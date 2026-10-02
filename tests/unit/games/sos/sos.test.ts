import { describe, it, expect } from "vitest";
import { SOS_BOARD_SIZE, SOS_TOTAL_CELLS } from "../../../../shared/games/sos/types";
import {
  canonicalizeLineEndpoints,
  createInitialState,
  detectNewLines,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/sos/engine";
import { sosEngineAdapter } from "../../../../shared/games/sos/adapter";
import { ErrorCode } from "../../../../shared/protocol/errors";

describe("SOS Engine", () => {
  it.each([5, 7, 9] as const)("keeps %i-cell geometry and completes on last cell", (size) => {
    let state = createInitialState({
      serverTime: 1,
      startingSeat: "A",
      config: { gridSize: size },
    });
    expect(state.board).toHaveLength(size);
    expect(toPublicView(state).gridSize).toBe(size);
    let index = 0;
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const result = validateAndReduce(
          state,
          { action: "sos.place", payload: { row, col, letter: "S" } },
          { serverTime: ++index, actorSeat: state.activeSeat },
        );
        expect(result.success).toBe(true);
        if (!result.success) return;
        state = result.newState;
        expect(state.status).toBe(index === size * size ? "completed" : "active");
      }
    expect(state.scores).toEqual({ A: 0, B: 0 });
    expect(state.winner).toBeNull();
  });
  describe("Initial State", () => {
    it("creates an empty 5x5 board with 0 lines, 0 scores, and activeSeat A", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      expect(state.board).toHaveLength(SOS_BOARD_SIZE);
      expect(SOS_TOTAL_CELLS).toBe(25);
      for (let r = 0; r < SOS_BOARD_SIZE; r++) {
        expect(state.board[r]).toHaveLength(SOS_BOARD_SIZE);
        for (let c = 0; c < SOS_BOARD_SIZE; c++) {
          expect(state.board[r][c]).toBeNull();
        }
      }

      expect(state.lines).toEqual([]);
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.activeSeat).toBe("A");
      expect(state.status).toBe("active");
      expect(state.winner).toBeNull();
      expect(isTerminal(state)).toBeNull();
    });

    it("reports legalActions accurately for active and waiting seats", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(legalActions(state, "A")).toEqual(["sos.place"]);
      expect(legalActions(state, "B")).toEqual([]);
    });

    it("produces a public view matching the state", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const view = toPublicView(state);

      expect(view.board).toEqual(state.board);
      expect(view.lines).toEqual(state.lines);
      expect(view.scores).toEqual(state.scores);
      expect(view.activeSeat).toBe("A");
      expect(view.status).toBe("active");
      expect(view.winner).toBeNull();
    });
  });

  describe("Line Detection & Canonicalization Helpers", () => {
    it("canonicalizes line endpoints such that (r1, c1) < (r2, c2)", () => {
      // Horizontal
      expect(canonicalizeLineEndpoints(0, 0, 0, 2)).toEqual({
        from: [0, 0],
        to: [0, 2],
        id: "0,0-0,2",
      });
      // Reversed horizontal
      expect(canonicalizeLineEndpoints(0, 2, 0, 0)).toEqual({
        from: [0, 0],
        to: [0, 2],
        id: "0,0-0,2",
      });
      // Vertical
      expect(canonicalizeLineEndpoints(3, 1, 1, 1)).toEqual({
        from: [1, 1],
        to: [3, 1],
        id: "1,1-3,1",
      });
      // Diagonal-up
      expect(canonicalizeLineEndpoints(2, 0, 0, 2)).toEqual({
        from: [0, 2],
        to: [2, 0],
        id: "0,2-2,0",
      });
    });

    it("detects newly formed lines with detectNewLines helper directly", () => {
      const board = Array.from({ length: SOS_BOARD_SIZE }, () =>
        Array<"S" | "O" | null>(SOS_BOARD_SIZE).fill(null),
      );
      board[0][0] = "S";
      board[0][1] = "O";
      board[0][2] = "S";

      const lines = detectNewLines(board, 0, 2, "S", "A");
      expect(lines).toHaveLength(1);
      expect(lines[0].id).toBe("0,0-0,2");
      expect(lines[0].claimedBy).toBe("A");
    });
  });

  describe("Validation & Rejection Rules", () => {
    it("rejects move if actor is not the active seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
        { actorSeat: "B", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NOT_YOUR_TURN);
      }
    });

    it("rejects unknown action types", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "dots-boxes.edge" as any, payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects invalid letters (not S or O)", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "X" as any } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects out-of-bounds coordinates", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 5, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects placement in already occupied cell", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 2, col: 2, letter: "S" } },
        { actorSeat: "A", serverTime: 1005 },
      );
      expect(res1.success).toBe(true);
      if (!res1.success) return;

      const state1 = res1.newState;
      // B attempts to place in cell (2, 2)
      const res2 = validateAndReduce(
        state1,
        { action: "sos.place", payload: { row: 2, col: 2, letter: "O" } },
        { actorSeat: "B", serverTime: 1010 },
      );

      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.code).toBe(ErrorCode.INVALID_ACTION);
        expect(res2.error.message).toContain("already occupied");
      }
    });

    it("preserves immutability when validation fails", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const originalCopy = JSON.parse(JSON.stringify(state));

      validateAndReduce(
        state,
        { action: "sos.place", payload: { row: -1, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(state).toEqual(originalCopy);
    });
  });

  describe("Turn Alternation on Non-scoring Moves", () => {
    it("places S or O and alternates turn when no lines are formed", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // Move 1: A places 'S' at (0, 0)
      const res1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      expect(res1.success).toBe(true);
      if (!res1.success) return;

      expect(res1.newState.board[0][0]).toBe("S");
      expect(res1.newState.activeSeat).toBe("B");
      expect(res1.newState.scores).toEqual({ A: 0, B: 0 });
      expect(res1.effects).toEqual([
        {
          type: "letter-placed",
          seat: "A",
          row: 0,
          col: 0,
          letter: "S",
        },
        {
          type: "turn-changed",
          fromSeat: "A",
          toSeat: "B",
        },
      ]);

      // Move 2: B places 'O' at (0, 1)
      const res2 = validateAndReduce(
        res1.newState,
        { action: "sos.place", payload: { row: 0, col: 1, letter: "O" } },
        { actorSeat: "B", serverTime: 1002 },
      );
      expect(res2.success).toBe(true);
      if (!res2.success) return;

      expect(res2.newState.board[0][1]).toBe("O");
      expect(res2.newState.activeSeat).toBe("A");
      expect(res2.newState.scores).toEqual({ A: 0, B: 0 });
    });
  });

  describe("Contiguous 3-Cell S-O-S Detection & Scoring", () => {
    it("detects horizontal line when completed by 'S'", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const m1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "sos.place", payload: { row: 0, col: 1, letter: "O" } },
        { actorSeat: "B", serverTime: 1002 },
      );

      // Now A places 'S' at (0, 2) completing horizontal line (0,0)-(0,2)
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "sos.place", payload: { row: 0, col: 2, letter: "S" } },
        { actorSeat: "A", serverTime: 1003 },
      );

      expect(m3.success).toBe(true);
      if (!m3.success) return;

      expect(m3.newState.scores).toEqual({ A: 1, B: 0 });
      expect(m3.newState.lines).toHaveLength(1);
      expect(m3.newState.lines[0]).toEqual({
        id: "0,0-0,2",
        from: [0, 0],
        to: [0, 2],
        claimedBy: "A",
      });
      // Turn retention: A retains the turn!
      expect(m3.newState.activeSeat).toBe("A");

      expect(m3.effects).toEqual([
        {
          type: "letter-placed",
          seat: "A",
          row: 0,
          col: 2,
          letter: "S",
        },
        {
          type: "lines-formed",
          seat: "A",
          lines: [
            {
              id: "0,0-0,2",
              from: [0, 0],
              to: [0, 2],
              claimedBy: "A",
            },
          ],
        },
      ]);
    });

    it("detects horizontal line when completed by 'O' in center", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const m1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 1, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "sos.place", payload: { row: 1, col: 2, letter: "S" } },
        { actorSeat: "B", serverTime: 1002 },
      );

      // Now A places 'O' at (1, 1) in the middle!
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "sos.place", payload: { row: 1, col: 1, letter: "O" } },
        { actorSeat: "A", serverTime: 1003 },
      );

      expect(m3.success).toBe(true);
      if (!m3.success) return;

      expect(m3.newState.scores).toEqual({ A: 1, B: 0 });
      expect(m3.newState.lines[0].id).toBe("1,0-1,2");
      expect(m3.newState.activeSeat).toBe("A");
    });

    it("detects vertical line", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const m1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 0, col: 3, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "sos.place", payload: { row: 2, col: 3, letter: "S" } },
        { actorSeat: "B", serverTime: 1002 },
      );
      // A places 'O' at (1, 3)
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "sos.place", payload: { row: 1, col: 3, letter: "O" } },
        { actorSeat: "A", serverTime: 1003 },
      );

      expect(m3.success).toBe(true);
      if (!m3.success) return;

      expect(m3.newState.scores).toEqual({ A: 1, B: 0 });
      expect(m3.newState.lines[0]).toEqual({
        id: "0,3-2,3",
        from: [0, 3],
        to: [2, 3],
        claimedBy: "A",
      });
    });

    it("detects diagonal-down line: (0,0), (1,1), (2,2)", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const m1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "sos.place", payload: { row: 1, col: 1, letter: "O" } },
        { actorSeat: "B", serverTime: 1002 },
      );
      // A completes diagonal with 'S' at (2, 2)
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "sos.place", payload: { row: 2, col: 2, letter: "S" } },
        { actorSeat: "A", serverTime: 1003 },
      );

      expect(m3.success).toBe(true);
      if (!m3.success) return;

      expect(m3.newState.scores).toEqual({ A: 1, B: 0 });
      expect(m3.newState.lines[0]).toEqual({
        id: "0,0-2,2",
        from: [0, 0],
        to: [2, 2],
        claimedBy: "A",
      });
    });

    it("detects diagonal-up line: (2,0), (1,1), (0,2)", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const m1 = validateAndReduce(
        state0,
        { action: "sos.place", payload: { row: 2, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "sos.place", payload: { row: 0, col: 2, letter: "S" } },
        { actorSeat: "B", serverTime: 1002 },
      );
      // A completes diagonal-up with 'O' at (1, 1)
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "sos.place", payload: { row: 1, col: 1, letter: "O" } },
        { actorSeat: "A", serverTime: 1003 },
      );

      expect(m3.success).toBe(true);
      if (!m3.success) return;

      expect(m3.newState.scores).toEqual({ A: 1, B: 0 });
      expect(m3.newState.lines[0]).toEqual({
        id: "0,2-2,0",
        from: [0, 2],
        to: [2, 0],
        claimedBy: "A",
      });
    });
  });

  describe("Multiple Lines on Single Move & Shared Letter Overlaps", () => {
    it("forms multiple lines on placing a central 'O' (cross shape), scores for both, and retains turn once", () => {
      // Set up a cross centered at (2, 2):
      // (1, 2)='S', (3, 2)='S' (vertical)
      // (2, 1)='S', (2, 3)='S' (horizontal)
      // Placer puts 'O' at (2, 2)
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      const setup = [
        { row: 1, col: 2, letter: "S" as const },
        { row: 3, col: 2, letter: "S" as const },
        { row: 2, col: 1, letter: "S" as const },
        { row: 2, col: 3, letter: "S" as const },
      ];

      for (const step of setup) {
        const res = validateAndReduce(
          state,
          { action: "sos.place", payload: step },
          { actorSeat: state.activeSeat, serverTime: 1000 },
        );
        if (!res.success) throw new Error();
        state = res.newState;
      }

      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.lines).toEqual([]);

      const active = state.activeSeat;
      // Place 'O' at (2, 2)
      const res = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 2, col: 2, letter: "O" } },
        { actorSeat: active, serverTime: 2000 },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // 2 lines formed!
      expect(res.newState.scores[active]).toBe(2);
      expect(res.newState.lines).toHaveLength(2);
      const lineIds = res.newState.lines.map((l) => l.id);
      expect(lineIds).toContain("1,2-3,2"); // vertical
      expect(lineIds).toContain("2,1-2,3"); // horizontal

      // Turn is retained once
      expect(res.newState.activeSeat).toBe(active);

      expect(res.effects).toEqual([
        {
          type: "letter-placed",
          seat: active,
          row: 2,
          col: 2,
          letter: "O",
        },
        {
          type: "lines-formed",
          seat: active,
          lines: res.newState.lines,
        },
      ]);
    });

    it("supports shared letter overlaps: S-O-S-O-S in a line", () => {
      // Row 0:
      // (0,0)='S', (0,1)='O', (0,2)='S' -> line 1 (0,0)-(0,2)
      // (0,3)='O', (0,4)='S' -> line 2 (0,2)-(0,4) sharing (0,2)
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // A places S at (0, 0)
      state = (
        validateAndReduce(
          state,
          { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
          { actorSeat: "A", serverTime: 1001 },
        ) as any
      ).newState;

      // B places O at (0, 1)
      state = (
        validateAndReduce(
          state,
          { action: "sos.place", payload: { row: 0, col: 1, letter: "O" } },
          { actorSeat: "B", serverTime: 1002 },
        ) as any
      ).newState;

      // A places S at (0, 2) -> forms line 1!
      const m3 = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 2, letter: "S" } },
        { actorSeat: "A", serverTime: 1003 },
      );
      if (!m3.success) throw new Error();
      state = m3.newState;
      expect(state.scores.A).toBe(1);
      expect(state.activeSeat).toBe("A"); // retained turn

      // A places O at (0, 3) (non-scoring)
      const m4 = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 3, letter: "O" } },
        { actorSeat: "A", serverTime: 1004 },
      );
      if (!m4.success) throw new Error();
      state = m4.newState;
      expect(state.activeSeat).toBe("B"); // turn transferred to B

      // B places S at (0, 4) -> forms line 2 sharing cell (0, 2)!
      const m5 = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 4, letter: "S" } },
        { actorSeat: "B", serverTime: 1005 },
      );
      if (!m5.success) throw new Error();
      state = m5.newState;

      expect(state.scores).toEqual({ A: 1, B: 1 });
      expect(state.lines).toHaveLength(2);
      expect(state.lines[0].id).toBe("0,0-0,2");
      expect(state.lines[0].claimedBy).toBe("A");
      expect(state.lines[1].id).toBe("0,2-0,4");
      expect(state.lines[1].claimedBy).toBe("B");
      expect(state.activeSeat).toBe("B"); // B retained turn
    });
  });

  describe("Full 25-Cell Completion & Terminal Outcome", () => {
    it("completes when all 25 cells are occupied, declares winner, and blocks further moves", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let time = 1000;

      // Fill board deterministically: row 0 has S, O, S, O, S so A gets some points
      // other rows filled with 'O' so no lines formed
      for (let r = 0; r < SOS_BOARD_SIZE; r++) {
        for (let c = 0; c < SOS_BOARD_SIZE; c++) {
          time += 10;
          let letter: "S" | "O" = "O";
          if (r === 0 && (c === 0 || c === 2 || c === 4)) {
            letter = "S";
          }
          const res = validateAndReduce(
            state,
            { action: "sos.place", payload: { row: r, col: c, letter } },
            { actorSeat: state.activeSeat, serverTime: time },
          );
          expect(res.success).toBe(true);
          if (!res.success) return;
          state = res.newState;
        }
      }

      expect(state.status).toBe("completed");
      expect(state.terminalResult).toBeDefined();
      expect(state.terminalResult?.finishedAt).toBe(time);
      expect(legalActions(state, "A")).toEqual([]);
      expect(legalActions(state, "B")).toEqual([]);

      // Further moves rejected with MATCH_FINISHED
      const afterRes = validateAndReduce(
        state,
        { action: "sos.place", payload: { row: 0, col: 0, letter: "S" } },
        { actorSeat: "A", serverTime: time + 10 },
      );
      expect(afterRes.success).toBe(false);
      if (!afterRes.success) {
        expect(afterRes.error.code).toBe(ErrorCode.MATCH_FINISHED);
      }
    });

    it("handles a clean draw when scores are equal at 25 cells", () => {
      // Fill entire board with 'O' (no S-O-S possible, 0-0 score)
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let time = 1000;

      for (let r = 0; r < SOS_BOARD_SIZE; r++) {
        for (let c = 0; c < SOS_BOARD_SIZE; c++) {
          time += 10;
          const res = validateAndReduce(
            state,
            { action: "sos.place", payload: { row: r, col: c, letter: "O" } },
            { actorSeat: state.activeSeat, serverTime: time },
          );
          expect(res.success).toBe(true);
          if (!res.success) return;
          state = res.newState;
        }
      }

      expect(state.status).toBe("completed");
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.winner).toBeNull();
      expect(state.terminalResult?.reason).toBe("rules_draw");
      expect(state.terminalResult?.winner).toBeNull();
    });
  });

  describe("JSON Serialization & Adapter Adherence", () => {
    it("serializes and deserializes cleanly without data loss", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "B" });
      const serialized = JSON.stringify(state);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(state);
    });

    it("exports adapter conforming to GameEngineAdapter contract", () => {
      expect(sosEngineAdapter.gameId).toBe("sos");
      expect(typeof sosEngineAdapter.createInitialState).toBe("function");
      expect(typeof sosEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof sosEngineAdapter.legalActions).toBe("function");
      expect(typeof sosEngineAdapter.toPublicView).toBe("function");
      expect(typeof sosEngineAdapter.isTerminal).toBe("function");
    });
  });
});
