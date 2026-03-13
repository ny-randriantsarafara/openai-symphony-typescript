import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateBackoffDelay,
  RetryQueue,
  type RetryType,
} from "../retry";
import type { RetryEntry } from "@symphony/shared";

const DEFAULT_MAX_RETRY_BACKOFF_MS = 300000;

describe("calculateBackoffDelay", () => {
  it("returns 1000ms for continuation retry type", () => {
    expect(calculateBackoffDelay("continuation", 1, DEFAULT_MAX_RETRY_BACKOFF_MS)).toBe(1000);
    expect(calculateBackoffDelay("continuation", 2, DEFAULT_MAX_RETRY_BACKOFF_MS)).toBe(1000);
  });

  it("returns 10000ms for failure attempt 1", () => {
    expect(calculateBackoffDelay("failure", 1, DEFAULT_MAX_RETRY_BACKOFF_MS)).toBe(10000);
  });

  it("returns 20000ms for failure attempt 2", () => {
    expect(calculateBackoffDelay("failure", 2, DEFAULT_MAX_RETRY_BACKOFF_MS)).toBe(20000);
  });

  it("returns 40000ms for failure attempt 3", () => {
    expect(calculateBackoffDelay("failure", 3, DEFAULT_MAX_RETRY_BACKOFF_MS)).toBe(40000);
  });

  it("caps backoff at maxRetryBackoffMs (default 300000)", () => {
    const capped = calculateBackoffDelay("failure", 10, DEFAULT_MAX_RETRY_BACKOFF_MS);
    expect(capped).toBe(300000);
  });

  it("caps backoff when custom maxRetryBackoffMs is smaller", () => {
    const capped = calculateBackoffDelay("failure", 3, 30000);
    expect(capped).toBe(30000);
  });
});

describe("RetryQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedule creates a retry entry with correct fields", () => {
    const queue = new RetryQueue();
    const onFired = vi.fn();
    const entry = queue.schedule(
      "issue-1",
      "MY-123",
      2,
      5000,
      "some error",
      onFired,
    );

    expect(entry).toEqual({
      issueId: "issue-1",
      identifier: "MY-123",
      attempt: 2,
      dueAtMs: expect.any(Number),
      error: "some error",
    });
    expect(entry.dueAtMs).toBe(Date.now() + 5000);
  });

  it("schedule cancels existing retry for same issueId", () => {
    const queue = new RetryQueue();
    const onFired1 = vi.fn();
    const onFired2 = vi.fn();

    queue.schedule("issue-1", "MY-123", 1, 5000, null, onFired1);
    queue.schedule("issue-1", "MY-123", 2, 10000, "error", onFired2);

    vi.advanceTimersByTime(5000);
    expect(onFired1).not.toHaveBeenCalled();
    expect(onFired2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(onFired1).not.toHaveBeenCalled();
    expect(onFired2).toHaveBeenCalledWith("issue-1");
  });

  it("cancel removes the entry and clears the timer", () => {
    const queue = new RetryQueue();
    const onFired = vi.fn();

    queue.schedule("issue-1", "MY-123", 1, 5000, null, onFired);
    expect(queue.get("issue-1")).toBeDefined();

    queue.cancel("issue-1");
    expect(queue.get("issue-1")).toBeUndefined();

    vi.advanceTimersByTime(10000);
    expect(onFired).not.toHaveBeenCalled();
  });

  it("getAll returns all scheduled retries", () => {
    const queue = new RetryQueue();
    const onFired = vi.fn();

    queue.schedule("issue-1", "MY-123", 1, 5000, null, onFired);
    queue.schedule("issue-2", "MY-456", 2, 10000, "err", onFired);

    const all = queue.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((e: RetryEntry) => e.issueId).sort()).toEqual(["issue-1", "issue-2"]);
  });

  it("clear removes all entries and timers", () => {
    const queue = new RetryQueue();
    const onFired = vi.fn();

    queue.schedule("issue-1", "MY-123", 1, 5000, null, onFired);
    queue.schedule("issue-2", "MY-456", 2, 10000, null, onFired);

    queue.clear();

    expect(queue.get("issue-1")).toBeUndefined();
    expect(queue.get("issue-2")).toBeUndefined();
    expect(queue.getAll()).toHaveLength(0);

    vi.advanceTimersByTime(15000);
    expect(onFired).not.toHaveBeenCalled();
  });
});
