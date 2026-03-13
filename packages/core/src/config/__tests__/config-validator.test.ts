import { describe, it, expect } from "vitest";
import type { ServiceConfig } from "@symphony/shared";
import { validateConfig } from "../config-validator";

function makeValidConfig(): ServiceConfig {
  return {
    tracker: {
      kind: "linear",
      endpoint: "https://api.linear.app/graphql",
      apiKey: "sk-abc123",
      projectSlug: "MY-PROJ",
      activeStates: ["Todo", "In Progress"],
      terminalStates: ["Closed", "Done"],
    },
    polling: { intervalMs: 30000 },
    workspace: { root: "/tmp/symphony_workspaces" },
    hooks: {
      afterCreate: null,
      beforeRun: null,
      afterRun: null,
      beforeRemove: null,
      timeoutMs: 60000,
    },
    agent: {
      provider: "codex",
      command: "codex app-server",
      maxConcurrentAgents: 10,
      maxTurns: 20,
      maxRetryBackoffMs: 300000,
      maxConcurrentAgentsByState: {},
    },
    codex: {
      approvalPolicy: "auto-edit",
      threadSandbox: "none",
      turnSandboxPolicy: "none",
      turnTimeoutMs: 3600000,
      readTimeoutMs: 5000,
      stallTimeoutMs: 300000,
    },
  };
}

describe("validateConfig", () => {
  it("valid config passes validation (returns { ok: true })", () => {
    const result = validateConfig(makeValidConfig());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("missing/empty tracker.kind fails with config_validation_failed", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      tracker: { ...config.tracker, kind: "" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain("tracker.kind is required");
    }
  });

  it("unsupported tracker.kind (e.g., jira) fails with config_validation_failed", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      tracker: { ...config.tracker, kind: "jira" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain("unsupported tracker.kind: jira");
    }
  });

  it("missing/empty tracker.apiKey fails with config_validation_failed", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      tracker: { ...config.tracker, apiKey: "" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain("tracker.apiKey is required");
    }
  });

  it("missing/empty tracker.projectSlug (when kind=linear) fails with config_validation_failed", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      tracker: { ...config.tracker, projectSlug: "" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain(
        "tracker.projectSlug is required for linear tracker"
      );
    }
  });

  it("missing/empty agent.command fails with config_validation_failed", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      agent: { ...config.agent, command: "" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain("agent.command is required");
    }
  });

  it("multiple validation errors are collected (not just first one)", () => {
    const config = makeValidConfig();
    const invalid = {
      ...config,
      tracker: {
        ...config.tracker,
        kind: "linear",
        apiKey: "",
        projectSlug: "",
      },
      agent: { ...config.agent, command: "" },
    };
    const result = validateConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config_validation_failed");
      expect(result.error.errors).toContain("tracker.apiKey is required");
      expect(result.error.errors).toContain(
        "tracker.projectSlug is required for linear tracker"
      );
      expect(result.error.errors).toContain("agent.command is required");
      expect(result.error.errors).toHaveLength(3);
    }
  });
});
