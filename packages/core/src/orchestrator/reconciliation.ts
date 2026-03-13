import type { Issue, SymphonyError, Result } from "@symphony/shared";

export interface RunningIssueInfo {
  readonly issueId: string;
  readonly identifier: string;
  readonly startedAt: Date;
  readonly lastEventTimestamp: Date | null;
}

export interface ReconciliationCallbacks {
  onStalled: (issueId: string) => void;
  onTerminal: (issueId: string) => void;
  onNonActive: (issueId: string) => void;
  onActiveUpdate: (issueId: string, issue: Issue) => void;
}

export type TrackerRefreshFn = (
  issueIds: readonly string[]
) => Promise<Result<readonly Issue[], SymphonyError>>;

export function detectStalls(
  runningIssues: readonly RunningIssueInfo[],
  stallTimeoutMs: number,
  now: Date,
  onStalled: (issueId: string) => void,
): void {
  if (stallTimeoutMs <= 0) return;

  for (const entry of runningIssues) {
    const lastActivity = entry.lastEventTimestamp ?? entry.startedAt;
    const elapsedMs = now.getTime() - lastActivity.getTime();
    if (elapsedMs > stallTimeoutMs) {
      onStalled(entry.issueId);
    }
  }
}

export async function refreshTrackerStates(
  runningIssues: readonly RunningIssueInfo[],
  activeStates: readonly string[],
  terminalStates: readonly string[],
  fetchStates: TrackerRefreshFn,
  callbacks: ReconciliationCallbacks,
): Promise<void> {
  if (runningIssues.length === 0) return;

  const issueIds = runningIssues.map((r) => r.issueId);
  const result = await fetchStates(issueIds);

  if (!result.ok) return; // keep workers running on failure

  const refreshedMap = new Map(result.value.map((i) => [i.id, i]));
  const activeSet = new Set(activeStates.map((s) => s.toLowerCase()));
  const terminalSet = new Set(terminalStates.map((s) => s.toLowerCase()));

  for (const entry of runningIssues) {
    const refreshed = refreshedMap.get(entry.issueId);
    if (!refreshed) continue;

    const stateLower = refreshed.state.toLowerCase();
    if (terminalSet.has(stateLower)) {
      callbacks.onTerminal(entry.issueId);
    } else if (activeSet.has(stateLower)) {
      callbacks.onActiveUpdate(entry.issueId, refreshed);
    } else {
      callbacks.onNonActive(entry.issueId);
    }
  }
}
