import { describe, it, expect, vi } from "vitest";
import { cleanupSession } from "../runtime/session-cleanup.js";

describe("cleanupSession", () => {
  it("captures stop errors instead of throwing", async () => {
    const error = await cleanupSession({
      session: {
        stop: vi.fn().mockRejectedValue(new Error("stop failed")),
      },
      runAfterRun: vi.fn().mockResolvedValue(undefined),
    });

    expect(error).toBe("stop failed");
  });

  it("still runs after_run when stop fails", async () => {
    const runAfterRun = vi.fn().mockResolvedValue(undefined);

    await cleanupSession({
      session: {
        stop: vi.fn().mockRejectedValue(new Error("stop failed")),
      },
      runAfterRun,
    });

    expect(runAfterRun).toHaveBeenCalledTimes(1);
  });
});
