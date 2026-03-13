import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigWatcher } from "../config-watcher.js";
import type { ServiceConfig, SymphonyError } from "@symphony/shared";

const VALID_WORKFLOW_V1 = `---
tracker:
  kind: linear
  project_slug: TEST
  api_key: lin_api_xxx
polling:
  interval_ms: 30000
---
Original prompt template.
`;

const VALID_WORKFLOW_V2 = `---
tracker:
  kind: linear
  project_slug: UPDATED
  api_key: lin_api_yyy
polling:
  interval_ms: 60000
---
Updated prompt template.
`;

const INVALID_YAML_WORKFLOW = `---
invalid: yaml: [unclosed
---
Prompt body.
`;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("ConfigWatcher", () => {
  let watcher: ConfigWatcher | null = null;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }
  });

  it("initial load populates current config and prompt template", async () => {
    const dir = await mkdtemp(join(tmpdir(), "symphony-config-watcher-"));
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, VALID_WORKFLOW_V1, "utf-8");

    watcher = new ConfigWatcher(path);
    const startResult = await watcher.start();

    expect(startResult.ok).toBe(true);
    const config = watcher.getCurrentConfig();
    expect(config).not.toBeNull();
    if (config) {
      expect(config.tracker.projectSlug).toBe("TEST");
      expect(config.polling.intervalMs).toBe(30000);
    }
    expect(watcher.getCurrentPromptTemplate()).toBe("Original prompt template.");
  });

  it("file change triggers reload and updates config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "symphony-config-watcher-"));
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, VALID_WORKFLOW_V1, "utf-8");

    watcher = new ConfigWatcher(path);
    await watcher.start();

    await writeFile(path, VALID_WORKFLOW_V2, "utf-8");
    await delay(150);

    const config = watcher.getCurrentConfig();
    expect(config).not.toBeNull();
    if (config) {
      expect(config.tracker.projectSlug).toBe("UPDATED");
      expect(config.polling.intervalMs).toBe(60000);
    }
    expect(watcher.getCurrentPromptTemplate()).toBe("Updated prompt template.");
  });

  it("keeps last-known-good config on invalid reload (bad YAML)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "symphony-config-watcher-"));
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, VALID_WORKFLOW_V1, "utf-8");

    watcher = new ConfigWatcher(path);
    await watcher.start();

    const originalConfig = watcher.getCurrentConfig();
    const originalPrompt = watcher.getCurrentPromptTemplate();
    expect(originalConfig).not.toBeNull();

    await writeFile(path, INVALID_YAML_WORKFLOW, "utf-8");
    await delay(150);

    expect(watcher.getCurrentConfig()).toEqual(originalConfig);
    expect(watcher.getCurrentPromptTemplate()).toBe(originalPrompt);
  });

  it("emits configReloaded event on successful reload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "symphony-config-watcher-"));
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, VALID_WORKFLOW_V1, "utf-8");

    watcher = new ConfigWatcher(path);
    const events: Array<{ config: ServiceConfig; promptTemplate: string }> = [];
    watcher.on(
      "configReloaded",
      (config: ServiceConfig, promptTemplate: string) => {
        events.push({ config, promptTemplate });
      }
    );

    await watcher.start();
    expect(events).toHaveLength(1);
    const first = events[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.config.tracker.projectSlug).toBe("TEST");
    }

    await writeFile(path, VALID_WORKFLOW_V2, "utf-8");
    await delay(150);

    expect(events).toHaveLength(2);
    const second = events[1];
    expect(second).toBeDefined();
    if (second) {
      expect(second.config.tracker.projectSlug).toBe("UPDATED");
      expect(second.promptTemplate).toBe("Updated prompt template.");
    }
  });

  it("emits configReloadFailed event on invalid reload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "symphony-config-watcher-"));
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, VALID_WORKFLOW_V1, "utf-8");

    watcher = new ConfigWatcher(path);
    const failedEvents: SymphonyError[] = [];
    watcher.on("configReloadFailed", (error: SymphonyError) => {
      failedEvents.push(error);
    });

    await watcher.start();
    expect(failedEvents).toHaveLength(0);

    await writeFile(path, INVALID_YAML_WORKFLOW, "utf-8");
    await delay(150);

    expect(failedEvents).toHaveLength(1);
    const failed = failedEvents[0];
    expect(failed).toBeDefined();
    if (failed) {
      expect(failed.kind).toBe("workflow_parse_error");
    }
  });
});
