/**
 * Private Arcade V1 — SOS Game Engine
 *
 * Server-authoritative, deterministic pure reducer for SOS.
 * 5x5 grid (25 cells) general scoring variant.
 */

import {
  ActionType,
  Seat,
  SOSPlacePayload,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import { SOSCell, SOSLetter, SOSLine, SOSState, SOSView, SOSEffect, gridSize } from "./types";

/**
 * Canonicalizes line endpoints such that (r1, c1) < (r2, c2).
 */
export function canonicalizeLineEndpoints(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): { from: [number, number]; to: [number, number]; id: string } {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) {
    return {
      from: [r1, c1],
      to: [r2, c2],
      id: `${r1},${c1}-${r2},${c2}`,
    };
  }
  return {
    from: [r2, c2],
    to: [r1, c1],
    id: `${r2},${c2}-${r1},${c1}`,
  };
}

/**
 * Detects all new contiguous 3-cell S-O-S lines containing the newly placed letter.
 */
export function detectNewLines(
  board: SOSCell[][],
  row: number,
  col: number,
  letter: SOSLetter,
  claimedBy: Seat,
): SOSLine[] {
  const size = board.length;
  const linesMap = new Map<string, SOSLine>();

  if (letter === "O") {
    // 'O' is the center of an S-O-S line: S at (row - dr, col - dc), S at (row + dr, col + dc)
    const axes: [number, number][] = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal-down
      [-1, 1], // diagonal-up
    ];

    for (const [dr, dc] of axes) {
      const r1 = row - dr;
      const c1 = col - dc;
      const r2 = row + dr;
      const c2 = col + dc;

      if (
        r1 >= 0 &&
        r1 < size &&
        c1 >= 0 &&
        c1 < size &&
        r2 >= 0 &&
        r2 < size &&
        c2 >= 0 &&
        c2 < size
      ) {
        if (board[r1][c1] === "S" && board[r2][c2] === "S") {
          const canonical = canonicalizeLineEndpoints(r1, c1, r2, c2);
          if (!linesMap.has(canonical.id)) {
            linesMap.set(canonical.id, {
              id: canonical.id,
              from: canonical.from,
              to: canonical.to,
              claimedBy,
            });
          }
        }
      }
    }
  } else {
    // letter === "S": 'S' is an endpoint of an S-O-S line
    // Center is 'O' at (row + dr, col + dc), other endpoint is 'S' at (row + 2*dr, col + 2*dc)
    const stepDirections: [number, number][] = [
      [0, 1], // right
      [0, -1], // left
      [1, 0], // down
      [-1, 0], // up
      [1, 1], // down-right
      [-1, -1], // up-left
      [-1, 1], // up-right
      [1, -1], // down-left
    ];

    for (const [dr, dc] of stepDirections) {
      const rMid = row + dr;
      const cMid = col + dc;
      const rEnd = row + 2 * dr;
      const cEnd = col + 2 * dc;

      if (
        rMid >= 0 &&
        rMid < size &&
        cMid >= 0 &&
        cMid < size &&
        rEnd >= 0 &&
        rEnd < size &&
        cEnd >= 0 &&
        cEnd < size
      ) {
        if (board[rMid][cMid] === "O" && board[rEnd][cEnd] === "S") {
          const canonical = canonicalizeLineEndpoints(row, col, rEnd, cEnd);
          if (!linesMap.has(canonical.id)) {
            linesMap.set(canonical.id, {
              id: canonical.id,
              from: canonical.from,
              to: canonical.to,
              claimedBy,
            });
          }
        }
      }
    }
  }

  const result = Array.from(linesMap.values());
  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

/**
 * Creates the initial SOS state.
 */
export function createInitialState(startFacts: SuppliedStartFacts): SOSState {
  const size = gridSize(startFacts.config?.gridSize);
  const board: SOSCell[][] = Array.from({ length: size }, () => Array<SOSCell>(size).fill(null));

  return {
    gridSize: size,
    board,
    lines: [],
    scores: { A: 0, B: 0 },
    activeSeat: startFacts.startingSeat ?? "A",
    status: "active",
    winner: null,
  };
}

/**
 * Pure validator and reducer for SOS moves.
 */
export function validateAndReduce(
  state: SOSState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<SOSState, SOSEffect> {
  const size = gridSize(state.gridSize);
  // 1. Guard against moves after match completion
  if (state.status === "completed" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  // 2. Validate action type
  if (action.action !== "sos.place") {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Expected action 'sos.place', got '${action.action}'`,
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
  const payload = action.payload as SOSPlacePayload | undefined;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.row !== "number" ||
    typeof payload.col !== "number" ||
    !Number.isInteger(payload.row) ||
    !Number.isInteger(payload.col) ||
    (payload.letter !== "S" && payload.letter !== "O")
  ) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        "Payload must include integer row, integer col, and letter 'S' or 'O'",
      ),
    };
  }

  const { row, col, letter } = payload;

  // 5. Bounds check
  if (row < 0 || row >= size || col < 0 || col >= size) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Cell coordinates must be within 0..${size - 1} on a ${size}x${size} board`,
      ),
    };
  }

  // 6. Cell occupancy check
  if (state.board[row][col] !== null) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, `Cell (${row}, ${col}) is already occupied`),
    };
  }

  // 7. Place letter
  const newBoard: SOSCell[][] = state.board.map((r) => [...r]);
  newBoard[row][col] = letter;

  // 8. Detect new S-O-S lines
  const newLines = detectNewLines(newBoard, row, col, letter, acceptedFacts.actorSeat);
  const updatedLines = [...state.lines, ...newLines];

  const newScores: Record<Seat, number> = {
    ...state.scores,
    [acceptedFacts.actorSeat]: state.scores[acceptedFacts.actorSeat] + newLines.length,
  };

  // 9. Count occupied cells
  let occupiedCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (newBoard[r][c] !== null) {
        occupiedCount++;
      }
    }
  }

  // 10. Check terminal condition (all 25 cells occupied)
  if (occupiedCount >= size * size) {
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

    const newState: SOSState = {
      gridSize: size,
      board: newBoard,
      lines: updatedLines,
      scores: newScores,
      activeSeat: state.activeSeat,
      status: "completed",
      winner,
      terminalResult,
    };

    const effects: SOSEffect[] = [
      {
        type: "letter-placed",
        seat: acceptedFacts.actorSeat,
        row,
        col,
        letter,
      },
    ];

    if (newLines.length > 0) {
      effects.push({
        type: "lines-formed",
        seat: acceptedFacts.actorSeat,
        lines: newLines,
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

  // 11. Non-terminal move: turn retention if at least 1 line formed
  if (newLines.length > 0) {
    const newState: SOSState = {
      gridSize: size,
      board: newBoard,
      lines: updatedLines,
      scores: newScores,
      activeSeat: state.activeSeat,
      status: "active",
      winner: null,
    };

    const effects: SOSEffect[] = [
      {
        type: "letter-placed",
        seat: acceptedFacts.actorSeat,
        row,
        col,
        letter,
      },
      {
        type: "lines-formed",
        seat: acceptedFacts.actorSeat,
        lines: newLines,
      },
    ];

    return {
      success: true,
      newState,
      effects,
    };
  }

  // 0 lines formed: turn alternates
  const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";
  const newState: SOSState = {
    gridSize: size,
    board: newBoard,
    lines: updatedLines,
    scores: newScores,
    activeSeat: nextSeat,
    status: "active",
    winner: null,
  };

  const effects: SOSEffect[] = [
    {
      type: "letter-placed",
      seat: acceptedFacts.actorSeat,
      row,
      col,
      letter,
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
export function legalActions(state: SOSState, seat: Seat): ActionType[] {
  if (state.status === "completed" || isTerminal(state) !== null) {
    return [];
  }
  if (seat === state.activeSeat) {
    return ["sos.place"];
  }
  return [];
}

/**
 * Filters state for client presentation. Full information game: all cells and lines are public.
 */
export function toPublicView(state: SOSState, _viewer?: ViewerContext): SOSView {
  return {
    gridSize: gridSize(state.gridSize),
    board: state.board.map((r) => [...r]),
    lines: state.lines.map((l) => ({ ...l, from: [...l.from], to: [...l.to] })),
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
export function isTerminal(state: SOSState): TerminalResult | null {
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
