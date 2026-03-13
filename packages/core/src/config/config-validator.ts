import type { ServiceConfig, SymphonyError, Result } from "@symphony/shared";

const SUPPORTED_TRACKER_KINDS: readonly string[] = ["linear"];

export function validateConfig(config: ServiceConfig): Result<void, SymphonyError> {
  const errors: string[] = [];

  if (!config.tracker.kind) {
    errors.push("tracker.kind is required");
  } else if (!SUPPORTED_TRACKER_KINDS.includes(config.tracker.kind)) {
    errors.push(`unsupported tracker.kind: ${config.tracker.kind}`);
  }

  if (!config.tracker.apiKey) {
    errors.push("tracker.apiKey is required");
  }

  if (config.tracker.kind === "linear" && !config.tracker.projectSlug) {
    errors.push("tracker.projectSlug is required for linear tracker");
  }

  if (!config.agent.command) {
    errors.push("agent.command is required");
  }

  if (errors.length > 0) {
    return { ok: false, error: { kind: "config_validation_failed", errors } };
  }

  return { ok: true, value: undefined };
}
