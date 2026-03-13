import { describe, it, expect, beforeEach } from "vitest";
import { createServer } from "../http/server.js";
import type { ServerDependencies } from "../http/server.js";
import type {
  StateResponse,
  IssueDetailResponse,
  RefreshResponse,
  ConfigResponse,
  EventsResponse,
  RecentEvent,
} from "@symphony/shared";

const mockStateResponse: StateResponse = {
  generatedAt: "2025-01-01T00:00:00Z",
  counts: { running: 1, retrying: 0 },
  running: [],
  retrying: [],
  codexTotals: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    secondsRunning: 0,
  },
  rateLimits: null,
};

const mockIssueDetail: IssueDetailResponse = {
  issueIdentifier: "MT-649",
  issueId: "issue-1",
  status: "running",
  workspace: { path: "/workspace/MT-649" },
  attempts: { restartCount: 0, currentRetryAttempt: null },
  running: null,
  retry: null,
  recentEvents: [],
  lastError: null,
};

const mockRefreshResponse: RefreshResponse = {
  queued: true,
  coalesced: false,
  requestedAt: "2025-01-01T00:00:00Z",
  operations: ["poll"],
};

const mockConfigResponse: ConfigResponse = {
  workflowPath: "/workflow.md",
  lastReloadAt: "2025-01-01T00:00:00Z",
  validationStatus: "valid",
  validationErrors: [],
  config: {
    tracker: {
      kind: "jira",
      endpoint: "https://jira.example.com",
      projectSlug: "PROJ",
      activeStates: ["In Progress"],
      terminalStates: ["Done"],
    },
    polling: { intervalMs: 60000 },
    workspace: { root: "/workspace" },
    agent: {
      provider: "codex",
      command: "codex",
      maxConcurrentAgents: 2,
      maxTurns: 10,
      maxRetryBackoffMs: 60000,
      maxConcurrentAgentsByState: {},
    },
  },
};

const mockEvent: RecentEvent = {
  at: "2025-01-01T00:00:00Z",
  event: "session_started",
  message: "Session started",
  issueIdentifier: "MT-649",
};

const mockEventsResponse: EventsResponse = {
  events: [mockEvent],
  total: 1,
  offset: 0,
  limit: 10,
};

function createMockDeps(): ServerDependencies {
  return {
    getSnapshot: () => mockStateResponse,
    getIssueDetail: (identifier: string) =>
      identifier === "MT-649" ? mockIssueDetail : null,
    triggerRefresh: async () => {},
    getConfig: () => mockConfigResponse,
    getRecentEvents: (offset: number, limit: number) => ({
      ...mockEventsResponse,
      offset,
      limit,
    }),
  };
}

describe("HTTP REST API", () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    app = await createServer(createMockDeps(), 3000, { listen: false });
  });

  it("GET /api/v1/state returns 200 with correct structure", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/state",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual(mockStateResponse);
    expect(body).toHaveProperty("generatedAt");
    expect(body).toHaveProperty("counts");
    expect(body.counts).toHaveProperty("running");
    expect(body.counts).toHaveProperty("retrying");
    expect(body).toHaveProperty("running");
    expect(body).toHaveProperty("retrying");
    expect(body).toHaveProperty("codexTotals");
    expect(body).toHaveProperty("rateLimits");
  });

  it("GET /api/v1/MT-649 returns 200 when issue exists", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/MT-649",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual(mockIssueDetail);
    expect(body.issueIdentifier).toBe("MT-649");
  });

  it("GET /api/v1/UNKNOWN returns 404 with error envelope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/UNKNOWN",
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
  });

  it("POST /api/v1/refresh returns 202 with queued: true", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/refresh",
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.queued).toBe(true);
    expect(body).toHaveProperty("requestedAt");
    expect(body).toHaveProperty("operations");
  });

  it("GET /api/v1/config returns 200 with sanitized config (no API key)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("config");
    expect(body.config.tracker).not.toHaveProperty("apiKey");
  });

  it("GET /api/v1/events returns 200 with events array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/events",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toEqual(mockEvent);
  });

  it("PUT /api/v1/state returns 405", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/state",
    });
    expect(res.statusCode).toBe(405);
  });
});
