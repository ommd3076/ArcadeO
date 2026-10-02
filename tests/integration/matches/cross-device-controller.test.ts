import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { createMockDOStorage } from "./do-mock";
import { MatchDurableObject } from "../../../worker/matches/match-do";
import { getPuzzleById } from "../../../worker/sudoku/catalog";
import { getPrivateSolution } from "../../../worker/sudoku/verification";

async function makeAuthority(matchId: string) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE sessions(sessionId TEXT PRIMARY KEY, accountId TEXT, expiresAt INTEGER, revokedAt INTEGER)",
  );
  for (const [sessionId, accountId] of [
    ["a1", "A"],
    ["a2", "A"],
    ["b1", "B"],
  ]) {
    db.prepare("INSERT INTO sessions VALUES(?,?,?,NULL)").run(
      sessionId,
      accountId,
      Date.now() + 86_400_000,
    );
  }
  const authority = new MatchDurableObject({ storage: createMockDOStorage(db) } as any, {
    DB: createMockD1Database(db),
  });
  return { authority, db, matchId };
}

function participants() {
  return {
    A: { accountId: "A" as const, displayName: "Player A", ready: true },
    B: { accountId: "B" as const, displayName: "Player B", ready: true },
  };
}

async function submit(
  authority: MatchDurableObject,
  matchId: string,
  action: string,
  account: "A" | "B",
  sessionId: string,
  payload: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const snapshot = authority.getSnapshot()!;
  return authority.handleAction(
    {
      protocolVersion: 1,
      matchId,
      actionId: crypto.randomUUID(),
      action: action as any,
      payload,
      expectedVersion: snapshot.deliveryVersion,
      controllerGeneration:
        snapshot.controller.playerControllers?.[account]?.generation ??
        snapshot.controller.controllerGeneration,
      progressRevision: (snapshot.gameState as any).players?.[account]?.progressRevision ?? 0,
      ...extra,
    },
    account,
    sessionId,
  );
}

afterEach(() => vi.useRealTimers());

describe("different-account Remote readiness and controller recovery", () => {
  it("serves accepted invitation/readiness instead of creation metadata", async () => {
    const { authority } = await makeAuthority("remote-ready");
    await authority.initializeMatch({
      matchId: "remote-ready",
      gameId: "connect-four",
      mode: "remote",
      creatorAccountId: "A",
      creatorSessionId: "a1",
      participants: participants(),
    });

    const initial = authority.buildFilteredView(authority.getSnapshot()!, "A", "a1");
    expect(initial.participants.A.ready).toBe(true);
    expect(initial.readiness).toEqual({ A: false, B: false });
    expect(initial.invitationAccepted).toBe(false);

    const accepted = await submit(authority, "remote-ready", "match.accept", "B", "b1");
    expect(accepted.status).toBe("accepted");
    expect(accepted.status === "accepted" && accepted.view.invitationAccepted).toBe(true);
    expect(accepted.status === "accepted" && accepted.view.readiness).toEqual({
      A: false,
      B: false,
    });

    const readyA = await submit(authority, "remote-ready", "match.ready", "A", "a1");
    expect(readyA.status).toBe("accepted");
    expect(readyA.status === "accepted" && readyA.view.readiness).toEqual({ A: true, B: false });
    expect(readyA.status === "accepted" && readyA.view.lifecycle).toBe("waiting");

    const readyB = await submit(authority, "remote-ready", "match.ready", "B", "b1");
    expect(readyB.status).toBe("accepted");
    expect(readyB.status === "accepted" && readyB.view.readiness).toEqual({ A: true, B: true });
    expect(readyB.status === "accepted" && readyB.view.lifecycle).toBe("active");
  });

  it("preserves independent Sudoku Duel controls across A takeover and rejects A's stale session", async () => {
    vi.useFakeTimers();
    const { authority } = await makeAuthority("sudoku-duel");
    const puzzle = getPuzzleById("easy-001")!;
    await authority.initializeMatch({
      matchId: "sudoku-duel",
      gameId: "sudoku",
      mode: "duel",
      creatorAccountId: "A",
      creatorSessionId: "a1",
      participants: participants(),
      gameOptions: {
        mode: "duel",
        puzzleId: "easy-001",
        givens: puzzle.givens,
        solution: getPrivateSolution("easy-001"),
      },
    });

    expect((await submit(authority, "sudoku-duel", "match.accept", "B", "b1")).status).toBe(
      "accepted",
    );
    expect((await submit(authority, "sudoku-duel", "match.ready", "A", "a1")).status).toBe(
      "accepted",
    );
    expect((await submit(authority, "sudoku-duel", "match.ready", "B", "b1")).status).toBe(
      "accepted",
    );
    await vi.advanceTimersByTimeAsync(5_000);

    const takeover = await authority.handleControllerTakeover("A", 1, "a2");
    expect(takeover.success).toBe(true);
    const snapshot = authority.getSnapshot()!;
    const aOld = authority.buildFilteredView(snapshot, "A", "a1");
    const aNew = authority.buildFilteredView(snapshot, "A", "a2");
    const bCurrent = authority.buildFilteredView(snapshot, "B", "b1");
    expect(aOld.controller).toMatchObject({ controllerGeneration: 2, isController: false });
    expect(aNew.controller).toMatchObject({ controllerGeneration: 2, isController: true });
    expect(bCurrent.controller).toMatchObject({
      controllingAccountId: "A",
      controllerGeneration: 1,
      isController: true,
    });

    const currentB = snapshot.gameState as any;
    const emptyIndex = currentB.players.B.cells.findIndex(
      (value: number, index: number) => value === 0 && currentB.givens[index] === "0",
    );
    expect(emptyIndex).toBeGreaterThanOrEqual(0);
    const bEdit = await submit(authority, "sudoku-duel", "sudoku.edit", "B", "b1", {
      row: Math.floor(emptyIndex / 9),
      col: emptyIndex % 9,
      operation: "set",
      value: Number((getPrivateSolution("easy-001") ?? "")[emptyIndex] ?? "0"),
    });
    expect(bEdit).toMatchObject({ status: "accepted" });
    expect(bEdit.status === "accepted" && bEdit.view.controller).toMatchObject({
      controllerGeneration: 1,
      isController: true,
    });

    const staleA = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "sudoku-duel",
        actionId: crypto.randomUUID(),
        action: "sudoku.edit",
        payload: { row: 0, col: 0, operation: "set", value: 1 },
        controllerGeneration: 1,
        progressRevision: 0,
      },
      "A",
      "a1",
    );
    expect(staleA.status).toBe("rejected");
    expect(staleA.status === "rejected" && staleA.code).toBe("CONTROL_TRANSFERRED");
    expect(staleA.status === "rejected" && staleA.latestView?.controller).toMatchObject({
      controllerGeneration: 2,
      isController: false,
    });
  });

  it("keeps active Remote state and event history unchanged after a disconnect-length alarm delay", async () => {
    vi.useFakeTimers();
    const { authority, db } = await makeAuthority("remote-disconnect");
    await authority.initializeMatch({
      matchId: "remote-disconnect",
      gameId: "connect-four",
      mode: "remote",
      creatorAccountId: "A",
      creatorSessionId: "a1",
      participants: participants(),
    });
    expect((await submit(authority, "remote-disconnect", "match.accept", "B", "b1")).status).toBe(
      "accepted",
    );
    expect((await submit(authority, "remote-disconnect", "match.ready", "A", "a1")).status).toBe(
      "accepted",
    );
    expect((await submit(authority, "remote-disconnect", "match.ready", "B", "b1")).status).toBe(
      "accepted",
    );
    const version = authority.getSnapshot()!.deliveryVersion;
    const eventCount = Number(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n);

    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    await authority.alarm();

    expect(authority.getSnapshot()).toMatchObject({
      lifecycle: "active",
      deliveryVersion: version,
      result: null,
    });
    expect(Number(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n)).toBe(eventCount);
  });
});
