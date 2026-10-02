import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import {
  getPuzzleById,
  listPuzzlesByBucket,
  selectEligiblePuzzle,
  getCatalogCount,
} from "../../../worker/sudoku/catalog";
import { getPrivateSolution, verifySudokuSolution } from "../../../worker/sudoku/verification";
import {
  projectSudokuRecord,
  getCompletedPuzzleIds,
  getBestUnassistedTime,
} from "../../../worker/sudoku/records";
import {
  createInitialState,
  validateAndReduce,
  toPublicView,
  calculateElapsedMs,
} from "../../../shared/games/sudoku/engine";
import { SudokuState } from "../../../shared/games/sudoku/types";

describe("Sudoku Integration (Task S02 / Worker, Duel & Async Challenge)", () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    d1 = createMockD1Database(sqlite);

    // Run initial migration
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
      "utf8",
    );
    await d1.exec(migrationSql);
    await d1.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "migrations", "0004_sudoku_interrupted.sql"),
        "utf8",
      ),
    );

    // Seed Player A and Player B
    await d1
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily, preferenceVersion)
         VALUES ('A', 'player_a', 'Player A', 'dummy_hash', 'dummy_salt', 'teal', 'standard', 1)`,
      )
      .run();

    await d1
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily, preferenceVersion)
         VALUES ('B', 'player_b', 'Player B', 'dummy_hash', 'dummy_salt', 'violet', 'romantic', 1)`,
      )
      .run();
  });

  describe("Worker Sudoku Catalog & Verification", () => {
    it("queries catalog safely without exposing private solutions", () => {
      expect(getCatalogCount()).toBe(1000);

      const puzzle = getPuzzleById("easy-001");
      expect(puzzle).toBeDefined();
      expect(puzzle?.puzzleId).toBe("easy-001");
      expect(puzzle?.bucket).toBe("easy");
      expect(puzzle?.number).toBe(1);
      expect(puzzle?.givens).toHaveLength(81);
      // Ensure solution is not part of catalog entry
      expect((puzzle as any).solution).toBeUndefined();

      const easyList = listPuzzlesByBucket("easy");
      expect(easyList).toHaveLength(250);
      expect(easyList[0].number).toBe(1);
      expect(easyList[249].number).toBe(250);
    });

    it("selects uncompleted eligible puzzle, and marks replay if bucket exhausted", () => {
      const completed = new Set<string>();
      const selection1 = selectEligiblePuzzle("medium", completed);
      expect(selection1.isReplay).toBe(false);
      expect(selection1.puzzle.bucket).toBe("medium");

      // Mark all medium puzzles completed
      const allMedium = listPuzzlesByBucket("medium");
      for (const p of allMedium) {
        completed.add(p.puzzleId);
      }

      const exhaustedSelection = selectEligiblePuzzle("medium", completed);
      expect(exhaustedSelection.isReplay).toBe(true);
      expect(exhaustedSelection.puzzle.puzzleId).toBe("medium-001");
    });

    it("verifies solutions against private server solutions repository", () => {
      const sol = getPrivateSolution("easy-001");
      expect(sol).toBeDefined();
      expect(sol).toHaveLength(81);

      expect(verifySudokuSolution("easy-001", sol!)).toBe(true);

      // Wrong solution
      const corrupted = "9" + sol!.slice(1);
      expect(verifySudokuSolution("easy-001", corrupted)).toBe(false);
    });
  });

  describe("D1 sudoku_records Projections", () => {
    it("projects completed attempts and queries best unassisted times", async () => {
      // 1. Record completed practice attempt for Account A
      await projectSudokuRecord(d1, {
        attemptId: "att-1",
        accountId: "A",
        puzzleId: "easy-001",
        mode: "practice",
        elapsedMs: 75000,
        assisted: false,
        replay: false,
        completedAt: 100000,
      });

      // 2. Record assisted practice attempt for Account A (faster, but assisted)
      await projectSudokuRecord(d1, {
        attemptId: "att-2",
        accountId: "A",
        puzzleId: "easy-001",
        mode: "practice",
        elapsedMs: 42000,
        assisted: true,
        replay: false,
        completedAt: 200000,
      });

      // 3. Query completed puzzles
      const completedA = await getCompletedPuzzleIds(d1, "A");
      expect(completedA.has("easy-001")).toBe(true);

      const completedB = await getCompletedPuzzleIds(d1, "B");
      expect(completedB.has("easy-001")).toBe(false);

      // 4. Best unassisted time should be 75000ms (ignoring the 42000ms assisted attempt)
      const best = await getBestUnassistedTime(d1, "A", "easy-001");
      expect(best).toBe(75000);
    });
  });

  describe("Duel Mode Synchronized Start (+3s) and Continuous Clock", () => {
    it("duel holds givens and moves until +3s scheduled start, then allows moves", () => {
      const serverCreatedTime = 10000;
      const scheduledStartTime = serverCreatedTime + 3000; // 13000
      const puzzle = getPuzzleById("easy-001")!;
      const solution = getPrivateSolution("easy-001")!;

      const duelState = createInitialState({
        serverTime: serverCreatedTime,
        startingSeat: "A",
        config: {
          puzzleId: puzzle.puzzleId,
          givens: puzzle.givens,
          solution,
          mode: "duel",
          scheduledStartTime,
        },
      });

      // At t = 11000 (< scheduledStartTime), view for A masks givens
      const earlyView = toPublicView(duelState, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: false,
        mode: "duel",
        serverTime: 11000,
      });
      expect(earlyView.hasStarted).toBe(false);
      expect(earlyView.givens).toBe("0".repeat(81));

      // Edits before scheduledStartTime reject
      const earlyEdit = validateAndReduce(
        duelState,
        {
          action: "sudoku.edit",
          payload: { row: 0, col: 0, operation: "set", value: 1 },
        },
        { serverTime: 12999, actorSeat: "A" },
      );
      expect(earlyEdit.success).toBe(false);

      // At t = 13000, view unmasks givens
      const activeView = toPublicView(duelState, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: false,
        mode: "duel",
        serverTime: 13000,
      });
      expect(activeView.hasStarted).toBe(true);
      expect(activeView.givens).toBe(puzzle.givens);

      // Moves at or after scheduledStartTime succeed
      const legalEdit = validateAndReduce(
        duelState,
        {
          action: "sudoku.edit",
          payload: { row: 0, col: 0, operation: "set", value: 1 },
        },
        { serverTime: 13001, actorSeat: "A" },
      );
      expect(legalEdit.success).toBe(true);
    });

    it("continuous competitive clock continues through background/disconnect (does not pause)", () => {
      const serverStartTime = 10000;
      const puzzle = getPuzzleById("easy-001")!;
      const solution = getPrivateSolution("easy-001")!;

      const duelState = createInitialState({
        serverTime: serverStartTime,
        startingSeat: "A",
        config: {
          puzzleId: puzzle.puzzleId,
          givens: puzzle.givens,
          solution,
          mode: "duel",
          scheduledStartTime: serverStartTime,
        },
      });

      // Pause attempt in duel must be rejected!
      const pauseAttempt = validateAndReduce(
        duelState,
        {
          action: "sudoku.pause",
          payload: {},
        },
        { serverTime: 15000, actorSeat: "A" },
      );
      expect(pauseAttempt.success).toBe(false);

      // Even if 30 seconds pass without client events (simulating background/disconnect),
      // the server clock advances continuously based on serverTime - startedAt
      const elapsedAt30s = calculateElapsedMs(duelState.players.A, serverStartTime + 30000);
      expect(elapsedAt30s).toBe(30000);
    });
  });

  describe("Async Challenge Creation and Whole-Second Comparison Flow", () => {
    it("handles sender completion, publish, receiver accept, continuous attempt and comparison", () => {
      const puzzle = getPuzzleById("easy-001")!;
      const solution = getPrivateSolution("easy-001")!;

      // 1. Sender (Player A) plays challenge attempt
      const senderState = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: {
          puzzleId: puzzle.puzzleId,
          givens: puzzle.givens,
          solution,
          mode: "challenge",
          senderSeat: "A",
        },
      });

      // Pre-fill Sender cells to complete at t = 35400 (elapsed = 34400ms -> floor = 34s)
      const senderCells = solution.split("").map((c) => parseInt(c, 10));
      const emptyIdx = puzzle.givens.lastIndexOf("0");
      senderCells[emptyIdx] = 0;
      senderState.players.A.cells = senderCells;

      const row = Math.floor(emptyIdx / 9);
      const col = emptyIdx % 9;
      const finalVal = parseInt(solution[emptyIdx], 10);

      const senderFinish = validateAndReduce(
        senderState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: finalVal },
        },
        { serverTime: 35400, actorSeat: "A" },
      );

      expect(senderFinish.success).toBe(true);
      if (!senderFinish.success) return;

      expect(senderFinish.newState.senderElapsedMs).toBe(34400);

      // 2. Challenge is published with target duration
      expect(senderFinish.terminalResult?.details?.scored).toBe(false);
      const publishedState: SudokuState = createInitialState({
        serverTime: 50000,
        startingSeat: "A",
        config: {
          puzzleId: puzzle.puzzleId,
          givens: puzzle.givens,
          solution,
          mode: "challenge",
          senderSeat: "A",
          senderElapsedMs: senderFinish.newState.senderElapsedMs,
          challengePublished: true,
          receiverAccepted: true,
        },
      });

      // Receiver (Player B) starts attempt at t = 100000
      publishedState.players.B.startedAt = 100000;
      const receiverCells = solution.split("").map((c) => parseInt(c, 10));
      receiverCells[emptyIdx] = 0;
      publishedState.players.B.cells = receiverCells;

      // Case A: Receiver finishes at 100000 + 34850ms (elapsed = 34850ms -> floor = 34s)
      // floor(34400/1000) = 34 === floor(34850/1000) = 34 -> EQUAL WHOLE SECONDS DRAW!
      const receiverFinishDraw = validateAndReduce(
        publishedState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: finalVal },
        },
        { serverTime: 100000 + 34850, actorSeat: "B" },
      );

      expect(receiverFinishDraw.success).toBe(true);
      if (receiverFinishDraw.success) {
        expect(receiverFinishDraw.terminalResult?.winner).toBeNull();
        expect(receiverFinishDraw.terminalResult?.reason).toBe("rules_draw");
        expect(receiverFinishDraw.terminalResult?.details?.senderSecs).toBe(34);
        expect(receiverFinishDraw.terminalResult?.details?.receiverSecs).toBe(34);
      }
    });
  });
});
