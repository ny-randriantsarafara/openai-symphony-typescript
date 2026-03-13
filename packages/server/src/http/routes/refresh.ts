import type { FastifyInstance } from "fastify";
import type { RefreshResponse } from "@symphony/shared";
import type { ServerDependencies } from "../server.js";

export function refreshRoutes(
  app: FastifyInstance,
  deps: ServerDependencies
): void {
  app.post("/api/v1/refresh", async (_request, reply) => {
    await deps.triggerRefresh();
    const body: RefreshResponse = {
      queued: true,
      coalesced: false,
      requestedAt: new Date().toISOString(),
      operations: ["poll"],
    };
    return reply.status(202).send(body);
  });
}
