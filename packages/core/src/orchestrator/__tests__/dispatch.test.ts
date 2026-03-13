import { describe, it, expect } from "vitest";
import type { Issue, ServiceConfig } from "@symphony/shared";
import {
  sortForDispatch,
  isEligibleForDispatch,
  availableGlobalSlots,
  availableStateSlots,
} from "../dispatch.js";
import type { OrchestratorState } from "../state.js";
import { createInitialState } from "../state.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<ServiceConfig["agent"]>): ServiceConfig {
  return {
    tracker: {
      kind: "linear",
      endpoint: "https://api.linear.app/graphql",
      apiKey: "sk-abc",
      projectSlug: "PROJ",
      activeStates: ["Todo", "In Progress"],
      terminalStates: ["Done", "Closed"],
    },
    polling: { intervalMs: 30000 },
    workspace: { root: "/tmp" },
    hooks: {
      afterCreate: null,
      beforeRun: null,
      afterRun: null,
      beforeRemove: null,
      timeoutMs: 60000,
    },
    agent: {
      provider: "codex",
      command: "codex app",
      maxConcurrentAgents: 3,
      maxTurns: 20,
      maxRetryBackoffMs: 300000,
      maxConcurrentAgentsByState: { todo: 1, "in progress": 2 },
      ...overrides,
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

function makeIssue(
  overrides: Partial<Issue> & {
    id: string;
    identifier: string;
    title: string;
    state: string;
  }
): Issue {
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

function makeRunningEntry(
  issueId: string,
  identifier: string,
  state: string
): { issueId: string; identifier: string; issue: Issue; sessionId: string | null; startedAt: Date; liveSession: null; retryAttempt: null } {
  return {
    issueId,
    identifier,
    issue: makeIssue({ id: issueId, identifier, title: "Issue", state }),
    sessionId: null,
    startedAt: new Date(),
    liveSession: null,
    retryAttempt: null,
  };
}

function makeState(overrides?: Partial<OrchestratorState>): OrchestratorState {
  const initial = createInitialState();
  return { ...initial, ...overrides };
}

// ─── Sort Tests ───────────────────────────────────────────────────────────────

describe("sortForDispatch", () => {
  it("sorts by priority ascending (1, 2, 3, 4, null last)", () => {
    const issues: Issue[] = [
      makeIssue({ id: "a", identifier: "A", title: "A", state: "Todo", priority: 4 }),
      makeIssue({ id: "b", identifier: "B", title: "B", state: "Todo", priority: 1 }),
      makeIssue({ id: "c", identifier: "C", title: "C", state: "Todo", priority: null }),
      makeIssue({ id: "d", identifier: "D", title: "D", state: "Todo", priority: 2 }),
      makeIssue({ id: "e", identifier: "E", title: "E", state: "Todo", priority: 3 }),
    ];
    const sorted = sortForDispatch(issues);
    expect(sorted.map((i) => i.priority)).toEqual([1, 2, 3, 4, null]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("sorts by oldest createdAt first when same priority", () => {
    const issues: Issue[] = [
      makeIssue({ id: "a", identifier: "A", title: "A", state: "Todo", priority: 1, createdAt: "2025-03-15T10:00:00Z" }),
      makeIssue({ id: "b", identifier: "B", title: "B", state: "Todo", priority: 1, createdAt: "2025-03-14T10:00:00Z" }),
      makeIssue({ id: "c", identifier: "C", title: "C", state: "Todo", priority: 1, createdAt: "2025-03-16T10:00:00Z" }),
    ];
    const sorted = sortForDispatch(issues);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("uses identifier as tie-breaker when same priority and createdAt", () => {
    const ts = "2025-03-15T10:00:00Z";
    const issues: Issue[] = [
      makeIssue({ id: "3", identifier: "PROJ-3", title: "Three", state: "Todo", priority: 1, createdAt: ts }),
      makeIssue({ id: "1", identifier: "PROJ-1", title: "One", state: "Todo", priority: 1, createdAt: ts }),
      makeIssue({ id: "2", identifier: "PROJ-2", title: "Two", state: "Todo", priority: 1, createdAt: ts }),
    ];
    const sorted = sortForDispatch(issues);
    expect(sorted.map((i) => i.identifier)).toEqual(["PROJ-1", "PROJ-2", "PROJ-3"]);
  });
});

// ─── Blocker Rule Tests ────────────────────────────────────────────────────────

describe("isEligibleForDispatch - blocker rule", () => {
  const config = makeConfig();

  it("Todo issue with non-terminal blockers is NOT eligible", () => {
    const issue = makeIssue({
      id: "1",
      identifier: "P-1",
      title: "Blocked",
      state: "Todo",
      blockedBy: [{ id: "b1", identifier: "P-0", state: "In Progress" }],
    });
    const state = makeState();
    expect(isEligibleForDispatch(issue, state, config)).toBe(false);
  });

  it("Todo issue with all-terminal blockers IS eligible", () => {
    const issue = makeIssue({
      id: "1",
      identifier: "P-1",
      title: "Unblocked",
      state: "Todo",
      blockedBy: [{ id: "b1", identifier: "P-0", state: "Done" }],
    });
    const state = makeState();
    expect(isEligibleForDispatch(issue, state, config)).toBe(true);
  });
});

// ─── Concurrency Tests ────────────────────────────────────────────────────────

describe("availableGlobalSlots and availableStateSlots", () => {
  it("respects global concurrency limit", () => {
    const config = makeConfig({ maxConcurrentAgents: 3 });
    const emptyState = makeState({ running: new Map() });
    expect(availableGlobalSlots(emptyState, config)).toBe(3);

    const twoRunning = makeState({
      running: new Map([
        ["a", makeRunningEntry("a", "A", "Todo")],
        ["b", makeRunningEntry("b", "B", "Todo")],
      ]),
    });
    expect(availableGlobalSlots(twoRunning, config)).toBe(1);

    const threeRunning = makeState({
      running: new Map([
        ["a", makeRunningEntry("a", "A", "Todo")],
        ["b", makeRunningEntry("b", "B", "Todo")],
        ["c", makeRunningEntry("c", "C", "Todo")],
      ]),
    });
    expect(availableGlobalSlots(threeRunning, config)).toBe(0);
  });

  it("respects per-state concurrency limits", () => {
    const config = makeConfig({
      maxConcurrentAgents: 10,
      maxConcurrentAgentsByState: { todo: 1, "in progress": 2 },
    });
    const emptyState = makeState({ running: new Map() });
    expect(availableStateSlots("Todo", emptyState, config)).toBe(1);
    expect(availableStateSlots("In Progress", emptyState, config)).toBe(2);
    expect(availableStateSlots("Unknown", emptyState, config)).toBe(10);

    const oneTodoRunning = makeState({
      running: new Map([["a", makeRunningEntry("a", "A", "Todo")]]),
    });
    expect(availableStateSlots("Todo", oneTodoRunning, config)).toBe(0);
    expect(availableStateSlots("In Progress", oneTodoRunning, config)).toBe(2);
  });
});

// ─── Running / Claimed Exclusion Tests ─────────────────────────────────────────

describe("isEligibleForDispatch - running and claimed", () => {
  const config = makeConfig();

  it("issue already in running map is not eligible", () => {
    const issue = makeIssue({ id: "1", identifier: "P-1", title: "Running", state: "Todo" });
    const state = makeState({
      running: new Map([
        ["1", { ...makeRunningEntry("1", "P-1", "Todo"), issue, sessionId: "s1" }],
      ]),
    });
    expect(isEligibleForDispatch(issue, state, config)).toBe(false);
  });

  it("issue already in claimed set is not eligible", () => {
    const issue = makeIssue({ id: "1", identifier: "P-1", title: "Claimed", state: "Todo" });
    const state = makeState({ claimed: new Set(["1"]) });
    expect(isEligibleForDispatch(issue, state, config)).toBe(false);
  });
});

// ─── Required Fields Tests ────────────────────────────────────────────────────

describe("isEligibleForDispatch - required fields", () => {
  const config = makeConfig();

  it("candidate missing required fields is not eligible", () => {
    const validIssue = makeIssue({ id: "1", identifier: "P-1", title: "Ok", state: "Todo" });
    expect(isEligibleForDispatch(validIssue, makeState(), config)).toBe(true);

    const noId = { ...validIssue, id: "" } as Issue;
    expect(isEligibleForDispatch(noId, makeState(), config)).toBe(false);

    const noIdentifier = { ...validIssue, identifier: "" } as Issue;
    expect(isEligibleForDispatch(noIdentifier, makeState(), config)).toBe(false);

    const noTitle = { ...validIssue, title: "" } as Issue;
    expect(isEligibleForDispatch(noTitle, makeState(), config)).toBe(false);

    const noState = { ...validIssue, state: "" } as Issue;
    expect(isEligibleForDispatch(noState, makeState(), config)).toBe(false);
  });
});
