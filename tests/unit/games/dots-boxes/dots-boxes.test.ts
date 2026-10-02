import { describe, it, expect } from "vitest";
import {
  BOXES_COLS,
  BOXES_ROWS,
  DOTS_COLS,
  DOTS_ROWS,
  DotsBoxesState,
  TOTAL_EDGES,
  TOTAL_BOXES,
} from "../../../../shared/games/dots-boxes/types";
import {
  canonicalizeEdge,
  createInitialState,
  edgeKey,
  getAdjacentBoxes,
  isBoxClosed,
  isOrthogonallyAdjacent,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/dots-boxes/engine";
import { dotsBoxesEngineAdapter } from "../../../../shared/games/dots-boxes/adapter";
import { ErrorCode } from "../../../../shared/protocol/errors";

describe("Dots & Boxes Engine", () => {
  it.each([5, 7, 9] as const)("keeps %i-dot geometry and terminal edge count", (size) => {
    let state = createInitialState({
      serverTime: 1,
      startingSeat: "A",
      config: { gridSize: size },
    });
    expect(state.boxes).toHaveLength(size - 1);
    expect(toPublicView(state).gridSize).toBe(size);
    const edges = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size - 1; c++) edges.push({ r1: r, c1: c, r2: r, c2: c + 1 });
    for (let r = 0; r < size - 1; r++)
      for (let c = 0; c < size; c++) edges.push({ r1: r, c1: c, r2: r + 1, c2: c });
    for (const [index, edge] of edges.entries()) {
      const result = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: edge },
        { serverTime: index + 2, actorSeat: state.activeSeat },
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      state = result.newState;
      expect(state.status).toBe(index === edges.length - 1 ? "completed" : "active");
    }
    expect(state.edges).toHaveLength(2 * size * (size - 1));
    expect(state.scores.A + state.scores.B).toBe((size - 1) ** 2);
  });
  describe("Initial State", () => {
    it("creates an empty board with 0 edges, 16 null boxes, and startingSeat A", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      expect(DOTS_ROWS).toBe(5);
      expect(DOTS_COLS).toBe(5);
      expect(state.edges).toEqual([]);
      expect(state.boxes).toHaveLength(BOXES_ROWS);
      for (let r = 0; r < BOXES_ROWS; r++) {
        expect(state.boxes[r]).toHaveLength(BOXES_COLS);
        for (let c = 0; c < BOXES_COLS; c++) {
          expect(state.boxes[r][c]).toBeNull();
        }
      }
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.activeSeat).toBe("A");
      expect(state.status).toBe("active");
      expect(state.winner).toBeNull();
      expect(isTerminal(state)).toBeNull();
    });

    it("reports legalActions accurately for active and waiting seats", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(legalActions(state, "A")).toEqual(["dots-boxes.edge"]);
      expect(legalActions(state, "B")).toEqual([]);
    });

    it("toPublicView returns a shallow copy matching state", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const view = toPublicView(state);

      expect(view.edges).toEqual(state.edges);
      expect(view.boxes).toEqual(state.boxes);
      expect(view.scores).toEqual(state.scores);
      expect(view.activeSeat).toBe("A");
      expect(view.status).toBe("active");
      expect(view.winner).toBeNull();
    });
  });

  describe("Edge Helpers & Canonicalization", () => {
    it("canonicalizes edge endpoints such that (r1, c1) < (r2, c2)", () => {
      // Already ordered
      expect(canonicalizeEdge(0, 0, 0, 1)).toEqual({ r1: 0, c1: 0, r2: 0, c2: 1 });
      expect(canonicalizeEdge(0, 0, 1, 0)).toEqual({ r1: 0, c1: 0, r2: 1, c2: 0 });

      // Reversed horizontal
      expect(canonicalizeEdge(0, 1, 0, 0)).toEqual({ r1: 0, c1: 0, r2: 0, c2: 1 });
      // Reversed vertical
      expect(canonicalizeEdge(1, 0, 0, 0)).toEqual({ r1: 0, c1: 0, r2: 1, c2: 0 });

      // Diagonal / complex ordering check
      expect(canonicalizeEdge(2, 3, 2, 2)).toEqual({ r1: 2, c1: 2, r2: 2, c2: 3 });
      expect(canonicalizeEdge(3, 1, 2, 1)).toEqual({ r1: 2, c1: 1, r2: 3, c2: 1 });
    });

    it("generates consistent edge keys", () => {
      const edge = canonicalizeEdge(1, 2, 1, 3);
      expect(edgeKey(edge)).toBe("1,2-1,3");
    });

    it("detects orthogonal adjacency correctly", () => {
      expect(isOrthogonallyAdjacent(0, 0, 0, 1)).toBe(true);
      expect(isOrthogonallyAdjacent(0, 0, 1, 0)).toBe(true);
      expect(isOrthogonallyAdjacent(0, 0, 1, 1)).toBe(false); // diagonal
      expect(isOrthogonallyAdjacent(0, 0, 0, 2)).toBe(false); // distance 2
      expect(isOrthogonallyAdjacent(0, 0, 0, 0)).toBe(false); // same dot
    });

    it("returns correct adjacent boxes for perimeter and interior edges", () => {
      // Top perimeter horizontal edge (0, 0)-(0, 1) has 1 box below: (0, 0)
      const topEdge = canonicalizeEdge(0, 0, 0, 1);
      expect(getAdjacentBoxes(topEdge)).toEqual([{ row: 0, col: 0 }]);

      // Interior horizontal edge (1, 1)-(1, 2) has box above (0, 1) and box below (1, 1)
      const interiorH = canonicalizeEdge(1, 1, 1, 2);
      expect(getAdjacentBoxes(interiorH)).toEqual([
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ]);

      // Left perimeter vertical edge (0, 0)-(1, 0) has 1 box to right: (0, 0)
      const leftEdge = canonicalizeEdge(0, 0, 1, 0);
      expect(getAdjacentBoxes(leftEdge)).toEqual([{ row: 0, col: 0 }]);

      // Interior vertical edge (1, 1)-(2, 1) has box to left (1, 0) and box to right (1, 1)
      const interiorV = canonicalizeEdge(1, 1, 2, 1);
      expect(getAdjacentBoxes(interiorV)).toEqual([
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ]);
    });

    it("checks if a box is closed using isBoxClosed", () => {
      const top = edgeKey(canonicalizeEdge(0, 0, 0, 1));
      const bottom = edgeKey(canonicalizeEdge(1, 0, 1, 1));
      const left = edgeKey(canonicalizeEdge(0, 0, 1, 0));
      const right = edgeKey(canonicalizeEdge(0, 1, 1, 1));

      const set = new Set([top, bottom, left]);
      expect(isBoxClosed(0, 0, set)).toBe(false);
      set.add(right);
      expect(isBoxClosed(0, 0, set)).toBe(true);
    });
  });

  describe("Validation & Rejection Rules", () => {
    it("rejects move if actor is not the active seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
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
        { action: "connect-four.drop" as any, payload: { column: 0 } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects out-of-bounds dot coordinates", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 4, r2: 0, c2: 5 } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects non-adjacent dots", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const result = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 1, c2: 1 } }, // diagonal
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects duplicate edges, even if endpoint order is reversed", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res1 = validateAndReduce(
        state0,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: 1005 },
      );
      expect(res1.success).toBe(true);
      if (!res1.success) return;

      const state1 = res1.newState;
      // Player B attempts to place the exact same edge with reversed endpoints
      const res2 = validateAndReduce(
        state1,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 1, r2: 0, c2: 0 } },
        { actorSeat: "B", serverTime: 1010 },
      );

      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.code).toBe(ErrorCode.INVALID_ACTION);
        expect(res2.error.message).toContain("already been placed");
      }
    });

    it("preserves immutability when validation fails", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const originalCopy = JSON.parse(JSON.stringify(state));

      validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: -1, c1: 0, r2: 0, c2: 0 } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(state).toEqual(originalCopy);
    });
  });

  describe("Turn Alternation on Non-scoring Moves", () => {
    it("alternates turn from A to B when no box is closed", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: 1005 },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.activeSeat).toBe("B");
      expect(res.newState.edges).toHaveLength(1);
      expect(res.newState.edges[0]).toEqual({
        r1: 0,
        c1: 0,
        r2: 0,
        c2: 1,
        claimedBy: "A",
      });
      expect(res.effects).toEqual([
        {
          type: "edge-placed",
          seat: "A",
          edge: { r1: 0, c1: 0, r2: 0, c2: 1 },
        },
        {
          type: "turn-changed",
          fromSeat: "A",
          toSeat: "B",
        },
      ]);
    });
  });

  describe("Single Box Closure & Turn Retention", () => {
    it("closes a single box, awards 1 point, claims box, and retains turn", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // Move 1 (A): top edge of box (0,0) -> (0,0)-(0,1)
      const res1 = validateAndReduce(
        state0,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: 1001 },
      );
      if (!res1.success) throw new Error();

      // Move 2 (B): left edge of box (0,0) -> (0,0)-(1,0)
      const res2 = validateAndReduce(
        res1.newState,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 1, c2: 0 } },
        { actorSeat: "B", serverTime: 1002 },
      );
      if (!res2.success) throw new Error();

      // Move 3 (A): right edge of box (0,0) -> (0,1)-(1,1)
      const res3 = validateAndReduce(
        res2.newState,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 1, r2: 1, c2: 1 } },
        { actorSeat: "A", serverTime: 1003 },
      );
      if (!res3.success) throw new Error();

      // Box (0,0) has 3 edges placed now. Active seat is B.
      expect(res3.newState.activeSeat).toBe("B");
      expect(res3.newState.scores).toEqual({ A: 0, B: 0 });

      // Move 4 (B): bottom edge of box (0,0) -> (1,0)-(1,1) (closes box (0,0))
      const res4 = validateAndReduce(
        res3.newState,
        { action: "dots-boxes.edge", payload: { r1: 1, c1: 0, r2: 1, c2: 1 } },
        { actorSeat: "B", serverTime: 1004 },
      );
      expect(res4.success).toBe(true);
      if (!res4.success) return;

      // Player B closed box (0, 0)!
      expect(res4.newState.boxes[0][0]).toBe("B");
      expect(res4.newState.scores).toEqual({ A: 0, B: 1 });
      // Turn retention: player B retains the turn!
      expect(res4.newState.activeSeat).toBe("B");

      expect(res4.effects).toEqual([
        {
          type: "edge-placed",
          seat: "B",
          edge: { r1: 1, c1: 0, r2: 1, c2: 1 },
        },
        {
          type: "boxes-claimed",
          seat: "B",
          boxes: [{ row: 0, col: 0 }],
        },
      ]);
    });

    it("allows player to continue playing when turn is retained, then alternate on next non-scoring move", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // Place 3 edges of box (0, 0)
      const m1 = validateAndReduce(
        state0,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: 1001 },
      );
      const m2 = validateAndReduce(
        (m1 as any).newState,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 1, c2: 0 } },
        { actorSeat: "B", serverTime: 1002 },
      );
      const m3 = validateAndReduce(
        (m2 as any).newState,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 1, r2: 1, c2: 1 } },
        { actorSeat: "A", serverTime: 1003 },
      );
      // B closes box (0, 0)
      const m4 = validateAndReduce(
        (m3 as any).newState,
        { action: "dots-boxes.edge", payload: { r1: 1, c1: 0, r2: 1, c2: 1 } },
        { actorSeat: "B", serverTime: 1004 },
      );
      expect((m4 as any).newState.activeSeat).toBe("B");

      // B moves again (retained turn) on an unrelated edge (4, 3)-(4, 4)
      const m5 = validateAndReduce(
        (m4 as any).newState,
        { action: "dots-boxes.edge", payload: { r1: 4, c1: 3, r2: 4, c2: 4 } },
        { actorSeat: "B", serverTime: 1005 },
      );
      expect(m5.success).toBe(true);
      if (!m5.success) return;

      // Turn now alternates to A because m5 closed 0 boxes
      expect(m5.newState.activeSeat).toBe("A");
      expect(m5.effects).toEqual([
        {
          type: "edge-placed",
          seat: "B",
          edge: { r1: 4, c1: 3, r2: 4, c2: 4 },
        },
        {
          type: "turn-changed",
          fromSeat: "B",
          toSeat: "A",
        },
      ]);
    });
  });

  describe("Simultaneous Two-Box Closure", () => {
    it("closes two adjacent boxes with one internal edge, scoring 2 points and retaining turn", () => {
      // Let's set up box (1, 1) and box (1, 2) sharing vertical edge (1, 2)-(2, 2)
      // Box (1, 1) edges:
      // top: (1, 1)-(1, 2)
      // bottom: (2, 1)-(2, 2)
      // left: (1, 1)-(2, 1)
      // right: (1, 2)-(2, 2) [shared edge]
      //
      // Box (1, 2) edges:
      // top: (1, 2)-(1, 3)
      // bottom: (2, 2)-(2, 3)
      // left: (1, 2)-(2, 2) [shared edge]
      // right: (1, 3)-(2, 3)

      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      const setupEdges = [
        // Box (1, 1) perimeter
        { r1: 1, c1: 1, r2: 1, c2: 2 }, // top (1,1)
        { r1: 2, c1: 1, r2: 2, c2: 2 }, // bottom (1,1)
        { r1: 1, c1: 1, r2: 2, c2: 1 }, // left (1,1)
        // Box (1, 2) perimeter
        { r1: 1, c1: 2, r2: 1, c2: 3 }, // top (1,2)
        { r1: 2, c1: 2, r2: 2, c2: 3 }, // bottom (1,2)
        { r1: 1, c1: 3, r2: 2, c2: 3 }, // right (1,2)
      ];

      let seat: "A" | "B" = "A";
      for (const edge of setupEdges) {
        const res = validateAndReduce(
          state,
          { action: "dots-boxes.edge", payload: edge },
          { actorSeat: seat, serverTime: 1000 },
        );
        if (!res.success) throw new Error("Setup edge failed");
        state = res.newState;
        seat = state.activeSeat;
      }

      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.boxes[1][1]).toBeNull();
      expect(state.boxes[1][2]).toBeNull();

      // Now activeSeat places the shared internal edge (1, 2)-(2, 2)
      const currentActor = state.activeSeat;
      const res = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: 1, c1: 2, r2: 2, c2: 2 } },
        { actorSeat: currentActor, serverTime: 2000 },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // Both boxes are closed!
      expect(res.newState.boxes[1][1]).toBe(currentActor);
      expect(res.newState.boxes[1][2]).toBe(currentActor);
      expect(res.newState.scores[currentActor]).toBe(2);
      // Turn is retained once
      expect(res.newState.activeSeat).toBe(currentActor);

      expect(res.effects).toEqual([
        {
          type: "edge-placed",
          seat: currentActor,
          edge: { r1: 1, c1: 2, r2: 2, c2: 2 },
        },
        {
          type: "boxes-claimed",
          seat: currentActor,
          boxes: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
          ],
        },
      ]);
    });
  });

  describe("Full 40-Edge Completion & Outcome", () => {
    it("completes all 40 edges, declares winner, and blocks further moves", () => {
      // Generate all 40 orthogonal edges deterministically
      const allEdges: { r1: number; c1: number; r2: number; c2: number }[] = [];
      // 20 Horizontal: r in 0..4, c in 0..3
      for (let r = 0; r <= 4; r++) {
        for (let c = 0; c < 4; c++) {
          allEdges.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        }
      }
      // 20 Vertical: r in 0..3, c in 0..4
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c <= 4; c++) {
          allEdges.push({ r1: r, c1: c, r2: r + 1, c2: c });
        }
      }

      expect(allEdges).toHaveLength(TOTAL_EDGES);

      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let time = 1000;

      for (let i = 0; i < allEdges.length; i++) {
        time += 10;
        const res = validateAndReduce(
          state,
          { action: "dots-boxes.edge", payload: allEdges[i] },
          { actorSeat: state.activeSeat, serverTime: time },
        );
        expect(res.success).toBe(true);
        if (!res.success) return;
        state = res.newState;
      }

      // Match must be completed
      expect(state.status).toBe("completed");
      expect(state.edges).toHaveLength(40);
      expect(state.scores.A + state.scores.B).toBe(TOTAL_BOXES);
      expect(state.terminalResult).toBeDefined();
      expect(state.terminalResult?.finishedAt).toBe(time);

      if (state.scores.A > state.scores.B) {
        expect(state.winner).toBe("A");
        expect(state.terminalResult?.reason).toBe("rules_win");
      } else if (state.scores.B > state.scores.A) {
        expect(state.winner).toBe("B");
        expect(state.terminalResult?.reason).toBe("rules_win");
      } else {
        expect(state.winner).toBeNull();
        expect(state.terminalResult?.reason).toBe("rules_draw");
      }

      // Legal actions empty after completion
      expect(legalActions(state, "A")).toEqual([]);
      expect(legalActions(state, "B")).toEqual([]);

      // Further moves rejected with MATCH_FINISHED
      const afterRes = validateAndReduce(
        state,
        { action: "dots-boxes.edge", payload: { r1: 0, c1: 0, r2: 0, c2: 1 } },
        { actorSeat: "A", serverTime: time + 10 },
      );
      expect(afterRes.success).toBe(false);
      if (!afterRes.success) {
        expect(afterRes.error.code).toBe(ErrorCode.MATCH_FINISHED);
      }
    });

    it("handles a clean 8-8 draw with game-drawn effect", () => {
      // Create a state where exactly 8 boxes belong to A, 8 belong to B, and 39 edges placed
      // We can manually craft or construct this cleanly:
      // Let's create an initial state, fill 39 edges, then place 40th.
      // Or construct a state with 39 edges placed where 15 boxes closed (7 for A, 8 for B)
      // and the final edge closes box 16 for A -> 8-8 draw!

      const allEdges: { r1: number; c1: number; r2: number; c2: number }[] = [];
      for (let r = 0; r <= 4; r++) {
        for (let c = 0; c < 4; c++) {
          allEdges.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        }
      }
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c <= 4; c++) {
          allEdges.push({ r1: r, c1: c, r2: r + 1, c2: c });
        }
      }

      // Let's construct a state directly to test draw handling cleanly:
      const placed39 = allEdges.slice(0, 39).map((e) => ({
        ...canonicalizeEdge(e.r1, e.c1, e.r2, e.c2),
        claimedBy: "A" as const,
      }));

      // Let's set 7 boxes to A, 8 boxes to B, and 1 box null (which will be closed by 40th edge)
      const boxes: ("A" | "B" | null)[][] = [
        ["A", "A", "A", "A"],
        ["A", "A", "A", "B"],
        ["B", "B", "B", "B"],
        ["B", "B", "B", null],
      ];

      const state39: DotsBoxesState = {
        edges: placed39,
        boxes,
        scores: { A: 7, B: 8 },
        activeSeat: "A",
        status: "active",
        winner: null,
      };

      const lastEdge = allEdges[39];
      const res = validateAndReduce(
        state39,
        { action: "dots-boxes.edge", payload: lastEdge },
        { actorSeat: "A", serverTime: 5000 },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.status).toBe("completed");
      expect(res.newState.scores).toEqual({ A: 8, B: 8 });
      expect(res.newState.winner).toBeNull();
      expect(res.newState.terminalResult?.reason).toBe("rules_draw");
      expect(res.effects).toContainEqual({
        type: "game-drawn",
        scores: { A: 8, B: 8 },
      });
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
      expect(dotsBoxesEngineAdapter.gameId).toBe("dots-boxes");
      expect(typeof dotsBoxesEngineAdapter.createInitialState).toBe("function");
      expect(typeof dotsBoxesEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof dotsBoxesEngineAdapter.legalActions).toBe("function");
      expect(typeof dotsBoxesEngineAdapter.toPublicView).toBe("function");
      expect(typeof dotsBoxesEngineAdapter.isTerminal).toBe("function");
    });
  });
});
