import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { createMockDOStorage } from "../matches/do-mock";
import { MatchDurableObject } from "../../../worker/matches/match-do";
import { getPuzzleById } from "../../../worker/sudoku/catalog";
import { getPrivateSolution } from "../../../worker/sudoku/verification";
import type { AccountId, PlayMode, Seat } from "../../../shared/protocol/types";
import type { SudokuState } from "../../../shared/games/sudoku/types";

async function makeFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const DB = createMockD1Database(sqlite);
  await DB.exec(fs.readFileSync(path.resolve("migrations/0001_initial_schema.sql"), "utf8"));
  await DB.exec(fs.readFileSync(path.resolve("migrations/0004_sudoku_interrupted.sql"), "utf8"));
  for (const account of ["A", "B"] as const) {
    await DB.prepare(
      "INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        account,
        account,
        account,
        "hash",
        "salt",
        account === "A" ? "teal" : "violet",
        account === "A" ? "standard" : "romantic",
      )
      .run();
    await DB.prepare(
      "INSERT INTO sessions (tokenHash, accountId, csrfHash, issuedAt, expiresAt, sessionId) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        `token-${account}`,
        account,
        `csrf-${account}`,
        Date.now(),
        Date.now() + 60_000,
        `session-${account}`,
      )
      .run();
  }
  const authority = new MatchDurableObject(
    { storage: createMockDOStorage(sqlite) } as any,
    { DB } as any,
  );
  const puzzle = getPuzzleById("easy-001")!;
  const solution = getPrivateSolution("easy-001")!;
  return { sqlite, DB, authority, puzzle, solution };
}

describe("Sudoku saved-attempt resume requirements by mode", () => {
  async function initialize(
    fixture: Awaited<ReturnType<typeof makeFixture>>,
    mode: Extract<PlayMode, "practice" | "challenge" | "duel">,
    matchId: string,
    options: Record<string, unknown> = {},
    withReceiver = false,
  ) {
    const { authority, puzzle, solution } = fixture;
    const participants = {
      A: { accountId: "A" as AccountId, displayName: "A", ready: true },
      ...(withReceiver
        ? { B: { accountId: "B" as AccountId, displayName: "B", ready: true } }
        : {}),
    };
    await authority.initializeMatch({
      matchId,
      gameId: "sudoku",
      mode,
      creatorAccountId: "A",
      creatorSessionId: "session-A",
      participants,
      gameOptions: { puzzleId: puzzle.puzzleId, givens: puzzle.givens, solution, ...options },
    });
    return async (action: string, actor: AccountId, payload: Record<string, unknown> = {}) => {
      const snapshot = authority.getSnapshot()!;
      return authority.handleAction(
        {
          protocolVersion: 1,
          matchId,
          actionId: crypto.randomUUID(),
          action: action as any,
          payload,
          expectedVersion: snapshot.deliveryVersion,
          controllerGeneration: 1,
          ...(action.startsWith("sudoku.")
            ? {
                progressRevision: (snapshot.gameState as SudokuState).players[
                  actor === "A" ? "A" : "B"
                ].progressRevision,
              }
            : {}),
        },
        actor,
        `session-${actor}`,
      );
    };
  }

  it("resumes Practice and unpublished sender Challenge with the sole participant", async () => {
    for (const [mode, matchId] of [
      ["practice", "practice-saved"],
      ["challenge", "sender-saved"],
    ] as const) {
      const fixture = await makeFixture();
      const act = await initialize(fixture, mode, matchId);
      expect((await act("match.leave-save", "A")).status).toBe("accepted");
      const pauseId = fixture.authority.getSnapshot()!.pauseId!;
      const reply = await act("match.resume", "A", { pauseId });
      expect(reply.status).toBe("accepted");
      expect(fixture.authority.getSnapshot()!.lifecycle).toBe("active");
      fixture.sqlite.close();
    }
  });

  it("resumes an accepted Challenge from the receiver without a sender acknowledgment", async () => {
    const fixture = await makeFixture();
    const act = await initialize(
      fixture,
      "challenge",
      "receiver-saved",
      { challengePublished: true, senderElapsedMs: 30_000, senderSeat: "A" as Seat },
      true,
    );
    expect((await act("match.accept", "B")).status).toBe("accepted");
    expect((await act("match.leave-save", "B")).status).toBe("accepted");
    const savedReceiver = (fixture.authority.getSnapshot()!.gameState as SudokuState).players.B;
    expect(savedReceiver.paused).toBe(false);
    expect(savedReceiver.totalPausedMs).toBe(0);
    // Simulate a saved snapshot made by the earlier implementation that paused
    // all Sudoku modes; migration recovery must clear the flag without crediting time.
    const legacySavedState = fixture.authority.getSnapshot()!.gameState as SudokuState;
    legacySavedState.players.B.paused = true;
    legacySavedState.players.B.pausedAt = Date.now() - 1_000;
    fixture.sqlite
      .prepare("UPDATE match_snapshot SET gameState = ? WHERE matchId = ?")
      .run(JSON.stringify(legacySavedState), "receiver-saved");
    const pauseId = fixture.authority.getSnapshot()!.pauseId!;
    expect((await act("match.resume", "A", { pauseId })).status).toBe("rejected");
    expect(fixture.authority.getSnapshot()!.lifecycle).toBe("saved");
    expect((await act("match.resume", "B", { pauseId })).status).toBe("accepted");
    expect(fixture.authority.getSnapshot()!.lifecycle).toBe("active");
    const resumedReceiver = (fixture.authority.getSnapshot()!.gameState as SudokuState).players.B;
    expect(resumedReceiver.paused).toBe(false);
    expect(resumedReceiver.totalPausedMs).toBe(0);
    expect(resumedReceiver.elapsedMs).toBeGreaterThanOrEqual(savedReceiver.elapsedMs);
    fixture.sqlite.close();
  });

  it("carries interrupted Duel eligibility through the terminal outbox and D1 rows", async () => {
    const fixture = await makeFixture();
    const matchId = "interrupted-duel-projection";
    const act = await initialize(fixture, "duel", matchId, {}, true);
    expect((await act("match.accept", "B")).status).toBe("accepted");
    expect((await act("match.ready", "A")).status).toBe("accepted");
    expect((await act("match.ready", "B")).status).toBe("accepted");

    // This fixture isolates the scheduled-start boundary without waiting three real seconds.
    const snapshot = fixture.authority.getSnapshot()!;
    const game = snapshot.gameState as SudokuState;
    game.scheduledStartTime = Date.now() - 1;
    game.players.A.startedAt = game.scheduledStartTime;
    game.players.B.startedAt = game.scheduledStartTime;
    fixture.sqlite
      .prepare("UPDATE match_snapshot SET gameState = ? WHERE matchId = ?")
      .run(JSON.stringify(game), matchId);

    expect((await act("match.leave-save", "A")).status).toBe("accepted");
    const pauseId = fixture.authority.getSnapshot()!.pauseId!;
    expect((await act("match.resume", "A", { pauseId })).status).toBe("accepted");
    expect((await act("match.resume", "B", { pauseId })).status).toBe("accepted");
    expect((fixture.authority.getSnapshot()!.gameState as SudokuState).interrupted).toBe(true);

    const lastBlank = fixture.puzzle.givens.lastIndexOf("0");
    const blanks = [...fixture.puzzle.givens].flatMap((value, index) =>
      value === "0" && index !== lastBlank ? [index] : [],
    );
    for (const index of blanks) {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const digit = Number(fixture.solution[index]);
      expect(
        (await act("sudoku.edit", "A", { row, col, operation: "set", value: digit })).status,
      ).toBe("accepted");
    }
    const row = Math.floor(lastBlank / 9);
    const col = lastBlank % 9;
    const finalReply = await act("sudoku.edit", "A", {
      row,
      col,
      operation: "set",
      value: Number(fixture.solution[lastBlank]),
    });
    expect(finalReply.status).toBe("accepted");
    expect(fixture.authority.getSnapshot()!.result?.details?.interrupted).toBe(true);

    await fixture.DB.prepare(
      `INSERT INTO match_registry (matchId, creationId, creatorAccountId, gameId, mode, participants, doName, initializationState, lifecycle, deliveryVersion, schemaVersion, rulesVersion, createdAt, lastActionAt)
       VALUES (?, ?, 'A', 'sudoku', 'duel', ?, ?, 'initialized', 'active', 1, 1, 1, ?, ?)`,
    )
      .bind(
        matchId,
        `creation-${matchId}`,
        JSON.stringify({ A: "A", B: "B" }),
        matchId,
        Date.now(),
        Date.now(),
      )
      .run();
    const terminalOutbox = fixture.sqlite
      .prepare(
        "SELECT projectionKey, requiredVersion, payload FROM projection_outbox ORDER BY requiredVersion DESC LIMIT 1",
      )
      .get() as { projectionKey: string; requiredVersion: number; payload: string };
    const terminalPayload = JSON.parse(terminalOutbox.payload);
    // Simulate a pre-0004 queued outbox entry after a record write succeeded but
    // before the terminal result write. Explicit result metadata is the legacy source.
    delete terminalPayload.interrupted;
    terminalPayload.sudokuRecords = [];
    await fixture.DB.prepare("UPDATE projection_outbox SET payload = ? WHERE projectionKey = ?")
      .bind(JSON.stringify(terminalPayload), terminalOutbox.projectionKey)
      .run();
    const patchedPayloadRow = fixture.sqlite
      .prepare("SELECT payload FROM projection_outbox WHERE projectionKey = ?")
      .get(terminalOutbox.projectionKey) as { payload: string } | undefined;
    expect(patchedPayloadRow).toBeDefined();
    const patchedPayload = JSON.parse(patchedPayloadRow!.payload);
    expect(patchedPayload.sudokuRecords).toEqual([]);
    for (let attempt = 0; attempt < 20; attempt++) {
      const pending = await fixture.DB.prepare(
        "SELECT COUNT(*) AS count FROM projection_outbox WHERE nextAttemptAt <= ?",
      )
        .bind(Date.now())
        .first<{ count: number }>();
      if (!pending?.count) break;
      await fixture.authority.flushProjectionOutbox();
    }
    const result = await fixture.DB.prepare(
      "SELECT interrupted, details FROM results WHERE matchId = ?",
    )
      .bind(matchId)
      .first<{ interrupted: number; details: string }>();
    expect(result?.interrupted).toBe(1);
    expect(JSON.parse(result!.details).interrupted).toBe(true);

    const stalePayload = {
      ...terminalPayload,
      deliveryVersion: terminalOutbox.requiredVersion - 1,
      interrupted: false,
      result: { ...terminalPayload.result, details: {} },
      sudokuRecords: [],
    };
    await fixture.sqlite
      .prepare(
        "INSERT INTO projection_outbox (projectionKey, requiredVersion, payload, retries, nextAttemptAt) VALUES (?, ?, ?, 0, ?)",
      )
      .run(
        `stale-${matchId}`,
        stalePayload.deliveryVersion,
        JSON.stringify(stalePayload),
        Date.now(),
      );
    await fixture.authority.flushProjectionOutbox();
    const afterStaleRetry = await fixture.DB.prepare(
      "SELECT projectedVersion, interrupted, details FROM results WHERE matchId = ?",
    )
      .bind(matchId)
      .first<{ projectedVersion: number; interrupted: number; details: string }>();
    expect(afterStaleRetry).toEqual({
      projectedVersion: terminalOutbox.requiredVersion,
      interrupted: 1,
      details: result!.details,
    });
    fixture.sqlite.close();
  });
});
