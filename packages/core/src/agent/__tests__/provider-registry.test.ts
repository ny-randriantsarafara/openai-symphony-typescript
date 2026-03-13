import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../provider-registry.js";
import type { AgentProvider, AgentSession, SessionStartParams } from "../types.js";

function createMockProvider(name: string): AgentProvider {
  return {
    name,
    async startSession(_params: SessionStartParams): Promise<AgentSession> {
      return {
        sessionId: "sess-1",
        threadId: "thread-1",
        async *runTurn() {
          yield { type: "notification" as const, message: "ok" };
        },
        async stop() {},
      };
    },
  };
}

describe("ProviderRegistry", () => {
  it("returns the registered provider by name", () => {
    const registry = new ProviderRegistry();
    const codex = createMockProvider("Codex");
    registry.register(codex);

    const found = registry.get("Codex");
    expect(found).toBe(codex);
  });

  it("returns undefined for unknown provider name", () => {
    const registry = new ProviderRegistry();
    const found = registry.get("unknown");
    expect(found).toBeUndefined();
  });

  it("can register multiple providers", () => {
    const registry = new ProviderRegistry();
    const codex = createMockProvider("Codex");
    const claude = createMockProvider("Claude");
    registry.register(codex);
    registry.register(claude);

    expect(registry.get("Codex")).toBe(codex);
    expect(registry.get("Claude")).toBe(claude);
  });

  it("provider names are case-insensitive (e.g., 'Codex' and 'codex' both work)", () => {
    const registry = new ProviderRegistry();
    const codex = createMockProvider("Codex");
    registry.register(codex);

    expect(registry.get("codex")).toBe(codex);
    expect(registry.get("CODEX")).toBe(codex);
    expect(registry.has("Codex")).toBe(true);
    expect(registry.has("codex")).toBe(true);
  });
});
