import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { resolveConfig } from "../config-resolver";

describe("resolveConfig", () => {
  it("applies defaults when optional values are missing (empty config -> full ServiceConfig with all defaults)", () => {
    const config = resolveConfig({});
    expect(config.tracker.kind).toBeDefined();
    expect(config.tracker.endpoint).toBe("https://api.linear.app/graphql");
    expect(config.tracker.activeStates).toEqual(["Todo", "In Progress"]);
    expect(config.tracker.terminalStates).toEqual([
      "Closed",
      "Cancelled",
      "Canceled",
      "Duplicate",
      "Done",
    ]);
    expect(config.polling.intervalMs).toBe(30000);
    expect(config.workspace.root).toBe(
      `${tmpdir()}/symphony_workspaces`
    );
    expect(config.hooks.afterCreate).toBeNull();
    expect(config.hooks.beforeRun).toBeNull();
    expect(config.hooks.afterRun).toBeNull();
    expect(config.hooks.beforeRemove).toBeNull();
    expect(config.hooks.timeoutMs).toBe(60000);
    expect(config.agent.provider).toBe("codex");
    expect(config.agent.command).toBe("codex app-server");
    expect(config.agent.maxConcurrentAgents).toBe(10);
    expect(config.agent.maxTurns).toBe(20);
    expect(config.agent.maxRetryBackoffMs).toBe(300000);
    expect(config.agent.maxConcurrentAgentsByState).toEqual({});
    expect(config.codex.approvalPolicy).toBe("auto-edit");
    expect(config.codex.threadSandbox).toBe("none");
    expect(config.codex.turnSandboxPolicy).toBe("none");
    expect(config.codex.turnTimeoutMs).toBe(3600000);
    expect(config.codex.readTimeoutMs).toBe(5000);
    expect(config.codex.stallTimeoutMs).toBe(300000);
  });

  it("resolves $VAR_NAME to environment variable values for tracker.api_key", () => {
    const orig = process.env.MY_API_KEY;
    process.env.MY_API_KEY = "secret-key-123";
    try {
      const config = resolveConfig({
        tracker: { kind: "linear", project_slug: "P", api_key: "$MY_API_KEY" },
      });
      expect(config.tracker.apiKey).toBe("secret-key-123");
    } finally {
      if (orig !== undefined) process.env.MY_API_KEY = orig;
      else delete process.env.MY_API_KEY;
    }
  });

  it("treats empty $VAR resolution as empty string (missing)", () => {
    const orig = process.env.MISSING_VAR;
    delete process.env.MISSING_VAR;
    try {
      const config = resolveConfig({
        tracker: {
          kind: "linear",
          project_slug: "P",
          api_key: "$MISSING_VAR",
        },
      });
      expect(config.tracker.apiKey).toBe("");
    } finally {
      if (orig !== undefined) process.env.MISSING_VAR = orig;
    }
  });

  it("expands ~ in workspace.root to home directory", () => {
    const config = resolveConfig({
      workspace: { root: "~/my-symphony-works" },
    });
    expect(config.workspace.root).not.toContain("~");
    expect(config.workspace.root).toMatch(/^\/.+my-symphony-works$/);
  });

  it("preserves agent.command as shell string (no path expansion on it)", () => {
    const config = resolveConfig({
      agent: { command: "~/bin/codex app-server" },
    });
    expect(config.agent.command).toBe("~/bin/codex app-server");
  });

  it("coerces string integers to numbers (e.g., polling.interval_ms: \"60000\" -> 60000)", () => {
    const config = resolveConfig({
      polling: { interval_ms: "60000" },
    });
    expect(config.polling.intervalMs).toBe(60000);
    expect(typeof config.polling.intervalMs).toBe("number");
  });

  it("normalizes per-state concurrency map keys to lowercase", () => {
    const config = resolveConfig({
      agent: {
        max_concurrent_agents_by_state: {
          "In Progress": 3,
          Todo: 5,
        },
      },
    });
    expect(config.agent.maxConcurrentAgentsByState).toEqual({
      "in progress": 3,
      todo: 5,
    });
  });

  it("ignores invalid per-state concurrency values (non-positive or non-numeric)", () => {
    const config = resolveConfig({
      agent: {
        max_concurrent_agents_by_state: {
          todo: 2,
          "in progress": 0,
          done: -1,
          cancelled: "bad",
          invalid: null,
        },
      },
    });
    expect(config.agent.maxConcurrentAgentsByState).toEqual({
      todo: 2,
    });
  });

  it("uses explicit config values over defaults when provided", () => {
    const config = resolveConfig({
      tracker: {
        kind: "linear",
        project_slug: "MY-PROJ",
        endpoint: "https://custom.example.com/graphql",
        active_states: ["Backlog", "Doing"],
      },
      polling: { interval_ms: 60000 },
      workspace: { root: "/custom/workspace" },
      agent: { provider: "openai", max_turns: 50 },
      codex: { approval_policy: "manual" },
    });
    expect(config.tracker.endpoint).toBe(
      "https://custom.example.com/graphql"
    );
    expect(config.tracker.activeStates).toEqual(["Backlog", "Doing"]);
    expect(config.polling.intervalMs).toBe(60000);
    expect(config.workspace.root).toBe("/custom/workspace");
    expect(config.agent.provider).toBe("openai");
    expect(config.agent.maxTurns).toBe(50);
    expect(config.codex.approvalPolicy).toBe("manual");
  });
});
