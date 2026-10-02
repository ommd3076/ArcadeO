import { createMockD1Database } from "../auth/d1-mock";
import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createMockDOStorage } from "./do-mock";
import { MatchDurableObject } from "../../../worker/matches/match-do";
import type { ActionEnvelope } from "../../../shared/protocol/types";
import { getPuzzleById } from "../../../worker/sudoku/catalog";
import { getPrivateSolution } from "../../../worker/sudoku/verification";

async function fixture(
  gameId: "connect-four" | "rock-paper-scissors" = "connect-four",
  mode: "remote" | "together" = "together",
) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE sessions(sessionId TEXT PRIMARY KEY, accountId TEXT, expiresAt INTEGER, revokedAt INTEGER)",
  );
  db.prepare("INSERT INTO sessions VALUES(?,?,?,NULL)").run("unit-A", "A", Date.now() + 60000);
  const authority = new MatchDurableObject({ storage: createMockDOStorage(db) } as any, {
    DB: createMockD1Database(db),
  });
  await authority.initializeMatch({
    matchId: "match",
    gameId,
    mode,
    creatorAccountId: "A",
    participants: {
      A: { accountId: "A", displayName: "A", ready: true },
      B: { accountId: "B", displayName: "B", ready: true },
    },
  });
  const action = (column: number, actionId = crypto.randomUUID()): ActionEnvelope => ({
    protocolVersion: 1,
    matchId: "match",
    actionId,
    action: "connect-four.drop",
    payload: { column },
    expectedVersion: 1,
    turnId: 1,
    controllerGeneration: 1,
  });
  return { authority, db, action };
}

describe("serialized authority regressions (SQLite adapter, not Workers runtime)", () => {
  it("allows only one simultaneous turn consumption", async () => {
    const { authority, db, action } = await fixture();
    const replies = await Promise.all([
      authority.handleAction(action(0), "A", "unit-A"),
      authority.handleAction(action(1), "A", "unit-A"),
    ]);
    expect(replies.filter((reply) => reply.status === "accepted")).toHaveLength(1);
    expect(authority.getSnapshot()?.deliveryVersion).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(1);
  });
  it("returns original identity once for simultaneous identical retries", async () => {
    const { authority, db, action } = await fixture();
    const envelope = action(0);
    const replies = await Promise.all([
      authority.handleAction(envelope, "A", "unit-A"),
      authority.handleAction(envelope, "A", "unit-A"),
    ]);
    expect(replies.map((reply) => reply.status)).toEqual(["accepted", "accepted"]);
    expect((replies[0] as any).eventId).toBe((replies[1] as any).eventId);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(1);
  });
  it("rejects missing/future controller and nonmembers without exposing a view", async () => {
    const { authority, action } = await fixture();
    expect(
      (
        (await authority.handleAction(
          { ...action(0), controllerGeneration: undefined },
          "A",
          "unit-A",
        )) as any
      ).code,
    ).toBe("CONTROL_TRANSFERRED");
    expect(
      (
        (await authority.handleAction(
          { ...action(0), controllerGeneration: 99 },
          "A",
          "unit-A",
        )) as any
      ).code,
    ).toBe("CONTROL_TRANSFERRED");
    const other = await authority.handleAction(action(0), "C" as any, "unit-A");
    expect((other as any).latestView).toBeUndefined();
  });
  it("recovery tombstones serialize against a delayed secret submission", async () => {
    const { authority, db } = await fixture("rock-paper-scissors");
    const actionId = crypto.randomUUID();
    await authority.handleSecretRecovery(actionId, "A", 1, "unit-A", 1);
    const reply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId,
        action: "secret.lock",
        payload: { choice: "rock" },
        roundId: 1,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect((reply as any).code).toBe("ACTION_SUPERSEDED");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
  });
  it("rolls back all accepted artifacts when a related write fails", async () => {
    const { authority, db, action } = await fixture();
    db.exec(
      "CREATE TRIGGER abort_receipt BEFORE INSERT ON action_receipts BEGIN SELECT RAISE(ABORT, 'fault'); END;",
    );
    await expect(authority.handleAction(action(0), "A", "unit-A")).rejects.toThrow();
    expect(authority.getSnapshot()?.deliveryVersion).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
  });

  it("keeps saved matches resumable beyond legacy expiry metadata", async () => {
    const { authority } = await fixture();
    // 1. Leave-save
    const leaveReply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId: crypto.randomUUID(),
        action: "match.leave-save",
        payload: {},
        expectedVersion: 1,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect(leaveReply.status).toBe("accepted");
    const snapSaved = authority.getSnapshot();
    expect(snapSaved?.lifecycle).toBe("saved");
    expect(snapSaved?.pauseId).toBeDefined();
    expect(snapSaved?.expiresAt).toBeNull();

    // Existing snapshots can still carry the old 72-hour timestamp. It is
    // legacy metadata and must not end the saved lifecycle or block Resume.
    const expiredAt = Date.now() - 60_000;
    authority["state"].storage.sql.exec(
      "UPDATE match_snapshot SET expiresAt = ? WHERE matchId = ?",
      expiredAt,
      "match",
    );
    await authority.alarm();
    expect(authority.getSnapshot()?.lifecycle).toBe("saved");
    expect(authority.getSnapshot()?.result).toBeNull();

    // 2. Normal move while saved is rejected
    const moveReply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId: crypto.randomUUID(),
        action: "connect-four.drop",
        payload: { column: 3 },
        expectedVersion: 2,
        turnId: 1,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect(moveReply.status).toBe("rejected");
    expect((moveReply as any).code).toBe("INVALID_ACTION");

    // 3. Resume with invalid pauseId is rejected
    const resumeBad = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId: crypto.randomUUID(),
        action: "match.resume",
        payload: { pauseId: crypto.randomUUID() },
        expectedVersion: 2,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect(resumeBad.status).toBe("rejected");

    // 4. Resume succeeds even though the legacy timestamp has passed.
    const resignReply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId: crypto.randomUUID(),
        action: "match.resume",
        payload: { pauseId: snapSaved!.pauseId! },
        expectedVersion: 2,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect(resignReply.status).toBe("accepted");
    const resumed = authority.getSnapshot();
    expect(resumed?.lifecycle).toBe("active");
    expect(resumed?.pauseId).toBeNull();
    expect(resumed?.expiresAt).toBeNull();
  });

  it("keeps a previously expired terminal record terminal", async () => {
    const { authority, db, action } = await fixture();
    const finishedAt = Date.now() - 86_400_000;
    const terminal = {
      winner: null,
      reason: "expired",
      finishedAt,
      scores: { A: 0, B: 0 },
      details: { scored: false },
    };
    db.prepare("UPDATE match_snapshot SET lifecycle = 'expired', result = ? WHERE matchId = ?").run(
      JSON.stringify(terminal),
      "match",
    );

    const view = authority.buildFilteredView(authority.getSnapshot()!, "A", "unit-A");
    expect(view.lifecycle).toBe("expired");
    expect(view.result?.reason).toBe("expired");
    const reply = await authority.handleAction(action(0), "A", "unit-A");
    expect(reply.status).toBe("rejected");
    expect((reply as any).code).toBe("MATCH_FINISHED");
    expect(authority.getSnapshot()?.lifecycle).toBe("expired");
    expect(authority.getSnapshot()?.result?.finishedAt).toBe(finishedAt);
  });

  it("rejects non-UUID pendingActionId in handleSecretRecovery", async () => {
    const { authority } = await fixture("rock-paper-scissors");
    await expect(
      authority.handleSecretRecovery("not-a-valid-uuid", "A", 1, "unit-A", 1),
    ).rejects.toThrow("Invalid pendingActionId: must be a valid UUID");
  });

  it("pauses both players and sets interrupted on Sudoku duel leave-save and resumes cleanly", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(
      "CREATE TABLE sessions(sessionId TEXT PRIMARY KEY, accountId TEXT, expiresAt INTEGER, revokedAt INTEGER)",
    );
    db.prepare("INSERT INTO sessions VALUES(?,?,?,NULL)").run("unit-A", "A", Date.now() + 60000);
    db.prepare("INSERT INTO sessions VALUES(?,?,?,NULL)").run("unit-B", "B", Date.now() + 60000);
    const authority = new MatchDurableObject({ storage: createMockDOStorage(db) } as any, {
      DB: createMockD1Database(db),
    });
    const puzzle = getPuzzleById("easy-001")!;
    const solution = getPrivateSolution("easy-001");
    await authority.initializeMatch({
      matchId: "sudoku-match",
      gameId: "sudoku",
      mode: "duel",
      creatorAccountId: "A",
      participants: {
        A: { accountId: "A", displayName: "A", ready: true },
        B: { accountId: "B", displayName: "B", ready: true },
      },
      gameOptions: {
        mode: "duel",
        puzzleId: "easy-001",
        givens: puzzle.givens,
        solution,
      },
    });

    const act = async (
      action: string,
      actor: "A" | "B",
      expectedVersion: number,
      payload: Record<string, unknown> = {},
    ) =>
      authority.handleAction(
        {
          protocolVersion: 1,
          matchId: "sudoku-match",
          actionId: crypto.randomUUID(),
          action: action as any,
          payload,
          expectedVersion,
          controllerGeneration: 1,
        },
        actor,
        `unit-${actor}`,
      );

    expect(authority.getSnapshot()?.lifecycle).toBe("waiting");
    expect((await act("match.accept", "B", 1)).status).toBe("accepted");
    expect((await act("match.ready", "A", 2)).status).toBe("accepted");
    expect((await act("match.ready", "B", 3)).status).toBe("accepted");
    expect(authority.getSnapshot()?.lifecycle).toBe("active");

    const leave = await act("match.leave-save", "A", 4);
    expect(leave.status).toBe("accepted");
    const savedSnap = authority.getSnapshot()!;
    expect(savedSnap.lifecycle).toBe("saved");
    const sState = savedSnap.gameState as any;
    expect(sState.interrupted).toBe(true);
    expect(sState.players.A.paused).toBe(true);
    expect(sState.players.B.paused).toBe(true);

    const resumeA = await act("match.resume", "A", 5, { pauseId: savedSnap.pauseId! });
    expect(resumeA.status).toBe("accepted");
    expect(authority.getSnapshot()?.lifecycle).toBe("saved");
    const resumeB = await act("match.resume", "B", 6, { pauseId: savedSnap.pauseId! });
    expect(resumeB.status).toBe("accepted");
    const resumedSnap = authority.getSnapshot()!;
    expect(resumedSnap.lifecycle).toBe("active");
    const rState = resumedSnap.gameState as any;
    expect(rState.interrupted).toBe(true);
    expect(rState.players.A.paused).toBe(false);
    expect(rState.players.B.paused).toBe(false);
    expect(rState.players.A.totalPausedMs).toBeGreaterThanOrEqual(0);
  });
});
