import { describe, it, expect } from "vitest";
import { decideRunOutcome } from "../runtime/run-outcome.js";

describe("decideRunOutcome", () => {
  it("does not request continuation when the issue is no longer active", () => {
    expect(
      decideRunOutcome({
        stopRequested: false,
        lastError: null,
        shouldContinue: false,
        issueStillActive: false,
      })
    ).toBe("terminal");
  });

  it("requests continuation when work stopped cleanly but the issue is still active", () => {
    expect(
      decideRunOutcome({
        stopRequested: false,
        lastError: null,
        shouldContinue: false,
        issueStillActive: true,
      })
    ).toBe("continuation");
  });
});
