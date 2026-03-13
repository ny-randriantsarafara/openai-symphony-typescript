import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Issue } from "@symphony/shared";
import {
  detectStalls,
  refreshTrackerStates,
  type RunningIssueInfo,
} from "../reconciliation.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeRunningIssueInfo(
  overrides: Partial<RunningIssueInfo>
): RunningIssueInfo {
  return {
    issueId: "issue-1",
    identifier: "P-1",
    startedAt: new Date("2025-03-14T10:00:00Z"),
    lastEventTimestamp: null,
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Issue> & { id: string; identifier: string; title: string; state: string }): Issue {
  return {
    id: overrides.id,
    identifier: overrides.identifier,
    title: overrides.title,
    description: null,
    priority: null,
    state: overrides.state,
    branchName: null,
    url: null,
    labels: [],
    blockedBy: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

// ─── Stall Detection Tests ────────────────────────────────────────────────────

describe("detectStalls", () => {
  it("detects stalled session (elapsed > stallTimeoutMs) and calls onStalled callback", () => {
    const onStalled = vi.fn();
    const now = new Date("2025-03-14T10:10:00Z"); // 10 min after start
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({
        issueId: "stalled-1",
        identifier: "P-1",
        startedAt: new Date("2025-03-14T10:00:00Z"),
        lastEventTimestamp: null,
      }),
    ];
    const stallTimeoutMs = 5 * 60 * 1000; // 5 min

    detectStalls(running, stallTimeoutMs, now, onStalled);

    expect(onStalled).toHaveBeenCalledTimes(1);
    expect(onStalled).toHaveBeenCalledWith("stalled-1");
  });

  it("skips stall detection when stallTimeoutMs <= 0", () => {
    const onStalled = vi.fn();
    const now = new Date("2025-03-14T12:00:00Z");
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({
        issueId: "issue-1",
        startedAt: new Date("2025-03-14T08:00:00Z"), // 4 hours ago
        lastEventTimestamp: null,
      }),
    ];

    detectStalls(running, 0, now, onStalled);
    expect(onStalled).not.toHaveBeenCalled();

    detectStalls(running, -100, now, onStalled);
    expect(onStalled).not.toHaveBeenCalled();
  });

  it("does not trigger when elapsed < stallTimeoutMs", () => {
    const onStalled = vi.fn();
    const now = new Date("2025-03-14T10:04:00Z"); // 4 min after start
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({
        issueId: "active-1",
        startedAt: new Date("2025-03-14T10:00:00Z"),
        lastEventTimestamp: null,
      }),
    ];
    const stallTimeoutMs = 5 * 60 * 1000; // 5 min

    detectStalls(running, stallTimeoutMs, now, onStalled);

    expect(onStalled).not.toHaveBeenCalled();
  });

  it("uses lastEventTimestamp when present for elapsed calculation", () => {
    const onStalled = vi.fn();
    const now = new Date("2025-03-14T10:10:00Z");
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({
        issueId: "with-event",
        startedAt: new Date("2025-03-14T09:00:00Z"),
        lastEventTimestamp: new Date("2025-03-14T10:02:00Z"), // 8 min since last event
      }),
    ];
    const stallTimeoutMs = 5 * 60 * 1000; // 5 min

    detectStalls(running, stallTimeoutMs, now, onStalled);

    expect(onStalled).toHaveBeenCalledTimes(1);
    expect(onStalled).toHaveBeenCalledWith("with-event");
  });

  it("does not trigger when lastEventTimestamp is recent", () => {
    const onStalled = vi.fn();
    const now = new Date("2025-03-14T10:10:00Z");
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({
        issueId: "recent-event",
        startedAt: new Date("2025-03-14T09:00:00Z"),
        lastEventTimestamp: new Date("2025-03-14T10:08:00Z"), // 2 min since last event
      }),
    ];
    const stallTimeoutMs = 5 * 60 * 1000; // 5 min

    detectStalls(running, stallTimeoutMs, now, onStalled);

    expect(onStalled).not.toHaveBeenCalled();
  });
});

// ─── Tracker State Refresh Tests ─────────────────────────────────────────────

describe("refreshTrackerStates", () => {
  const activeStates = ["Todo", "In Progress"];
  const terminalStates = ["Done", "Closed"];
  const callbacks = {
    onStalled: vi.fn(),
    onTerminal: vi.fn(),
    onNonActive: vi.fn(),
    onActiveUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("terminal state calls onTerminal", async () => {
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({ issueId: "i1", identifier: "P-1" }),
    ];
    const refreshed = [makeIssue({ id: "i1", identifier: "P-1", title: "T", state: "Done" })];
    const fetchStates = vi.fn().mockResolvedValue({ ok: true, value: refreshed });

    await refreshTrackerStates(
      running,
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );

    expect(callbacks.onTerminal).toHaveBeenCalledTimes(1);
    expect(callbacks.onTerminal).toHaveBeenCalledWith("i1");
    expect(callbacks.onActiveUpdate).not.toHaveBeenCalled();
    expect(callbacks.onNonActive).not.toHaveBeenCalled();
  });

  it("active state updates running entry via onActiveUpdate", async () => {
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({ issueId: "i1", identifier: "P-1" }),
    ];
    const refreshed = [
      makeIssue({
        id: "i1",
        identifier: "P-1",
        title: "Updated Title",
        state: "In Progress",
      }),
    ];
    const fetchStates = vi.fn().mockResolvedValue({ ok: true, value: refreshed });

    await refreshTrackerStates(
      running,
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );

    expect(callbacks.onActiveUpdate).toHaveBeenCalledTimes(1);
    expect(callbacks.onActiveUpdate).toHaveBeenCalledWith("i1", refreshed[0]);
    expect(callbacks.onTerminal).not.toHaveBeenCalled();
    expect(callbacks.onNonActive).not.toHaveBeenCalled();
  });

  it("non-active/non-terminal state calls onNonActive", async () => {
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({ issueId: "i1", identifier: "P-1" }),
    ];
    const refreshed = [
      makeIssue({ id: "i1", identifier: "P-1", title: "T", state: "Backlog" }),
    ];
    const fetchStates = vi.fn().mockResolvedValue({ ok: true, value: refreshed });

    await refreshTrackerStates(
      running,
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );

    expect(callbacks.onNonActive).toHaveBeenCalledTimes(1);
    expect(callbacks.onNonActive).toHaveBeenCalledWith("i1");
    expect(callbacks.onTerminal).not.toHaveBeenCalled();
    expect(callbacks.onActiveUpdate).not.toHaveBeenCalled();
  });

  it("no running issues is a no-op (does not call fetchStates)", async () => {
    const fetchStates = vi.fn();
    await refreshTrackerStates(
      [],
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );
    expect(fetchStates).not.toHaveBeenCalled();
    expect(callbacks.onTerminal).not.toHaveBeenCalled();
    expect(callbacks.onActiveUpdate).not.toHaveBeenCalled();
    expect(callbacks.onNonActive).not.toHaveBeenCalled();
  });

  it("tracker refresh failure: does not terminate workers (keeps them running)", async () => {
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({ issueId: "i1", identifier: "P-1" }),
    ];
    const fetchStates = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: "tracker_api_error", status: 500, message: "Server error" },
    });

    await refreshTrackerStates(
      running,
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );

    expect(callbacks.onTerminal).not.toHaveBeenCalled();
    expect(callbacks.onActiveUpdate).not.toHaveBeenCalled();
    expect(callbacks.onNonActive).not.toHaveBeenCalled();
  });

  it("state comparison is case-insensitive", async () => {
    const running: RunningIssueInfo[] = [
      makeRunningIssueInfo({ issueId: "i1", identifier: "P-1" }),
    ];
    const refreshed = [
      makeIssue({ id: "i1", identifier: "P-1", title: "T", state: "done" }),
    ];
    const fetchStates = vi.fn().mockResolvedValue({ ok: true, value: refreshed });

    await refreshTrackerStates(
      running,
      activeStates,
      terminalStates,
      fetchStates,
      callbacks
    );

    expect(callbacks.onTerminal).toHaveBeenCalledWith("i1");
  });
});
