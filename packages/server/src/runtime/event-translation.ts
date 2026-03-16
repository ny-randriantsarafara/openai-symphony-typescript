import type { AgentEvent, Issue, WsMessage } from "@symphony/shared";
import type { OrchestratorEvent } from "@symphony/core";

interface PendingSessionInfo {
  readonly workspacePath: string;
}

interface PendingSessionTracker {
  remember(issueId: string, info: PendingSessionInfo): void;
  consume(issueId: string): PendingSessionInfo | null;
  peek(issueId: string): PendingSessionInfo | null;
}

export function createPendingSessionTracker(): PendingSessionTracker {
  const sessions = new Map<string, PendingSessionInfo>();

  return {
    remember(issueId, info) {
      sessions.set(issueId, info);
    },
    consume(issueId) {
      const info = sessions.get(issueId) ?? null;
      sessions.delete(issueId);
      return info;
    },
    peek(issueId) {
      return sessions.get(issueId) ?? null;
    },
  };
}

export function createOrchestratorMessage(
  event: OrchestratorEvent,
  tracker: PendingSessionTracker,
  at: string,
  snapshotMessage?: WsMessage
): WsMessage | null {
  switch (event.type) {
    case "session:started":
      tracker.remember(event.issueId, { workspacePath: event.workspacePath });
      return null;
    case "retry:scheduled":
      return {
        type: "retry:scheduled",
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
        attempt: event.attempt,
        dueAt: event.dueAt,
        error: event.error,
      };
    case "retry:fired":
      return {
        type: "retry:fired",
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
        attempt: event.attempt,
      };
    case "error":
      return {
        type: "error",
        code: event.code,
        message: event.message,
        timestamp: at,
      };
    case "state:updated":
      return snapshotMessage ?? null;
    default:
      return null;
  }
}

export function createAgentMessage(
  issue: Pick<Issue, "id" | "identifier">,
  event: AgentEvent,
  tracker: PendingSessionTracker,
  at: string
): WsMessage | null {
  switch (event.type) {
    case "session_started": {
      const pending = tracker.consume(issue.id);
      return {
        type: "session:started",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        sessionId: event.sessionId,
        workspacePath: pending?.workspacePath ?? "",
        startedAt: at,
      };
    }
    case "turn_completed":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "turn_completed",
        message: "Turn completed",
        timestamp: at,
        tokens: {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
        },
      };
    case "turn_failed":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "turn_failed",
        message: event.error,
        timestamp: at,
        tokens: null,
      };
    case "turn_cancelled":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "turn_cancelled",
        message: "Turn cancelled",
        timestamp: at,
        tokens: null,
      };
    case "notification":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "notification",
        message: event.message,
        timestamp: at,
        tokens: null,
      };
    case "approval_auto_approved":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "approval_auto_approved",
        message: "Approval auto-approved",
        timestamp: at,
        tokens: null,
      };
    case "token_usage_updated":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "token_usage_updated",
        message: "Token usage updated",
        timestamp: at,
        tokens: {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
        },
      };
    case "stall_detected":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "stall_detected",
        message: "Agent stalled",
        timestamp: at,
        tokens: null,
      };
    case "other":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "other",
        message: JSON.stringify(event.payload),
        timestamp: at,
        tokens: null,
      };
    case "rate_limit_updated":
      return {
        type: "session:event",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        event: "rate_limit_updated",
        message: "Rate limits updated",
        timestamp: at,
        tokens: null,
      };
    default:
      return null;
  }
}

export type { PendingSessionTracker };
