import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import type {
  AgentProvider,
  AgentSession,
  SessionStartParams,
  TurnParams,
} from "../types.js";
import type { AgentEvent, ServiceConfig } from "@symphony/shared";

interface JsonRpcRequest {
  id?: number;
  method?: string;
  params?: unknown;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
}

function isJsonRpcResponse(obj: unknown): obj is JsonRpcResponse {
  return obj !== null && typeof obj === "object" && "id" in obj;
}

function parseJsonRpc(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return null;
  }
}

function extractThreadId(response: JsonRpcResponse): string | null {
  const result = response.result;
  if (result === null || typeof result !== "object") return null;
  const thread = (result as Record<string, unknown>).thread;
  if (thread === null || typeof thread !== "object") return null;
  const id = (thread as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

function extractTurnId(response: JsonRpcResponse): string | null {
  const result = response.result;
  if (result === null || typeof result !== "object") return null;
  const turn = (result as Record<string, unknown>).turn;
  if (turn === null || typeof turn !== "object") return null;
  const id = (turn as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

function writeStdin(
  stream: NodeJS.WritableStream | null,
  data: string
): Promise<void> {
  if (!stream || !("write" in stream)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const ok = (stream as NodeJS.WritableStream).write(
      data + "\n",
      (err?: Error) => (err ? reject(err) : resolve())
    );
    if (ok) resolve();
  });
}

function createLineIterator(
  rl: ReturnType<typeof createInterface>
): AsyncIterable<string> {
  const queue: string[] = [];
  let waitResolve: (() => void) | null = null;
  let ended = false;

  rl.on("line", (line: string) => {
    queue.push(line);
    if (waitResolve) {
      waitResolve();
      waitResolve = null;
    }
  });
  rl.on("close", () => {
    ended = true;
    if (waitResolve) {
      waitResolve();
      waitResolve = null;
    }
  });

  return {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift() as string;
          continue;
        }
        if (ended) return;
        await new Promise<void>((r) => {
          waitResolve = r;
        });
      }
    },
  };
}

function waitForResponse(
  rl: AsyncIterable<string>,
  expectedId: number,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Read timeout: no response for id ${expectedId} within ${timeoutMs}ms`));
    }, timeoutMs);

    (async () => {
      try {
        for await (const line of rl) {
          const parsed = parseJsonRpc(line);
          if (parsed !== null && isJsonRpcResponse(parsed)) {
            if (parsed.id === expectedId) {
              clearTimeout(timer);
              resolve(line);
              return;
            }
          }
        }
        clearTimeout(timer);
        reject(new Error(`Stream ended before response for id ${expectedId}`));
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    })();
  });
}

export function createCodexProvider(): AgentProvider {
  return {
    name: "Codex",

    async startSession(params: SessionStartParams): Promise<AgentSession> {
      const { workspacePath, config } = params;
      const command = config.agent.command;
      const readTimeoutMs = config.codex.readTimeoutMs;
      const turnTimeoutMs = config.codex.turnTimeoutMs;

      const child = execFile(
        "bash",
        ["-lc", command],
        {
          cwd: workspacePath,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      const stdout = child.stdout;
      if (!stdout || !("on" in stdout)) {
        throw new Error("Codex process stdout is not readable");
      }

      const stdin = child.stdin;
      const rl = createInterface({
        input: stdout as Readable,
        crlfDelay: Infinity,
      });

      const lines = createLineIterator(rl);

      const sendRequest = (method: string, id: number, params?: unknown) => {
        const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method };
        if (params !== undefined) payload.params = params;
        return writeStdin(stdin, JSON.stringify(payload));
      };

      const sendNotification = (method: string) => {
        const payload = { jsonrpc: "2.0", method };
        return writeStdin(stdin, JSON.stringify(payload));
      };

      await sendRequest("initialize", 1, {});
      const initResp = await waitForResponse(lines, 1, readTimeoutMs);
      const initParsed = parseJsonRpc(initResp);
      if (initParsed === null || !isJsonRpcResponse(initParsed)) {
        throw new Error("Invalid initialize response");
      }

      await sendNotification("initialized");

      await sendRequest("thread/start", 2, {});
      const threadResp = await waitForResponse(lines, 2, readTimeoutMs);
      const threadParsed = parseJsonRpc(threadResp);
      if (threadParsed === null || !isJsonRpcResponse(threadParsed)) {
        throw new Error("Invalid thread/start response");
      }
      const threadId = extractThreadId(threadParsed);
      if (!threadId) {
        throw new Error("Missing thread.id in thread/start response");
      }

      await sendRequest("turn/start", 3, {});
      const turnResp = await waitForResponse(lines, 3, readTimeoutMs);
      const turnParsed = parseJsonRpc(turnResp);
      if (turnParsed === null || !isJsonRpcResponse(turnParsed)) {
        throw new Error("Invalid turn/start response");
      }
      const turnId = extractTurnId(turnParsed);
      if (!turnId) {
        throw new Error("Missing turn.id in turn/start response");
      }

      const sessionId = `${threadId}-${turnId}`;
      let nextRequestId = 4;

      const session: AgentSession = {
        sessionId,
        threadId,
        async *runTurn(turnParams: TurnParams): AsyncIterable<AgentEvent> {
          const turnStart = Date.now();

          yield {
            type: "session_started",
            sessionId,
            threadId,
            turnId,
          };

          const promptPayload = {
            prompt: turnParams.prompt,
            issue: turnParams.issue,
            turnNumber: turnParams.turnNumber,
            isFirstTurn: turnParams.isFirstTurn,
          };
          await sendRequest("turn/input", nextRequestId, promptPayload);
          nextRequestId++;

          const turnResp2 = await waitForResponse(
            lines,
            nextRequestId - 1,
            turnTimeoutMs
          );
          const turnInputResp = parseJsonRpc(turnResp2);
          if (
            turnInputResp !== null &&
            isJsonRpcResponse(turnInputResp) &&
            turnInputResp.error
          ) {
            yield {
              type: "turn_failed",
              error: String(turnInputResp.error.message ?? "Unknown error"),
            };
            return;
          }

          for await (const line of lines) {
            if (Date.now() - turnStart > turnTimeoutMs) {
              yield {
                type: "turn_failed",
                error: `Turn timeout after ${turnTimeoutMs}ms`,
              };
              return;
            }

            const parsed = parseJsonRpc(line);
            if (parsed === null) continue;

            if (typeof parsed === "object" && parsed !== null && "method" in parsed) {
              const method = (parsed as { method?: string }).method;
              const params = (parsed as { params?: unknown }).params;
              const id = (parsed as { id?: number }).id;

              if (method === "turn/completed") {
                const p = params as Record<string, unknown> | undefined;
                const inputTokens = typeof p?.inputTokens === "number" ? p.inputTokens : 0;
                const outputTokens = typeof p?.outputTokens === "number" ? p.outputTokens : 0;
                const totalTokens = typeof p?.totalTokens === "number" ? p.totalTokens : 0;
                yield {
                  type: "turn_completed",
                  inputTokens,
                  outputTokens,
                  totalTokens,
                };
                return;
              }

              if (method === "turn/failed") {
                const p = params as Record<string, unknown> | undefined;
                yield {
                  type: "turn_failed",
                  error: String(p?.error ?? "Turn failed"),
                };
                return;
              }

              if (method === "turn/cancelled") {
                yield { type: "turn_cancelled" };
                return;
              }

              if (method === "user-input-required" || method === "user_input_required") {
                yield {
                  type: "turn_failed",
                  error: "User input required - not supported in headless mode",
                };
                return;
              }

              if (method === "approval/auto_approved" || method === "approval_auto_approved") {
                yield {
                  type: "approval_auto_approved",
                  details: params ?? {},
                };
                continue;
              }

              if (method === "approval/request" || method === "approval_request") {
                if (typeof id === "number") {
                  await writeStdin(
                    stdin,
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id,
                      result: { approved: true },
                    })
                  );
                  yield {
                    type: "approval_auto_approved",
                    details: params ?? {},
                  };
                }
                continue;
              }

              if (
                (method?.startsWith("tool/") || method === "tool_call") &&
                typeof id === "number"
              ) {
                await writeStdin(
                  stdin,
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    error: {
                      code: -32601,
                      message: "Unsupported tool call",
                    },
                  })
                );
                continue;
              }
            }
          }
        },

        async stop(): Promise<void> {
          child.kill("SIGTERM");
        },
      };

      return session;
    },
  };
}
