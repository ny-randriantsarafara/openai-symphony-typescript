/**
 * Symphony shared domain types (SPEC Section 4).
 * Core value types shared between backend orchestrator and frontend dashboard.
 */

// ─── Issue Model ─────────────────────────────────────────────────────────────

export interface BlockerRef {
  readonly id: string | null;
  readonly identifier: string | null;
  readonly state: string | null;
}

export interface Issue {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: number | null;
  readonly state: string;
  readonly branchName: string | null;
  readonly url: string | null;
  readonly labels: readonly string[];
  readonly blockedBy: readonly BlockerRef[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  readonly config: Record<string, unknown>;
  readonly promptTemplate: string;
}

// ─── Config Types ────────────────────────────────────────────────────────────

export interface TrackerConfig {
  readonly kind: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly projectSlug: string;
  readonly activeStates: readonly string[];
  readonly terminalStates: readonly string[];
}

export interface PollingConfig {
  readonly intervalMs: number;
}

export interface WorkspaceConfig {
  readonly root: string;
}

export interface HooksConfig {
  readonly afterCreate: string | null;
  readonly beforeRun: string | null;
  readonly afterRun: string | null;
  readonly beforeRemove: string | null;
  readonly timeoutMs: number;
}

export interface AgentConfig {
  readonly provider: string;
  readonly command: string;
  readonly maxConcurrentAgents: number;
  readonly maxTurns: number;
  readonly maxRetryBackoffMs: number;
  readonly maxConcurrentAgentsByState: Readonly<Record<string, number>>;
}

export interface CodexConfig {
  readonly approvalPolicy: string;
  readonly threadSandbox: string;
  readonly turnSandboxPolicy: string;
  readonly turnTimeoutMs: number;
  readonly readTimeoutMs: number;
  readonly stallTimeoutMs: number;
}

export interface ServiceConfig {
  readonly tracker: TrackerConfig;
  readonly polling: PollingConfig;
  readonly workspace: WorkspaceConfig;
  readonly hooks: HooksConfig;
  readonly agent: AgentConfig;
  readonly codex: CodexConfig;
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface WorkspaceInfo {
  readonly path: string;
  readonly workspaceKey: string;
  readonly createdNow: boolean;
}

// ─── Run Attempt ─────────────────────────────────────────────────────────────

export type RunAttemptStatus =
  | { readonly status: "preparing_workspace" }
  | { readonly status: "building_prompt" }
  | { readonly status: "launching_agent" }
  | { readonly status: "initializing_session" }
  | { readonly status: "streaming_turn" }
  | { readonly status: "finishing" }
  | { readonly status: "succeeded" }
  | { readonly status: "failed" }
  | { readonly status: "timed_out" }
  | { readonly status: "stalled" }
  | { readonly status: "canceled_by_reconciliation" };

// ─── Live Session ───────────────────────────────────────────────────────────

export interface LiveSession {
  readonly sessionId: string;
  readonly threadId: string;
  readonly turnId: string;
  readonly codexAppServerPid: string | null;
  readonly lastEvent: string | null;
  readonly lastTimestamp: string | null;
  readonly lastMessage: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly lastReportedInputTokens: number;
  readonly lastReportedOutputTokens: number;
  readonly lastReportedTotalTokens: number;
  readonly turnCount: number;
}

// ─── Retry ───────────────────────────────────────────────────────────────────

export interface RetryEntry {
  readonly issueId: string;
  readonly identifier: string;
  readonly attempt: number;
  readonly dueAtMs: number;
  readonly error: string | null;
}

// ─── Token Totals ────────────────────────────────────────────────────────────

export interface TokenTotals {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly secondsRunning: number;
}

// ─── Orchestrator Snapshot ───────────────────────────────────────────────────

export interface RunningSession {
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly state: string;
  readonly sessionId: string | null;
  readonly turnCount: number;
  readonly lastEvent: string | null;
  readonly lastMessage: string;
  readonly startedAt: string;
  readonly lastEventAt: string | null;
  readonly tokens: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}

export interface RetryInfo {
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly attempt: number;
  readonly dueAt: string;
  readonly error: string | null;
}

export interface OrchestratorSnapshot {
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

// ─── Agent Events (discriminated union) ───────────────────────────────────────

export type AgentEvent =
  | {
      readonly type: "session_started";
      readonly sessionId: string;
      readonly threadId: string;
      readonly turnId: string;
    }
  | {
      readonly type: "turn_completed";
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly totalTokens: number;
    }
  | {
      readonly type: "turn_failed";
      readonly error: string;
    }
  | { readonly type: "turn_cancelled" }
  | {
      readonly type: "notification";
      readonly message: string;
    }
  | {
      readonly type: "approval_auto_approved";
      readonly details: unknown;
    }
  | {
      readonly type: "token_usage_updated";
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly totalTokens: number;
    }
  | {
      readonly type: "rate_limit_updated";
      readonly payload: unknown;
    }
  | { readonly type: "stall_detected" }
  | {
      readonly type: "other";
      readonly payload: unknown;
    };

// ─── Error Types (discriminated union) ────────────────────────────────────────

export type SymphonyError =
  | { readonly kind: "missing_workflow_file"; readonly path: string }
  | { readonly kind: "workflow_parse_error"; readonly message: string }
  | { readonly kind: "workflow_front_matter_not_a_map" }
  | { readonly kind: "template_parse_error"; readonly message: string }
  | {
      readonly kind: "template_render_error";
      readonly variable: string;
      readonly message: string;
    }
  | { readonly kind: "unsupported_tracker_kind"; readonly trackerKind: string }
  | { readonly kind: "missing_tracker_api_key" }
  | { readonly kind: "missing_tracker_project_slug" }
  | {
      readonly kind: "tracker_api_error";
      readonly status: number;
      readonly message: string;
    }
  | {
      readonly kind: "tracker_graphql_error";
      readonly errors: readonly unknown[];
    }
  | {
      readonly kind: "workspace_creation_failed";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly kind: "workspace_path_violation";
      readonly path: string;
      readonly root: string;
    }
  | {
      readonly kind: "hook_failed";
      readonly hook: string;
      readonly message: string;
    }
  | {
      readonly kind: "hook_timeout";
      readonly hook: string;
      readonly timeoutMs: number;
    }
  | {
      readonly kind: "agent_startup_failed";
      readonly provider: string;
      readonly message: string;
    }
  | {
      readonly kind: "agent_turn_timeout";
      readonly issueId: string;
      readonly turnTimeoutMs: number;
    }
  | {
      readonly kind: "agent_stalled";
      readonly issueId: string;
      readonly stallTimeoutMs: number;
    }
  | {
      readonly kind: "agent_turn_failed";
      readonly issueId: string;
      readonly message: string;
    }
  | { readonly kind: "agent_user_input_required"; readonly issueId: string }
  | { readonly kind: "prompt_render_failed"; readonly message: string }
  | {
      readonly kind: "config_validation_failed";
      readonly errors: readonly string[];
    };

// ─── Result Type ──────────────────────────────────────────────────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
