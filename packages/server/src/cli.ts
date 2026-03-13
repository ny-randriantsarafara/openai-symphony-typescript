#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

export interface CliArgs {
  readonly workflowPath: string;
  readonly port: number | undefined;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const program = new Command();

  program
    .name("symphony")
    .description("Symphony orchestration service")
    .argument("[workflow-path]", "Path to WORKFLOW.md", "./WORKFLOW.md")
    .option("-p, --port <port>", "HTTP server port")
    .parse([...argv]);

  const workflowPath = resolve(program.args[0] ?? "./WORKFLOW.md");
  const opts = program.opts<{ port?: string }>();
  const port = opts.port !== undefined ? parseInt(opts.port, 10) : undefined;

  return { workflowPath, port };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!existsSync(args.workflowPath)) {
    console.error(`Error: Workflow file not found: ${args.workflowPath}`);
    process.exit(1);
  }

  console.log(`Symphony starting with workflow: ${args.workflowPath}`);

  // TODO: Initialize orchestrator, start HTTP server, handle shutdown
  // For now, just validate and log

  const shutdown = () => {
    console.log("Symphony shutting down...");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
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
