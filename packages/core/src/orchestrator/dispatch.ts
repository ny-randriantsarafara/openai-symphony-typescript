import type { Issue, ServiceConfig, BlockerRef } from "@symphony/shared";
import type { OrchestratorState } from "./state.js";

/**
 * Sort issues for dispatch: priority ascending (1..4 first, null last), oldest createdAt first, identifier tie-breaker.
 */
export function sortForDispatch(issues: readonly Issue[]): readonly Issue[] {
  return [...issues].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;

    const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (createdAtA !== createdAtB) return createdAtA - createdAtB;

    return a.identifier.localeCompare(b.identifier);
  });
}

function isTerminalState(state: string | null, terminalStates: readonly string[]): boolean {
  if (state === null || state === "") return false;
  const lower = state.toLowerCase();
  return terminalStates.some((t) => t.toLowerCase() === lower);
}

function hasNonTerminalBlocker(
  blockedBy: readonly BlockerRef[],
  terminalStates: readonly string[]
): boolean {
  return blockedBy.some((b) => !isTerminalState(b.state, terminalStates));
}

function countRunningByState(state: OrchestratorState, stateName: string): number {
  const key = stateName.toLowerCase();
  let count = 0;
  for (const entry of state.running.values()) {
    if (entry.issue.state.toLowerCase() === key) count++;
  }
  return count;
}

export function availableGlobalSlots(
  state: OrchestratorState,
  config: ServiceConfig
): number {
  const max = config.agent.maxConcurrentAgents;
  const runningCount = state.running.size;
  return Math.max(max - runningCount, 0);
}

export function availableStateSlots(
  stateName: string,
  state: OrchestratorState,
  config: ServiceConfig
): number {
  const key = stateName.toLowerCase();
  const byState = config.agent.maxConcurrentAgentsByState[key];
  const limit =
    byState !== undefined ? byState : config.agent.maxConcurrentAgents;
  const runningCount = countRunningByState(state, stateName);
  return Math.max(limit - runningCount, 0);
}

export function isEligibleForDispatch(
  issue: Issue,
  state: OrchestratorState,
  config: ServiceConfig
): boolean {
  if (!issue.id || !issue.identifier || !issue.title || !issue.state) {
    return false;
  }

  const stateKey = issue.state.toLowerCase();
  const activeStates = config.tracker.activeStates.map((s) => s.toLowerCase());
  const terminalStates = config.tracker.terminalStates.map((s) => s.toLowerCase());

  if (!activeStates.includes(stateKey)) return false;
  if (terminalStates.includes(stateKey)) return false;

  if (state.running.has(issue.id)) return false;
  if (state.claimed.has(issue.id)) return false;

  const terminalStatesLower = config.tracker.terminalStates;
  if (stateKey === "todo" && hasNonTerminalBlocker(issue.blockedBy, terminalStatesLower)) {
    return false;
  }

  if (availableGlobalSlots(state, config) <= 0) return false;
  if (availableStateSlots(issue.state, state, config) <= 0) return false;

  return true;
}
