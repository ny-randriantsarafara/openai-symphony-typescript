import { describe, expect, it, vi } from "vitest";
import {
  runAgentAttempt,
  type RunAttemptParams,
  type RunAttemptDependencies,
} from "../runner.js";
import type { Issue, ServiceConfig, SymphonyError, Result } from "@symphony/shared";

const CONTRIBUTION_PROMPT = "Continue working on this issue. Pick up where you left off.";

function createMinimalConfig(overrides?: Partial<ServiceConfig>): ServiceConfig {
  return {
    tracker: {
      kind: "linear",
      endpoint: "https://api.linear.app/graphql",
      apiKey: "test",
      projectSlug: "test",
      activeStates: ["Todo", "In Progress"],
      terminalStates: ["Done"],
    },
    polling: { intervalMs: 30000 },
    workspace: { root: "/tmp/ws" },
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
      maxConcurrentAgents: 5,
      maxTurns: 3,
      maxRetryBackoffMs: 300000,
      maxConcurrentAgentsByState: {},
    },
    codex: {
      approvalPolicy: "auto-edit",
      threadSandbox: "none",
      turnSandboxPolicy: "none",
      turnTimeoutMs: 60000,
      readTimeoutMs: 500,
      stallTimeoutMs: 300000,
    },
    ...overrides,
  } as ServiceConfig;
}

function createMinimalIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: "issue-1",
    identifier: "SYM-1",
    title: "Test",
    description: null,
    priority: null,
    state: "Todo",
    branchName: null,
    url: null,
    labels: [],
    blockedBy: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

describe("runAgentAttempt", () => {
  it("creates workspace, runs before_run hook, starts session, runs turn", async () => {
    const events: unknown[] = [];
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
      runAfterRun: vi.fn().mockResolvedValue(undefined),
    };

    const session = {
      sessionId: "s1",
      threadId: "t1",
      runTurn: vi.fn().mockReturnValue(
        createAsyncIterable([
          { type: "session_started" as const, sessionId: "s1", threadId: "t1", turnId: "u1" },
          { type: "turn_completed" as const, inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        ])
      ),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const agentProvider = {
      name: "codex",
      startSession: vi.fn().mockResolvedValue(session),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: true,
      value: "Full prompt for issue",
    } as Result<string, SymphonyError>);

    const refreshIssueState = vi.fn().mockResolvedValue({
      ok: true,
      value: createMinimalIssue({ state: "Done" }),
    } as Result<Issue | null, SymphonyError>);

    const onEvent = vi.fn((e: unknown) => events.push(e));

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "Template",
      config: createMinimalConfig(),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: agentProvider as unknown as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState,
      onEvent,
    };

    const result = await runAgentAttempt(params, deps);

    expect(workspaceManager.createForIssue).toHaveBeenCalledWith("SYM-1");
    expect(workspaceManager.runBeforeRun).toHaveBeenCalledWith("/tmp/ws/SYM-1");
    expect(renderPrompt).toHaveBeenCalledWith("Template", params.issue, 1);
    expect(agentProvider.startSession).toHaveBeenCalledWith({
      workspacePath: "/tmp/ws/SYM-1",
      config: params.config,
    });
    expect(session.runTurn).toHaveBeenCalledWith({
      prompt: "Full prompt for issue",
      issue: params.issue,
      turnNumber: 1,
      isFirstTurn: true,
    });
    expect(session.stop).toHaveBeenCalled();
    expect(workspaceManager.runAfterRun).toHaveBeenCalledWith("/tmp/ws/SYM-1");
    expect(result.success).toBe(true);
    expect(result.turnCount).toBe(1);
    expect(result.error).toBeNull();
  });

  it("multi-turn: continues on same thread when issue remains active", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
      runAfterRun: vi.fn().mockResolvedValue(undefined),
    };

    const turnCalls: { prompt: string; turnNumber: number; isFirstTurn: boolean }[] = [];
    const session = {
      sessionId: "s1",
      threadId: "t1",
      runTurn: vi.fn().mockImplementation((params: { prompt: string; turnNumber: number; isFirstTurn: boolean }) => {
        turnCalls.push({ prompt: params.prompt, turnNumber: params.turnNumber, isFirstTurn: params.isFirstTurn });
        return createAsyncIterable([
          { type: "session_started" as const, sessionId: "s1", threadId: "t1", turnId: "u1" },
          { type: "turn_completed" as const, inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        ]);
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const agentProvider = {
      name: "codex",
      startSession: vi.fn().mockResolvedValue(session),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: true,
      value: "Full prompt",
    } as Result<string, SymphonyError>);

    let refreshCallCount = 0;
    const refreshIssueState = vi.fn().mockImplementation(() => {
      refreshCallCount++;
      return Promise.resolve({
        ok: true,
        value: createMinimalIssue({ state: refreshCallCount < 2 ? "In Progress" : "Done" }),
      } as Result<Issue | null, SymphonyError>);
    });

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: null,
      promptTemplate: "T",
      config: createMinimalConfig({ agent: { ...createMinimalConfig().agent, maxTurns: 3 } }),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: agentProvider as unknown as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState,
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(turnCalls.length).toBe(2);
    expect(turnCalls[0]).toEqual({ prompt: "Full prompt", turnNumber: 1, isFirstTurn: true });
    expect(turnCalls[1]).toEqual({
      prompt: CONTRIBUTION_PROMPT,
      turnNumber: 2,
      isFirstTurn: false,
    });
    expect(result.success).toBe(true);
    expect(result.turnCount).toBe(2);
  });

  it("stops after max_turns", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
      runAfterRun: vi.fn().mockResolvedValue(undefined),
    };

    const turnCalls: number[] = [];
    const session = {
      sessionId: "s1",
      threadId: "t1",
      runTurn: vi.fn().mockImplementation((params: { turnNumber: number }) => {
        turnCalls.push(params.turnNumber);
        return createAsyncIterable([
          { type: "turn_completed" as const, inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        ]);
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const agentProvider = {
      name: "codex",
      startSession: vi.fn().mockResolvedValue(session),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: true,
      value: "Full prompt",
    } as Result<string, SymphonyError>);

    const refreshIssueState = vi.fn().mockResolvedValue({
      ok: true,
      value: createMinimalIssue({ state: "In Progress" }),
    } as Result<Issue | null, SymphonyError>);

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "T",
      config: createMinimalConfig({ agent: { ...createMinimalConfig().agent, maxTurns: 3 } }),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: agentProvider as unknown as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState,
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(turnCalls).toEqual([1, 2, 3]);
    expect(result.turnCount).toBe(3);
    expect(result.success).toBe(true);
  });

  it("stops when issue state becomes non-active (checked via tracker)", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
      runAfterRun: vi.fn().mockResolvedValue(undefined),
    };

    const turnCalls: number[] = [];
    const session = {
      sessionId: "s1",
      threadId: "t1",
      runTurn: vi.fn().mockImplementation((params: { turnNumber: number }) => {
        turnCalls.push(params.turnNumber);
        return createAsyncIterable([
          { type: "turn_completed" as const, inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        ]);
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const agentProvider = {
      name: "codex",
      startSession: vi.fn().mockResolvedValue(session),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: true,
      value: "Full prompt",
    } as Result<string, SymphonyError>);

    const refreshIssueState = vi.fn().mockResolvedValue({
      ok: true,
      value: createMinimalIssue({ state: "Done" }),
    } as Result<Issue | null, SymphonyError>);

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "T",
      config: createMinimalConfig({ agent: { ...createMinimalConfig().agent, maxTurns: 5 } }),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: agentProvider as unknown as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState,
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(turnCalls).toEqual([1]);
    expect(result.turnCount).toBe(1);
    expect(result.success).toBe(true);
  });

  it("runs after_run hook on both success and failure", async () => {
    const runAfterRun = vi.fn().mockResolvedValue(undefined);
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
      runAfterRun,
    };

    const session = {
      sessionId: "s1",
      threadId: "t1",
      runTurn: vi.fn().mockReturnValue(
        createAsyncIterable([{ type: "turn_failed" as const, error: "Turn failed" }])
      ),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const agentProvider = {
      name: "codex",
      startSession: vi.fn().mockResolvedValue(session),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: true,
      value: "Prompt",
    } as Result<string, SymphonyError>);

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "T",
      config: createMinimalConfig(),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: agentProvider as unknown as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState: vi.fn().mockResolvedValue({ ok: true, value: createMinimalIssue() } as Result<Issue | null, SymphonyError>),
      onEvent: () => {},
    };

    await runAgentAttempt(params, deps);

    expect(runAfterRun).toHaveBeenCalledWith("/tmp/ws/SYM-1");
  });

  it("returns error on workspace creation failure", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: false,
        error: { kind: "workspace_path_violation" as const, path: "/bad", root: "/tmp" },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
    };

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "T",
      config: createMinimalConfig(),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: { name: "codex", startSession: vi.fn() } as RunAttemptDependencies["agentProvider"],
      renderPrompt: vi.fn(),
      refreshIssueState: vi.fn(),
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(result.success).toBe(false);
    expect(result.turnCount).toBe(0);
    expect(result.error).toEqual({ kind: "workspace_path_violation", path: "/bad", root: "/tmp" });
  });

  it("returns error on before_run hook failure", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({
        ok: false,
        error: { kind: "hook_failed" as const, hook: "echo fail", message: "Failed" },
      } as Result<void, SymphonyError>),
    };

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "T",
      config: createMinimalConfig(),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: { name: "codex", startSession: vi.fn() } as RunAttemptDependencies["agentProvider"],
      renderPrompt: vi.fn(),
      refreshIssueState: vi.fn(),
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(result.success).toBe(false);
    expect(result.turnCount).toBe(0);
    expect(result.error).toEqual({ kind: "hook_failed", hook: "echo fail", message: "Failed" });
  });

  it("returns error on prompt rendering failure", async () => {
    const workspaceManager = {
      createForIssue: vi.fn().mockResolvedValue({
        ok: true,
        value: { path: "/tmp/ws/SYM-1", workspaceKey: "SYM-1", createdNow: true },
      } as Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>),
      runBeforeRun: vi.fn().mockResolvedValue({ ok: true, value: undefined } as Result<void, SymphonyError>),
    };

    const renderPrompt = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: "template_render_error" as const, variable: "", message: "Parse error" },
    } as Result<string, SymphonyError>);

    const params: RunAttemptParams = {
      issue: createMinimalIssue(),
      attempt: 1,
      promptTemplate: "{{ invalid",
      config: createMinimalConfig(),
    };

    const deps: RunAttemptDependencies = {
      workspaceManager: workspaceManager as unknown as RunAttemptDependencies["workspaceManager"],
      agentProvider: { name: "codex", startSession: vi.fn() } as RunAttemptDependencies["agentProvider"],
      renderPrompt,
      refreshIssueState: vi.fn(),
      onEvent: () => {},
    };

    const result = await runAgentAttempt(params, deps);

    expect(result.success).toBe(false);
    expect(result.turnCount).toBe(0);
    expect(result.error).toEqual({
      kind: "template_render_error",
      variable: "",
      message: "Parse error",
    });
  });
});
