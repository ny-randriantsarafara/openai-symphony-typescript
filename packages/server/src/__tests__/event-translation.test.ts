import { describe, it, expect } from "vitest";
import {
  createPendingSessionTracker,
  createAgentMessage,
  createOrchestratorMessage,
} from "../runtime/event-translation.js";

describe("event translation", () => {
  it("turns orchestrator retry events into websocket messages", () => {
    const tracker = createPendingSessionTracker();
    const message = createOrchestratorMessage(
      {
        type: "retry:scheduled",
        issueId: "issue-1",
        issueIdentifier: "MT-1",
        attempt: 2,
        dueAt: "2026-03-16T00:02:00.000Z",
        error: "boom",
      },
      tracker,
      "2026-03-16T00:00:00.000Z"
    );

    expect(message).toEqual({
      type: "retry:scheduled",
      issueId: "issue-1",
      issueIdentifier: "MT-1",
      attempt: 2,
      dueAt: "2026-03-16T00:02:00.000Z",
      error: "boom",
    });
  });

  it("uses pending workspace info when an agent session starts", () => {
    const tracker = createPendingSessionTracker();

    createOrchestratorMessage(
      {
        type: "session:started",
        issueId: "issue-1",
        issueIdentifier: "MT-1",
        sessionId: "",
        workspacePath: "/tmp/MT-1",
      },
      tracker,
      "2026-03-16T00:00:00.000Z"
    );

    const message = createAgentMessage(
      { id: "issue-1", identifier: "MT-1" },
      {
        type: "session_started",
        sessionId: "sess-1",
        threadId: "thread-1",
        turnId: "turn-1",
      },
      tracker,
      "2026-03-16T00:00:01.000Z"
    );

    expect(message).toEqual({
      type: "session:started",
      issueId: "issue-1",
      issueIdentifier: "MT-1",
      sessionId: "sess-1",
      workspacePath: "/tmp/MT-1",
      startedAt: "2026-03-16T00:00:01.000Z",
    });
  });
});
