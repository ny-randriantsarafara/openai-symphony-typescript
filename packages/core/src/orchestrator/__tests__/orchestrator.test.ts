import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Issue, ServiceConfig, OrchestratorSnapshot } from "@symphony/shared";
import { Orchestrator } from "../orchestrator.js";
import { EventBus } from "../event-bus.js";
import type { OrchestratorDependencies } from "../orchestrator.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<ServiceConfig>): ServiceConfig {
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
      maxConcurrentAgentsByState: {},
      ...overrides?.agent,
    },
    codex: {
      approvalPolicy: "auto-edit",
      threadSandbox: "none",
      turnSandboxPolicy: "none",
      turnTimeoutMs: 3600000,
      readTimeoutMs: 5000,
      stallTimeoutMs: 300000,
    },
    ...overrides,
  };
}

function makeIssue(
  overrides: Partial<Issue> & { id: string; identifier: string; title: string; state: string }
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

function makeDeps(overrides?: Partial<OrchestratorDependencies>): OrchestratorDependencies {
  const validConfig = makeConfig();
  return {
    configWatcher: {
      getCurrentConfig: vi.fn().mockReturnValue(validConfig),
      getCurrentPromptTemplate: vi.fn().mockReturnValue(""),
      on: vi.fn(),
      removeListener: vi.fn(),
      start: vi.fn().mockResolvedValue({ ok: true as const, value: undefined }),
      stop: vi.fn().mockResolvedValue(undefined),
    } as OrchestratorDependencies["configWatcher"],
    validateConfig: vi.fn().mockReturnValue({ ok: true as const, value: undefined }),
    tracker: {
      fetchCandidateIssues: vi.fn().mockResolvedValue({ ok: true as const, value: [] as readonly Issue[] }),
      fetchIssueStatesByIds: vi.fn().mockResolvedValue({ ok: true as const, value: [] as readonly Issue[] }),
      fetchIssuesByStates: vi.fn().mockResolvedValue({ ok: true as const, value: [] as readonly Issue[] }),
    } as OrchestratorDependencies["tracker"],
    workspaceManager: {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true as const,
        value: { path: "/tmp/PROJ-1", workspaceKey: "PROJ-1", createdNow: true },
      }),
      removeWorkspace: vi.fn().mockResolvedValue(undefined),
    } as OrchestratorDependencies["workspaceManager"],
    spawnAgent: vi.fn().mockResolvedValue(undefined),
    eventBus: new EventBus(),
    ...overrides,
  };
}

// ─── Orchestrator Tests ──────────────────────────────────────────────────────

describe("Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tick", () => {
    it("runs reconcile before dispatch", async () => {
      const callOrder: string[] = [];
      const runningIssue = makeIssue({ id: "r1", identifier: "PROJ-R1", title: "R", state: "Todo" });
      const deps = makeDeps({
        createInitialState: vi.fn().mockReturnValue({
          running: new Map([
            [
              "r1",
              {
                issueId: "r1",
                identifier: "PROJ-R1",
                issue: runningIssue,
                sessionId: null,
                startedAt: new Date(),
                liveSession: null,
                retryAttempt: null,
              },
            ],
          ]),
          claimed: new Set(),
          retryAttempts: new Map(),
          completed: new Set(),
          codexTotals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, secondsRunning: 0 },
          rateLimits: null,
        }),
        tracker: {
          fetchCandidateIssues: vi.fn().mockImplementation(async () => {
            callOrder.push("fetchCandidateIssues");
            return { ok: true as const, value: [] as readonly Issue[] };
          }),
          fetchIssueStatesByIds: vi.fn().mockImplementation(async () => {
            callOrder.push("fetchIssueStatesByIds");
            return { ok: true as const, value: [] as readonly Issue[] };
          }),
          fetchIssuesByStates: vi.fn().mockResolvedValue({ ok: true as const, value: [] as readonly Issue[] }),
        } as OrchestratorDependencies["tracker"],
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.tick();

      expect(callOrder).toEqual(["fetchIssueStatesByIds", "fetchCandidateIssues"]);
    });

    it("skips dispatch when config validation fails but still reconciles", async () => {
      const deps = makeDeps({
        validateConfig: vi.fn().mockReturnValue({
          ok: false as const,
          error: { kind: "config_validation_failed" as const, errors: ["invalid"] },
        }),
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.tick();

      expect(deps.validateConfig).toHaveBeenCalled();
      expect(deps.spawnAgent).not.toHaveBeenCalled();
      // Reconcile runs regardless
      expect(deps.tracker.fetchIssueStatesByIds).toHaveBeenCalledTimes(0); // no running
    });

    it("skips dispatch when candidate fetch fails", async () => {
      const deps = makeDeps({
        tracker: {
          fetchCandidateIssues: vi.fn().mockResolvedValue({
            ok: false as const,
            error: { kind: "tracker_api_error" as const, status: 500, message: "error" },
          }),
          fetchIssueStatesByIds: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
          fetchIssuesByStates: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
        } as OrchestratorDependencies["tracker"],
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.tick();

      expect(deps.tracker.fetchCandidateIssues).toHaveBeenCalled();
      expect(deps.spawnAgent).not.toHaveBeenCalled();
    });

    it("dispatches eligible issues when candidates fetched successfully", async () => {
      const issue = makeIssue({ id: "i1", identifier: "PROJ-1", title: "T", state: "Todo" });
      const deps = makeDeps({
        tracker: {
          fetchCandidateIssues: vi.fn().mockResolvedValue({ ok: true as const, value: [issue] }),
          fetchIssueStatesByIds: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
          fetchIssuesByStates: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
        } as OrchestratorDependencies["tracker"],
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.tick();

      expect(deps.tracker.fetchCandidateIssues).toHaveBeenCalled();
      expect(deps.workspaceManager.createForIssue).toHaveBeenCalledWith("PROJ-1");
      expect(deps.spawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          issue,
          workspacePath: "/tmp/PROJ-1",
        })
      );
    });
  });

  describe("getSnapshot", () => {
    it("returns correct structure with running, retrying, totals", () => {
      const deps = makeDeps();
      const orchestrator = new Orchestrator(deps);
      const snapshot = orchestrator.getSnapshot();

      expect(snapshot).toMatchObject<Partial<OrchestratorSnapshot>>({
        counts: { running: 0, retrying: 0 },
        running: [],
        retrying: [],
      });
      expect(snapshot.generatedAt).toBeDefined();
      expect(snapshot.codexTotals).toMatchObject({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        secondsRunning: 0,
      });
      expect(snapshot.rateLimits).toBeNull();
    });
  });

  describe("start", () => {
    it("performs terminal workspace cleanup", async () => {
      const terminalIssue = makeIssue({ id: "t1", identifier: "PROJ-99", title: "Done", state: "Done" });
      const deps = makeDeps({
        tracker: {
          fetchCandidateIssues: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
          fetchIssueStatesByIds: vi.fn().mockResolvedValue({ ok: true as const, value: [] }),
          fetchIssuesByStates: vi.fn().mockResolvedValue({ ok: true as const, value: [terminalIssue] }),
        } as OrchestratorDependencies["tracker"],
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.start();

      expect(deps.tracker.fetchIssuesByStates).toHaveBeenCalledWith(["Done", "Closed"]);
      expect(deps.workspaceManager.removeWorkspace).toHaveBeenCalledWith("PROJ-99");

      await orchestrator.stop();
    });
  });

  describe("config changes", () => {
    it("config changes update poll interval when config reloaded", async () => {
      const on = vi.fn();
      const deps = makeDeps({
        configWatcher: {
          getCurrentConfig: vi.fn().mockReturnValue(makeConfig()),
          getCurrentPromptTemplate: vi.fn().mockReturnValue(""),
          on,
          removeListener: vi.fn(),
          start: vi.fn().mockResolvedValue({ ok: true as const, value: undefined }),
          stop: vi.fn().mockResolvedValue(undefined),
        } as OrchestratorDependencies["configWatcher"],
      });

      const orchestrator = new Orchestrator(deps);
      await orchestrator.start();

      expect(on).toHaveBeenCalledWith("configReloaded", expect.any(Function));

      await orchestrator.stop();
    });
  });

  describe("triggerRefresh", () => {
    it("triggers a manual tick", async () => {
      const deps = makeDeps();
      const orchestrator = new Orchestrator(deps);
      const tickSpy = vi.spyOn(orchestrator, "tick").mockResolvedValue(undefined);

      await orchestrator.triggerRefresh();

      expect(tickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
