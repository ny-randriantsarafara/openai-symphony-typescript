import { describe, it, expect } from "vitest";
import { resolveProxyTarget } from "../../scripts/dev-proxy.mjs";

describe("dashboard dev proxy", () => {
  it("routes api traffic to the backend", () => {
    expect(resolveProxyTarget("/api/v1/state")).toBe("http://127.0.0.1:8080");
  });

  it("routes websocket traffic to the backend", () => {
    expect(resolveProxyTarget("/ws")).toBe("http://127.0.0.1:8080");
  });

  it("routes websocket traffic with query strings to the backend", () => {
    expect(resolveProxyTarget("/ws?token=abc")).toBe("http://127.0.0.1:8080");
  });

  it("routes page traffic to next dev server", () => {
    expect(resolveProxyTarget("/")).toBe("http://127.0.0.1:3002");
  });
});
