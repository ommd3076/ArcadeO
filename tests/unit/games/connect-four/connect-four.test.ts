import { describe, it, expect } from "vitest";
import {
  CONNECT_FOUR_COLS,
  CONNECT_FOUR_ROWS,
  ConnectFourCell,
  ConnectFourState,
} from "../../../../shared/games/connect-four/types";
import {
  checkWin,
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/connect-four/engine";
import { connectFourEngineAdapter } from "../../../../shared/games/connect-four/adapter";
import { ErrorCode } from "../../../../shared/protocol/errors";

describe("Connect Four Engine", () => {
  describe("Initial State", () => {
    it("creates an empty 7x6 board with startingSeat 'A'", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      expect(state.board).toHaveLength(CONNECT_FOUR_ROWS);
      for (let r = 0; r < CONNECT_FOUR_ROWS; r++) {
        expect(state.board[r]).toHaveLength(CONNECT_FOUR_COLS);
        for (let c = 0; c < CONNECT_FOUR_COLS; c++) {
          expect(state.board[r][c]).toBeNull();
        }
      }

      expect(state.activeSeat).toBe("A");
      expect(state.status).toBe("active");
      expect(state.winner).toBeNull();
      expect(state.winningCells).toEqual([]);
      expect(isTerminal(state)).toBeNull();
    });

    it("reports legalActions accurately for active and waiting seats", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(legalActions(state, "A")).toEqual(["connect-four.drop"]);
      expect(legalActions(state, "B")).toEqual([]);
    });

    it("produces a public view matching the state", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const view = toPublicView(state);

      expect(view.board).toEqual(state.board);
      expect(view.activeSeat).toBe("A");
      expect(view.status).toBe("active");
      expect(view.winner).toBeNull();
      expect(view.winningCells).toEqual([]);
    });
  });

  describe("Gravity & Column Stacking", () => {
    it("drops disc to the bottom row (row 5) in an empty column", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state0,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1100, actorSeat: "A" },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.newState.board[5][3]).toBe("A");
      expect(result.newState.activeSeat).toBe("B");
      expect(result.newState.status).toBe("active");
      expect(result.effects).toEqual([
        { type: "disc-dropped", seat: "A", row: 5, col: 3, column: 3 },
      ]);
    });

    it("stacks discs in the same column from bottom to top", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const col = 2;

      // Drop 6 discs into column 2
      for (let i = 0; i < 6; i++) {
        const expectedSeat = i % 2 === 0 ? "A" : "B";
        const expectedRow = 5 - i;
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 100, actorSeat: expectedSeat },
        );

        expect(res.success).toBe(true);
        if (!res.success) return;

        expect(res.newState.board[expectedRow][col]).toBe(expectedSeat);
        expect(res.effects).toEqual([
          {
            type: "disc-dropped",
            seat: expectedSeat,
            row: expectedRow,
            col,
            column: col,
          },
        ]);
        state = res.newState;
      }

      // Column 2 should now be completely filled
      for (let r = 0; r < 6; r++) {
        expect(state.board[r][col]).not.toBeNull();
      }
    });
  });

  describe("Action & Turn Validation", () => {
    it("rejects move out of turn with NOT_YOUR_TURN", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 0 } },
        { serverTime: 1100, actorSeat: "B" },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.NOT_YOUR_TURN);
      }
      expect(state.board[5][0]).toBeNull();
    });

    it("rejects drop in a full column with INVALID_ACTION", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      // Fill column 0
      for (let i = 0; i < 6; i++) {
        const actor = state.activeSeat;
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: 0 } },
          { serverTime: 1000 + i * 100, actorSeat: actor },
        );
        expect(res.success).toBe(true);
        if (res.success) state = res.newState;
      }

      // Try 7th drop in column 0
      const actor = state.activeSeat;
      const res = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 0 } },
        { serverTime: 2000, actorSeat: actor },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects out-of-bounds, fractional, and malformed column payloads", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      const invalidPayloads: unknown[] = [
        { column: -1 },
        { column: 7 },
        { column: 3.5 },
        { column: "3" },
        { column: NaN },
        {},
        null,
      ];

      for (const payload of invalidPayloads) {
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload },
          { serverTime: 1100, actorSeat: "A" },
        );
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
        }
      }
    });

    it("rejects unknown action types", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "ludo.move" as any, payload: { column: 0 } },
        { serverTime: 1100, actorSeat: "A" },
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });
  });

  describe("Direct checkWin Unit Invariants", () => {
    it("returns null when no win exists", () => {
      const board: ConnectFourCell[][] = Array.from({ length: 6 }, () =>
        Array<ConnectFourCell>(7).fill(null),
      );
      board[5][0] = "A";
      board[5][1] = "A";
      board[5][2] = "A";
      expect(checkWin(board, 5, 2, "A")).toBeNull();
    });

    it("returns 4 coordinates on horizontal match", () => {
      const board: ConnectFourCell[][] = Array.from({ length: 6 }, () =>
        Array<ConnectFourCell>(7).fill(null),
      );
      board[5][0] = "A";
      board[5][1] = "A";
      board[5][2] = "A";
      board[5][3] = "A";
      expect(checkWin(board, 5, 1, "A")).toEqual([
        [5, 0],
        [5, 1],
        [5, 2],
        [5, 3],
      ]);
    });
  });

  describe("Horizontal Win", () => {
    it("detects horizontal 4-in-a-row and records winning cells", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const moves = [
        { seat: "A", col: 0 },
        { seat: "B", col: 0 },
        { seat: "A", col: 1 },
        { seat: "B", col: 1 },
        { seat: "A", col: 2 },
        { seat: "B", col: 2 },
        { seat: "A", col: 3 },
      ] as const;

      let lastResult: any;
      for (let i = 0; i < moves.length; i++) {
        const { seat, col } = moves[i];
        lastResult = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 100, actorSeat: seat },
        );
        expect(lastResult.success).toBe(true);
        if (lastResult.success) state = lastResult.newState;
      }

      expect(state.status).toBe("completed");
      expect(state.winner).toBe("A");
      expect(state.winningCells).toEqual([
        [5, 0],
        [5, 1],
        [5, 2],
        [5, 3],
      ]);
      expect(lastResult.effects).toEqual([
        { type: "disc-dropped", seat: "A", row: 5, col: 3, column: 3 },
        {
          type: "game-won",
          winner: "A",
          winningCells: [
            [5, 0],
            [5, 1],
            [5, 2],
            [5, 3],
          ],
        },
      ]);
      expect(state.terminalResult).toEqual({
        winner: "A",
        reason: "rules_win",
        scores: { A: 1, B: 0 },
        finishedAt: 1600,
      });
      expect(isTerminal(state)).toEqual(state.terminalResult);
      expect(legalActions(state, "A")).toEqual([]);
      expect(legalActions(state, "B")).toEqual([]);
    });
  });

  describe("Vertical Win", () => {
    it("detects vertical 4-in-a-row and records winning cells", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const moves = [
        { seat: "A", col: 2 },
        { seat: "B", col: 3 },
        { seat: "A", col: 2 },
        { seat: "B", col: 3 },
        { seat: "A", col: 2 },
        { seat: "B", col: 3 },
        { seat: "A", col: 2 },
      ] as const;

      let lastResult: any;
      for (let i = 0; i < moves.length; i++) {
        const { seat, col } = moves[i];
        lastResult = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 100, actorSeat: seat },
        );
        expect(lastResult.success).toBe(true);
        if (lastResult.success) state = lastResult.newState;
      }

      expect(state.status).toBe("completed");
      expect(state.winner).toBe("A");
      expect(state.winningCells).toEqual([
        [2, 2],
        [3, 2],
        [4, 2],
        [5, 2],
      ]);
      expect(lastResult.effects[1]).toEqual({
        type: "game-won",
        winner: "A",
        winningCells: [
          [2, 2],
          [3, 2],
          [4, 2],
          [5, 2],
        ],
      });
    });
  });

  describe("Diagonal Up-Right Win", () => {
    it("detects diagonal up-right win (bottom-left to top-right)", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const moves = [
        { seat: "A", col: 0 },
        { seat: "B", col: 1 },
        { seat: "A", col: 1 },
        { seat: "B", col: 2 },
        { seat: "A", col: 3 },
        { seat: "B", col: 2 },
        { seat: "A", col: 2 },
        { seat: "B", col: 3 },
        { seat: "A", col: 4 },
        { seat: "B", col: 3 },
        { seat: "A", col: 3 },
      ] as const;

      for (let i = 0; i < moves.length; i++) {
        const { seat, col } = moves[i];
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 100, actorSeat: seat },
        );
        expect(res.success).toBe(true);
        if (res.success) state = res.newState;
      }

      expect(state.status).toBe("completed");
      expect(state.winner).toBe("A");
      expect(state.winningCells).toEqual([
        [5, 0],
        [4, 1],
        [3, 2],
        [2, 3],
      ]);
    });
  });

  describe("Diagonal Down-Right Win", () => {
    it("detects diagonal down-right win (top-left to bottom-right)", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const moves = [
        { seat: "A", col: 3 },
        { seat: "B", col: 2 },
        { seat: "A", col: 2 },
        { seat: "B", col: 1 },
        { seat: "A", col: 0 },
        { seat: "B", col: 1 },
        { seat: "A", col: 1 },
        { seat: "B", col: 0 },
        { seat: "A", col: 0 },
        { seat: "B", col: 4 },
        { seat: "A", col: 0 },
      ] as const;

      for (let i = 0; i < moves.length; i++) {
        const { seat, col } = moves[i];
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 100, actorSeat: seat },
        );
        expect(res.success).toBe(true);
        if (res.success) state = res.newState;
      }

      expect(state.status).toBe("completed");
      expect(state.winner).toBe("A");
      expect(state.winningCells).toEqual([
        [2, 0],
        [3, 1],
        [4, 2],
        [5, 3],
      ]);
    });
  });

  describe("Full Board Draw", () => {
    it("plays 42 non-winning moves to reach a full board draw", () => {
      const drawMoves = [
        0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 4, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5,
        5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 5,
      ];

      expect(drawMoves).toHaveLength(42);

      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let currentSeat: "A" | "B" = "A";
      let lastResult: any;

      for (let i = 0; i < drawMoves.length; i++) {
        const col = drawMoves[i];
        lastResult = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000 + i * 50, actorSeat: currentSeat },
        );

        expect(lastResult.success).toBe(true);
        if (lastResult.success) state = lastResult.newState;

        if (i < 41) {
          expect(state.status).toBe("active");
          currentSeat = currentSeat === "A" ? "B" : "A";
        }
      }

      expect(state.status).toBe("completed");
      expect(state.winner).toBeNull();
      expect(state.winningCells).toEqual([]);
      expect(state.terminalResult).toEqual({
        winner: null,
        reason: "rules_draw",
        scores: { A: 0, B: 0 },
        finishedAt: 1000 + 41 * 50,
      });
      expect(lastResult.effects[1]).toEqual({ type: "game-drawn" });
      expect(isTerminal(state)).toEqual(state.terminalResult);
    });

    it("prioritizes win on the 42nd move over draw", () => {
      const board: ConnectFourCell[][] = Array.from({ length: 6 }, () =>
        Array<ConnectFourCell>(7).fill("A"),
      );

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          board[r][c] = (r + c) % 2 === 0 ? "A" : "B";
        }
      }

      // Configure top row so that placing at (0, 6) completes 4 B's
      board[0][3] = "B";
      board[0][4] = "B";
      board[0][5] = "B";
      board[0][6] = null;

      const state: ConnectFourState = {
        board,
        activeSeat: "B",
        status: "active",
        winner: null,
        winningCells: [],
      };

      const res = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 6 } },
        { serverTime: 5000, actorSeat: "B" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.status).toBe("completed");
      expect(res.newState.winner).toBe("B");
      expect(res.terminalResult?.reason).toBe("rules_win");
      expect(res.effects[1].type).toBe("game-won");
    });
  });

  describe("Terminal State Enforcement", () => {
    it("rejects further moves after game is completed", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const moves = [
        { seat: "A", col: 0 },
        { seat: "B", col: 0 },
        { seat: "A", col: 1 },
        { seat: "B", col: 1 },
        { seat: "A", col: 2 },
        { seat: "B", col: 2 },
        { seat: "A", col: 3 },
      ] as const;

      for (const { seat, col } of moves) {
        const res = validateAndReduce(
          state,
          { action: "connect-four.drop", payload: { column: col } },
          { serverTime: 1000, actorSeat: seat },
        );
        expect(res.success).toBe(true);
        if (res.success) state = res.newState;
      }

      expect(state.status).toBe("completed");

      // Attempt another move
      const res = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 4 } },
        { serverTime: 2000, actorSeat: "B" },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.MATCH_FINISHED);
      }
    });
  });

  describe("Immutability & Determinism", () => {
    it("does not mutate input state on reduction", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const boardSnapshot = JSON.stringify(state.board);

      validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1100, actorSeat: "A" },
      );

      expect(JSON.stringify(state.board)).toBe(boardSnapshot);
      expect(state.activeSeat).toBe("A");
    });

    it("produces identical results for identical inputs", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      const res1 = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1100, actorSeat: "A" },
      );

      const res2 = validateAndReduce(
        state,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1100, actorSeat: "A" },
      );

      expect(res1).toEqual(res2);
    });
  });

  describe("Serialization Round-Trip", () => {
    it("survives JSON.stringify -> JSON.parse and resumes accurately", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res0 = validateAndReduce(
        state0,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1100, actorSeat: "A" },
      );
      expect(res0.success).toBe(true);
      if (!res0.success) return;

      const serialized = JSON.stringify(res0.newState);
      const deserialized: ConnectFourState = JSON.parse(serialized);

      expect(deserialized).toEqual(res0.newState);
      expect(legalActions(deserialized, "B")).toEqual(["connect-four.drop"]);
      expect(isTerminal(deserialized)).toBeNull();

      // Next move from deserialized state
      const res1 = validateAndReduce(
        deserialized,
        { action: "connect-four.drop", payload: { column: 3 } },
        { serverTime: 1200, actorSeat: "B" },
      );

      expect(res1.success).toBe(true);
      if (!res1.success) return;
      expect(res1.newState.board[4][3]).toBe("B");
    });
  });

  describe("Adapter Interface", () => {
    it("connectFourEngineAdapter conforms to GameEngineAdapter contract", () => {
      expect(connectFourEngineAdapter.gameId).toBe("connect-four");
      const init = connectFourEngineAdapter.createInitialState({
        serverTime: 1000,
        startingSeat: "A",
      });
      expect(init.activeSeat).toBe("A");
      expect(connectFourEngineAdapter.legalActions(init, "A")).toEqual(["connect-four.drop"]);
      expect(connectFourEngineAdapter.isTerminal(init)).toBeNull();

      const view = connectFourEngineAdapter.toPublicView(init, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: true,
        mode: "together",
      });
      expect(view.board).toEqual(init.board);
    });
  });
});
