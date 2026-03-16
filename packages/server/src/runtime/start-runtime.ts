import type { FastifyInstance } from "fastify";
import type {
  AgentEvent,
  Issue,
  ServiceConfig,
  StateUpdatedEvent,
  SymphonyError,
  TrackerConfig,
  WsMessage,
} from "@symphony/shared";
import {
  ConfigWatcher,
  EventBus,
  LinearClient,
  Orchestrator,
  ProviderRegistry,
  WorkspaceManager,
  type AgentProvider,
  createCodexProvider,
  renderPrompt,
  validateConfig,
} from "@symphony/core";
import { createServer } from "../http/server.js";
import { WsServer } from "../ws/ws-server.js";
import {
  createAgentMessage,
  createOrchestratorMessage,
  createPendingSessionTracker,
} from "./event-translation.js";
import { decideRunOutcome } from "./run-outcome.js";
import { cleanupSession } from "./session-cleanup.js";
import { createRuntimeStore } from "./runtime-store.js";

const CONTINUATION_PROMPT =
  "Continue working on this issue. Pick up where you left off.";

export interface StartRuntimeArgs {
  readonly workflowPath: string;
  readonly port?: number;
}

export interface RuntimeHandle {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

function describeError(error: SymphonyError): string {
  switch (error.kind) {
    case "missing_workflow_file":
      return `Missing workflow file: ${error.path}`;
    case "workflow_parse_error":
    case "template_parse_error":
    case "prompt_render_failed":
      return error.message;
    case "config_validation_failed":
      return error.errors.join("; ");
    case "hook_failed":
    case "tracker_api_error":
    case "agent_startup_failed":
    case "agent_turn_failed":
      return error.message;
    case "hook_timeout":
      return `Hook timed out after ${error.timeoutMs}ms`;
    case "tracker_graphql_error":
      return JSON.stringify(error.errors);
    default:
      return error.kind;
  }
}

function createLogger() {
  return {
    info: (_message: string) => {},
    warn: (_message: string) => {},
  };
}

function createStateUpdatedMessage(snapshot: ReturnType<typeof storeSnapshotToMessage>): StateUpdatedEvent {
  return snapshot;
}

function storeSnapshotToMessage(snapshot: ReturnType<ReturnType<typeof createRuntimeStore>["getSnapshot"]>) {
  return {
    type: "state:updated" as const,
    running: snapshot.running,
    retrying: snapshot.retrying,
    codexTotals: snapshot.codexTotals,
    counts: snapshot.counts,
  };
}

function isIssueActive(issue: Issue, config: ServiceConfig): boolean {
  const activeStates = config.tracker.activeStates.map((value) => value.toLowerCase());
  return activeStates.includes(issue.state.toLowerCase());
}

function getTrackerResult(config: ServiceConfig | null, trackerConfig: TrackerConfig | null) {
  if (!config || !trackerConfig) {
    return {
      ok: false as const,
      error: {
        kind: "config_validation_failed" as const,
        errors: ["Config not loaded"],
      },
    };
  }

  return {
    ok: true as const,
    value: new LinearClient(trackerConfig),
  };
}

function applyMessage(
  store: ReturnType<typeof createRuntimeStore>,
  wsServer: WsServer,
  message: WsMessage | null
): void {
  if (!message) return;

  switch (message.type) {
    case "state:updated":
      store.syncSnapshot({
        generatedAt: new Date().toISOString(),
        counts: message.counts,
        running: message.running,
        retrying: message.retrying,
        codexTotals: message.codexTotals,
        rateLimits: null,
      });
      break;
    case "session:started":
      store.applySessionStarted(message);
      break;
    case "session:event":
      store.applySessionEvent(message);
      break;
    case "session:ended":
      store.applySessionEnded(message);
      break;
    case "retry:scheduled":
      store.applyRetryScheduled(message);
      break;
    case "retry:fired":
      store.applyRetryFired(message);
      break;
    case "error":
      store.applyError(message);
      break;
    case "config:reloaded":
      break;
  }

  wsServer.broadcast(message);
}

function createSessionEndedMessage(
  issue: Issue,
  snapshot: ReturnType<ReturnType<typeof createRuntimeStore>["getSnapshot"]>,
  reason: "completed" | "failed" | "timed_out" | "stalled" | "canceled"
): WsMessage {
  const running = snapshot.running.find((item) => item.issueId === issue.id);
  const tokens = running?.tokens ?? {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  return {
    type: "session:ended",
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    reason,
    durationMs: 0,
    tokens,
  };
}

function createWorkspaceManager(config: ServiceConfig): WorkspaceManager {
  return new WorkspaceManager(config.workspace.root, config.hooks, createLogger());
}

export async function startRuntime(args: StartRuntimeArgs): Promise<RuntimeHandle> {
  const port = args.port ?? 8080;
  const configWatcher = new ConfigWatcher(args.workflowPath);
  const initialLoad = await configWatcher.start();
  if (!initialLoad.ok) {
    throw new Error(describeError(initialLoad.error));
  }

  const currentConfig = configWatcher.getCurrentConfig();
  if (!currentConfig) {
    throw new Error("Config not loaded");
  }

  const store = createRuntimeStore({ workflowPath: args.workflowPath });
  const initialValidation = validateConfig(currentConfig);
  if (initialValidation.ok) {
    store.setConfigValid(currentConfig);
  } else {
    store.setConfigInvalid(
      currentConfig,
      initialValidation.error.kind === "config_validation_failed"
        ? initialValidation.error.errors
        : [describeError(initialValidation.error)]
    );
  }

  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(createCodexProvider());

  const pendingSessions = createPendingSessionTracker();
  const eventBus = new EventBus();
  const wsServer = new WsServer(() => store.getSnapshot());

  const trackerAdapter = {
    fetchCandidateIssues: async () => {
      const config = configWatcher.getCurrentConfig();
      const tracker = getTrackerResult(config, config?.tracker ?? null);
      return tracker.ok ? tracker.value.fetchCandidateIssues() : tracker;
    },
    fetchIssueStatesByIds: async (issueIds: readonly string[]) => {
      const config = configWatcher.getCurrentConfig();
      const tracker = getTrackerResult(config, config?.tracker ?? null);
      return tracker.ok ? tracker.value.fetchIssueStatesByIds(issueIds) : tracker;
    },
    fetchIssuesByStates: async (stateNames: readonly string[]) => {
      const config = configWatcher.getCurrentConfig();
      const tracker = getTrackerResult(config, config?.tracker ?? null);
      return tracker.ok ? tracker.value.fetchIssuesByStates(stateNames) : tracker;
    },
  };

  const workspaceAdapter = {
    createForIssue: async (identifier: string) => {
      const config = configWatcher.getCurrentConfig();
      if (!config) {
        return {
          ok: false as const,
          error: {
            kind: "config_validation_failed" as const,
            errors: ["Config not loaded"],
          },
        };
      }

      return createWorkspaceManager(config).createForIssue(identifier);
    },
    removeWorkspace: async (identifier: string) => {
      const config = configWatcher.getCurrentConfig();
      if (!config) return;
      await createWorkspaceManager(config).removeWorkspace(identifier);
    },
  };

  const spawnAgent = async ({ issue, config, promptTemplate, onExit }: any) => {
    const provider = providerRegistry.get(config.agent.provider);
    if (!provider) {
      const errorMessage = `Unknown agent provider: ${config.agent.provider}`;
      applyMessage(store, wsServer, {
        type: "error",
        code: "unknown_provider",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      onExit({
        type: "failure",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        error: errorMessage,
      });
      return {
        stop: async () => {},
      };
    }

    let stopRequested = false;
    let session: Awaited<ReturnType<AgentProvider["startSession"]>> | null = null;

    const run = async (): Promise<void> => {
      const manager = createWorkspaceManager(config);
      const workspaceResult = await manager.createForIssue(issue.identifier);
      if (!workspaceResult.ok) {
        onExit({
          type: "failure",
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          error: describeError(workspaceResult.error),
        });
        return;
      }

      const workspacePath = workspaceResult.value.path;
      const beforeRun = await manager.runBeforeRun(workspacePath);
      if (!beforeRun.ok) {
        onExit({
          type: "failure",
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          error: describeError(beforeRun.error),
        });
        return;
      }

      const prompt = await renderPrompt(promptTemplate, issue, null);
      if (!prompt.ok) {
        onExit({
          type: "failure",
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          error: describeError(prompt.error),
        });
        return;
      }

      let lastError: string | null = null;
      let turnCount = 0;
      let shouldContinue = true;
      let issueStillActive = true;
      let endReason: "completed" | "failed" | "timed_out" | "stalled" | "canceled" =
        "completed";

      try {
        session = await provider.startSession({ workspacePath, config });

        while (!stopRequested && shouldContinue) {
          const isFirstTurn = turnCount === 0;
          const turnPrompt = isFirstTurn ? prompt.value : CONTINUATION_PROMPT;
          let turnSucceeded = false;

          for await (const event of session.runTurn({
            prompt: turnPrompt,
            issue,
            turnNumber: turnCount + 1,
            isFirstTurn,
          })) {
            const message = createAgentMessage(
              issue,
              event,
              pendingSessions,
              new Date().toISOString()
            );
            applyMessage(store, wsServer, message);

            if (event.type === "turn_completed") {
              turnSucceeded = true;
            }

            if (event.type === "turn_failed") {
              lastError = event.error;
              endReason = "failed";
              shouldContinue = false;
              break;
            }

            if (event.type === "stall_detected") {
              lastError = "Agent stalled";
              endReason = "stalled";
              shouldContinue = false;
              break;
            }
          }

          if (stopRequested) {
            endReason = "canceled";
            break;
          }

          if (!turnSucceeded) {
            shouldContinue = false;
            break;
          }

          turnCount += 1;
          if (turnCount >= config.agent.maxTurns) {
            shouldContinue = false;
            break;
          }

          const refreshed = await trackerAdapter.fetchIssueStatesByIds([issue.id]);
          if (!refreshed.ok) {
            lastError = describeError(refreshed.error);
            endReason = "failed";
            shouldContinue = false;
            break;
          }

          const nextIssue = refreshed.value[0];
          if (!nextIssue || !isIssueActive(nextIssue, config)) {
            issueStillActive = false;
            shouldContinue = false;
            break;
          }
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        endReason = "failed";
      } finally {
        const cleanupError = await cleanupSession({
          session,
          runAfterRun: () => manager.runAfterRun(workspacePath),
        });
        if (cleanupError && !lastError) {
          lastError = cleanupError;
          endReason = "failed";
        }
      }

      applyMessage(store, wsServer, createSessionEndedMessage(issue, store.getSnapshot(), endReason));

      const outcome = decideRunOutcome({
        stopRequested,
        lastError,
        shouldContinue,
        issueStillActive,
      });

      if (outcome === "canceled" || outcome === "terminal") {
        return;
      }

      if (outcome === "failure") {
        onExit({
          type: "failure",
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          error: lastError ?? "Unknown agent failure",
        });
        return;
      }

      onExit({
        type: "continuation",
        issueId: issue.id,
        issueIdentifier: issue.identifier,
      });
    };

    void run();

    return {
      stop: async () => {
        stopRequested = true;
        if (session) {
          await session.stop();
        }
      },
    };
  };

  const orchestrator = new Orchestrator({
    configWatcher,
    validateConfig,
    tracker: trackerAdapter,
    workspaceManager: workspaceAdapter,
    spawnAgent,
    eventBus,
  });

  const app = await createServer(
    {
      getSnapshot: () => store.getSnapshot(),
      getIssueDetail: (identifier) => store.getIssueDetail(identifier),
      triggerRefresh: () => orchestrator.triggerRefresh(),
      getConfig: () => store.getConfig(),
      getRecentEvents: (offset, limit) => store.getRecentEvents(offset, limit),
      wsServer,
    },
    port
  );

  eventBus.on((event) => {
    if (event.type === "session:started") {
      store.rememberWorkspace(event.issueId, event.issueIdentifier, event.workspacePath);
    }

    if (event.type === "state:updated") {
      const snapshot = orchestrator.getSnapshot();
      store.syncSnapshot(snapshot);
      applyMessage(store, wsServer, createStateUpdatedMessage(storeSnapshotToMessage(store.getSnapshot())));
      return;
    }

    const message = createOrchestratorMessage(event, pendingSessions, new Date().toISOString());
    applyMessage(store, wsServer, message);
  });

  configWatcher.on("configReloaded", (config: ServiceConfig) => {
    const validation = validateConfig(config);
    if (validation.ok) {
      store.setConfigValid(config);
    } else {
      store.setConfigInvalid(
        config,
        validation.error.kind === "config_validation_failed"
          ? validation.error.errors
          : [describeError(validation.error)]
      );
    }
    wsServer.broadcast({
      type: "config:reloaded",
      reloadedAt: new Date().toISOString(),
      valid: validation.ok,
      changes: [],
    });
  });

  configWatcher.on("configReloadFailed", (error: SymphonyError) => {
    applyMessage(store, wsServer, {
      type: "error",
      code: error.kind,
      message: describeError(error),
      timestamp: new Date().toISOString(),
    });
  });

  store.syncSnapshot(orchestrator.getSnapshot());
  await orchestrator.start();
  store.syncSnapshot(orchestrator.getSnapshot());

  return {
    app,
    stop: async () => {
      await orchestrator.stop();
      await app.close();
      await configWatcher.stop();
    },
  };
}
