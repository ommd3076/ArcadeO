import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { generateSessionToken, deriveCsrfToken } from "../../../worker/auth/session";
import { sha256Hex } from "../../../worker/auth/crypto";
import { handleRecordsRequest, getCalcuttaWeekStart } from "../../../worker/api/records";
import type { Env } from "../../../worker/index";
import { projectSudokuRecord } from "../../../worker/sudoku/records";

describe("Records & Projections API (Task B03)", () => {
  let sqlite: DatabaseSync;
  let db: D1Database;
  const CSRF_SECRET = "test-csrf-secret-key-32-bytes-long!";

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    db = createMockD1Database(sqlite);

    const schemaSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
      "utf8",
    );
    await db.exec(schemaSql);

    // Seed Player A and Player B
    await db
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "A",
        "player_a",
        "Player A",
        "hashA",
        "saltA",
        "PBKDF2-SHA256:600000",
        "teal",
        "standard",
        1,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "B",
        "player_b",
        "Player B",
        "hashB",
        "saltB",
        "PBKDF2-SHA256:600000",
        "violet",
        "romantic",
        1,
      )
      .run();
  });

  async function createSession(accountId: "A" | "B") {
    const rawToken = generateSessionToken();
    const tokenHash = await sha256Hex(rawToken);
    const csrfToken = await deriveCsrfToken(rawToken, CSRF_SECRET);
    const csrfHash = await sha256Hex(csrfToken);

    await db
      .prepare(
        `INSERT INTO sessions (tokenHash, accountId, csrfHash, issuedAt, expiresAt, sessionId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        tokenHash,
        accountId,
        csrfHash,
        Date.now(),
        Date.now() + 86400000,
        `session-${accountId}`,
      )
      .run();

    return { rawToken };
  }

  it("calculates accurate Asia/Calcutta week start Monday anchor", () => {
    const weekStartMs = getCalcuttaWeekStart();
    expect(typeof weekStartMs).toBe("number");
    expect(weekStartMs).toBeLessThanOrEqual(Date.now());

    // Shift to IST and ensure day of week is Monday (1)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(weekStartMs + IST_OFFSET_MS);
    expect(istDate.getUTCDay()).toBe(1); // Monday
    expect(istDate.getUTCHours()).toBe(0);
    expect(istDate.getUTCMinutes()).toBe(0);
  });

  it("computes head-to-head records, win streaks, and recent matches", async () => {
    const now = Date.now();

    // Insert completed match records in match_registry and results
    const matches = [
      { id: "m1", game: "connect-four", winner: "A", time: now - 300000 },
      { id: "m2", game: "connect-four", winner: "A", time: now - 200000 },
      { id: "m3", game: "rock-paper-scissors", winner: "B", time: now - 100000 },
      { id: "m4", game: "ludo", winner: "A", time: now - 50000 },
      { id: "m5", game: "dots-boxes", winner: "A", time: now },
    ];

    for (const m of matches) {
      await db
        .prepare(
          `INSERT INTO match_registry (matchId, creationId, creatorAccountId, gameId, mode, participants, doName, initializationState, lifecycle, deliveryVersion, schemaVersion, rulesVersion, createdAt, lastActionAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          m.id,
          `c-${m.id}`,
          "A",
          m.game,
          "remote",
          JSON.stringify({ A: "A", B: "B" }),
          m.id,
          "initialized",
          "completed",
          10,
          1,
          1,
          m.time,
          m.time,
        )
        .run();

      await db
        .prepare(
          `INSERT INTO results (matchId, projectedVersion, gameId, mode, participants, winner, reason, scores, finishedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          m.id,
          10,
          m.game,
          "remote",
          JSON.stringify({ A: "A", B: "B" }),
          m.winner,
          "rules_win",
          JSON.stringify({ A: m.winner === "A" ? 1 : 0, B: m.winner === "B" ? 1 : 0 }),
          m.time,
        )
        .run();
    }

    // Insert Sudoku records
    await db
      .prepare(
        `INSERT INTO sudoku_records (attemptId, accountId, puzzleId, mode, elapsedMs, assisted, replay, completedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind("att-1", "A", "sudoku-easy-001", "practice", 72000, 0, 0, now)
      .run();

    await db
      .prepare(
        `INSERT INTO sudoku_records (attemptId, accountId, puzzleId, mode, elapsedMs, assisted, replay, completedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind("att-2", "B", "sudoku-easy-001", "practice", 68000, 0, 0, now)
      .run();

    const { rawToken } = await createSession("A");
    const mockEnv = {
      DB: db,
      CSRF_SECRET,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    } as Env;

    // 1. Check summary
    const sumReq = new Request("http://localhost/api/v1/records/summary", {
      headers: { Cookie: `arcade-session=${rawToken}` },
    });
    const sumRes = await handleRecordsRequest(sumReq, mockEnv);
    expect(sumRes?.status).toBe(200);

    const sumData = (await sumRes?.json()) as {
      summary: {
        totalPlayed: number;
        winsA: number;
        winsB: number;
        currentStreak: { holder: string; count: number };
      };
      byGame: Record<string, { played: number; winsA: number; winsB: number }>;
      sudokuBestTimes: Record<string, { unassisted: number; fastestAccountId: string }>;
    };

    expect(sumData.summary.totalPlayed).toBe(5);
    expect(sumData.summary.winsA).toBe(4);
    expect(sumData.summary.winsB).toBe(1);
    expect(sumData.summary.currentStreak.holder).toBe("A");
    expect(sumData.summary.currentStreak.count).toBe(2); // m4 (A), m5 (A)

    // Sudoku best time: B has 68000ms < A's 72000ms
    expect(sumData.sudokuBestTimes["sudoku-easy-001"].unassisted).toBe(68000);
    expect(sumData.sudokuBestTimes["sudoku-easy-001"].fastestAccountId).toBe("B");

    // 2. Check recent matches
    const recReq = new Request("http://localhost/api/v1/records/recent", {
      headers: { Cookie: `arcade-session=${rawToken}` },
    });
    const recRes = await handleRecordsRequest(recReq, mockEnv);
    expect(recRes?.status).toBe(200);

    const recData = (await recRes?.json()) as {
      recentMatches: Array<{ matchId: string; winner: string }>;
      sharedRecap: Array<{
        matchId: string;
        gameId: string;
        winnerAccountId: string;
        finishedAt: number;
      }>;
    };
    expect(recData.recentMatches).toHaveLength(5);
    expect(recData.recentMatches[0].matchId).toBe("m5"); // Most recent first
    expect(recData.sharedRecap).toHaveLength(5);
    expect(recData.sharedRecap[0]).toEqual({
      matchId: "m5",
      gameId: "dots-boxes",
      mode: "remote",
      winnerAccountId: "A",
      reason: "rules_win",
      finishedAt: now,
    });
  });

  it("maps winner seats to saved account identities and excludes unscored solo/replay results", async () => {
    const now = Date.now();
    const participants = JSON.stringify({ A: { accountId: "B" }, B: { accountId: "A" } });
    for (const [id, mode, details] of [
      ["scored", "remote", {}],
      ["solo", "practice", {}],
      ["replay", "duel", { scored: false }],
      ["sender", "challenge", { senderAttempt: true }],
    ] as const) {
      await db
        .prepare(
          `INSERT INTO match_registry (matchId, creationId, creatorAccountId, gameId, mode, participants, doName, initializationState, lifecycle, deliveryVersion, schemaVersion, rulesVersion, createdAt, lastActionAt) VALUES (?, ?, 'B', 'sudoku', ?, ?, ?, 'initialized', 'completed', 2, 1, 1, ?, ?)`,
        )
        .bind(id, `c-${id}`, mode, participants, id, now, now)
        .run();
      await db
        .prepare(
          `INSERT INTO results (matchId, projectedVersion, gameId, mode, participants, winner, reason, scores, finishedAt, details) VALUES (?, 2, 'sudoku', ?, ?, 'A', 'rules_win', '{}', ?, ?)`,
        )
        .bind(id, mode, participants, now, JSON.stringify(details))
        .run();
    }
    const { rawToken } = await createSession("B");
    const env = { DB: db, CSRF_SECRET } as Env;
    const req = (path: string) =>
      new Request(`http://localhost/api/v1/records/${path}`, {
        headers: { Cookie: `arcade-session=${rawToken}` },
      });
    const summary = (await (await handleRecordsRequest(req("summary"), env))!.json()) as any;
    expect(summary.summary).toMatchObject({ totalPlayed: 1, winsA: 0, winsB: 1, playDayStreak: 1 });
    expect(summary.byGame.sudoku.winStreak).toEqual({ holder: "B", count: 1 });
    const recent = (await (await handleRecordsRequest(req("recent"), env))!.json()) as any;
    expect(recent.recentMatches.every((r: any) => r.winnerAccountId === "B")).toBe(true);
    expect(recent.sharedRecap.map((r: any) => r.matchId)).toEqual(["scored"]);
  });

  it("never regresses saved Sudoku eligibility or completion facts on an older projection retry", async () => {
    const original = {
      attemptId: "attempt",
      accountId: "A" as const,
      puzzleId: "easy-001",
      mode: "practice" as const,
      elapsedMs: 90_000,
      completedAt: 100_000,
      assisted: true,
      replay: true,
    };
    await projectSudokuRecord(db, original);
    await projectSudokuRecord(db, {
      ...original,
      assisted: false,
      replay: false,
      elapsedMs: 1,
      completedAt: 1,
    });
    const row = await db
      .prepare(
        "SELECT elapsedMs, completedAt, assisted, replay FROM sudoku_records WHERE attemptId = 'attempt'",
      )
      .first();
    expect(row).toEqual({ elapsedMs: 90_000, completedAt: 100_000, assisted: 1, replay: 1 });
  });
});
