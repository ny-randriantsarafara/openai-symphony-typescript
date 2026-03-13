import { homedir, tmpdir } from "node:os";
import type { ServiceConfig } from "@symphony/shared";

function resolveEnvVar(value: string): string {
  if (value.startsWith("$")) {
    const key = value.slice(1);
    const env = process.env[key];
    return env !== undefined ? env : "";
  }
  return value;
}

function expandPath(value: string): string {
  if (value.startsWith("~")) {
    return homedir() + value.slice(1);
  }
  return value;
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normalizeMaxConcurrentAgentsByState(
  value: unknown
): Record<string, number> {
  const obj = safeRecord(value);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    const num = toInteger(v, -1);
    if (num > 0) {
      result[key] = num;
    }
  }
  return result;
}

export function resolveConfig(rawConfig: Record<string, unknown>): ServiceConfig {
  const trackerRaw = safeRecord(rawConfig["tracker"]);
  const pollingRaw = safeRecord(rawConfig["polling"]);
  const workspaceRaw = safeRecord(rawConfig["workspace"]);
  const hooksRaw = safeRecord(rawConfig["hooks"]);
  const agentRaw = safeRecord(rawConfig["agent"]);
  const codexRaw = safeRecord(rawConfig["codex"]);

  const kind = toString(trackerRaw["kind"]) || "linear";
  const apiKeyRaw = toString(trackerRaw["api_key"]);
  const apiKeyResolved =
    apiKeyRaw || (kind === "linear" ? resolveEnvVar("$LINEAR_API_KEY") : "");
  const apiKey = apiKeyRaw.startsWith("$")
    ? resolveEnvVar(apiKeyRaw)
    : apiKeyResolved;

  const tracker = {
    kind,
    endpoint:
      toString(trackerRaw["endpoint"]) ||
      (kind === "linear" ? "https://api.linear.app/graphql" : ""),
    apiKey,
    projectSlug: toString(trackerRaw["project_slug"]),
    activeStates: toStringArray(trackerRaw["active_states"]).length
      ? toStringArray(trackerRaw["active_states"])
      : ["Todo", "In Progress"],
    terminalStates: toStringArray(trackerRaw["terminal_states"]).length
      ? toStringArray(trackerRaw["terminal_states"])
      : [
          "Closed",
          "Cancelled",
          "Canceled",
          "Duplicate",
          "Done",
        ],
  };

  const workspaceRootRaw = toString(workspaceRaw["root"]);
  const workspaceRoot = workspaceRootRaw
    ? expandPath(workspaceRootRaw)
    : `${tmpdir()}/symphony_workspaces`;

  return {
    tracker,
    polling: {
      intervalMs: toInteger(pollingRaw["interval_ms"], 30000),
    },
    workspace: {
      root: workspaceRoot,
    },
    hooks: {
      afterCreate: toStringOrNull(hooksRaw["after_create"]),
      beforeRun: toStringOrNull(hooksRaw["before_run"]),
      afterRun: toStringOrNull(hooksRaw["after_run"]),
      beforeRemove: toStringOrNull(hooksRaw["before_remove"]),
      timeoutMs: toInteger(hooksRaw["timeout_ms"], 60000),
    },
    agent: {
      provider: toString(agentRaw["provider"]) || "codex",
      command: toString(agentRaw["command"]) || "codex app-server",
      maxConcurrentAgents: toInteger(agentRaw["max_concurrent_agents"], 10),
      maxTurns: toInteger(agentRaw["max_turns"], 20),
      maxRetryBackoffMs: toInteger(agentRaw["max_retry_backoff_ms"], 300000),
      maxConcurrentAgentsByState: Object.keys(
        safeRecord(agentRaw["max_concurrent_agents_by_state"])
      ).length
        ? normalizeMaxConcurrentAgentsByState(
            agentRaw["max_concurrent_agents_by_state"]
          )
        : {},
    },
    codex: {
      approvalPolicy: toString(codexRaw["approval_policy"]) || "auto-edit",
      threadSandbox: toString(codexRaw["thread_sandbox"]) || "none",
      turnSandboxPolicy: toString(codexRaw["turn_sandbox_policy"]) || "none",
      turnTimeoutMs: toInteger(codexRaw["turn_timeout_ms"], 3600000),
      readTimeoutMs: toInteger(codexRaw["read_timeout_ms"], 5000),
      stallTimeoutMs: toInteger(codexRaw["stall_timeout_ms"], 300000),
    },
  };
}
