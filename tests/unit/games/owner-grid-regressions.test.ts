import { describe, it, expect } from "vitest";
import * as dots from "../../../shared/games/dots-boxes/engine";
import * as sos from "../../../shared/games/sos/engine";
import type { DotsBoxesState } from "../../../shared/games/dots-boxes/types";
import type { SOSState } from "../../../shared/games/sos/types";

const facts = (actorSeat: "A" | "B" = "A") => ({ serverTime: 1234, actorSeat });
const dotAction = (r1: number, c1: number, r2: number, c2: number) => ({
  action: "dots-boxes.edge" as const,
  payload: { r1, c1, r2, c2 },
});
const sosAction = (row: number, col: number, letter: "S" | "O") => ({
  action: "sos.place" as const,
  payload: { row, col, letter },
});

for (const size of [5, 7, 9] as const) {
  describe(`${size}×${size} owner grid regressions`, () => {
    it("Dots closes two outer boxes, retains turn, and rejects duplicate/stale moves without mutation", () => {
      const state = dots.createInitialState({
        serverTime: 1,
        startingSeat: "A",
        config: { gridSize: size },
      });
      const r = size - 2,
        c = size - 2;
      const existing = [
        dotAction(r, c - 1, r, c),
        dotAction(r + 1, c - 1, r + 1, c),
        dotAction(r, c - 1, r + 1, c - 1),
        dotAction(r, c, r, c + 1),
        dotAction(r + 1, c, r + 1, c + 1),
        dotAction(r, c + 1, r + 1, c + 1),
      ].map((item) => ({ ...item.payload, claimedBy: "B" as const }));
      const prepared: DotsBoxesState = { ...state, edges: existing };
      const original = JSON.stringify(prepared);
      const stale = dots.validateAndReduce(prepared, dotAction(r, c, r + 1, c), facts("B"));
      expect(stale.success).toBe(false);
      const duplicate = dots.validateAndReduce(prepared, dotAction(r, c - 1, r, c), facts());
      expect(duplicate.success).toBe(false);
      expect(JSON.stringify(prepared)).toBe(original);
      const result = dots.validateAndReduce(prepared, dotAction(r, c, r + 1, c), facts());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.newState.scores.A).toBe(2);
      expect(result.newState.activeSeat).toBe("A");
      expect(result.newState.boxes[r][c - 1]).toBe("A");
      expect(result.newState.boxes[r][c]).toBe("A");
      expect(dots.toPublicView(JSON.parse(JSON.stringify(result.newState))).gridSize).toBe(size);
    });

    it("SOS scores multiple outer lines, retains turn, and rejects duplicate/stale moves", () => {
      const state = sos.createInitialState({
        serverTime: 1,
        startingSeat: "A",
        config: { gridSize: size },
      });
      const r = size - 2,
        c = size - 2;
      const board = state.board.map((row) => [...row]);
      for (const [rr, cc] of [
        [r, c - 1],
        [r, c + 1],
        [r - 1, c],
        [r + 1, c],
      ])
        board[rr][cc] = "S";
      const prepared: SOSState = { ...state, board };
      const original = JSON.stringify(prepared);
      expect(sos.validateAndReduce(prepared, sosAction(r, c, "O"), facts("B")).success).toBe(false);
      expect(sos.validateAndReduce(prepared, sosAction(r, c - 1, "O"), facts()).success).toBe(
        false,
      );
      expect(JSON.stringify(prepared)).toBe(original);
      const result = sos.validateAndReduce(prepared, sosAction(r, c, "O"), facts());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.newState.scores.A).toBe(2);
      expect(result.newState.activeSeat).toBe("A");
      expect(result.newState.lines).toHaveLength(2);
      expect(sos.toPublicView(JSON.parse(JSON.stringify(result.newState))).gridSize).toBe(size);
    });

    it("SOS all-S board ends in a draw at each size and rejects post-terminal placement", () => {
      const state = sos.createInitialState({
        serverTime: 1,
        startingSeat: "A",
        config: { gridSize: size },
      });
      const board = Array.from({ length: size }, () => Array<"S" | null>(size).fill("S"));
      board[size - 1][size - 1] = null;
      const result = sos.validateAndReduce(
        { ...state, board },
        sosAction(size - 1, size - 1, "S"),
        facts(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.newState.status).toBe("completed");
      expect(result.terminalResult?.reason).toBe("rules_draw");
      expect(sos.validateAndReduce(result.newState, sosAction(0, 0, "O"), facts()).success).toBe(
        false,
      );
    });

    it("Dots final shared edge can complete two boxes in a draw", () => {
      const state = dots.createInitialState({
        serverTime: 1,
        startingSeat: "A",
        config: { gridSize: size },
      });
      const edges: DotsBoxesState["edges"] = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size - 1; c++)
          edges.push({ r1: r, c1: c, r2: r, c2: c + 1, claimedBy: "B" });
      for (let r = 0; r < size - 1; r++)
        for (let c = 0; c < size; c++)
          if (!(r === 0 && c === 1)) edges.push({ r1: r, c1: c, r2: r + 1, c2: c, claimedBy: "B" });
      const totalBoxes = (size - 1) ** 2;
      const boxes: DotsBoxesState["boxes"] = Array.from({ length: size - 1 }, () =>
        Array(size - 1).fill("B"),
      );
      boxes[0][0] = boxes[0][1] = null;
      let assignedA = 0;
      for (let r = 0; r < size - 1; r++)
        for (let c = 0; c < size - 1; c++) {
          if (boxes[r][c] && assignedA < totalBoxes / 2 - 2) {
            boxes[r][c] = "A";
            assignedA++;
          }
        }
      const prepared: DotsBoxesState = {
        ...state,
        edges,
        boxes,
        scores: { A: totalBoxes / 2 - 2, B: totalBoxes / 2 },
      };
      const result = dots.validateAndReduce(prepared, dotAction(0, 1, 1, 1), facts());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.newState.scores).toEqual({ A: totalBoxes / 2, B: totalBoxes / 2 });
      expect(result.newState.status).toBe("completed");
      expect(result.terminalResult?.reason).toBe("rules_draw");
      expect(dots.validateAndReduce(result.newState, dotAction(0, 1, 1, 1), facts()).success).toBe(
        false,
      );
    });
  });
}

describe("legacy grid recovery", () => {
  it("Dots and SOS missing dimensions resolve to five after JSON restore", () => {
    const dotState = dots.createInitialState({ serverTime: 1, startingSeat: "A" });
    const sosState = sos.createInitialState({ serverTime: 1, startingSeat: "A" });
    delete dotState.gridSize;
    delete sosState.gridSize;
    expect(dots.toPublicView(JSON.parse(JSON.stringify(dotState))).gridSize).toBe(5);
    expect(sos.toPublicView(JSON.parse(JSON.stringify(sosState))).gridSize).toBe(5);
  });
});
