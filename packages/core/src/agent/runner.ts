import type {
  Issue,
  AgentEvent,
  ServiceConfig,
  SymphonyError,
  Result,
} from "@symphony/shared";
import type { AgentProvider, AgentSession } from "./types.js";
import type { WorkspaceManager } from "../workspace/workspace-manager.js";

export interface RunAttemptParams {
  readonly issue: Issue;
  readonly attempt: number | null;
  readonly promptTemplate: string;
  readonly config: ServiceConfig;
}

export interface RunAttemptDependencies {
  readonly workspaceManager: WorkspaceManager;
  readonly agentProvider: AgentProvider;
  readonly renderPrompt: (
    template: string,
    issue: Issue,
    attempt: number | null
  ) => Promise<Result<string, SymphonyError>>;
  readonly refreshIssueState: (
    issueId: string
  ) => Promise<Result<Issue | null, SymphonyError>>;
  readonly onEvent: (event: AgentEvent) => void;
}

export interface RunAttemptResult {
  readonly success: boolean;
  readonly turnCount: number;
  readonly error: SymphonyError | null;
}

const CONTINUATION_PROMPT =
  "Continue working on this issue. Pick up where you left off.";

function isIssueActive(issue: Issue, config: ServiceConfig): boolean {
  const stateKey = issue.state.toLowerCase();
  const activeStates = config.tracker.activeStates.map((s) => s.toLowerCase());
  return activeStates.includes(stateKey);
}

export async function runAgentAttempt(
  params: RunAttemptParams,
  deps: RunAttemptDependencies
): Promise<RunAttemptResult> {
  const { issue, attempt, promptTemplate, config } = params;
  const {
    workspaceManager,
    agentProvider,
    renderPrompt,
    refreshIssueState,
    onEvent,
  } = deps;

  const maxTurns = config.agent.maxTurns;

  // 1. Create workspace
  const workspaceResult = await workspaceManager.createForIssue(issue.identifier);
  if (!workspaceResult.ok) {
    return {
      success: false,
      turnCount: 0,
      error: workspaceResult.error,
    };
  }
  const workspacePath = workspaceResult.value.path;

  // 2. Run before_run hook
  const beforeRunResult = await workspaceManager.runBeforeRun(workspacePath);
  if (!beforeRunResult.ok) {
    return {
      success: false,
      turnCount: 0,
      error: beforeRunResult.error,
    };
  }

  // 3. Render prompt
  const promptResult = await renderPrompt(promptTemplate, issue, attempt);
  if (!promptResult.ok) {
    return {
      success: false,
      turnCount: 0,
      error: promptResult.error,
    };
  }
  const fullPrompt = promptResult.value;

  // 4. Start session
  let session: AgentSession;
  try {
    session = await agentProvider.startSession({
      workspacePath,
      config,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      turnCount: 0,
      error: {
        kind: "agent_startup_failed",
        provider: agentProvider.name,
        message,
      },
    };
  }

  let turnCount = 0;
  let lastError: SymphonyError | null = null;
  let shouldContinue = true;

  try {
    // 5. Turn loop
    while (shouldContinue) {
      const turnNumber = turnCount + 1;
      const isFirstTurn = turnNumber === 1;
      const prompt = isFirstTurn ? fullPrompt : CONTINUATION_PROMPT;

      let turnSucceeded = false;
      for await (const event of session.runTurn({
        prompt,
        issue,
        turnNumber,
        isFirstTurn,
      })) {
        onEvent(event);
        if (event.type === "turn_completed") {
          turnSucceeded = true;
        }
        if (event.type === "turn_failed") {
          lastError = {
            kind: "agent_turn_failed",
            issueId: issue.id,
            message: event.error,
          };
          shouldContinue = false;
          break;
        }
      }

      if (!turnSucceeded && lastError) {
        break;
      }

      turnCount += 1;

      if (!turnSucceeded) {
        break;
      }

      if (turnNumber >= maxTurns) {
        shouldContinue = false;
        break;
      }

      const refreshResult = await refreshIssueState(issue.id);
      if (!refreshResult.ok) {
        lastError = refreshResult.error;
        shouldContinue = false;
        break;
      }
      if (refreshResult.value === null) {
        shouldContinue = false;
        break;
      }
      if (!isIssueActive(refreshResult.value, config)) {
        shouldContinue = false;
        break;
      }
    }
  } finally {
    // 6. Stop session
    await session.stop();
  }

  // 7. Run after_run hook (best effort)
  await workspaceManager.runAfterRun(workspacePath);

  // 8. Return result
  return {
    success: lastError === null,
    turnCount,
    error: lastError,
  };
}
