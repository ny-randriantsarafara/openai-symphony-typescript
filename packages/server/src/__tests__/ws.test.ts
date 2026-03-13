import { describe, it, expect, beforeEach, vi } from "vitest";
import { WsServer } from "../ws/ws-server.js";
import type { StateResponse } from "@symphony/shared";
import type { FastifyInstance } from "fastify";

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>;
  readyState: number;
  on(event: string, fn: () => void): MockWebSocket;
  _emitClose?: () => void;
}

type WsHandler = (socket: MockWebSocket) => void;

const mockState: StateResponse = {
  generatedAt: "2024-01-01T00:00:00Z",
  counts: { running: 1, retrying: 0 },
  running: [
    {
      issueId: "issue-1",
      issueIdentifier: "MT-649",
      state: "In Progress",
      sessionId: "sess-1",
      turnCount: 2,
      lastEvent: "turn_completed",
      lastMessage: "Done",
      startedAt: "2024-01-01T00:00:00Z",
      lastEventAt: "2024-01-01T00:01:00Z",
      tokens: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    },
  ],
  retrying: [],
  codexTotals: {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    secondsRunning: 60,
  },
  rateLimits: null,
};

function createMockSocket(): MockWebSocket & { _emitClose: () => void } {
  const send = vi.fn();
  const handlers: Map<string, () => void> = new Map();
  const mock: MockWebSocket & { _emitClose: () => void } = {
    send,
    readyState: 1,
    on(event: string, fn: () => void) {
      handlers.set(event, fn);
      return mock;
    },
    _emitClose() {
      handlers.get("close")?.();
    },
  };
  return mock;
}

interface MockApp {
  get(path: string, opts: { websocket: true }, handler: WsHandler): void;
  register: ReturnType<typeof vi.fn>;
  _getWsHandler: () => WsHandler | undefined;
}

function createMockApp(): MockApp {
  const captured: { handler?: WsHandler } = {};
  return {
    get(_path: string, _opts: { websocket: true }, handler: WsHandler) {
      captured.handler = handler;
    },
    register: vi.fn(),
    _getWsHandler: () => captured.handler,
  };
}

describe("WsServer", () => {
  let wsServer: WsServer;
  let mockApp: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    wsServer = new WsServer(() => mockState);
    mockApp = createMockApp();
  });

  it("tracks connected clients", () => {
    wsServer.register(mockApp as unknown as Parameters<WsServer["register"]>[0]);
    const handler = mockApp._getWsHandler();
    expect(handler).toBeDefined();

    const socket1 = createMockSocket();
    handler!(socket1);
    expect(wsServer.getClientCount()).toBe(1);

    const socket2 = createMockSocket();
    handler?.(socket2);
    expect(wsServer.getClientCount()).toBe(2);
  });

  it("sends initial snapshot on connect", () => {
    wsServer.register(mockApp as unknown as Parameters<WsServer["register"]>[0]);
    const handler = mockApp._getWsHandler();
    expect(handler).toBeDefined();

    const socket = createMockSocket();
    if (!handler) throw new Error("handler expected");
    handler(socket);

    expect(socket.send).toHaveBeenCalledTimes(1);
    const calls = (socket.send as ReturnType<typeof vi.fn>).mock.calls;
    const firstCall = calls[0];
    if (!firstCall) throw new Error("Expected send to have been called");
    const sent = String(firstCall[0]);
    const parsed = JSON.parse(sent);
    expect(parsed.type).toBe("state:updated");
    expect(parsed.running).toEqual(mockState.running);
    expect(parsed.retrying).toEqual(mockState.retrying);
    expect(parsed.codexTotals).toEqual(mockState.codexTotals);
    expect(parsed.counts).toEqual(mockState.counts);
  });

  it("broadcast sends to all clients", () => {
    wsServer.register(mockApp as unknown as Parameters<WsServer["register"]>[0]);
    const handler = mockApp._getWsHandler();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    handler?.(socket1);
    handler?.(socket2);

    const event = { type: "session:started" as const, issueId: "i1", issueIdentifier: "MT-1", sessionId: "s1", workspacePath: "/p", startedAt: "2024-01-01T00:00:00Z" };
    wsServer.broadcast(event);

    expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(event));
    expect(socket2.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it("removes disconnected clients", () => {
    wsServer.register(mockApp as unknown as Parameters<WsServer["register"]>[0]);
    const handler = mockApp._getWsHandler();
    const socket = createMockSocket();
    handler?.(socket);
    expect(wsServer.getClientCount()).toBe(1);

    socket._emitClose?.();
    expect(wsServer.getClientCount()).toBe(0);
  });

  it("does not send to closed clients on broadcast", () => {
    wsServer.register(mockApp as unknown as Parameters<WsServer["register"]>[0]);
    const handler = mockApp._getWsHandler();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    handler?.(socket1);
    handler?.(socket2);

    (socket1 as { readyState: number }).readyState = 2; // CLOSING
    (socket2 as { readyState: number }).readyState = 3; // CLOSED

    vi.mocked(socket1.send).mockClear();
    vi.mocked(socket2.send).mockClear();

    const event = { type: "config:reloaded" as const, reloadedAt: "2024-01-01T00:00:00Z", valid: true, changes: [] };
    wsServer.broadcast(event);

    expect(socket1.send).not.toHaveBeenCalled();
    expect(socket2.send).not.toHaveBeenCalled();
  });
});
