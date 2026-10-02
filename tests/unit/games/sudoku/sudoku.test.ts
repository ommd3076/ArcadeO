import { describe, it, expect } from "vitest";
import {
  createInitialState,
  validateAndReduce,
  toPublicView,
  isTerminal,
  countFilledCells,
} from "../../../../shared/games/sudoku/engine";
import { sudokuEngineAdapter } from "../../../../shared/games/sudoku/adapter";
import { SudokuState } from "../../../../shared/games/sudoku/types";
import catalogData from "../../../../content/sudoku/catalog.json";
import solutionsData from "../../../../content/sudoku/solutions.json";

const catalog = catalogData as Array<{ puzzleId: string; givens: string }>;
const solutions = solutionsData as Record<string, string>;

describe("Sudoku Pure Engine (Task S02 / SUD01–SUD08)", () => {
  const samplePuzzle = catalog[0];
  const puzzleId = samplePuzzle.puzzleId;
  const givens = samplePuzzle.givens;
  const solution = solutions[puzzleId];

  function createTestState(mode: "practice" | "duel" | "challenge" = "practice"): SudokuState {
    return createInitialState({
      serverTime: 1000,
      startingSeat: "A",
      config: {
        puzzleId,
        givens,
        solution,
        mode,
        scheduledStartTime: mode === "duel" ? 4000 : undefined,
      },
    });
  }

  it("initializes state with givens populated in cells", () => {
    const state = createTestState("practice");
    expect(state.puzzleId).toBe(puzzleId);
    expect(state.mode).toBe("practice");

    // Verify given cells in player A and B
    for (let i = 0; i < 81; i++) {
      const g = parseInt(givens[i], 10);
      expect(state.players.A.cells[i]).toBe(g);
      expect(state.players.B.cells[i]).toBe(g);
    }
  });

  describe("SUD01: Givens Immutability", () => {
    it("rejects edits on given cells", () => {
      const state = createTestState("practice");
      // Find a given cell index
      const givenIndex = givens.split("").findIndex((c) => c !== "0");
      expect(givenIndex).toBeGreaterThanOrEqual(0);

      const row = Math.floor(givenIndex / 9);
      const col = givenIndex % 9;

      // Attempt to set
      const resSet = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 9 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(resSet.success).toBe(false);

      // Attempt to erase
      const resErase = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "erase" },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(resErase.success).toBe(false);

      // Attempt to toggle note
      const resNote = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "toggle-note", value: 3 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(resNote.success).toBe(false);
    });
  });

  describe("SUD02: Notes and Setting Values", () => {
    it("sets value on an empty cell and increments progressRevision", () => {
      const state = createTestState("practice");
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      const res = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 7 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.newState.players.A.cells[emptyIndex]).toBe(7);
        expect(res.newState.players.A.progressRevision).toBe(2);
        // Player B should be unaffected (independent revisions)
        expect(res.newState.players.B.cells[emptyIndex]).toBe(0);
        expect(res.newState.players.B.progressRevision).toBe(1);
      }
    });

    it("toggles notes using bitmask and setting digit clears notes for that cell", () => {
      const state = createTestState("practice");
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      // Toggle note 3 -> bitmask has 1 << 3 = 8
      let res = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "toggle-note", value: 3 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.notes[emptyIndex]).toBe(1 << 3);

      // Toggle note 5 -> bitmask has (1 << 3) | (1 << 5)
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "toggle-note", value: 5 },
        },
        { serverTime: 2100, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.notes[emptyIndex]).toBe((1 << 3) | (1 << 5));

      // Toggle note 3 again -> removes note 3, leaves note 5
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "toggle-note", value: 3 },
        },
        { serverTime: 2200, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.notes[emptyIndex]).toBe(1 << 5);

      // Setting digit 4 on this cell clears its notes
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 4 },
        },
        { serverTime: 2300, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.cells[emptyIndex]).toBe(4);
      expect(res.newState.players.A.notes[emptyIndex]).toBe(0);
    });
  });

  describe("SUD03: Undo Stack", () => {
    it("reverts last entry/note edits and restores previous values", () => {
      const state = createTestState("practice");
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      // 1. Set note 2
      let res = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "toggle-note", value: 2 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      // 2. Set digit 6 (clears note 2)
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 6 },
        },
        { serverTime: 2100, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.cells[emptyIndex]).toBe(6);
      expect(res.newState.players.A.notes[emptyIndex]).toBe(0);

      // 3. Undo set -> restores note 2 and cell 0
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.undo",
          payload: {},
        },
        { serverTime: 2200, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.cells[emptyIndex]).toBe(0);
      expect(res.newState.players.A.notes[emptyIndex]).toBe(1 << 2);

      // 4. Undo note 2 -> restores cell 0 and note 0
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.undo",
          payload: {},
        },
        { serverTime: 2300, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.cells[emptyIndex]).toBe(0);
      expect(res.newState.players.A.notes[emptyIndex]).toBe(0);

      // 5. Further undo when empty fails
      const resEmpty = validateAndReduce(
        res.newState,
        {
          action: "sudoku.undo",
          payload: {},
        },
        { serverTime: 2400, actorSeat: "A" },
      );
      expect(resEmpty.success).toBe(false);
    });
  });

  describe("SUD04: Practice Mode Check & Pause", () => {
    it("marks assisted permanently and identifies incorrect cells", () => {
      const state = createTestState("practice");
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;
      const correctVal = parseInt(solution[emptyIndex], 10);
      const wrongVal = correctVal === 9 ? 1 : correctVal + 1;

      // Set incorrect value
      let res = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: wrongVal },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.assisted).toBe(false);

      // Call Check
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.check",
          payload: {},
        },
        { serverTime: 2100, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.players.A.assisted).toBe(true);
      expect(res.newState.players.A.incorrectCells).toContain(emptyIndex);

      // Subsequent actions must never undo assisted = true
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.undo",
          payload: {},
        },
        { serverTime: 2200, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.newState.players.A.assisted).toBe(true);
    });

    it("pause pauses the timer and rejects edits while paused", () => {
      const state = createTestState("practice");
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      // Pause
      let res = validateAndReduce(
        state,
        {
          action: "sudoku.pause",
          payload: {},
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.newState.players.A.paused).toBe(true);
      expect(res.newState.players.A.pausedAt).toBe(2000);

      // Edits while paused must reject
      const editRes = validateAndReduce(
        res.newState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 3 },
        },
        { serverTime: 2500, actorSeat: "A" },
      );
      expect(editRes.success).toBe(false);

      // Resume at 5000 (paused for 3000ms)
      res = validateAndReduce(
        res.newState,
        {
          action: "sudoku.resume",
          payload: {},
        },
        { serverTime: 5000, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.newState.players.A.paused).toBe(false);
      expect(res.newState.players.A.totalPausedMs).toBe(3000);
      // Started at 1000, now 5000, paused 3000 -> elapsed = 1000ms
      expect(res.newState.players.A.elapsedMs).toBe(1000);
    });
  });

  describe("SUD05: Duel Privacy and Start Timing", () => {
    it("enforces +3s synchronized start before allowing moves or exposing givens", () => {
      const state = createTestState("duel");
      expect(state.scheduledStartTime).toBe(4000);

      // Before start time (serverTime = 2000 < 4000)
      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      const earlyMove = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 5 },
        },
        { serverTime: 2000, actorSeat: "A" },
      );
      expect(earlyMove.success).toBe(false);

      // Check toPublicView before start: givens masked to 81 zeroes
      const earlyView = toPublicView(state, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: false,
        mode: "duel",
        serverTime: 2000,
      });
      expect(earlyView.hasStarted).toBe(false);
      expect(earlyView.givens).toBe("0".repeat(81));

      // After start time: moves succeed
      const startMove = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 5 },
        },
        { serverTime: 4001, actorSeat: "A" },
      );
      expect(startMove.success).toBe(true);
    });

    it("STRICT PRIVACY: never exposes opponent cells, notes, or correctness in duel", () => {
      let state = createTestState("duel");
      state = { ...state, scheduledStartTime: 1000 }; // already started

      const emptyIndex = givens.split("").findIndex((c) => c === "0");
      const row = Math.floor(emptyIndex / 9);
      const col = emptyIndex % 9;

      // Seat B places a digit and a note
      const resB = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: 8 },
        },
        { serverTime: 2000, actorSeat: "B" },
      );
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      // View for Seat A:
      const viewForA = toPublicView(resB.newState, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: false,
        mode: "duel",
      });

      // Self view (Seat A)
      expect(viewForA.self.cells).toBeDefined();
      expect(viewForA.self.cells![emptyIndex]).toBe(0);

      // Opponent view (Seat B)
      expect(viewForA.opponent).toBeDefined();
      expect(viewForA.opponent!.filledCount).toBe(countFilledCells(resB.newState.players.B.cells));
      // STRICT ASSERTION: opponent cells and notes must be undefined!
      expect(viewForA.opponent!.cells).toBeUndefined();
      expect(viewForA.opponent!.notes).toBeUndefined();
      expect(viewForA.opponent!.incorrectCells).toBeUndefined();
      expect((viewForA as any).solution).toBeUndefined();
    });
  });

  describe("SUD06: Automatic Completion & First-To-Finish Duel Win", () => {
    it("completes when all 81 cells match the solution and awards first-finisher win", () => {
      let state = createTestState("duel");
      state = { ...state, scheduledStartTime: 1000 };

      // Pre-fill Player A with 80 correct cells
      const almostCompleteCells = solution.split("").map((c) => parseInt(c, 10));
      const lastEmptyIndex = givens.lastIndexOf("0");
      almostCompleteCells[lastEmptyIndex] = 0;

      state.players.A.cells = almostCompleteCells;

      const lastRow = Math.floor(lastEmptyIndex / 9);
      const lastCol = lastEmptyIndex % 9;
      const lastVal = parseInt(solution[lastEmptyIndex], 10);

      // Place the final digit for Player A
      const res = validateAndReduce(
        state,
        {
          action: "sudoku.edit",
          payload: { row: lastRow, col: lastCol, operation: "set", value: lastVal },
        },
        { serverTime: 5000, actorSeat: "A" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.terminalResult).toBeDefined();
      expect(res.terminalResult?.winner).toBe("A");
      expect(res.terminalResult?.reason).toBe("rules_win");
      expect(res.newState.players.A.completedAt).toBe(5000);
      expect(isTerminal(res.newState)).not.toBeNull();
    });
  });

  describe("SUD07: Async Challenge Whole-Second Timing Comparison", () => {
    it("compares floor(senderMs / 1000) vs floor(receiverMs / 1000), draws on equal whole seconds", () => {
      const challengeState = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: {
          puzzleId,
          givens,
          solution,
          mode: "challenge",
          senderSeat: "A",
          senderElapsedMs: 45200, // 45.2 seconds -> floor = 45s
          challengePublished: true,
          receiverAccepted: true,
        },
      });

      // Prepare Receiver (Player B) almost finished
      const almostDoneB = solution.split("").map((c) => parseInt(c, 10));
      const emptyIdx = givens.lastIndexOf("0");
      almostDoneB[emptyIdx] = 0;
      challengeState.players.B.cells = almostDoneB;
      challengeState.players.B.startedAt = 10000;

      const row = Math.floor(emptyIdx / 9);
      const col = emptyIdx % 9;
      const finalVal = parseInt(solution[emptyIdx], 10);

      // Case 1: Receiver finishes with 45800ms -> floor = 45s -> DRAW!
      const resDraw = validateAndReduce(
        challengeState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: finalVal },
        },
        { serverTime: 10000 + 45800, actorSeat: "B" },
      );

      expect(resDraw.success).toBe(true);
      if (resDraw.success) {
        expect(resDraw.terminalResult?.winner).toBeNull();
        expect(resDraw.terminalResult?.reason).toBe("rules_draw");
        expect(resDraw.terminalResult?.details?.senderSecs).toBe(45);
        expect(resDraw.terminalResult?.details?.receiverSecs).toBe(45);
      }

      // Case 2: Receiver finishes faster (44900ms -> floor = 44s) -> Receiver (B) WINS!
      const resReceiverWin = validateAndReduce(
        challengeState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: finalVal },
        },
        { serverTime: 10000 + 44900, actorSeat: "B" },
      );

      expect(resReceiverWin.success).toBe(true);
      if (resReceiverWin.success) {
        expect(resReceiverWin.terminalResult?.winner).toBe("B");
        expect(resReceiverWin.terminalResult?.reason).toBe("rules_win");
      }

      // Case 3: Receiver finishes slower (46100ms -> floor = 46s) -> Sender (A) WINS!
      const resSenderWin = validateAndReduce(
        challengeState,
        {
          action: "sudoku.edit",
          payload: { row, col, operation: "set", value: finalVal },
        },
        { serverTime: 10000 + 46100, actorSeat: "B" },
      );

      expect(resSenderWin.success).toBe(true);
      if (resSenderWin.success) {
        expect(resSenderWin.terminalResult?.winner).toBe("A");
        expect(resSenderWin.terminalResult?.reason).toBe("rules_win");
      }
    });
  });

  describe("Adapter Interface Verification", () => {
    it("conforms to GameEngineAdapter contract", () => {
      expect(sudokuEngineAdapter.gameId).toBe("sudoku");
      expect(typeof sudokuEngineAdapter.createInitialState).toBe("function");
      expect(typeof sudokuEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof sudokuEngineAdapter.legalActions).toBe("function");
      expect(typeof sudokuEngineAdapter.toPublicView).toBe("function");
      expect(typeof sudokuEngineAdapter.isTerminal).toBe("function");
    });
  });
});
