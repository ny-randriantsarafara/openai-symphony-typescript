import type { FastifyInstance } from "fastify";
import type { ServerDependencies } from "../server.js";

export function eventsRoutes(
  app: FastifyInstance,
  deps: ServerDependencies
): void {
  app.get<{
    Querystring: { offset?: string; limit?: string };
  }>("/api/v1/events", async (request, reply) => {
    const offset = Math.max(0, parseInt(request.query.offset ?? "0", 10) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.query.limit ?? "10", 10) || 10)
    );
    const result = deps.getRecentEvents(offset, limit);
    return reply.status(200).send(result);
  });
}
