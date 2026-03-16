#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { startRuntime } from "./runtime/start-runtime.js";

export interface CliArgs {
  readonly workflowPath: string;
  readonly port: number | undefined;
}

interface RuntimeHandle {
  stop(): Promise<void>;
}

interface RunCliDependencies {
  readonly fileExists?: (path: string) => boolean;
  readonly startRuntime?: (args: CliArgs) => Promise<RuntimeHandle>;
  readonly onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
  readonly log?: (message: string) => void;
  readonly error?: (message: string) => void;
  readonly exit?: (code: number) => void;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const program = new Command();

  program
    .name("symphony")
    .description("Symphony orchestration service")
    .argument("[workflow-path]", "Path to WORKFLOW.md", "./WORKFLOW.md")
    .option("-p, --port <port>", "HTTP server port")
    .parse([...argv]);

  const baseDir = process.env["INIT_CWD"] || process.cwd();
  const workflowPath = resolve(baseDir, program.args[0] ?? "./WORKFLOW.md");
  const opts = program.opts<{ port?: string }>();
  const port = opts.port !== undefined ? parseInt(opts.port, 10) : undefined;

  return { workflowPath, port };
}

export async function runCli(
  argv: readonly string[],
  deps: RunCliDependencies = {}
): Promise<RuntimeHandle> {
  const {
    fileExists = existsSync,
    startRuntime: start = startRuntime,
    onSignal = (signal, handler) => {
      process.on(signal, handler);
    },
    log = console.log,
    error = console.error,
    exit = (code) => {
      process.exit(code);
    },
  } = deps;

  const args = parseArgs(argv);

  if (!fileExists(args.workflowPath)) {
    throw new Error(`Workflow file not found: ${args.workflowPath}`);
  }

  log(`Symphony starting with workflow: ${args.workflowPath}`);
  const runtime = await start(args);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("Symphony shutting down...");
    try {
      await runtime.stop();
      exit(0);
    } catch (runtimeError: unknown) {
      const message = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
      error(`Shutdown error: ${message}`);
      exit(1);
    }
  };

  onSignal("SIGINT", shutdown);
  onSignal("SIGTERM", shutdown);

  return runtime;
}

async function main(): Promise<void> {
  try {
    await runCli(process.argv);
  } catch (runtimeError: unknown) {
    const message = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((error: unknown) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
