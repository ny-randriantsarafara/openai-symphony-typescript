import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseArgs } from "../cli.js";

describe("parseArgs", () => {
  it("returns default workflow path ./WORKFLOW.md when no args", () => {
    const result = parseArgs(["node", "cli.js"]);
    expect(result.workflowPath).toBe(resolve(process.cwd(), "WORKFLOW.md"));
  });

  it("returns explicit workflow path from positional arg", () => {
    const result = parseArgs(["node", "cli.js", "custom/workflow.md"]);
    expect(result.workflowPath).toBe(resolve(process.cwd(), "custom/workflow.md"));
  });

  it("returns port from --port flag", () => {
    const result = parseArgs(["node", "cli.js", "--port", "3000"]);
    expect(result.port).toBe(3000);
  });

  it("returns port undefined when no --port", () => {
    const result = parseArgs(["node", "cli.js"]);
    expect(result.port).toBeUndefined();
  });
});
