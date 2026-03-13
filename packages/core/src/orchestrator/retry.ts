import type { RetryEntry } from "@symphony/shared";

export type RetryType = "continuation" | "failure";

export function calculateBackoffDelay(
  type: RetryType,
  attempt: number,
  maxRetryBackoffMs: number,
): number {
  if (type === "continuation") return 1000;
  return Math.min(
    10000 * Math.pow(2, attempt - 1),
    maxRetryBackoffMs,
  );
}

export class RetryQueue {
  private readonly entries = new Map<
    string,
    { entry: RetryEntry; timerId: ReturnType<typeof setTimeout> }
  >();

  schedule(
    issueId: string,
    identifier: string,
    attempt: number,
    delayMs: number,
    error: string | null,
    onFired: (issueId: string) => void,
  ): RetryEntry {
    this.cancel(issueId);

    const dueAtMs = Date.now() + delayMs;
    const entry: RetryEntry = {
      issueId,
      identifier,
      attempt,
      dueAtMs,
      error,
    };
    const timerId = setTimeout(() => {
      this.entries.delete(issueId);
      onFired(issueId);
    }, delayMs);

    this.entries.set(issueId, { entry, timerId });
    return entry;
  }

  cancel(issueId: string): void {
    const existing = this.entries.get(issueId);
    if (existing) {
      clearTimeout(existing.timerId);
      this.entries.delete(issueId);
    }
  }

  get(issueId: string): RetryEntry | undefined {
    return this.entries.get(issueId)?.entry;
  }

  getAll(): readonly RetryEntry[] {
    return Array.from(this.entries.values()).map((e) => e.entry);
  }

  clear(): void {
    for (const { timerId } of this.entries.values()) {
      clearTimeout(timerId);
    }
    this.entries.clear();
  }
}
