import type {
  Issue,
  BlockerRef,
  SymphonyError,
  Result,
  TrackerConfig,
} from "@symphony/shared";
import {
  CANDIDATE_ISSUES_QUERY,
  ISSUE_STATES_BY_IDS_QUERY,
  ISSUES_BY_STATES_QUERY,
} from "./linear-queries.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_ENDPOINT = "https://api.linear.app/graphql";

type FetchFn = typeof globalThis.fetch;

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface LinearState {
  name: string;
}

interface LinearLabelNode {
  name: string;
}

interface LinearBlockerIssue {
  id: string;
  identifier: string;
  state: LinearState | null;
}

interface LinearInverseRelationNode {
  issue: LinearBlockerIssue;
}

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  state: LinearState;
  labels?: { nodes: readonly LinearLabelNode[] };
  branchName: string | null;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  inverseRelations?: { nodes: readonly LinearInverseRelationNode[] };
}

interface IssuesConnection {
  pageInfo: PageInfo;
  nodes: readonly LinearIssueNode[];
}

interface GraphQLResponse<T> {
  data: T | null;
  errors?: readonly unknown[];
}

function isLinearIssueNode(value: unknown): value is LinearIssueNode {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["identifier"] === "string" &&
    typeof obj["title"] === "string" &&
    obj["state"] !== null &&
    typeof obj["state"] === "object" &&
    typeof (obj["state"] as Record<string, unknown>)["name"] === "string"
  );
}

function parsePriority(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return null;
}

function normalizeLabels(labels: unknown): readonly string[] {
  if (labels === null || labels === undefined) return [];
  if (typeof labels !== "object" || !("nodes" in labels)) return [];
  const nodes = (labels as { nodes: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((n) => (typeof n === "object" && n !== null && "name" in n ? String((n as { name: unknown }).name) : ""))
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

function normalizeBlockers(inverseRelations: unknown): readonly BlockerRef[] {
  if (inverseRelations === null || inverseRelations === undefined) return [];
  if (typeof inverseRelations !== "object" || !("nodes" in inverseRelations))
    return [];
  const nodes = (inverseRelations as { nodes: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const result: BlockerRef[] = [];
  for (const n of nodes) {
    if (typeof n !== "object" || n === null || !("issue" in n)) continue;
    const issue = (n as { issue: unknown }).issue;
    if (typeof issue !== "object" || issue === null) continue;
    const i = issue as Record<string, unknown>;
    const state = i["state"];
    const stateName =
      state !== null && typeof state === "object" && "name" in state
        ? String((state as { name: unknown }).name)
        : null;
    result.push({
      id: typeof i["id"] === "string" ? i["id"] : null,
      identifier: typeof i["identifier"] === "string" ? i["identifier"] : null,
      state: stateName,
    });
  }
  return result;
}

function normalizeIssue(node: LinearIssueNode): Issue {
  const labels = normalizeLabels(node.labels);
  const blockedBy = normalizeBlockers(node.inverseRelations);
  const priority = parsePriority(node.priority);
  const stateName =
    node.state && typeof node.state === "object" && "name" in node.state
      ? String((node.state as { name: string }).name)
      : "Unknown";

  return {
    id: node["id"],
    identifier: node["identifier"],
    title: node["title"],
    description: node.description ?? null,
    priority,
    state: stateName,
    branchName: node.branchName ?? null,
    url: node.url ?? null,
    labels,
    blockedBy,
    createdAt: typeof node.createdAt === "string" ? node.createdAt : null,
    updatedAt: typeof node.updatedAt === "string" ? node.updatedAt : null,
  };
}

function parseIssuesConnection(value: unknown): IssuesConnection | null {
  if (value === null || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const pageInfo = obj["pageInfo"];
  const nodes = obj["nodes"];

  if (!pageInfo || typeof pageInfo !== "object") return null;
  const hasNextPage =
    "hasNextPage" in pageInfo && (pageInfo as { hasNextPage: unknown }).hasNextPage === true;
  const endCursor =
    "endCursor" in pageInfo && typeof (pageInfo as { endCursor: unknown }).endCursor === "string"
      ? ((pageInfo as { endCursor: string }).endCursor as string)
      : null;

  if (!Array.isArray(nodes)) return null;
  const validNodes = nodes.filter((n) => isLinearIssueNode(n)) as LinearIssueNode[];

  return {
    pageInfo: { hasNextPage, endCursor },
    nodes: validNodes,
  };
}

export class LinearClient {
  constructor(
    private readonly config: TrackerConfig,
    private readonly fetchFn: FetchFn = globalThis.fetch
  ) {}

  private async request<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<Result<GraphQLResponse<T>, SymphonyError>> {
    const endpoint = this.config.endpoint || DEFAULT_ENDPOINT;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        return {
          ok: false,
          error: {
            kind: "tracker_api_error",
            status: response.status,
            message: `${response.status}: ${text.slice(0, 500)}`,
          },
        };
      }

      const json = (await response.json()) as unknown;
      if (json === null || typeof json !== "object") {
        return {
          ok: false,
          error: {
            kind: "tracker_api_error",
            status: 200,
            message: "Invalid JSON response",
          },
        };
      }

      const parsed = json as GraphQLResponse<T>;
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        return {
          ok: false,
          error: {
            kind: "tracker_graphql_error",
            errors: parsed.errors,
          },
        };
      }

      return { ok: true, value: parsed };
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          kind: "tracker_api_error",
          status: 0,
          message,
        },
      };
    }
  }

  async fetchCandidateIssues(): Promise<
    Result<readonly Issue[], SymphonyError>
  > {
    return this.fetchIssuesByStates(this.config.activeStates);
  }

  async fetchIssueStatesByIds(
    issueIds: readonly string[]
  ): Promise<Result<readonly Issue[], SymphonyError>> {
    if (issueIds.length === 0) {
      return { ok: true, value: [] };
    }

    const result = await this.request<{ issues: IssuesConnection }>(
      ISSUE_STATES_BY_IDS_QUERY,
      { issueIds: [...issueIds] }
    );

    if (!result.ok) return result;
    const conn = parseIssuesConnection(result.value.data?.issues);
    if (!conn) {
      return { ok: true, value: [] };
    }
    return {
      ok: true,
      value: conn.nodes.map(normalizeIssue),
    };
  }

  async fetchIssuesByStates(
    stateNames: readonly string[]
  ): Promise<Result<readonly Issue[], SymphonyError>> {
    if (stateNames.length === 0) {
      return { ok: true, value: [] };
    }

    const all: Issue[] = [];
    let after: string | null = null;

    for (;;) {
      const variables: Record<string, unknown> = {
        projectSlug: this.config.projectSlug,
        stateNames: [...stateNames],
        first: DEFAULT_PAGE_SIZE,
      };
      if (after !== null) {
        variables["after"] = after;
      }

      const result = await this.request<{ issues: IssuesConnection }>(
        ISSUES_BY_STATES_QUERY,
        variables
      );

      if (!result.ok) return result;
      const conn = parseIssuesConnection(result.value.data?.issues);
      if (!conn) {
        break;
      }
      for (const node of conn.nodes) {
        all.push(normalizeIssue(node));
      }
      if (!conn.pageInfo.hasNextPage || conn.pageInfo.endCursor === null) {
        break;
      }
      after = conn.pageInfo.endCursor;
    }

    return { ok: true, value: all };
  }
}
