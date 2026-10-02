import { describe, expect, it } from "vitest";
import { MatchSession } from "../../../src/sync/match-session";
import { createMockFilteredView } from "../../fixtures/matches";

class Socket {
  static latest: Socket;
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (message: { data: string }) => void;
  constructor() {
    Socket.latest = this;
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

describe("saved event presentation", () => {
  it("presents one live event once and settles a refresh snapshot without replay", () => {
    const initial = createMockFilteredView({ deliveryVersion: 3 });
    const session = new MatchSession({
      matchId: initial.matchId,
      actorAccountId: "A",
      initialView: initial,
      transport: "websocket",
      webSocketClass: Socket,
      storage: null,
    });
    session.connect();
    const socket = Socket.latest;
    const next = createMockFilteredView({ deliveryVersion: 4 });
    const event = {
      type: "event",
      eventId: "saved-4",
      acceptedVersion: 4,
      view: next,
      effects: [{ type: "disc-dropped", row: 5, col: 0, seat: "A" }],
      serverTime: 1,
    };
    socket.emit(event);
    expect(session.getState().acceptedEvent?.eventId).toBe("saved-4");
    const presentation = session.getState().acceptedEvent;
    socket.emit(event);
    expect(session.getState().acceptedEvent).toBe(presentation);
    socket.emit({ type: "snapshot", view: next, serverTime: 2 });
    expect(session.getState().acceptedEvent).toBeNull();
    socket.emit({
      status: "accepted",
      actionId: "receipt",
      eventId: "saved-4",
      acceptedVersion: 4,
      view: next,
      effects: event.effects,
      serverTime: 1,
    });
    expect(session.getState().acceptedEvent).toBeNull();
    session.disconnect();
  });
});
