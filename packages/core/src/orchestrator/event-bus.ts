import { EventEmitter } from "node:events";
import type { AgentEvent } from "@symphony/shared";

export type OrchestratorEvent =
  | {
      type: "session:started";
      issueId: string;
      issueIdentifier: string;
      sessionId: string;
      workspacePath: string;
    }
  | {
      type: "session:event";
      issueId: string;
      issueIdentifier: string;
      event: AgentEvent;
    }
  | {
      type: "session:ended";
      issueId: string;
      issueIdentifier: string;
      reason: string;
      durationMs: number;
    }
  | {
      type: "retry:scheduled";
      issueId: string;
      issueIdentifier: string;
      attempt: number;
      dueAt: string;
      error: string | null;
    }
  | { type: "retry:fired"; issueId: string; issueIdentifier: string; attempt: number }
  | { type: "state:updated" }
  | { type: "config:reloaded" }
  | { type: "error"; code: string; message: string };

export class EventBus {
  private readonly emitter = new EventEmitter();

  emit(event: OrchestratorEvent): void {
    this.emitter.emit("event", event);
  }

  on(listener: (event: OrchestratorEvent) => void): void {
    this.emitter.on("event", listener);
  }

  off(listener: (event: OrchestratorEvent) => void): void {
    this.emitter.off("event", listener);
  }
}
