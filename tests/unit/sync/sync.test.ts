import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MatchSession } from "../../../src/sync/match-session";
import { createMockFilteredView } from "../../fixtures/matches";
import type { AcceptedReply, RejectedReply } from "../../../shared/protocol/types";

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public readyState = 0; // 0: CONNECTING, 1: OPEN, 3: CLOSED
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onmessage: ((evt: { data: string }) => void) | null = null;
  public onerror: ((evt: any) => void) | null = null;
  public sentMessages: any[] = [];
  public url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public open() {
    this.readyState = 1;
    this.onopen?.();
  }

  public close() {
    this.readyState = 3;
    this.onclose?.();
  }

  public send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  public emit(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("MatchSession & Sync Client (Task C01)", () => {
  let mockStorage: MockStorage;
  let mockFetch: any;

  beforeEach(() => {
    MockWebSocket.instances = [];
    mockStorage = new MockStorage();
    mockFetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("1. Delivery Version Sequencing and Gap Handling", () => {
    it("updates view and deliveryVersion on higher version snapshot, ignores stale snapshot", () => {
      const initialView = createMockFilteredView({ deliveryVersion: 3 });
      const session = new MatchSession({
        matchId: "match-1",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      expect(session.getState().deliveryVersion).toBe(3);

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      // Stale snapshot (version 2 < current 3): must be ignored
      ws.emit({
        type: "snapshot",
        view: createMockFilteredView({ deliveryVersion: 2, turnSeat: "B" }),
        serverTime: Date.now(),
      });
      expect(session.getState().deliveryVersion).toBe(3);
      expect(session.getState().view?.turnSeat).toBe("A");

      // Newer snapshot (version 4 >= current 3): replaces view
      ws.emit({
        type: "snapshot",
        view: createMockFilteredView({ deliveryVersion: 4, turnSeat: "B" }),
        serverTime: Date.now(),
      });
      expect(session.getState().deliveryVersion).toBe(4);
      expect(session.getState().view?.turnSeat).toBe("B");
    });

    it("applies contiguous event (acceptedVersion === current + 1) and increments version", () => {
      const initialView = createMockFilteredView({ deliveryVersion: 5 });
      const session = new MatchSession({
        matchId: "match-1",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      // Contiguous event: acceptedVersion = 6 (5 + 1)
      ws.emit({
        type: "event",
        eventId: "evt-006",
        acceptedVersion: 6,
        view: createMockFilteredView({ deliveryVersion: 6, turnId: 6, turnSeat: "B" }),
        serverTime: Date.now(),
      });

      expect(session.getState().deliveryVersion).toBe(6);
      expect(session.getState().view?.turnSeat).toBe("B");

      // Duplicate/stale event (acceptedVersion <= 6): ignored
      ws.emit({
        type: "event",
        eventId: "evt-005",
        acceptedVersion: 5,
        view: createMockFilteredView({ deliveryVersion: 5, turnSeat: "A" }),
        serverTime: Date.now(),
      });

      expect(session.getState().deliveryVersion).toBe(6);
      expect(session.getState().view?.turnSeat).toBe("B");
    });

    it("detects gap (acceptedVersion > current + 1) and triggers immediate snapshot fetch to catch up", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 2 });
      const catchupView = createMockFilteredView({ deliveryVersion: 5, turnSeat: "B" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => catchupView,
      });

      const session = new MatchSession({
        matchId: "match-gap",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        fetchFn: mockFetch,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      // Out of order event: current is 2, event arrives with acceptedVersion 5 (gap of 3 and 4!)
      ws.emit({
        type: "event",
        eventId: "evt-005",
        acceptedVersion: 5,
        view: createMockFilteredView({ deliveryVersion: 5 }),
        serverTime: Date.now(),
      });

      // Gap detected: does NOT blindly advance immediately, calls fetchSnapshot to resync
      expect(mockFetch).toHaveBeenCalledWith(
        "https://arcade.test/api/v1/matches/match-gap",
        expect.objectContaining({
          headers: { "X-Actor-Account": "A" },
        }),
      );

      // Await resolution of snapshot fetch
      await vi.advanceTimersByTimeAsync(2500);

      expect(session.getState().deliveryVersion).toBe(5);
      expect(session.getState().view?.turnSeat).toBe("B");
    });
  });

  describe("2. Idempotent Action Retry and Single Pending Command Tracking", () => {
    it("enforces single pending command tracking; second simultaneous action rejects", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      const session = new MatchSession({
        matchId: "match-1",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();
      session.setConnectionState("connected");

      // Start action 1 (does not resolve until server responds)
      const actionPromise = session.sendAction("connect-four.drop", { column: 3 });

      expect(session.getState().pendingAction).not.toBeNull();
      expect(session.getState().pendingAction?.action).toBe("connect-four.drop");

      // Attempt second action while action 1 is in-flight: must throw immediately!
      await expect(session.sendAction("connect-four.drop", { column: 4 })).rejects.toThrow(
        /already in flight/i,
      );

      // Now server accepts action 1 via websocket reply
      const pendingId = session.getState().pendingAction!.actionId;
      ws.emit({
        status: "accepted",
        actionId: pendingId,
        acceptedVersion: 2,
        eventId: "evt-002",
        serverTime: Date.now(),
        view: createMockFilteredView({ deliveryVersion: 2 }),
      } as AcceptedReply);

      const result = await actionPromise;
      expect(result.status).toBe("accepted");
      expect(session.getState().pendingAction).toBeNull();
      expect(session.getState().isInputPaused).toBe(false);
    });

    it("surfaces server rejection, clears in-flight action, and updates latestView", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      const session = new MatchSession({
        matchId: "match-1",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      const actionPromise = session.sendAction("connect-four.drop", { column: 3 });
      const pendingId = session.getState().pendingAction!.actionId;

      const latestView = createMockFilteredView({ deliveryVersion: 2, turnSeat: "B" });
      ws.emit({
        status: "rejected",
        actionId: pendingId,
        code: "NOT_YOUR_TURN",
        message: "It is not your turn to play",
        retryable: false,
        latestView,
      } as RejectedReply);

      await expect(actionPromise).rejects.toThrow(/NOT_YOUR_TURN/);
      expect(session.getState().pendingAction).toBeNull();
      expect(session.getState().error?.code).toBe("NOT_YOUR_TURN");
      expect(session.getState().view?.deliveryVersion).toBe(2);
      expect(session.getState().view?.turnSeat).toBe("B");
    });

    it("idempotently retries nonsecret pending action with identical actionId and payload", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });

      // First attempt fails with network error
      mockFetch.mockRejectedValueOnce(new Error("Network offline"));

      const session = new MatchSession({
        matchId: "match-retry",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        transport: "polling", // Uses HTTP fetch
        fetchFn: mockFetch,
        storage: mockStorage,
      });

      session.connect();
      session.setConnectionState("connected");

      await expect(session.sendAction("connect-four.drop", { column: 2 })).rejects.toThrow(
        "Network offline",
      );

      // Action remains stored as pending with status "retrying"
      const pending = session.getState().pendingAction;
      expect(pending).not.toBeNull();
      expect(pending?.status).toBe("retrying");
      const originalActionId = pending?.actionId;
      expect(originalActionId).toBeDefined();

      // Reconcile the original receipt first, then replay only because it is
      // explicitly unknown. The action identity and payload remain unchanged.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "unknown" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialView,
      });
      const acceptedReply: AcceptedReply = {
        status: "accepted",
        actionId: originalActionId!,
        acceptedVersion: 2,
        eventId: "evt-002",
        serverTime: Date.now(),
        view: createMockFilteredView({ deliveryVersion: 2 }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => acceptedReply,
      });

      const retryResult = await session.retryPendingAction();
      expect(retryResult).not.toBeNull();
      expect(retryResult?.status).toBe("accepted");
      expect(retryResult?.actionId).toBe(originalActionId);

      // Verify fetch was called with the exact same actionId and payload!
      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://arcade.test/api/v1/matches/match-retry/actions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(`"actionId":"${originalActionId}"`),
        }),
      );

      expect(session.getState().pendingAction).toBeNull();
    });

    it("settles a dropped-after-commit action from its receipt without resubmitting", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      mockFetch.mockRejectedValueOnce(new Error("Reply dropped after commit"));
      const session = new MatchSession({
        matchId: "match-receipt",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        transport: "polling",
        fetchFn: mockFetch,
        storage: mockStorage,
      });
      session.connect();
      session.setConnectionState("connected");

      await expect(session.sendAction("connect-four.drop", { column: 1 })).rejects.toThrow(
        "Reply dropped after commit",
      );
      const originalActionId = session.getState().pendingAction!.actionId;
      const acceptedView = createMockFilteredView({ deliveryVersion: 2, turnSeat: "B" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "accepted", view: acceptedView }),
      });

      const retryResult = await session.retryPendingAction();
      expect(retryResult).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        `https://arcade.test/api/v1/matches/match-receipt/receipts/${originalActionId}`,
        expect.any(Object),
      );
      expect(session.getState().pendingAction).toBeNull();
      expect(session.getState().view?.deliveryVersion).toBe(2);
    });
  });

  describe("3. Offline Pause State", () => {
    it("pauses inputs when disconnected, reconnecting, or offline; disables input queueing", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      const session = new MatchSession({
        matchId: "match-offline",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      // Initially disconnected: inputs must be paused
      expect(session.getState().connectionState).toBe("disconnected");
      expect(session.getState().isInputPaused).toBe(true);

      // Attempting to send an action while disconnected must throw (no offline queueing!)
      await expect(session.sendAction("connect-four.drop", { column: 0 })).rejects.toThrow(
        /Inputs are currently paused/i,
      );

      // Connect socket
      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      expect(session.getState().connectionState).toBe("connected");
      expect(session.getState().isInputPaused).toBe(false);

      // Socket drops: enters reconnecting
      ws.close();
      expect(session.getState().connectionState).toBe("reconnecting");
      expect(session.getState().isInputPaused).toBe(true);

      // Inputs paused again
      await expect(session.sendAction("connect-four.drop", { column: 0 })).rejects.toThrow(
        /Inputs are currently paused/i,
      );
    });
  });

  describe("4. Secret Masking and Recovery on Reconnect", () => {
    it("never stores secret lock choice in sessionStorage; stores only metadata", async () => {
      const initialView = createMockFilteredView({
        deliveryVersion: 1,
        roundId: 1,
      });
      const session = new MatchSession({
        matchId: "match-secret-storage",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      // Submit secret action: RPS "rock"
      void session
        .sendAction("secret.lock", { choice: "rock" }, { roundId: 1, isSecret: true })
        .catch(() => {});

      // Check storage
      const storedKey = "pa_pending_A_match-secret-storage";
      const storedRaw = mockStorage.getItem(storedKey);
      expect(storedRaw).not.toBeNull();

      const storedMeta = JSON.parse(storedRaw!);
      expect(storedMeta.action).toBe("secret.lock");
      expect(storedMeta.isSecret).toBe(true);
      expect(storedMeta.roundId).toBe(1);
      // CRITICAL SECURITY ASSERTION: the choice "rock" MUST NOT be in storage!
      expect(storedMeta.payload).toBeUndefined();
      expect(JSON.stringify(storedMeta)).not.toContain("rock");
    });

    it("masks secret choices immediately upon reconnect/reconcile", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialView,
      });

      const session = new MatchSession({
        matchId: "match-secret-mask",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        fetchFn: mockFetch,
        storage: mockStorage,
      });

      expect(session.getState().secretChoiceMasked).toBe(false);

      // Trigger reconcile (simulating focus/reconnect/pageshow)
      const reconcilePromise = session.reconcile();
      expect(session.getState().secretChoiceMasked).toBe(true);
      expect(session.getState().syncStatus).toBe("reconciling");

      await reconcilePromise;
      expect(session.getState().syncStatus).toBe("idle");
      // Choice remains masked until user explicitly interacts
      expect(session.getState().secretChoiceMasked).toBe(true);

      session.unmaskSecretChoice();
      expect(session.getState().secretChoiceMasked).toBe(false);
    });

    it("recovers uncertain secret lock via POST /secret-recovery with status superseded", async () => {
      const initialView = createMockFilteredView({ deliveryVersion: 1, roundId: 1 });
      const session = new MatchSession({
        matchId: "match-sec-rec",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        fetchFn: mockFetch,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      void session
        .sendAction("secret.lock", { choice: "rock" }, { roundId: 1, isSecret: true })
        .catch(() => {});
      const pending = session.getState().pendingAction;
      expect(pending).not.toBeNull();

      // Disconnect occurs while uncertain secret lock was in flight
      ws.close();

      // Secret-recovery endpoint returns superseded (the lock did not land)
      const supersededView = createMockFilteredView({ deliveryVersion: 1, roundId: 1 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "superseded",
          locked: false,
          view: supersededView,
        }),
      });

      // Call reconcile
      await session.reconcile();

      // Endpoint must have been called with pendingActionId
      expect(mockFetch).toHaveBeenCalledWith(
        "https://arcade.test/api/v1/matches/match-sec-rec/secret-recovery",
        expect.anything(),
      );
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.pendingActionId).toBe(pending?.actionId);
      expect(callBody.roundId).toBe(1);

      // Pending action is cleared so user can choose again safely
      expect(session.getState().pendingAction).toBeNull();
      expect(session.getState().secretChoiceMasked).toBe(true);
    });
  });

  describe("5. HTTP Polling Fallback", () => {
    it("falls back to HTTP polling when transport is polling or WebSocket is unavailable", async () => {
      if (typeof document !== "undefined") {
        Object.defineProperty(document, "hidden", { value: false, configurable: true });
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          configurable: true,
        });
      }

      const initialView = createMockFilteredView({ deliveryVersion: 1 });
      const polledView = createMockFilteredView({ deliveryVersion: 2, turnSeat: "B" });

      const session = new MatchSession({
        matchId: "match-poll",
        actorAccountId: "A",
        initialView,
        baseUrl: "https://arcade.test",
        transport: "polling",
        pollIntervalMs: 2000,
        fetchFn: mockFetch,
        storage: mockStorage,
      });

      // Set up next poll response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => polledView,
      });

      session.connect();
      expect(session.getState().connectionState).toBe("connecting");
      expect(session.getState().isInputPaused).toBe(true);

      // Advance by pollIntervalMs
      await vi.advanceTimersByTimeAsync(2000);

      expect(session.getState().deliveryVersion).toBe(2);
      expect(session.getState().view?.turnSeat).toBe("B");
    });
  });

  describe("6. Controller Takeover Notifications", () => {
    it("updates controller status and surfaces takeover notice on control-changed message", () => {
      const initialView = createMockFilteredView({
        deliveryVersion: 1,
        controller: {
          controllingAccountId: "A",
          controllerGeneration: 1,
          isController: true,
        },
      });

      const session = new MatchSession({
        matchId: "match-ctrl",
        actorAccountId: "A",
        initialView,
        transport: "websocket",
        webSocketClass: MockWebSocket as any,
        storage: mockStorage,
      });

      session.connect();
      const ws = MockWebSocket.instances[0];
      ws.open();

      expect(session.getState().controllerStatus?.isController).toBe(true);
      expect(session.getState().controllerStatus?.takeoverNotice).toBe(false);

      // Controller changed to B
      ws.emit({
        type: "control-changed",
        controller: {
          controllingAccountId: "B",
          controllerGeneration: 2,
          isController: false,
        },
        deliveryVersion: 2,
        serverTime: Date.now(),
      });

      const updated = session.getState().controllerStatus;
      expect(updated?.controllingAccountId).toBe("B");
      expect(updated?.controllerGeneration).toBe(2);
      expect(updated?.isController).toBe(false);
      expect(updated?.takeoverNotice).toBe(true);

      // User dismisses takeover notice
      session.dismissTakeoverNotice();
      expect(session.getState().controllerStatus?.takeoverNotice).toBe(false);
    });
  });
  it("does not accept an uncertain action because an unrelated broadcast advances the board", async () => {
    const view = createMockFilteredView({ deliveryVersion: 1 });
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      webSocketClass: MockWebSocket,
      storage: mockStorage,
      fetchFn: mockFetch,
    });
    session.connect();
    const socket = MockWebSocket.instances[0];
    socket.open();
    const pending = session.sendAction("connect-four.drop", { column: 0 });
    const id = session.getState().pendingAction!.actionId;
    socket.emit({
      type: "event",
      eventId: "other-action",
      acceptedVersion: 2,
      serverTime: Date.now(),
      view: { ...view, deliveryVersion: 2 },
    });
    expect(session.getState().pendingAction?.actionId).toBe(id);
    expect(session.getState().isInputPaused).toBe(true);
    socket.emit({
      status: "accepted",
      actionId: id,
      acceptedVersion: 3,
      eventId: "ours",
      serverTime: Date.now(),
      view: { ...view, deliveryVersion: 3 },
    });
    await expect(pending).resolves.toMatchObject({ actionId: id });
    session.disconnect();
  });
  it("keeps input paused when fallback snapshot requests fail", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    const session = new MatchSession({
      matchId: "network-failure",
      actorAccountId: "B",
      transport: "polling",
      fetchFn: mockFetch,
      storage: mockStorage,
    });
    session.connect();
    await vi.advanceTimersByTimeAsync(3000);
    expect(session.getState().isInputPaused).toBe(true);
    expect(session.getState().connectionState).not.toBe("connected");
    session.disconnect();
  });
  it("honors same-account viewer false control instead of treating account equality as authority", () => {
    const view = createMockFilteredView({ mode: "together" });
    view.controller = { controllingAccountId: "A", controllerGeneration: 2, isController: false };
    const session = new MatchSession({
      matchId: view.matchId,
      actorAccountId: "A",
      initialView: view,
      fetchFn: mockFetch,
      storage: mockStorage,
    });
    session.setConnectionState("connected");
    expect(session.getState().controllerStatus?.isController).toBe(false);
    expect(session.getState().isInputPaused).toBe(true);
    session.disconnect();
  });
});
