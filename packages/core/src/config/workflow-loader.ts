import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { WorkflowDefinition, SymphonyError, Result } from "@symphony/shared";

function isErrno(err: unknown, code: string): boolean {
  if (err === null || typeof err !== "object") return false;
  const desc = Object.getOwnPropertyDescriptor(err, "code");
  return desc?.value === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function toConfigMap(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k === "string") {
      result[k] = v;
    }
  }
  return result;
}

export async function loadWorkflow(
  filePath: string
): Promise<Result<WorkflowDefinition, SymphonyError>> {
  let content: string;
  try {
    const buf = await readFile(filePath, "utf-8");
    content = buf;
  } catch (err) {
    if (isErrno(err, "ENOENT")) {
      return {
        ok: false,
        error: { kind: "missing_workflow_file", path: filePath },
      };
    }
    throw err;
  }

  const lines = content.split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";

  let config: Record<string, unknown>;
  let promptStartIndex: number;

  if (firstLine === "---") {
    const closingIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (closingIndex === -1) {
      return {
        ok: false,
        error: {
          kind: "workflow_parse_error",
          message: "Unclosed YAML front matter: no closing ---",
        },
      };
    }
    const yamlLines = lines.slice(1, closingIndex);
    const yamlStr = yamlLines.join("\n");

    let parsed: unknown;
    try {
      parsed = parseYaml(yamlStr);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      return {
        ok: false,
        error: { kind: "workflow_parse_error", message },
      };
    }

    if (!isRecord(parsed)) {
      return {
        ok: false,
        error: { kind: "workflow_front_matter_not_a_map" },
      };
    }

    config = toConfigMap(parsed);
    promptStartIndex = closingIndex + 1;
  } else {
    config = {};
    promptStartIndex = 0;
  }

  const promptLines = lines.slice(promptStartIndex);
  const promptTemplate = promptLines.join("\n").trim();

  return {
    ok: true,
    value: { config, promptTemplate },
  };
}
