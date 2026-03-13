import type {} from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { WsMessage, StateResponse } from "@symphony/shared";

export class WsServer {
  private readonly clients = new Set<WebSocket>();

  constructor(
    private readonly getSnapshot: () => StateResponse,
  ) {}

  register(app: FastifyInstance): void {
    app.get("/ws", { websocket: true }, (socket) => {
      this.clients.add(socket);

      // Send initial snapshot
      const snapshot = this.getSnapshot();
      socket.send(
        JSON.stringify({
          type: "state:updated",
          running: snapshot.running,
          retrying: snapshot.retrying,
          codexTotals: snapshot.codexTotals,
          counts: snapshot.counts,
        } satisfies WsMessage),
      );

      socket.on("close", () => {
        this.clients.delete(socket);
      });
    });
  }

  broadcast(event: WsMessage): void {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
