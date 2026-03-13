import { homedir, tmpdir } from "node:os";
import type {
  ServiceConfig,
  TrackerConfig,
  PollingConfig,
  WorkspaceConfig,
  HooksConfig,
  AgentConfig,
  CodexConfig,
} from "@symphony/shared";

function safeRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveEnvVar(value: string): string {
  if (value.startsWith("$")) {
    const name = value.slice(1);
    const resolved = process.env[name];
    return resolved !== undefined ? resolved : "";
  }
  return value;
}

function expandPath(value: string): string {
  if (value.startsWith("~/") || value === "~") {
    return value.replace(/^~/, homedir());
  }
  return value;
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  return String(value);
}

function toStrArray(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) return fallback;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string") result.push(item);
  }
  return result.length > 0 ? result : fallback;
}

const TRACKER_ACTIVE_STATES_DEFAULT: readonly string[] = [
  "Todo",
  "In Progress",
];
const TRACKER_TERMINAL_STATES_DEFAULT: readonly string[] = [
  "Closed",
  "Cancelled",
  "Canceled",
  "Duplicate",
  "Done",
];

function resolveTracker(raw: Record<string, unknown>): TrackerConfig {
  const kind = toString(raw["kind"], "linear");
  const endpointDefault =
    kind === "linear"
      ? "https://api.linear.app/graphql"
      : "https://api.linear.app/graphql";
  const endpoint = expandPath(
    resolveEnvVar(toString(raw["endpoint"], endpointDefault))
  );
  const apiKeyRaw = toString(raw["api_key"], "");
  const apiKey = apiKeyRaw.startsWith("$")
    ? resolveEnvVar(apiKeyRaw)
    : apiKeyRaw;
  const projectSlug = toString(raw["project_slug"], "");

  return {
    kind,
    endpoint,
    apiKey,
    projectSlug,
    activeStates: toStrArray(raw["active_states"], TRACKER_ACTIVE_STATES_DEFAULT),
    terminalStates: toStrArray(
      raw["terminal_states"],
      TRACKER_TERMINAL_STATES_DEFAULT
    ),
  };
}

function resolvePolling(raw: Record<string, unknown>): PollingConfig {
  return {
    intervalMs: toInteger(raw["interval_ms"], 30000),
  };
}

function resolveWorkspace(raw: Record<string, unknown>): WorkspaceConfig {
  const rootRaw = toString(
    raw["root"],
    `${tmpdir()}/symphony_workspaces`
  );
  const root = expandPath(rootRaw);
  return { root };
}

function resolveHooks(raw: Record<string, unknown>): HooksConfig {
  return {
    afterCreate: toStringOrNull(raw["after_create"]),
    beforeRun: toStringOrNull(raw["before_run"]),
    afterRun: toStringOrNull(raw["after_run"]),
    beforeRemove: toStringOrNull(raw["before_remove"]),
    timeoutMs: toInteger(raw["timeout_ms"], 60000),
  };
}

function resolveMaxConcurrentAgentsByState(
  raw: unknown
): Record<string, number> {
  const obj = safeRecord(raw);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase();
    const num = toInteger(value, 0);
    if (num > 0) {
      result[normalizedKey] = num;
    }
  }
  return result;
}

function resolveAgent(raw: Record<string, unknown>): AgentConfig {
  return {
    provider: toString(raw["provider"], "codex"),
    command: toString(raw["command"], "codex app-server"),
    maxConcurrentAgents: toInteger(raw["max_concurrent_agents"], 10),
    maxTurns: toInteger(raw["max_turns"], 20),
    maxRetryBackoffMs: toInteger(raw["max_retry_backoff_ms"], 300000),
    maxConcurrentAgentsByState: resolveMaxConcurrentAgentsByState(
      raw["max_concurrent_agents_by_state"]
    ),
  };
}

function resolveCodex(raw: Record<string, unknown>): CodexConfig {
  return {
    approvalPolicy: toString(raw["approval_policy"], "auto-edit"),
    threadSandbox: toString(raw["thread_sandbox"], "none"),
    turnSandboxPolicy: toString(raw["turn_sandbox_policy"], "none"),
    turnTimeoutMs: toInteger(raw["turn_timeout_ms"], 3600000),
    readTimeoutMs: toInteger(raw["read_timeout_ms"], 5000),
    stallTimeoutMs: toInteger(raw["stall_timeout_ms"], 300000),
  };
}

export function resolveConfig(rawConfig: Record<string, unknown>): ServiceConfig {
  const trackerRaw = safeRecord(rawConfig["tracker"]);
  const pollingRaw = safeRecord(rawConfig["polling"]);
  const workspaceRaw = safeRecord(rawConfig["workspace"]);
  const hooksRaw = safeRecord(rawConfig["hooks"]);
  const agentRaw = safeRecord(rawConfig["agent"]);
  const codexRaw = safeRecord(rawConfig["codex"]);

  return {
    tracker: resolveTracker(trackerRaw),
    polling: resolvePolling(pollingRaw),
    workspace: resolveWorkspace(workspaceRaw),
    hooks: resolveHooks(hooksRaw),
    agent: resolveAgent(agentRaw),
    codex: resolveCodex(codexRaw),
  };
}
