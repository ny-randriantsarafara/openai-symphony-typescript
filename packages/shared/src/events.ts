/**
 * Symphony WebSocket event contract types.
 * Discriminated union for all WebSocket message types.
 */

import type { RunningSession, RetryInfo, TokenTotals } from "./domain.js";

export interface StateUpdatedEvent {
  readonly type: "state:updated";
  readonly running: readonly RunningSession[];
  readonly retrying: readonly RetryInfo[];
  readonly codexTotals: TokenTotals;
  readonly counts: {
    readonly running: number;
    readonly retrying: number;
  };
}

export interface SessionStartedEvent {
  readonly type: "session:started";
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly sessionId: string;
  readonly workspacePath: string;
  readonly startedAt: string;
}

export interface SessionEventEvent {
  readonly type: "session:event";
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly event: string;
  readonly message: string;
  readonly timestamp: string;
  readonly tokens: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  } | null;
}

export interface SessionEndedEvent {
  readonly type: "session:ended";
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly reason: "completed" | "failed" | "timed_out" | "stalled" | "canceled";
  readonly durationMs: number;
  readonly tokens: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}

export interface RetryScheduledEvent {
  readonly type: "retry:scheduled";
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly attempt: number;
  readonly dueAt: string;
  readonly error: string | null;
}

export interface RetryFiredEvent {
  readonly type: "retry:fired";
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly attempt: number;
}

export interface ConfigReloadedEvent {
  readonly type: "config:reloaded";
  readonly reloadedAt: string;
  readonly valid: boolean;
  readonly changes: readonly string[];
}

export interface WsErrorEvent {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
  readonly timestamp: string;
}

export type WsMessage =
  | StateUpdatedEvent
  | SessionStartedEvent
  | SessionEventEvent
  | SessionEndedEvent
  | RetryScheduledEvent
  | RetryFiredEvent
  | ConfigReloadedEvent
  | WsErrorEvent;
