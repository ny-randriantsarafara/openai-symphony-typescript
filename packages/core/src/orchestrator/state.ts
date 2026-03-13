import type { Issue, TokenTotals, LiveSession, RetryEntry } from "@symphony/shared";

export interface RunningEntry {
  readonly issueId: string;
  readonly identifier: string;
  readonly issue: Issue;
  readonly sessionId: string | null;
  readonly startedAt: Date;
  readonly liveSession: LiveSession | null;
  readonly retryAttempt: number | null;
}

export interface OrchestratorState {
  readonly running: ReadonlyMap<string, RunningEntry>;
  readonly claimed: ReadonlySet<string>;
  readonly retryAttempts: ReadonlyMap<string, RetryEntry>;
  readonly completed: ReadonlySet<string>;
  readonly codexTotals: TokenTotals;
  readonly rateLimits: unknown | null;
}

const ZERO_TOKEN_TOTALS: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  secondsRunning: 0,
};

export function createInitialState(): OrchestratorState {
  return {
    running: new Map(),
    claimed: new Set(),
    retryAttempts: new Map(),
    completed: new Set(),
    codexTotals: ZERO_TOKEN_TOTALS,
    rateLimits: null,
  };
}
