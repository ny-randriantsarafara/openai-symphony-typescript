import type {
  Issue,
  ServiceConfig,
  SymphonyError,
  Result,
  OrchestratorSnapshot,
  RunningSession,
  RetryInfo,
  TokenTotals,
} from "@symphony/shared";
import type { ConfigWatcher } from "../config/config-watcher.js";
import type { RunningEntry, OrchestratorState } from "./state.js";
import { createInitialState } from "./state.js";
import { sortForDispatch, isEligibleForDispatch } from "./dispatch.js";
import { RetryQueue, calculateBackoffDelay, type RetryType } from "./retry.js";
import {
  detectStalls,
  refreshTrackerStates,
  type RunningIssueInfo,
  type ReconciliationCallbacks,
} from "./reconciliation.js";
import type { EventBus } from "./event-bus.js";

// ─── Dependencies ────────────────────────────────────────────────────────────

export interface TrackerAdapter {
  fetchCandidateIssues(): Promise<Result<readonly Issue[], SymphonyError>>;
  fetchIssueStatesByIds(issueIds: readonly string[]): Promise<Result<readonly Issue[], SymphonyError>>;
  fetchIssuesByStates(stateNames: readonly string[]): Promise<Result<readonly Issue[], SymphonyError>>;
}

export interface WorkspaceManagerAdapter {
  createForIssue(identifier: string): Promise<Result<{ path: string; workspaceKey: string; createdNow: boolean }, SymphonyError>>;
  removeWorkspace(identifier: string): Promise<void>;
}

export interface AgentHandle {
  stop(): Promise<void>;
}

export interface SpawnAgentParams {
  issue: Issue;
  workspacePath: string;
  config: ServiceConfig;
  promptTemplate: string;
  onExit: (result: AgentExitResult) => void;
}

export type AgentExitResult =
  | { type: "continuation"; issueId: string; issueIdentifier: string }
  | { type: "failure"; issueId: string; issueIdentifier: string; error: string };

export interface OrchestratorDependencies {
  configWatcher: Pick<
    ConfigWatcher,
    "getCurrentConfig" | "getCurrentPromptTemplate" | "start" | "stop" | "on" | "removeListener"
  >;
  validateConfig: (config: ServiceConfig) => Result<void, SymphonyError>;
  tracker: TrackerAdapter;
  workspaceManager: WorkspaceManagerAdapter;
  spawnAgent: (params: SpawnAgentParams) => Promise<AgentHandle | void>;
  eventBus: EventBus;
  createInitialState?: () => OrchestratorState;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class Orchestrator {
  private state: OrchestratorState;
  private readonly retryQueue = new RetryQueue();
  private readonly workerHandles = new Map<string, AgentHandle>();
  private readonly retryFiredInfo = new Map<string, { identifier: string; attempt: number }>();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private configReloadHandler: ((config: ServiceConfig, promptTemplate: string) => void) | null = null;

  constructor(private readonly deps: OrchestratorDependencies) {
    this.state = (deps.createInitialState ?? createInitialState)();
  }

  async start(): Promise<void> {
    const config = this.deps.configWatcher.getCurrentConfig();
    if (!config) {
      this.deps.eventBus.emit({ type: "error", code: "no_config", message: "No config loaded" });
      return;
    }

    const validation = this.deps.validateConfig(config);
    if (!validation.ok) {
      const err = validation.error;
      const message =
        err.kind === "config_validation_failed"
          ? err.errors.join("; ")
          : "Config validation failed";
      this.deps.eventBus.emit({
        type: "error",
        code: "config_validation_failed",
        message,
      });
      return;
    }

    await this.performTerminalWorkspaceCleanup(config);
    await this.deps.configWatcher.start();

    this.configReloadHandler = () => this.handleConfigReload();
    this.deps.configWatcher.on("configReloaded", this.configReloadHandler as (config: ServiceConfig, promptTemplate: string) => void);

    await this.tick();
    this.scheduleNextTick(config);
  }

  async stop(): Promise<void> {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    for (const handle of this.workerHandles.values()) {
      await handle.stop();
    }
    this.workerHandles.clear();
    this.retryQueue.clear();

    if (this.configReloadHandler) {
      this.deps.configWatcher.removeListener(
        "configReloaded",
        this.configReloadHandler as (config: ServiceConfig, promptTemplate: string) => void
      );
      this.configReloadHandler = null;
    }
    await this.deps.configWatcher.stop();
  }

  async tick(): Promise<void> {
    const config = this.deps.configWatcher.getCurrentConfig();
    if (!config) return;

    await this.reconcile(config);
    this.emitStateUpdated();

    const validation = this.deps.validateConfig(config);
    if (!validation.ok) return;

    const fetchResult = await this.deps.tracker.fetchCandidateIssues();
    if (!fetchResult.ok) return;

    const candidates = fetchResult.value;
    const sorted = sortForDispatch(candidates);
    await this.dispatch(sorted, config);
    this.emitStateUpdated();
  }

  getSnapshot(): OrchestratorSnapshot {
    const running: RunningSession[] = [];
    for (const entry of this.state.running.values()) {
      const ls = entry.liveSession;
      running.push({
        issueId: entry.issueId,
        issueIdentifier: entry.identifier,
        state: entry.issue.state,
        sessionId: entry.sessionId,
        turnCount: ls?.turnCount ?? 0,
        lastEvent: ls?.lastEvent ?? null,
        lastMessage: ls?.lastMessage ?? "",
        startedAt: entry.startedAt.toISOString(),
        lastEventAt: ls?.lastTimestamp ?? null,
        tokens: {
          inputTokens: ls?.inputTokens ?? 0,
          outputTokens: ls?.outputTokens ?? 0,
          totalTokens: ls?.totalTokens ?? 0,
        },
      });
    }

    const retrying: RetryInfo[] = this.retryQueue.getAll().map((e) => ({
      issueId: e.issueId,
      issueIdentifier: e.identifier,
      attempt: e.attempt,
      dueAt: new Date(e.dueAtMs).toISOString(),
      error: e.error,
    }));

    return {
      generatedAt: new Date().toISOString(),
      counts: { running: running.length, retrying: retrying.length },
      running,
      retrying,
      codexTotals: this.state.codexTotals,
      rateLimits: this.state.rateLimits,
    };
  }

  async triggerRefresh(): Promise<void> {
    await this.tick();
  }

  private async reconcile(config: ServiceConfig): Promise<void> {
    const runningList = Array.from(this.state.running.values());
    if (runningList.length === 0) return;

    const runningInfo: RunningIssueInfo[] = runningList.map((e) => ({
      issueId: e.issueId,
      identifier: e.identifier,
      startedAt: e.startedAt,
      lastEventTimestamp: e.liveSession?.lastTimestamp
        ? new Date(e.liveSession.lastTimestamp)
        : null,
    }));

    const callbacks: ReconciliationCallbacks = {
      onStalled: (issueId) => this.handleWorkerExit(issueId, "failure", "stalled"),
      onTerminal: (issueId) => this.handleReconcileTerminal(issueId),
      onNonActive: (issueId) => this.handleReconcileNonActive(issueId),
      onActiveUpdate: (issueId, issue) => this.handleActiveUpdate(issueId, issue),
    };

    detectStalls(runningInfo, config.codex.stallTimeoutMs, new Date(), callbacks.onStalled);

    await refreshTrackerStates(
      runningInfo,
      config.tracker.activeStates,
      config.tracker.terminalStates,
      (ids) => this.deps.tracker.fetchIssueStatesByIds(ids),
      callbacks
    );
  }

  private handleReconcileTerminal(issueId: string): void {
    this.stopWorker(issueId);
  }

  private handleReconcileNonActive(issueId: string): void {
    this.stopWorker(issueId);
  }

  private handleActiveUpdate(issueId: string, issue: Issue): void {
    const entry = this.state.running.get(issueId);
    if (!entry) return;
    const updated: RunningEntry = { ...entry, issue };
    const running = new Map(this.state.running);
    running.set(issueId, updated);
    this.state = { ...this.state, running };
  }

  private handleWorkerExit(
    issueId: string,
    retryType: RetryType,
    error: string | null
  ): void {
    const entry = this.state.running.get(issueId);
    if (!entry) return;

    this.stopWorker(issueId);
    const attempt = (entry.retryAttempt ?? 0) + 1;
    const delayMs = calculateBackoffDelay(retryType, attempt, this.deps.configWatcher.getCurrentConfig()?.agent.maxRetryBackoffMs ?? 300000);
    const dueAt = new Date(Date.now() + delayMs).toISOString();
    this.deps.eventBus.emit({
      type: "retry:scheduled",
      issueId,
      issueIdentifier: entry.identifier,
      attempt,
      dueAt,
      error,
    });
    this.retryFiredInfo.set(issueId, { identifier: entry.identifier, attempt });
    this.retryQueue.schedule(issueId, entry.identifier, attempt, delayMs, error, (id) =>
      this.handleRetryFired(id)
    );
  }

  private handleRetryFired(issueId: string): void {
    const info = this.retryFiredInfo.get(issueId);
    this.retryFiredInfo.delete(issueId);
    if (!info) return;
    this.deps.eventBus.emit({
      type: "retry:fired",
      issueId,
      issueIdentifier: info.identifier,
      attempt: info.attempt,
    });
    void this.tick();
  }

  private stopWorker(issueId: string): void {
    const handle = this.workerHandles.get(issueId);
    if (handle) {
      void handle.stop();
      this.workerHandles.delete(issueId);
    }
    const entry = this.state.running.get(issueId);
    if (!entry) return;
    const running = new Map(this.state.running);
    running.delete(issueId);
    const completed = new Set(this.state.completed);
    completed.add(issueId);
    this.state = { ...this.state, running, completed };
  }

  private async dispatch(candidates: readonly Issue[], config: ServiceConfig): Promise<void> {
    const promptTemplate = this.deps.configWatcher.getCurrentPromptTemplate();
    for (const issue of candidates) {
      if (!isEligibleForDispatch(issue, this.state, config)) continue;

      const workspaceResult = await this.deps.workspaceManager.createForIssue(issue.identifier);
      if (!workspaceResult.ok) continue;

      const workspacePath = workspaceResult.value.path;
      const claimed = new Set(this.state.claimed);
      claimed.add(issue.id);
      this.state = { ...this.state, claimed };

      const entry: RunningEntry = {
        issueId: issue.id,
        identifier: issue.identifier,
        issue,
        sessionId: null,
        startedAt: new Date(),
        liveSession: null,
        retryAttempt: null,
      };
      const running = new Map(this.state.running);
      running.set(issue.id, entry);
      this.state = { ...this.state, running };
      claimed.delete(issue.id);
      this.state = { ...this.state, claimed };

      this.deps.eventBus.emit({
        type: "session:started",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        sessionId: "",
        workspacePath,
      });

      const handle = await this.deps.spawnAgent({
        issue,
        workspacePath,
        config,
        promptTemplate,
        onExit: (result) => this.handleAgentExit(result),
      });
      if (handle) {
        this.workerHandles.set(issue.id, handle);
      }
    }
  }

  private handleAgentExit(result: AgentExitResult): void {
    const entry = this.state.running.get(result.issueId);
    if (!entry) return;

    const retryType: RetryType = result.type === "continuation" ? "continuation" : "failure";
    const error = result.type === "failure" ? result.error : null;
    this.handleWorkerExit(result.issueId, retryType, error);
  }

  private async performTerminalWorkspaceCleanup(config: ServiceConfig): Promise<void> {
    const result = await this.deps.tracker.fetchIssuesByStates(config.tracker.terminalStates);
    if (!result.ok) return;
    for (const issue of result.value) {
      await this.deps.workspaceManager.removeWorkspace(issue.identifier);
    }
  }

  private handleConfigReload(): void {
    this.deps.eventBus.emit({ type: "config:reloaded" });
    const config = this.deps.configWatcher.getCurrentConfig();
    if (config && this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
      this.scheduleNextTick(config);
    }
  }

  private scheduleNextTick(config: ServiceConfig): void {
    const intervalMs = config.polling.intervalMs;
    this.pollIntervalId = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  private emitStateUpdated(): void {
    this.deps.eventBus.emit({ type: "state:updated" });
  }
}
