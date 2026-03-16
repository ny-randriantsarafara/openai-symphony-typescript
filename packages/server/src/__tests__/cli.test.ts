import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";
import { parseArgs, runCli } from "../cli.js";

describe("parseArgs", () => {
  const baseDir = process.env["INIT_CWD"] || process.cwd();

  it("returns default workflow path ./WORKFLOW.md when no args", () => {
    const result = parseArgs(["node", "cli.js"]);
    expect(result.workflowPath).toBe(resolve(baseDir, "WORKFLOW.md"));
  });

  it("returns explicit workflow path from positional arg", () => {
    const result = parseArgs(["node", "cli.js", "custom/workflow.md"]);
    expect(result.workflowPath).toBe(resolve(baseDir, "custom/workflow.md"));
  });

  it("returns port from --port flag", () => {
    const result = parseArgs(["node", "cli.js", "--port", "3000"]);
    expect(result.port).toBe(3000);
  });

  it("returns port undefined when no --port", () => {
    const result = parseArgs(["node", "cli.js"]);
    expect(result.port).toBeUndefined();
  });

  it("resolves workflow path from INIT_CWD when present", () => {
    const originalInitCwd = process.env["INIT_CWD"];
    process.env["INIT_CWD"] = "/tmp/repo-root";

    try {
      const result = parseArgs(["node", "cli.js", "./WORKFLOW.md"]);
      expect(result.workflowPath).toBe(resolve("/tmp/repo-root", "WORKFLOW.md"));
    } finally {
      if (originalInitCwd === undefined) {
        delete process.env["INIT_CWD"];
      } else {
        process.env["INIT_CWD"] = originalInitCwd;
      }
    }
  });
});

describe("runCli", () => {
  it("starts runtime with parsed args", async () => {
    const startRuntime = vi.fn().mockResolvedValue({ stop: vi.fn().mockResolvedValue(undefined) });

    await runCli(["node", "cli.js", "./WORKFLOW.md", "--port", "8080"], {
      fileExists: () => true,
      startRuntime,
      onSignal: () => {},
      log: () => {},
      error: () => {},
    });

    expect(startRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowPath: resolve(process.env["INIT_CWD"] || process.cwd(), "WORKFLOW.md"),
        port: 8080,
      })
    );
  });

  it("awaits runtime stop and exits on signal", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const startRuntime = vi.fn().mockResolvedValue({ stop });
    let signalHandler: (() => void | Promise<void>) | undefined;
    const exit = vi.fn();

    await runCli(["node", "cli.js", "./WORKFLOW.md", "--port", "8080"], {
      fileExists: () => true,
      startRuntime,
      onSignal: (_signal, handler) => {
        signalHandler = handler;
      },
      log: () => {},
      error: () => {},
      exit,
    });

    await signalHandler?.();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
