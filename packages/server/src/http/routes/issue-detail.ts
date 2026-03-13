import type { FastifyInstance } from "fastify";
import type { ApiError } from "@symphony/shared";
import type { ServerDependencies } from "../server.js";

export function issueDetailRoutes(
  app: FastifyInstance,
  deps: ServerDependencies
): void {
  app.get<{
    Params: { issueIdentifier: string };
  }>("/api/v1/:issueIdentifier", async (request, reply) => {
    const { issueIdentifier } = request.params;
    const detail = deps.getIssueDetail(issueIdentifier);
    if (detail === null) {
      const body: ApiError = {
        error: {
          code: "NOT_FOUND",
          message: `Issue '${issueIdentifier}' not found`,
        },
      };
      return reply.status(404).send(body);
    }
    return reply.status(200).send(detail);
  });
}
