import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchSession } from "../../../src/sync/match-session";
import { createMockFilteredView } from "../../fixtures/matches";

class Socket {
  static latest: Socket | null = null;
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;

  constructor(_url: string) {
    Socket.latest = this;
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  send(_data: string) {}

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function connect(session: MatchSession): Socket {
  session.connect();
  const socket = Socket.latest!;
  socket.open();
  return socket;
}

function acceptedReply(view: ReturnType<typeof createMockFilteredView>, actionId: string) {
  return {
    status: "accepted",
    actionId,
    acceptedVersion: view.deliveryVersion,
    eventId: `event-${view.deliveryVersion}`,
    serverTime: Date.now(),
    view,
  };
}

afterEach(() => {
  vi.useRealTimers();
  Socket.latest = null;
});

describe("cross-device synchronization recovery", () => {
  it("does not start a retry while the original HTTP action is still in flight", async () => {
    const view = createMockFilteredView({ lifecycle: "active" });
    let completeRequest!: (value: Response) => void;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          completeRequest = resolve;
        }),
    );
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as unknown as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;
    const action = session.sendAction("connect-four.drop", { column: 0 });
    const pendingId = session.getState().pendingAction!.actionId;
    await expect(session.retryPendingAction()).rejects.toThrow("Wait while");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    completeRequest({
      ok: true,
      status: 200,
      json: async () => acceptedReply({ ...view, deliveryVersion: 2 }, pendingId),
    } as unknown as Response);
    await action;
    expect(session.getState().pendingAction).toBeNull();
    session.disconnect();
  });

  it("keeps Sudoku A and B control independent and reconciles takeover rejection", async () => {
    const common = {
      gameId: "sudoku" as const,
      mode: "duel" as const,
      lifecycle: "active" as const,
      deliveryVersion: 4,
    };
    const aInitial = createMockFilteredView({
      ...common,
      controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
    });
    const bInitial = createMockFilteredView({
      ...common,
      controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
    });
    const a = new MatchSession({
      matchId: aInitial.matchId,
      actorAccountId: "A",
      initialView: aInitial,
      transport: "websocket",
      webSocketClass: Socket,
      storage: null,
    });
    const bFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const actionId = JSON.parse(String(init?.body)).actionId as string;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "rejected",
          actionId,
          code: "CONTROL_TRANSFERRED",
          message: "Current Sudoku controller required",
          retryable: false,
          latestView: createMockFilteredView({
            ...common,
            deliveryVersion: 6,
            controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
          }),
        }),
      } as unknown as Response;
    });
    const b = new MatchSession({
      matchId: bInitial.matchId,
      actorAccountId: "B",
      initialView: bInitial,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: bFetch as unknown as typeof fetch,
      storage: null,
    });
    const aSocket = connect(a);
    const bSocket = connect(b);

    aSocket.emit({
      type: "control-changed",
      deliveryVersion: 5,
      controller: { controllingAccountId: "A", controllerGeneration: 2, isController: false },
      view: createMockFilteredView({
        ...common,
        deliveryVersion: 5,
        controller: { controllingAccountId: "A", controllerGeneration: 2, isController: false },
      }),
      serverTime: Date.now(),
    });
    aSocket.emit({
      type: "control-changed",
      deliveryVersion: 4,
      controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
      view: aInitial,
      serverTime: Date.now(),
    });
    bSocket.emit({
      type: "control-changed",
      deliveryVersion: 5,
      controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
      view: createMockFilteredView({
        ...common,
        deliveryVersion: 5,
        controller: { controllingAccountId: "A", controllerGeneration: 1, isController: true },
      }),
      serverTime: Date.now(),
    });

    expect(a.getState().controllerStatus).toMatchObject({
      isController: false,
      takeoverNotice: true,
    });
    expect(b.getState().controllerStatus).toMatchObject({
      isController: true,
      takeoverNotice: false,
    });

    const oldBsocket = bSocket;
    oldBsocket.readyState = 3;
    await expect(
      b.sendAction("sudoku.edit", { row: 0, col: 0, operation: "set", value: 1 }),
    ).rejects.toThrow("CONTROL_TRANSFERRED");
    expect(b.getState().controllerStatus).toMatchObject({
      isController: true,
      controllerGeneration: 1,
    });

    a.disconnect();
    b.disconnect();
  });

  it("checks an uncertain action receipt before replaying the original action ID", async () => {
    const view = createMockFilteredView({ lifecycle: "active" });
    const calls: Array<{ actionId: string }> = [];
    let actionCalls = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/actions")) {
        const envelope = JSON.parse(String(init?.body));
        calls.push(envelope);
        actionCalls++;
        if (actionCalls === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError("bad json");
            },
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => acceptedReply({ ...view, deliveryVersion: 2 }, envelope.actionId),
        } as unknown as Response;
      }
      if (url.includes("/receipts/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "accepted", view: { ...view, deliveryVersion: 2 } }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => view } as unknown as Response;
    });
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as unknown as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    await expect(session.sendAction("connect-four.drop", { column: 0 })).rejects.toThrow(
      "Malformed action response",
    );
    const pendingId = session.getState().pendingAction?.actionId;
    expect(session.getState().error).toMatchObject({
      code: "TRANSPORT_MALFORMED_JSON",
      category: "transport",
    });
    expect(pendingId).toBeTruthy();

    const accepted = await session.retryPendingAction();
    expect(accepted).toBeNull();
    expect(actionCalls).toBe(1);
    expect(calls[0].actionId).toBe(pendingId);
    expect(session.getState().pendingAction).toBeNull();
    expect(session.getState().deliveryVersion).toBe(2);
    session.disconnect();
  });

  it("replays only after the original receipt is unknown, using the same action ID", async () => {
    const view = createMockFilteredView({ lifecycle: "active" });
    const actionIds: string[] = [];
    let actionCalls = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/actions")) {
        const envelope = JSON.parse(String(init?.body));
        actionIds.push(envelope.actionId);
        actionCalls++;
        if (actionCalls === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError("lost reply");
            },
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => acceptedReply({ ...view, deliveryVersion: 2 }, envelope.actionId),
        } as unknown as Response;
      }
      if (url.includes("/receipts/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "unknown" }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => view } as unknown as Response;
    });
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as unknown as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    await expect(session.sendAction("connect-four.drop", { column: 0 })).rejects.toThrow(
      "Malformed action response",
    );
    const pendingId = session.getState().pendingAction?.actionId;
    const accepted = await session.retryPendingAction();
    expect(accepted?.actionId).toBe(pendingId);
    expect(actionCalls).toBe(2);
    expect(actionIds).toEqual([pendingId, pendingId]);
    session.disconnect();
  });

  it("retains the uncertain action ID and reports an HTTP Origin rejection as transport", async () => {
    vi.useFakeTimers();
    const view = createMockFilteredView({ lifecycle: "active" });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "ORIGIN_MISMATCH", error: "Origin mismatch" }),
    });
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    await expect(session.sendAction("connect-four.drop", { column: 0 })).rejects.toThrow(
      "HTTP 403",
    );
    const pendingId = session.getState().pendingAction?.actionId;
    expect(session.getState().error).toMatchObject({
      code: "TRANSPORT_HTTP_403",
      category: "transport",
      backendCode: "ORIGIN_MISMATCH",
      httpStatus: 403,
    });
    expect(pendingId).toBeTruthy();
    session.disconnect();
  });

  it("times out while reading the body and keeps the action pending for receipt recovery", async () => {
    vi.useFakeTimers();
    const view = createMockFilteredView({ lifecycle: "active" });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    });
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as unknown as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    const action = session.sendAction("connect-four.drop", { column: 0 });
    const rejectedAction = expect(action).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(12_000);
    await rejectedAction;
    expect(session.getState().error).toMatchObject({
      code: "TRANSPORT_TIMEOUT",
      category: "transport",
      httpStatus: 200,
    });
    expect(session.getState().pendingAction?.actionId).toBeTruthy();
    session.disconnect();
  });
});
