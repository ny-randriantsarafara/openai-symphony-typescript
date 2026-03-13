import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkspaceManager } from "../workspace-manager.js";
import type { HooksConfig } from "@symphony/shared";

describe("WorkspaceManager", () => {
  let workspaceRoot: string;
  const logger = { warn: vi.fn(), info: vi.fn() };

  async function createTempRoot(): Promise<string> {
    return mkdtemp(join(tmpdir(), "symphony-workspace-manager-"));
  }

  beforeEach(async () => {
    workspaceRoot = await createTempRoot();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  const noHooks: HooksConfig = {
    afterCreate: null,
    beforeRun: null,
    afterRun: null,
    beforeRemove: null,
    timeoutMs: 60000,
  };

  it("produces deterministic workspace path per issue identifier", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    const r1 = await manager.createForIssue("MT-42");
    const r2 = await manager.createForIssue("MT-42");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.path).toBe(r2.value.path);
      expect(r1.value.workspaceKey).toBe(r2.value.workspaceKey);
    }
  });

  it("sanitizes identifier (e.g., ABC/123 -> ABC_123, MT-42 stays MT-42)", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    const r1 = await manager.createForIssue("ABC/123");
    const r2 = await manager.createForIssue("MT-42");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.workspaceKey).toBe("ABC_123");
      expect(r2.value.workspaceKey).toBe("MT-42");
    }
  });

  it("creates missing workspace directory (createdNow = true)", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    const result = await manager.createForIssue("NEW-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.createdNow).toBe(true);
    }
  });

  it("reuses existing workspace directory (createdNow = false)", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    await manager.createForIssue("EXIST-1");
    const result = await manager.createForIssue("EXIST-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.createdNow).toBe(false);
    }
  });

  it("rejects workspace path outside workspace root (path traversal attempt like ..)", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    const result = await manager.createForIssue("..");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("workspace_path_violation");
    }
  });

  it("validates workspace path is under root before returning", async () => {
    const manager = new WorkspaceManager(workspaceRoot, noHooks, logger);
    const result = await manager.createForIssue("valid-key");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path.startsWith(workspaceRoot)).toBe(true);
    }
  });

  it("after_create hook runs only on new workspace (mock or spy)", async () => {
    const hooks: HooksConfig = {
      ...noHooks,
      afterCreate: "echo run >> .hook_runs",
      timeoutMs: 5000,
    };
    const manager = new WorkspaceManager(workspaceRoot, hooks, logger);
    await manager.createForIssue("HOOK-NEW");
    await manager.createForIssue("HOOK-NEW");
    const content = await readFile(
      join(workspaceRoot, "HOOK-NEW", ".hook_runs"),
      "utf-8"
    );
    expect(content.trim().split("\n")).toHaveLength(1);
  });

  it("before_run hook failure aborts attempt (returns error)", async () => {
    const hooks: HooksConfig = {
      ...noHooks,
      beforeRun: "exit 1",
      timeoutMs: 5000,
    };
    const manager = new WorkspaceManager(workspaceRoot, hooks, logger);
    await manager.createForIssue("BEFORE-RUN-FAIL");
    const beforeResult = await manager.runBeforeRun(join(workspaceRoot, "BEFORE-RUN-FAIL"));
    expect(beforeResult.ok).toBe(false);
    if (!beforeResult.ok) {
      expect(beforeResult.error.kind).toBe("hook_failed");
    }
  });

  it("after_run hook failure is logged and ignored (does not return error)", async () => {
    const hooks: HooksConfig = {
      ...noHooks,
      afterRun: "exit 1",
      timeoutMs: 5000,
    };
    const manager = new WorkspaceManager(workspaceRoot, hooks, logger);
    await manager.createForIssue("AFTER-RUN-FAIL");
    await manager.runAfterRun(join(workspaceRoot, "AFTER-RUN-FAIL"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("after_run hook failed"));
  });

  it("hook timeout is enforced", async () => {
    const hooks: HooksConfig = {
      ...noHooks,
      afterCreate: "sleep 10",
      timeoutMs: 100,
    };
    const manager = new WorkspaceManager(workspaceRoot, hooks, logger);
    const result = await manager.createForIssue("TIMEOUT-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("hook_timeout");
    }
  });

  it("after_create hook failure is fatal to workspace creation (cleans up dir)", async () => {
    const hooks: HooksConfig = {
      ...noHooks,
      afterCreate: "exit 1",
      timeoutMs: 5000,
    };
    const manager = new WorkspaceManager(workspaceRoot, hooks, logger);
    const result = await manager.createForIssue("AFTER-CREATE-FAIL");
    expect(result.ok).toBe(false);
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(workspaceRoot, "AFTER-CREATE-FAIL"))).toBe(false);
  });
});
