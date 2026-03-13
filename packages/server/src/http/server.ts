import Fastify from "fastify";
import type {
  StateResponse,
  IssueDetailResponse,
  ConfigResponse,
  EventsResponse,
  ApiError,
} from "@symphony/shared";
import { stateRoutes } from "./routes/state.js";
import { issueDetailRoutes } from "./routes/issue-detail.js";
import { refreshRoutes } from "./routes/refresh.js";
import { configRoutes } from "./routes/config.js";
import { eventsRoutes } from "./routes/events.js";

export interface ServerDependencies {
  getSnapshot: () => StateResponse;
  getIssueDetail: (identifier: string) => IssueDetailResponse | null;
  triggerRefresh: () => Promise<void>;
  getConfig: () => ConfigResponse;
  getRecentEvents: (offset: number, limit: number) => EventsResponse;
}

export interface CreateServerOptions {
  readonly listen?: boolean;
}

export async function createServer(
  deps: ServerDependencies,
  port: number,
  options: CreateServerOptions = {}
): Promise<ReturnType<typeof Fastify>> {
  const { listen: shouldListen = true } = options;
  const app = Fastify({ logger: false });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = {
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
      },
    };
    reply.status(404).send(body);
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const body: ApiError = {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    };
    reply.status(500).send(body);
  });

  stateRoutes(app, deps);
  refreshRoutes(app, deps);
  configRoutes(app, deps);
  eventsRoutes(app, deps);
  issueDetailRoutes(app, deps);

  if (shouldListen) {
    await app.listen({ port, host: "127.0.0.1" });
  }

  return app;
}
