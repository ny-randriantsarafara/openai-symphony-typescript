import type {
  ConfigResponse,
  EventsResponse,
  IssueDetailResponse,
  RecentEvent,
  RunningSession,
  RetryInfo,
  SanitizedConfig,
  ServiceConfig,
  StateResponse,
  TokenTotals,
} from "@symphony/shared";

const EMPTY_TOTALS: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  secondsRunning: 0,
};

const EMPTY_CONFIG: SanitizedConfig = {
  tracker: {
    kind: "linear",
    endpoint: "https://api.linear.app/graphql",
    projectSlug: "",
    activeStates: [],
    terminalStates: [],
  },
  polling: {
    intervalMs: 30000,
  },
  workspace: {
    root: "",
  },
  agent: {
    provider: "codex",
    command: "",
    maxConcurrentAgents: 0,
    maxTurns: 0,
    maxRetryBackoffMs: 0,
    maxConcurrentAgentsByState: {},
  },
};

interface RuntimeStoreOptions {
  readonly workflowPath: string;
}

interface KnownIssue {
  readonly issueId: string;
  readonly issueIdentifier: string;
}

interface RuntimeStore {
  getSnapshot(): StateResponse;
  syncSnapshot(snapshot: StateResponse): void;
  applySessionStarted(event: {
    issueId: string;
    issueIdentifier: string;
    sessionId: string;
    workspacePath: string;
    startedAt: string;
  }): void;
  applySessionEvent(event: {
    issueId: string;
    issueIdentifier: string;
    event: string;
    message: string;
    timestamp: string;
    tokens: RunningSession["tokens"] | null;
  }): void;
  applySessionEnded(event: {
    issueId: string;
    issueIdentifier: string;
    reason: string;
    durationMs: number;
    tokens: RunningSession["tokens"];
  }): void;
  applyRetryScheduled(event: RetryInfo): void;
  applyRetryFired(event: { issueId: string; issueIdentifier: string; attempt: number }): void;
  applyError(event: { code: string; message: string; timestamp: string }): void;
  rememberWorkspace(issueId: string, issueIdentifier: string, workspacePath: string): void;
  setConfigValid(config: ServiceConfig): void;
  setConfigInvalid(config: ServiceConfig, errors: readonly string[]): void;
  getConfig(): ConfigResponse;
  getRecentEvents(offset: number, limit: number): EventsResponse;
  getIssueDetail(identifier: string): IssueDetailResponse | null;
}

function sanitizeConfig(config: ServiceConfig): SanitizedConfig {
  return {
    tracker: {
      kind: config.tracker.kind,
      endpoint: config.tracker.endpoint,
      projectSlug: config.tracker.projectSlug,
      activeStates: [...config.tracker.activeStates],
      terminalStates: [...config.tracker.terminalStates],
    },
    polling: {
      intervalMs: config.polling.intervalMs,
    },
    workspace: {
      root: config.workspace.root,
    },
    agent: {
      provider: config.agent.provider,
      command: config.agent.command,
      maxConcurrentAgents: config.agent.maxConcurrentAgents,
      maxTurns: config.agent.maxTurns,
      maxRetryBackoffMs: config.agent.maxRetryBackoffMs,
      maxConcurrentAgentsByState: { ...config.agent.maxConcurrentAgentsByState },
    },
  };
}

function createEmptySnapshot(): StateResponse {
  return {
    generatedAt: new Date(0).toISOString(),
    counts: { running: 0, retrying: 0 },
    running: [],
    retrying: [],
    codexTotals: EMPTY_TOTALS,
    rateLimits: null,
  };
}

function mergeRunningSession(
  current: RunningSession | undefined,
  incoming: RunningSession
): RunningSession {
  if (!current) return incoming;
  return {
    ...incoming,
    sessionId: incoming.sessionId || current.sessionId,
    turnCount: incoming.turnCount || current.turnCount,
    lastEvent: incoming.lastEvent ?? current.lastEvent,
    lastMessage: incoming.lastMessage || current.lastMessage,
    startedAt: incoming.startedAt || current.startedAt,
    lastEventAt: incoming.lastEventAt ?? current.lastEventAt,
    tokens:
      incoming.tokens.totalTokens > 0
        ? incoming.tokens
        : current.tokens,
  };
}

export function createRuntimeStore(options: RuntimeStoreOptions): RuntimeStore {
  let snapshot = createEmptySnapshot();
  let configResponse: ConfigResponse = {
    workflowPath: options.workflowPath,
    lastReloadAt: null,
    validationStatus: "invalid",
    validationErrors: ["Config not loaded"],
    config: EMPTY_CONFIG,
  };

  const recentEvents: RecentEvent[] = [];
  const recentEventsByIssue = new Map<string, RecentEvent[]>();
  const workspacesByIssueId = new Map<string, string>();
  const knownIssuesByIdentifier = new Map<string, KnownIssue>();
  const lastErrorsByIdentifier = new Map<string, string>();
  const retryAttemptsByIdentifier = new Map<string, number>();

  const recordEvent = (event: RecentEvent): void => {
    recentEvents.unshift(event);
    if (recentEvents.length > 100) recentEvents.length = 100;

    if (!event.issueIdentifier) return;
    const existing = recentEventsByIssue.get(event.issueIdentifier) ?? [];
    const updated = [event, ...existing].slice(0, 50);
    recentEventsByIssue.set(event.issueIdentifier, updated);
  };

  const setRunning = (next: readonly RunningSession[]): void => {
    snapshot = {
      ...snapshot,
      running: next,
      counts: {
        running: next.length,
        retrying: snapshot.retrying.length,
      },
      generatedAt: new Date().toISOString(),
    };
    for (const session of next) {
      knownIssuesByIdentifier.set(session.issueIdentifier, {
        issueId: session.issueId,
        issueIdentifier: session.issueIdentifier,
      });
    }
  };

  const setRetrying = (next: readonly RetryInfo[]): void => {
    snapshot = {
      ...snapshot,
      retrying: next,
      counts: {
        running: snapshot.running.length,
        retrying: next.length,
      },
      generatedAt: new Date().toISOString(),
    };
    for (const retry of next) {
      knownIssuesByIdentifier.set(retry.issueIdentifier, {
        issueId: retry.issueId,
        issueIdentifier: retry.issueIdentifier,
      });
      retryAttemptsByIdentifier.set(retry.issueIdentifier, retry.attempt);
    }
  };

  return {
    getSnapshot(): StateResponse {
      return snapshot;
    },

    syncSnapshot(nextSnapshot: StateResponse): void {
      const currentByIssueId = new Map(snapshot.running.map((item) => [item.issueId, item]));
      const mergedRunning = nextSnapshot.running.map((item) =>
        mergeRunningSession(currentByIssueId.get(item.issueId), item)
      );

      snapshot = {
        ...nextSnapshot,
        running: mergedRunning,
      };

      for (const session of mergedRunning) {
        knownIssuesByIdentifier.set(session.issueIdentifier, {
          issueId: session.issueId,
          issueIdentifier: session.issueIdentifier,
        });
      }
      for (const retry of nextSnapshot.retrying) {
        retryAttemptsByIdentifier.set(retry.issueIdentifier, retry.attempt);
      }
    },

    applySessionStarted(event): void {
      workspacesByIssueId.set(event.issueId, event.workspacePath);
      knownIssuesByIdentifier.set(event.issueIdentifier, {
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
      });

      const existing = snapshot.running.find((item) => item.issueId === event.issueId);
      const session: RunningSession = {
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
        state: existing?.state ?? "running",
        sessionId: event.sessionId,
        turnCount: existing?.turnCount ?? 0,
        lastEvent: existing?.lastEvent ?? null,
        lastMessage: existing?.lastMessage ?? "",
        startedAt: event.startedAt,
        lastEventAt: existing?.lastEventAt ?? null,
        tokens: existing?.tokens ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };

      const remaining = snapshot.running.filter((item) => item.issueId !== event.issueId);
      setRunning([...remaining, session]);

      recordEvent({
        at: event.startedAt,
        event: "session:started",
        message: `Session started for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
    },

    applySessionEvent(event): void {
      const current = snapshot.running.find((item) => item.issueId === event.issueId);
      if (current) {
        const next = snapshot.running.map((item) =>
          item.issueId === event.issueId
            ? {
                ...item,
                turnCount:
                  event.event === "turn_completed" ? item.turnCount + 1 : item.turnCount,
                lastEvent: event.event,
                lastMessage: event.message,
                lastEventAt: event.timestamp,
                tokens: event.tokens ?? item.tokens,
              }
            : item
        );
        setRunning(next);
      }

      if (event.event === "turn_failed" || event.event === "stall_detected") {
        lastErrorsByIdentifier.set(event.issueIdentifier, event.message);
      }

      recordEvent({
        at: event.timestamp,
        event: event.event,
        message: event.message,
        issueIdentifier: event.issueIdentifier,
      });
    },

    applySessionEnded(event): void {
      const nextRunning = snapshot.running.filter((item) => item.issueId !== event.issueId);
      setRunning(nextRunning);

      if (event.reason === "failed") {
        lastErrorsByIdentifier.set(event.issueIdentifier, `Session ended (${event.reason})`);
      }

      recordEvent({
        at: new Date().toISOString(),
        event: "session:ended",
        message: `Session ended (${event.reason}) for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
    },

    applyRetryScheduled(event): void {
      const remaining = snapshot.retrying.filter((item) => item.issueId !== event.issueId);
      setRetrying([...remaining, event]);

      retryAttemptsByIdentifier.set(event.issueIdentifier, event.attempt);
      if (event.error) {
        lastErrorsByIdentifier.set(event.issueIdentifier, event.error);
      }

      recordEvent({
        at: event.dueAt,
        event: "retry:scheduled",
        message: `Retry #${event.attempt} scheduled for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
    },

    applyRetryFired(event): void {
      const remaining = snapshot.retrying.filter((item) => item.issueId !== event.issueId);
      setRetrying(remaining);

      recordEvent({
        at: new Date().toISOString(),
        event: "retry:fired",
        message: `Retry #${event.attempt} fired for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
    },

    applyError(event): void {
      recordEvent({
        at: event.timestamp,
        event: "error",
        message: event.message,
        issueIdentifier: "",
      });
    },

    rememberWorkspace(issueId: string, issueIdentifier: string, workspacePath: string): void {
      workspacesByIssueId.set(issueId, workspacePath);
      knownIssuesByIdentifier.set(issueIdentifier, {
        issueId,
        issueIdentifier,
      });
    },

    setConfigValid(config: ServiceConfig): void {
      configResponse = {
        workflowPath: options.workflowPath,
        lastReloadAt: new Date().toISOString(),
        validationStatus: "valid",
        validationErrors: [],
        config: sanitizeConfig(config),
      };
    },

    setConfigInvalid(config: ServiceConfig, errors: readonly string[]): void {
      configResponse = {
        workflowPath: options.workflowPath,
        lastReloadAt: new Date().toISOString(),
        validationStatus: "invalid",
        validationErrors: [...errors],
        config: sanitizeConfig(config),
      };
    },

    getConfig(): ConfigResponse {
      return configResponse;
    },

    getRecentEvents(offset: number, limit: number): EventsResponse {
      const events = recentEvents.slice(offset, offset + limit);
      return {
        events,
        total: recentEvents.length,
        offset,
        limit,
      };
    },

    getIssueDetail(identifier: string): IssueDetailResponse | null {
      const running = snapshot.running.find((item) => item.issueIdentifier === identifier) ?? null;
      const retry = snapshot.retrying.find((item) => item.issueIdentifier === identifier) ?? null;
      const known = knownIssuesByIdentifier.get(identifier);

      if (!running && !retry && !known) {
        return null;
      }

      const issueId = running?.issueId ?? retry?.issueId ?? known?.issueId ?? "";
      const workspacePath = workspacesByIssueId.get(issueId) ?? null;
      const restartCount = retryAttemptsByIdentifier.get(identifier) ?? 0;
      const issueEvents = recentEventsByIssue.get(identifier) ?? [];

      return {
        issueIdentifier: identifier,
        issueId,
        status: running ? "running" : retry ? "retrying" : "completed",
        workspace: workspacePath ? { path: workspacePath } : null,
        attempts: {
          restartCount,
          currentRetryAttempt: retry?.attempt ?? null,
        },
        running,
        retry,
        recentEvents: issueEvents,
        lastError: lastErrorsByIdentifier.get(identifier) ?? null,
      };
    },
  };
}

export type { RuntimeStore };
