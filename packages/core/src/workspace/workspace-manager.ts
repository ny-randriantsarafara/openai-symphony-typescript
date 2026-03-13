import { mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import type {
  WorkspaceInfo,
  HooksConfig,
  SymphonyError,
  Result,
} from "@symphony/shared";
import { sanitizeIdentifier, isPathUnderRoot } from "./path-safety.js";

export class WorkspaceManager {
  constructor(
    private readonly workspaceRoot: string,
    private readonly hooks: HooksConfig,
    private readonly logger: { warn: (msg: string) => void; info: (msg: string) => void }
  ) {}

  async createForIssue(
    identifier: string
  ): Promise<Result<WorkspaceInfo, SymphonyError>> {
    const key = sanitizeIdentifier(identifier);
    const workspacePath = resolve(join(this.workspaceRoot, key));

    if (!isPathUnderRoot(workspacePath, this.workspaceRoot)) {
      return {
        ok: false,
        error: {
          kind: "workspace_path_violation",
          path: workspacePath,
          root: this.workspaceRoot,
        },
      };
    }

    let createdNow = false;
    try {
      await stat(workspacePath);
    } catch {
      await mkdir(workspacePath, { recursive: true });
      createdNow = true;
    }

    if (createdNow && this.hooks.afterCreate) {
      const hookResult = await this.runHook(
        this.hooks.afterCreate,
        workspacePath
      );
      if (!hookResult.ok) {
        await rm(workspacePath, { recursive: true, force: true });
        return hookResult;
      }
    }

    return {
      ok: true,
      value: { path: workspacePath, workspaceKey: key, createdNow },
    };
  }

  async runBeforeRun(workspacePath: string): Promise<Result<void, SymphonyError>> {
    if (!this.hooks.beforeRun) return { ok: true, value: undefined };
    return this.runHook(this.hooks.beforeRun, workspacePath);
  }

  async runAfterRun(workspacePath: string): Promise<void> {
    if (!this.hooks.afterRun) return;
    const result = await this.runHook(this.hooks.afterRun, workspacePath);
    if (!result.ok) {
      this.logger.warn(`after_run hook failed: ${result.error.kind}`);
    }
  }

  async removeWorkspace(identifier: string): Promise<void> {
    const key = sanitizeIdentifier(identifier);
    const workspacePath = resolve(join(this.workspaceRoot, key));

    if (!isPathUnderRoot(workspacePath, this.workspaceRoot)) return;

    if (this.hooks.beforeRemove) {
      const result = await this.runHook(
        this.hooks.beforeRemove,
        workspacePath
      );
      if (!result.ok) {
        this.logger.warn(`before_remove hook failed: ${result.error.kind}`);
      }
    }

    await rm(workspacePath, { recursive: true, force: true });
  }

  private runHook(
    script: string,
    cwd: string
  ): Promise<Result<void, SymphonyError>> {
    return new Promise((fulfill) => {
      execFile(
        "bash",
        ["-lc", script],
        {
          cwd,
          timeout: this.hooks.timeoutMs,
        },
        (error) => {
          if (error) {
            if (error.killed) {
              fulfill({
                ok: false,
                error: {
                  kind: "hook_timeout",
                  hook: script,
                  timeoutMs: this.hooks.timeoutMs,
                },
              });
            } else {
              fulfill({
                ok: false,
                error: {
                  kind: "hook_failed",
                  hook: script,
                  message: error.message,
                },
              });
            }
          } else {
            fulfill({ ok: true, value: undefined });
          }
        }
      );
    });
  }
}
