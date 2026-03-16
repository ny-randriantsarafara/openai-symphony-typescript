import { EventEmitter } from "node:events";
import { watch } from "chokidar";
import { loadWorkflow } from "./workflow-loader.js";
import { resolveConfig } from "./config-resolver.js";
import type { ServiceConfig, SymphonyError, Result } from "@symphony/shared";

export interface ConfigWatcherEvents {
  configReloaded: [config: ServiceConfig, promptTemplate: string];
  configReloadFailed: [error: SymphonyError];
}

export class ConfigWatcher extends EventEmitter {
  private currentConfig: ServiceConfig | null = null;
  private currentPromptTemplate: string = "";
  private watcher: ReturnType<typeof watch> | null = null;

  constructor(private readonly workflowPath: string) {
    super();
  }

  async start(): Promise<Result<void, SymphonyError>> {
    const result = await this.reload();
    if (!result.ok) return result;

    if (this.watcher) {
      return { ok: true, value: undefined };
    }

    this.watcher = watch(this.workflowPath, { ignoreInitial: true });
    this.watcher.on("change", () => {
      void this.reload();
    });

    return { ok: true, value: undefined };
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  getCurrentConfig(): ServiceConfig | null {
    return this.currentConfig;
  }

  getCurrentPromptTemplate(): string {
    return this.currentPromptTemplate;
  }

  private async reload(): Promise<Result<void, SymphonyError>> {
    const loaded = await loadWorkflow(this.workflowPath);
    if (!loaded.ok) {
      this.emit("configReloadFailed", loaded.error);
      return loaded;
    }
    const config = resolveConfig(loaded.value.config);
    this.currentConfig = config;
    this.currentPromptTemplate = loaded.value.promptTemplate;
    this.emit("configReloaded", config, loaded.value.promptTemplate);
    return { ok: true, value: undefined };
  }
}
