import { describe, it, expect } from "vitest";
import { createRuntimeStore } from "../runtime/runtime-store.js";

describe("RuntimeStore", () => {
  it("records events and builds issue detail", () => {
    const store = createRuntimeStore({ workflowPath: "/tmp/WORKFLOW.md" });

    store.applySessionStarted({
      issueId: "issue-1",
      issueIdentifier: "MT-1",
      sessionId: "sess-1",
      workspacePath: "/tmp/MT-1",
      startedAt: "2026-03-16T00:00:00.000Z",
    });

    store.applySessionEvent({
      issueId: "issue-1",
      issueIdentifier: "MT-1",
      event: "turn_completed",
      message: "Done",
      timestamp: "2026-03-16T00:01:00.000Z",
      tokens: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });

    store.applyRetryScheduled({
      issueId: "issue-1",
      issueIdentifier: "MT-1",
      attempt: 2,
      dueAt: "2026-03-16T00:02:00.000Z",
      error: "boom",
    });

    const detail = store.getIssueDetail("MT-1");

    expect(detail).not.toBeNull();
    expect(detail?.workspace?.path).toBe("/tmp/MT-1");
    expect(detail?.attempts.restartCount).toBe(2);
    expect(detail?.lastError).toBe("boom");
    expect(detail?.recentEvents).toHaveLength(3);
  });

  it("tracks config validation status", () => {
    const store = createRuntimeStore({ workflowPath: "/tmp/WORKFLOW.md" });

    store.setConfigInvalid(
      {
        tracker: {
          kind: "linear",
          endpoint: "https://api.linear.app/graphql",
          apiKey: "secret",
          projectSlug: "proj",
          activeStates: ["Todo"],
          terminalStates: ["Done"],
        },
        polling: { intervalMs: 30000 },
        workspace: { root: "/tmp/workspaces" },
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
          maxConcurrentAgents: 2,
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
      },
      ["tracker.apiKey is required"]
    );

    const config = store.getConfig();

    expect(config.validationStatus).toBe("invalid");
    expect(config.validationErrors).toEqual(["tracker.apiKey is required"]);
    expect(config.config.tracker).not.toHaveProperty("apiKey");
  });

  it("preserves workspace info before provider session starts", () => {
    const store = createRuntimeStore({ workflowPath: "/tmp/WORKFLOW.md" });

    store.rememberWorkspace("issue-1", "MT-1", "/tmp/MT-1");

    const detail = store.getIssueDetail("MT-1");

    expect(detail).not.toBeNull();
    expect(detail?.workspace?.path).toBe("/tmp/MT-1");
  });
});
