import { describe, expect, it } from "vitest";
import type { AcceptedReply, FilteredMatchView } from "../../../shared/protocol/types";
import type { SudokuView } from "../../../shared/games/sudoku/types";
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

function makeDuelView(options: {
  deliveryVersion: number;
  serverTime: number;
  hasStarted: boolean;
  lifecycle?: "waiting" | "active";
}): FilteredMatchView {
  const scheduledStartTime = 1_800_000_000_000;
  const sudoku: SudokuView = {
    puzzleId: "sudoku-easy-001",
    mode: "duel",
    scheduledStartTime,
    hasStarted: options.hasStarted,
    givens: options.hasStarted ? "1".repeat(81) : "0".repeat(81),
    self: {
      filledCount: 0,
      completed: false,
      elapsedMs: options.hasStarted ? 15 : 0,
      paused: false,
      assisted: false,
      ...(options.hasStarted ? { cells: Array(81).fill(0), notes: Array(81).fill(0) } : {}),
      undoAvailable: false,
    },
    opponent: {
      filledCount: 0,
      completed: false,
      elapsedMs: options.hasStarted ? 15 : 0,
      paused: false,
      assisted: false,
    },
  };

  return createMockFilteredView({
    gameId: "sudoku",
    mode: "duel",
    lifecycle: options.lifecycle ?? "active",
    deliveryVersion: options.deliveryVersion,
    serverTime: options.serverTime,
    participants: {
      A: { accountId: "A", displayName: "Player One", ready: true },
      B: { accountId: "B", displayName: "Player Two", ready: true },
    },
    controller: {
      controllingAccountId: "A",
      controllerGeneration: 1,
      isController: true,
    },
    gameState: sudoku,
    legalActions: options.lifecycle === "waiting" ? ["match.ready"] : ["sudoku.edit"],
  });
}

function connect(session: MatchSession): Socket {
  session.connect();
  const socket = Socket.latest!;
  socket.open();
  return socket;
}

function startedDuelSession() {
  const view = makeDuelView({
    deliveryVersion: 60,
    serverTime: 1_800_000_000_100,
    hasStarted: true,
  });
  const session = new MatchSession({
    matchId: view.matchId,
    actorAccountId: "A",
    initialView: view,
    transport: "websocket",
    webSocketClass: Socket,
    storage: null,
  });
  return { view, session, socket: connect(session) };
}

function makeAcceptedReadyReply(view: FilteredMatchView, actionId: string): AcceptedReply {
  return {
    status: "accepted",
    actionId,
    acceptedVersion: view.deliveryVersion,
    eventId: "event-" + view.deliveryVersion,
    serverTime: view.serverTime,
    view,
  };
}

describe("Sudoku Duel scheduled-start message ordering", () => {
  it("keeps the started board after a delayed same-version pre-start HTTP snapshot", async () => {
    const oldHttpView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_799_999_999_000,
      hasStarted: false,
    });
    const startedSocketView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_800_000_000_100,
      hasStarted: true,
    });
    let resolveFetch!: (response: Response) => void;
    const fetchFn = () => new Promise<Response>((resolve) => (resolveFetch = resolve));
    const session = new MatchSession({
      matchId: oldHttpView.matchId,
      actorAccountId: "A",
      initialView: oldHttpView,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as typeof fetch,
      storage: null,
    });
    const socket = connect(session);

    const pollSnapshot = Reflect.get(session, "pollSnapshot") as () => Promise<void>;
    const delayedSnapshot = pollSnapshot.call(session);
    socket.emit({
      type: "snapshot",
      view: startedSocketView,
      serverTime: startedSocketView.serverTime,
    });
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(true);

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => oldHttpView,
    } as Response);
    await delayedSnapshot;

    expect(session.getState().deliveryVersion).toBe(60);
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(true);
    expect((session.getState().view?.gameState as SudokuView).givens).toBe("1".repeat(81));
    session.disconnect();
  });

  it("keeps the started board after a delayed same-version HTTP accepted Ready reply", async () => {
    const waiting = makeDuelView({
      deliveryVersion: 59,
      serverTime: 1_799_999_998_000,
      hasStarted: false,
      lifecycle: "waiting",
    });
    const preStartReadyReplyView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_799_999_999_000,
      hasStarted: false,
    });
    const startedSocketView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_800_000_000_100,
      hasStarted: true,
    });
    let resolveActionFetch!: (response: Response) => void;
    const session = new MatchSession({
      matchId: waiting.matchId,
      actorAccountId: "A",
      initialView: waiting,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: (() =>
        new Promise<Response>((resolve) => (resolveActionFetch = resolve))) as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    const readyAction = session.sendAction("match.ready", {});
    const readyActionId = session.getState().pendingAction!.actionId;
    socket.emit({
      type: "snapshot",
      view: startedSocketView,
      serverTime: startedSocketView.serverTime,
    });
    resolveActionFetch({
      ok: true,
      status: 200,
      json: async () => makeAcceptedReadyReply(preStartReadyReplyView, readyActionId),
    } as Response);
    await readyAction;

    expect(session.getState().deliveryVersion).toBe(60);
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(true);
    expect((session.getState().view?.gameState as SudokuView).givens).toBe("1".repeat(81));
    session.disconnect();
  });

  it("keeps the started board when an unknown Ready action is accepted by its receipt", async () => {
    const waiting = makeDuelView({
      deliveryVersion: 59,
      serverTime: 1_799_999_998_000,
      hasStarted: false,
      lifecycle: "waiting",
    });
    const preStartReceiptView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_799_999_999_000,
      hasStarted: false,
    });
    const startedSocketView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_800_000_000_100,
      hasStarted: true,
    });
    let actionCalls = 0;
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/actions")) {
        actionCalls++;
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("uncertain response");
          },
        } as unknown as Response;
      }
      if (String(input).includes("/receipts/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "accepted", view: preStartReceiptView }),
        } as unknown as Response;
      }
      throw new Error(
        `Unexpected reconciliation request: ${String(input)} ${String(init?.method)}`,
      );
    };
    const session = new MatchSession({
      matchId: waiting.matchId,
      actorAccountId: "A",
      initialView: waiting,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    await expect(session.sendAction("match.ready", {})).rejects.toThrow(
      "Malformed action response",
    );
    expect(session.getState().pendingAction).not.toBeNull();
    socket.emit({
      type: "snapshot",
      view: startedSocketView,
      serverTime: startedSocketView.serverTime,
    });
    await expect(session.retryPendingAction()).resolves.toBeNull();

    expect(actionCalls).toBe(1);
    expect(session.getState().pendingAction).toBeNull();
    expect(session.getState().syncStatus).toBe("idle");
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(true);
    expect((session.getState().view?.gameState as SudokuView).givens).toBe("1".repeat(81));
    session.disconnect();
  });

  it("keeps the started board and preserves rejection cleanup for a same-version latest view", async () => {
    const waiting = makeDuelView({
      deliveryVersion: 59,
      serverTime: 1_799_999_998_000,
      hasStarted: false,
      lifecycle: "waiting",
    });
    const preStartRejectedView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_799_999_999_000,
      hasStarted: false,
    });
    const startedSocketView = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_800_000_000_100,
      hasStarted: true,
    });
    let resolveActionFetch!: (response: Response) => void;
    const fetchFn = () => new Promise<Response>((resolve) => (resolveActionFetch = resolve));
    const session = new MatchSession({
      matchId: waiting.matchId,
      actorAccountId: "A",
      initialView: waiting,
      transport: "websocket",
      webSocketClass: Socket,
      fetchFn: fetchFn as typeof fetch,
      storage: null,
    });
    const socket = connect(session);
    socket.readyState = 3;

    const readyAction = session.sendAction("match.ready", {});
    const actionId = session.getState().pendingAction!.actionId;
    socket.emit({
      type: "snapshot",
      view: startedSocketView,
      serverTime: startedSocketView.serverTime,
    });
    resolveActionFetch({
      ok: true,
      status: 200,
      json: async () => ({
        status: "rejected",
        actionId,
        code: "READY_ALREADY_ACCEPTED",
        message: "This Ready action was already accepted.",
        retryable: false,
        latestView: preStartRejectedView,
      }),
    } as Response);
    await expect(readyAction).rejects.toThrow("READY_ALREADY_ACCEPTED");

    expect(session.getState().pendingAction).toBeNull();
    expect(session.getState().error).toMatchObject({
      code: "READY_ALREADY_ACCEPTED",
      category: "game",
    });
    expect(session.getState().deliveryVersion).toBe(60);
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(true);
    expect((session.getState().view?.gameState as SudokuView).givens).toBe("1".repeat(81));
    session.disconnect();
  });

  it("accepts higher-version save, terminal, and controller changes", () => {
    const started = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_800_000_000_100,
      hasStarted: true,
    });
    const session = new MatchSession({
      matchId: started.matchId,
      actorAccountId: "A",
      initialView: started,
      transport: "websocket",
      webSocketClass: Socket,
      storage: null,
    });
    const socket = connect(session);

    socket.emit({
      type: "snapshot",
      view: {
        ...started,
        deliveryVersion: 61,
        lifecycle: "saved",
        gameState: {
          ...(started.gameState as SudokuView),
          hasStarted: false,
          givens: "0".repeat(81),
        },
      },
      serverTime: started.serverTime,
    });
    expect(session.getState().view?.lifecycle).toBe("saved");

    socket.emit({
      type: "snapshot",
      view: {
        ...started,
        deliveryVersion: 62,
        lifecycle: "completed",
        gameState: {
          ...(started.gameState as SudokuView),
          hasStarted: false,
          givens: "0".repeat(81),
          terminalResult: {
            winner: null,
            reason: "rules_draw",
            scores: { A: 0, B: 0 },
            finishedAt: started.serverTime,
          },
        },
      },
      serverTime: started.serverTime,
    });
    expect(session.getState().view?.lifecycle).toBe("completed");
    expect((session.getState().view?.gameState as SudokuView).terminalResult?.reason).toBe(
      "rules_draw",
    );

    socket.emit({
      type: "snapshot",
      view: {
        ...started,
        deliveryVersion: 63,
        controller: {
          controllingAccountId: "B",
          controllerGeneration: 2,
          isController: false,
        },
        gameState: {
          ...(started.gameState as SudokuView),
          hasStarted: false,
          givens: "0".repeat(81),
        },
      },
      serverTime: started.serverTime,
    });
    expect(session.getState().controllerStatus).toMatchObject({
      controllingAccountId: "B",
      controllerGeneration: 2,
      isController: false,
    });
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(false);
    session.disconnect();
  });

  it("does not reuse started state across a participant identity change", () => {
    const { session, socket } = startedDuelSession();
    const switchedParticipants = {
      ...makeDuelView({
        deliveryVersion: 60,
        serverTime: 1_799_999_999_000,
        hasStarted: false,
      }),
      participants: {
        A: { accountId: "B", displayName: "Player Two", ready: true },
        B: { accountId: "A", displayName: "Player One", ready: true },
      },
      controller: {
        controllingAccountId: "B",
        controllerGeneration: 1,
        isController: false,
      },
    };
    socket.emit({
      type: "snapshot",
      view: switchedParticipants,
      serverTime: switchedParticipants.serverTime,
    });
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(false);
    expect((session.getState().view?.gameState as SudokuView).self.cells).toBeUndefined();
    session.disconnect();
  });

  it("does not reuse started state across a scheduled deadline change", () => {
    const { session, socket } = startedDuelSession();
    const differentDeadline = makeDuelView({
      deliveryVersion: 60,
      serverTime: 1_799_999_999_000,
      hasStarted: false,
    });
    const differentDeadlineGame = {
      ...(differentDeadline.gameState as SudokuView),
      scheduledStartTime: 1_800_000_001_000,
    };
    const differentDeadlineView = { ...differentDeadline, gameState: differentDeadlineGame };
    socket.emit({
      type: "snapshot",
      view: differentDeadlineView,
      serverTime: differentDeadlineView.serverTime,
    });
    expect((session.getState().view?.gameState as SudokuView).scheduledStartTime).toBe(
      1_800_000_001_000,
    );
    session.disconnect();
  });

  it("does not preserve a started view across a same-version controller-generation change", () => {
    const { session, socket } = startedDuelSession();
    const changedControllerView = {
      ...makeDuelView({
        deliveryVersion: 60,
        serverTime: 1_799_999_999_000,
        hasStarted: false,
      }),
      controller: {
        controllingAccountId: "A",
        controllerGeneration: 2,
        isController: false,
      },
    };
    socket.emit({
      type: "snapshot",
      view: changedControllerView,
      serverTime: changedControllerView.serverTime,
    });

    expect(session.getState().controllerStatus).toMatchObject({
      controllerGeneration: 2,
      isController: false,
    });
    expect((session.getState().view?.gameState as SudokuView).hasStarted).toBe(false);
    session.disconnect();
  });
});
