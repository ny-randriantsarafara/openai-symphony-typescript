import type { Issue, AgentEvent, ServiceConfig } from "@symphony/shared";

export interface SessionStartParams {
  readonly workspacePath: string;
  readonly config: ServiceConfig;
}

export interface TurnParams {
  readonly prompt: string;
  readonly issue: Issue;
  readonly turnNumber: number;
  readonly isFirstTurn: boolean;
}

export interface AgentSession {
  readonly sessionId: string;
  readonly threadId: string;
  runTurn(params: TurnParams): AsyncIterable<AgentEvent>;
  stop(): Promise<void>;
}

export interface AgentProvider {
  readonly name: string;
  startSession(params: SessionStartParams): Promise<AgentSession>;
}
