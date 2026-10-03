/**
 * ArcadeO V1 — Dots & Boxes Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Dots & Boxes.
 * 5x5 dots giving 4x4 boxes (16 boxes total, 40 orthogonal edges).
 */

import {
  ActionType,
  DotsBoxesEdgePayload,
  Seat,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import {
  DOTS_ROWS,
  DotsBoxesBoxCoordinate,
  DotsBoxesEdge,
  DotsBoxesEffect,
  DotsBoxesPlacedEdge,
  DotsBoxesState,
  DotsBoxesView,
  gridSize,
} from "./types";

/**
 * Canonicalizes an edge such that (r1, c1) < (r2, c2).
 */
export function canonicalizeEdge(r1: number, c1: number, r2: number, c2: number): DotsBoxesEdge {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) {
    return { r1, c1, r2, c2 };
  }
  return { r1: r2, c1: c2, r2: r1, c2: c1 };
}

/**
 * Returns a stable string key for a canonical edge.
 */
export function edgeKey(edge: DotsBoxesEdge): string {
  return `${edge.r1},${edge.c1}-${edge.r2},${edge.c2}`;
}

/**
 * Checks whether two points on the 5x5 grid are orthogonally adjacent.
 */
export function isOrthogonallyAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/**
 * Returns candidate adjacent box coordinates (0, 1, or 2 boxes) for a canonical edge.
 */
export function getAdjacentBoxes(
  edge: DotsBoxesEdge,
  size: number = DOTS_ROWS,
): DotsBoxesBoxCoordinate[] {
  const boxes: DotsBoxesBoxCoordinate[] = [];
  const { r1, c1, r2, c2 } = edge;

  if (r1 === r2 && c2 === c1 + 1) {
    // Horizontal edge: between (r, c) and (r, c+1)
    const r = r1;
    const c = c1;
    if (r > 0) {
      boxes.push({ row: r - 1, col: c });
    }
    if (r < size - 1) {
      boxes.push({ row: r, col: c });
    }
  } else if (c1 === c2 && r2 === r1 + 1) {
    // Vertical edge: between (r, c) and (r+1, c)
    const r = r1;
    const c = c1;
    if (c > 0) {
      boxes.push({ row: r, col: c - 1 });
    }
    if (c < size - 1) {
      boxes.push({ row: r, col: c });
    }
  }

  return boxes;
}

/**
 * Checks if a box at (row, col) has all 4 edges placed.
 */
export function isBoxClosed(row: number, col: number, placedKeys: Set<string>): boolean {
  const top = edgeKey(canonicalizeEdge(row, col, row, col + 1));
  const bottom = edgeKey(canonicalizeEdge(row + 1, col, row + 1, col + 1));
  const left = edgeKey(canonicalizeEdge(row, col, row + 1, col));
  const right = edgeKey(canonicalizeEdge(row, col + 1, row + 1, col + 1));

  return (
    placedKeys.has(top) && placedKeys.has(bottom) && placedKeys.has(left) && placedKeys.has(right)
  );
}

/**
 * Creates the initial Dots & Boxes state.
 */
export function createInitialState(startFacts: SuppliedStartFacts): DotsBoxesState {
  const size = gridSize(startFacts.config?.gridSize);
  const boxes: (Seat | null)[][] = Array.from({ length: size - 1 }, () =>
    Array<Seat | null>(size - 1).fill(null),
  );

  return {
    gridSize: size,
    edges: [],
    boxes,
    scores: { A: 0, B: 0 },
    activeSeat: startFacts.startingSeat ?? "A",
    status: "active",
    winner: null,
  };
}

/**
 * Pure validator and reducer for Dots & Boxes moves.
 */
export function validateAndReduce(
  state: DotsBoxesState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<DotsBoxesState, DotsBoxesEffect> {
  const size = gridSize(state.gridSize);
  // 1. Guard against moves after match completion
  if (state.status === "completed" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  // 2. Validate action type
  if (action.action !== "dots-boxes.edge") {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Expected action 'dots-boxes.edge', got '${action.action}'`,
      ),
    };
  }

  // 3. Turn verification
  if (acceptedFacts.actorSeat !== state.activeSeat) {
    return {
      success: false,
      error: createError(
        ErrorCode.NOT_YOUR_TURN,
        `It is player ${state.activeSeat}'s turn, but player ${acceptedFacts.actorSeat} attempted to move`,
      ),
    };
  }

  // 4. Validate payload
  const payload = action.payload as DotsBoxesEdgePayload | undefined;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.r1 !== "number" ||
    typeof payload.c1 !== "number" ||
    typeof payload.r2 !== "number" ||
    typeof payload.c2 !== "number" ||
    !Number.isInteger(payload.r1) ||
    !Number.isInteger(payload.c1) ||
    !Number.isInteger(payload.r2) ||
    !Number.isInteger(payload.c2)
  ) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        "Edge coordinates r1, c1, r2, c2 must be integers",
      ),
    };
  }

  const { r1, c1, r2, c2 } = payload;

  // 5. Bounds check
  if (
    r1 < 0 ||
    r1 >= size ||
    c1 < 0 ||
    c1 >= size ||
    r2 < 0 ||
    r2 >= size ||
    c2 < 0 ||
    c2 >= size
  ) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Coordinates must be within 0..${size - 1} on a ${size}x${size} dot grid`,
      ),
    };
  }

  // 6. Adjacency check
  if (!isOrthogonallyAdjacent(r1, c1, r2, c2)) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        "Dots must be orthogonally adjacent with distance 1",
      ),
    };
  }

  // 7. Canonicalize edge and check duplicate
  const canonical = canonicalizeEdge(r1, c1, r2, c2);
  const key = edgeKey(canonical);

  if (state.edges.some((e) => edgeKey(e) === key)) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, "Edge has already been placed"),
    };
  }

  // 8. Place edge
  const newPlacedEdge: DotsBoxesPlacedEdge = {
    ...canonical,
    claimedBy: acceptedFacts.actorSeat,
  };
  const newEdges = [...state.edges, newPlacedEdge];
  const placedEdgeKeys = new Set(newEdges.map((e) => edgeKey(e)));

  // 9. Check closing boxes
  const adjacent = getAdjacentBoxes(canonical, size);
  const closedBoxes: DotsBoxesBoxCoordinate[] = [];
  const newBoxes = state.boxes.map((rowCells) => [...rowCells]);

  for (const box of adjacent) {
    if (state.boxes[box.row][box.col] === null) {
      if (isBoxClosed(box.row, box.col, placedEdgeKeys)) {
        closedBoxes.push(box);
        newBoxes[box.row][box.col] = acceptedFacts.actorSeat;
      }
    }
  }

  closedBoxes.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

  const newScores: Record<Seat, number> = {
    ...state.scores,
    [acceptedFacts.actorSeat]: state.scores[acceptedFacts.actorSeat] + closedBoxes.length,
  };

  // 10. Check if all 40 edges are placed (terminal)
  if (newEdges.length >= 2 * size * (size - 1)) {
    let winner: Seat | null = null;
    let reason: "rules_win" | "rules_draw" = "rules_draw";

    if (newScores.A > newScores.B) {
      winner = "A";
      reason = "rules_win";
    } else if (newScores.B > newScores.A) {
      winner = "B";
      reason = "rules_win";
    }

    const terminalResult: TerminalResult = {
      winner,
      reason,
      scores: { ...newScores },
      finishedAt: acceptedFacts.serverTime,
    };

    const newState: DotsBoxesState = {
      gridSize: size,
      edges: newEdges,
      boxes: newBoxes,
      scores: newScores,
      activeSeat: state.activeSeat,
      status: "completed",
      winner,
      terminalResult,
    };

    const effects: DotsBoxesEffect[] = [
      {
        type: "edge-placed",
        seat: acceptedFacts.actorSeat,
        edge: canonical,
      },
    ];

    if (closedBoxes.length > 0) {
      effects.push({
        type: "boxes-claimed",
        seat: acceptedFacts.actorSeat,
        boxes: closedBoxes,
      });
    }

    if (winner !== null) {
      effects.push({
        type: "game-won",
        winner,
        scores: { ...newScores },
      });
    } else {
      effects.push({
        type: "game-drawn",
        scores: { ...newScores },
      });
    }

    return {
      success: true,
      newState,
      effects,
      terminalResult,
    };
  }

  // 11. Non-terminal move: turn retention if boxes closed, otherwise turn alternates
  if (closedBoxes.length > 0) {
    // Placer retains turn
    const newState: DotsBoxesState = {
      gridSize: size,
      edges: newEdges,
      boxes: newBoxes,
      scores: newScores,
      activeSeat: state.activeSeat,
      status: "active",
      winner: null,
    };

    const effects: DotsBoxesEffect[] = [
      {
        type: "edge-placed",
        seat: acceptedFacts.actorSeat,
        edge: canonical,
      },
      {
        type: "boxes-claimed",
        seat: acceptedFacts.actorSeat,
        boxes: closedBoxes,
      },
    ];

    return {
      success: true,
      newState,
      effects,
    };
  }

  // 0 boxes closed: turn alternates
  const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";
  const newState: DotsBoxesState = {
    gridSize: size,
    edges: newEdges,
    boxes: newBoxes,
    scores: newScores,
    activeSeat: nextSeat,
    status: "active",
    winner: null,
  };

  const effects: DotsBoxesEffect[] = [
    {
      type: "edge-placed",
      seat: acceptedFacts.actorSeat,
      edge: canonical,
    },
    {
      type: "turn-changed",
      fromSeat: state.activeSeat,
      toSeat: nextSeat,
    },
  ];

  return {
    success: true,
    newState,
    effects,
  };
}

/**
 * Returns legal actions for a seat.
 */
export function legalActions(state: DotsBoxesState, seat: Seat): ActionType[] {
  if (state.status === "completed" || isTerminal(state) !== null) {
    return [];
  }
  if (seat === state.activeSeat) {
    return ["dots-boxes.edge"];
  }
  return [];
}

/**
 * Filters state for client presentation. Full information game: all edges and boxes are public.
 */
export function toPublicView(state: DotsBoxesState, _viewer?: ViewerContext): DotsBoxesView {
  return {
    gridSize: gridSize(state.gridSize),
    edges: state.edges.map((e) => ({ ...e })),
    boxes: state.boxes.map((rowCells) => [...rowCells]),
    scores: { ...state.scores },
    activeSeat: state.activeSeat,
    status: state.status,
    winner: state.winner,
    ...(state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks whether the state is in a terminal condition.
 */
export function isTerminal(state: DotsBoxesState): TerminalResult | null {
  if (state.terminalResult) {
    return state.terminalResult;
  }
  if (state.status === "completed") {
    return {
      winner: state.winner,
      reason: state.winner ? "rules_win" : "rules_draw",
      scores: { ...state.scores },
      finishedAt: 0,
    };
  }
  return null;
}
