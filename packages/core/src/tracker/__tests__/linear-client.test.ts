import { describe, it, expect, vi } from "vitest";
import type { Issue, BlockerRef, TrackerConfig } from "@symphony/shared";
import { LinearClient } from "../linear-client";

const DEFAULT_ENDPOINT = "https://api.linear.app/graphql";

function createConfig(overrides?: Partial<TrackerConfig>): TrackerConfig {
  return {
    kind: "linear",
    endpoint: DEFAULT_ENDPOINT,
    apiKey: "test-api-key",
    projectSlug: "MY-PROJECT",
    activeStates: ["In Progress", "Todo"],
    terminalStates: ["Done", "Canceled"],
    ...overrides,
  };
}

function createMockIssueNode(overrides?: Record<string, unknown>) {
  return {
    id: "issue-1",
    identifier: "PROJ-123",
    title: "Test issue",
    description: "Description",
    priority: 2,
    state: { name: "In Progress" },
    labels: { nodes: [{ name: "BUG" }, { name: "Urgent" }] },
    branchName: "proj-123-test-issue",
    url: "https://linear.app/team/issue/PROJ-123",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-16T12:00:00.000Z",
    inverseRelations: {
      nodes: [
        {
          issue: {
            id: "blocker-1",
            identifier: "PROJ-100",
            state: { name: "Done" },
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("LinearClient", () => {
  describe("fetchCandidateIssues", () => {
    it("sends correct GraphQL query with project slug filter", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
      });

      const client = new LinearClient(createConfig(), mockFetch);
      await client.fetchCandidateIssues();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(DEFAULT_ENDPOINT);
      expect(opts?.method).toBe("POST");
      expect(opts?.headers).toMatchObject({
        Authorization: "test-api-key",
        "Content-Type": "application/json",
      });

      const body = JSON.parse((opts?.body as string) ?? "{}");
      expect(body.variables?.projectSlug).toBe("MY-PROJECT");
      expect(body.variables?.stateNames).toEqual(["In Progress", "Todo"]);
      expect(body.variables?.first).toBe(50);
      expect(body.query).toContain("project");
      expect(body.query).toContain("slugId");
      expect(body.query).toContain("eq");
    });

    it("normalizes issues correctly (labels lowercase, blockers from inverse blocks, ISO timestamps)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                createMockIssueNode({
                  labels: { nodes: [{ name: "BUG" }, { name: "Urgent" }] },
                  inverseRelations: {
                    nodes: [
                      {
                        issue: {
                          id: "blocker-1",
                          identifier: "PROJ-100",
                          state: { name: "Done" },
                        },
                      },
                    ],
                  },
                  createdAt: "2025-01-15T10:00:00.000Z",
                  updatedAt: "2025-01-16T12:00:00.000Z",
                }),
              ],
            },
          },
        }),
      });

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchCandidateIssues();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        const issue = result.value[0] as Issue;
        expect(issue.labels).toEqual(["bug", "urgent"]);
        expect(issue.blockedBy).toHaveLength(1);
        const blocker = issue.blockedBy[0] as BlockerRef;
        expect(blocker.id).toBe("blocker-1");
        expect(blocker.identifier).toBe("PROJ-100");
        expect(blocker.state).toBe("Done");
        expect(issue.createdAt).toBe("2025-01-15T10:00:00.000Z");
        expect(issue.updatedAt).toBe("2025-01-16T12:00:00.000Z");
      }
    });

    it("handles pagination across multiple pages", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              issues: {
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                nodes: [createMockIssueNode({ id: "page-1-issue" })],
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              issues: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [createMockIssueNode({ id: "page-2-issue" })],
              },
            },
          }),
        });

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchCandidateIssues();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect((result.value[0] as Issue).id).toBe("page-1-issue");
        expect((result.value[1] as Issue).id).toBe("page-2-issue");
      }
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse((secondCall[1]?.body as string) ?? "{}");
      expect(body.variables?.after).toBe("cursor-1");
    });
  });

  describe("fetchIssueStatesByIds", () => {
    it("uses correct [ID!] typing in GraphQL variables", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: "id-1",
                  identifier: "PROJ-1",
                  state: { name: "Done" },
                },
              ],
            },
          },
        }),
      });

      const client = new LinearClient(createConfig(), mockFetch);
      await client.fetchIssueStatesByIds(["id-1", "id-2"]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (mockFetch.mock.calls[0][1]?.body as string) ?? "{}"
      );
      expect(body.variables?.issueIds).toEqual(["id-1", "id-2"]);
      expect(body.query).toContain("issueIds");
    });
  });

  describe("fetchIssuesByStates", () => {
    it("returns empty array without API call when given empty states", async () => {
      const mockFetch = vi.fn();

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchIssuesByStates([]);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe("error handling", () => {
    it("maps transport errors to tracker_api_error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchCandidateIssues();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("tracker_api_error");
        expect(result.error.status).toBe(0);
        expect(result.error.message).toContain("Network failure");
      }
    });

    it("maps non-200 responses to tracker_api_error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchCandidateIssues();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("tracker_api_error");
        expect(result.error.status).toBe(401);
        expect(result.error.message).toContain("401");
      }
    });

    it("maps GraphQL errors to tracker_graphql_error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: null,
          errors: [{ message: "Invalid query", path: ["issues"] }],
        }),
      });

      const client = new LinearClient(createConfig(), mockFetch);
      const result = await client.fetchCandidateIssues();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("tracker_graphql_error");
        expect(result.error.errors).toHaveLength(1);
        expect((result.error.errors[0] as { message: string }).message).toBe(
          "Invalid query"
        );
      }
    });
  });
});
