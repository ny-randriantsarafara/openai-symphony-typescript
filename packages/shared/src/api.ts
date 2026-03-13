/**
 * Symphony REST API contract types.
 * Request/response types for each REST API endpoint.
 */

import type { RunningSession, RetryInfo, TokenTotals } from "./domain.js";

// GET /api/v1/state
export interface StateResponse {
  readonly generatedAt: string;
  readonly counts: {
    readonly running: number;
    readonly retrying: number;
  };
  readonly running: readonly RunningSession[];
  readonly retrying: readonly RetryInfo[];
  readonly codexTotals: TokenTotals;
  readonly rateLimits: unknown | null;
}

// GET /api/v1/:issueIdentifier
export interface IssueDetailResponse {
  readonly issueIdentifier: string;
  readonly issueId: string;
  readonly status: "running" | "retrying" | "completed" | "unknown";
  readonly workspace: {
    readonly path: string;
  } | null;
  readonly attempts: {
    readonly restartCount: number;
    readonly currentRetryAttempt: number | null;
  };
  readonly running: RunningSession | null;
  readonly retry: RetryInfo | null;
  readonly recentEvents: readonly RecentEvent[];
  readonly lastError: string | null;
}

export interface RecentEvent {
  readonly at: string;
  readonly event: string;
  readonly message: string;
  readonly issueIdentifier: string;
}

// POST /api/v1/refresh
export interface RefreshResponse {
  readonly queued: boolean;
  readonly coalesced: boolean;
  readonly requestedAt: string;
  readonly operations: readonly string[];
}

// GET /api/v1/config
export interface ConfigResponse {
  readonly workflowPath: string;
  readonly lastReloadAt: string | null;
  readonly validationStatus: "valid" | "invalid";
  readonly validationErrors: readonly string[];
  readonly config: SanitizedConfig;
}

export interface SanitizedConfig {
  readonly tracker: {
    readonly kind: string;
    readonly endpoint: string;
    readonly projectSlug: string;
    readonly activeStates: readonly string[];
    readonly terminalStates: readonly string[];
  };
  readonly polling: {
    readonly intervalMs: number;
  };
  readonly workspace: {
    readonly root: string;
  };
  readonly agent: {
    readonly provider: string;
    readonly command: string;
    readonly maxConcurrentAgents: number;
    readonly maxTurns: number;
    readonly maxRetryBackoffMs: number;
    readonly maxConcurrentAgentsByState: Readonly<Record<string, number>>;
  };
}

// GET /api/v1/events
export interface EventsResponse {
  readonly events: readonly RecentEvent[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

// Error envelope
export interface ApiError {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
