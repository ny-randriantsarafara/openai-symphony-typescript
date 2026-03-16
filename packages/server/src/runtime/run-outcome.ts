interface RunOutcomeInput {
  readonly stopRequested: boolean;
  readonly lastError: string | null;
  readonly shouldContinue: boolean;
  readonly issueStillActive: boolean;
}

export function decideRunOutcome(
  input: RunOutcomeInput
): "canceled" | "failure" | "continuation" | "terminal" {
  if (input.stopRequested) return "canceled";
  if (input.lastError) return "failure";
  if (!input.shouldContinue && input.issueStillActive) return "continuation";
  return "terminal";
}
