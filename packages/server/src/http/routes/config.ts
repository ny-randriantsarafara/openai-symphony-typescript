import type { FastifyInstance } from "fastify";
import type { ServerDependencies } from "../server.js";

export function configRoutes(
  app: FastifyInstance,
  deps: ServerDependencies
): void {
  app.get("/api/v1/config", async (_request, reply) => {
    return reply.status(200).send(deps.getConfig());
  });
}
