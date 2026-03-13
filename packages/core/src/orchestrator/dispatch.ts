import type { Issue, ServiceConfig } from "@symphony/shared";
import type { OrchestratorState } from "./state.js";

export function sortForDispatch(issues: readonly Issue[]): readonly Issue[] {
  return [...issues];
}

export function isEligibleForDispatch(
  _issue: Issue,
  _state: OrchestratorState,
  _config: ServiceConfig
): boolean {
  return false;
}

export function availableGlobalSlots(
  _state: OrchestratorState,
  _config: ServiceConfig
): number {
  return 0;
}

export function availableStateSlots(
  _stateName: string,
  _state: OrchestratorState,
  _config: ServiceConfig
): number {
  return 0;
}
