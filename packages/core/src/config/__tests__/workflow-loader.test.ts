import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadWorkflow } from "../workflow-loader";

describe("loadWorkflow", () => {
  async function createTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), "symphony-workflow-loader-"));
  }

  it("parses valid WORKFLOW.md with front matter + prompt body", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(
      path,
      `---
model: gpt-4
temperature: 0.7
---
You are a helpful assistant.
`,
      "utf-8"
    );

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.config).toEqual({
        model: "gpt-4",
        temperature: 0.7,
      });
      expect(result.value.promptTemplate).toBe("You are a helpful assistant.");
    }
  });

  it("returns empty config when no front matter present (entire file is prompt)", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(path, "Just a plain prompt body.\nNo YAML here.\n", "utf-8");

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.config).toEqual({});
      expect(result.value.promptTemplate).toBe(
        "Just a plain prompt body.\nNo YAML here."
      );
    }
  });

  it("returns missing_workflow_file error for missing file", async () => {
    const dir = await createTempDir();
    const path = join(dir, "nonexistent-WORKFLOW.md");

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("missing_workflow_file");
      expect(result.error.path).toBe(path);
    }
  });

  it("returns workflow_parse_error for invalid YAML", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(
      path,
      `---
invalid: yaml: [unclosed
---
Prompt body.
`,
      "utf-8"
    );

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("workflow_parse_error");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("returns workflow_front_matter_not_a_map for non-map YAML (e.g., a YAML list)", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(
      path,
      `---
- item1
- item2
---
Prompt body.
`,
      "utf-8"
    );

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("workflow_front_matter_not_a_map");
    }
  });

  it("trims prompt body whitespace", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(
      path,
      `---
key: value
---

  \n\n  Trimmed prompt.\n  \n`,
      "utf-8"
    );

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.promptTemplate).toBe("Trimmed prompt.");
    }
  });

  it("handles empty prompt body (front matter only)", async () => {
    const dir = await createTempDir();
    const path = join(dir, "WORKFLOW.md");
    await writeFile(
      path,
      `---
model: gpt-4
---
`,
      "utf-8"
    );

    const result = await loadWorkflow(path);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.config).toEqual({ model: "gpt-4" });
      expect(result.value.promptTemplate).toBe("");
    }
  });
});
