import type { FastifyInstance } from "fastify";
import type { ApiError } from "@symphony/shared";
import type { ServerDependencies } from "../server.js";

export function stateRoutes(
  app: FastifyInstance,
  deps: ServerDependencies
): void {
  app.get("/api/v1/state", async (_request, reply) => {
    return reply.status(200).send(deps.getSnapshot());
  });

  app.put("/api/v1/state", async (_request, reply) => {
    const body: ApiError = {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "PUT is not allowed on /api/v1/state",
      },
    };
    return reply.status(405).send(body);
  });
}
