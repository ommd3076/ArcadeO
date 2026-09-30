/**
 * Private Arcade V1 — Connect Four Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Connect Four.
 * 7 columns x 6 rows board with gravity.
 *
 * Reference notice: Connect Four geometry and win logic inspired by
 * @devshareacademy/connect-four (MIT License, Copyright (c) 2023 Dev Share Academy).
 * Implemented as a pure immutable reducer conforming to Private Arcade V1 protocol.
 */

import {
  ActionType,
  ConnectFourDropPayload,
  Seat,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import {
  CONNECT_FOUR_COLS,
  CONNECT_FOUR_ROWS,
  ConnectFourCell,
  ConnectFourCoordinate,
  ConnectFourEffect,
  ConnectFourState,
  ConnectFourView,
} from "./types";

const DIRECTIONS: [number, number][] = [
  [0, 1], // Horizontal: left-to-right
  [1, 0], // Vertical: top-to-bottom
  [-1, 1], // Diagonal-up: bottom-left to top-right
  [1, 1], // Diagonal-down: top-left to bottom-right
];

/**
 * Creates the initial Connect Four state from supplied facts.
 */
export function createInitialState(startFacts: SuppliedStartFacts): ConnectFourState {
  const board: ConnectFourCell[][] = Array.from({ length: CONNECT_FOUR_ROWS }, () =>
    Array<ConnectFourCell>(CONNECT_FOUR_COLS).fill(null),
  );

  return {
    board,
    activeSeat: startFacts.startingSeat ?? "A",
    status: "active",
    winner: null,
    winningCells: [],
  };
}

/**
 * Checks if the disc placed at (row, col) creates a 4-in-a-row in any direction.
 * Returns the 4 winning coordinates if found, or null.
 */
export function checkWin(
  board: ConnectFourCell[][],
  row: number,
  col: number,
  seat: Seat,
): ConnectFourCoordinate[] | null {
  for (const [dr, dc] of DIRECTIONS) {
    // Walk backwards along the line to find the start of the contiguous sequence
    let r = row - dr;
    let c = col - dc;
    while (
      r >= 0 &&
      r < CONNECT_FOUR_ROWS &&
      c >= 0 &&
      c < CONNECT_FOUR_COLS &&
      board[r][c] === seat
    ) {
      r -= dr;
      c -= dc;
    }

    const startR = r + dr;
    const startC = c + dc;

    // Walk forwards counting consecutive discs
    const cells: ConnectFourCoordinate[] = [];
    let currR = startR;
    let currC = startC;
    while (
      currR >= 0 &&
      currR < CONNECT_FOUR_ROWS &&
      currC >= 0 &&
      currC < CONNECT_FOUR_COLS &&
      board[currR][currC] === seat
    ) {
      cells.push([currR, currC]);
      currR += dr;
      currC += dc;
    }

    if (cells.length >= 4) {
      return cells.slice(0, 4);
    }
  }

  return null;
}

/**
 * Pure validator and state reducer for Connect Four moves.
 */
export function validateAndReduce(
  state: ConnectFourState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<ConnectFourState, ConnectFourEffect> {
  // 1. Guard against moves after match completion
  if (state.status === "completed" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  // 2. Validate action type
  if (action.action !== "connect-four.drop") {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Expected action 'connect-four.drop', got '${action.action}'`,
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

  // 4. Validate column payload
  const payload = action.payload as ConnectFourDropPayload | undefined;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.column !== "number" ||
    !Number.isInteger(payload.column) ||
    payload.column < 0 ||
    payload.column >= CONNECT_FOUR_COLS
  ) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, "Column must be an integer between 0 and 6"),
    };
  }

  const col = payload.column;

  // 5. Check if column is already full (top cell row 0 is occupied)
  if (state.board[0][col] !== null) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, `Column ${col} is already full`),
    };
  }

  // 6. Apply gravity: find lowest unoccupied row
  let targetRow = -1;
  for (let r = CONNECT_FOUR_ROWS - 1; r >= 0; r--) {
    if (state.board[r][col] === null) {
      targetRow = r;
      break;
    }
  }

  if (targetRow === -1) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, `Column ${col} has no available space`),
    };
  }

  // 7. Immutably clone board and place disc
  const newBoard: ConnectFourCell[][] = state.board.map((rowCells) => [...rowCells]);
  newBoard[targetRow][col] = acceptedFacts.actorSeat;

  // 8. Check for 4-in-a-row win
  const winningCells = checkWin(newBoard, targetRow, col, acceptedFacts.actorSeat);
  if (winningCells !== null) {
    const terminalResult: TerminalResult = {
      winner: acceptedFacts.actorSeat,
      reason: "rules_win",
      scores: {
        A: acceptedFacts.actorSeat === "A" ? 1 : 0,
        B: acceptedFacts.actorSeat === "B" ? 1 : 0,
      },
      finishedAt: acceptedFacts.serverTime,
    };

    const newState: ConnectFourState = {
      board: newBoard,
      activeSeat: state.activeSeat,
      status: "completed",
      winner: acceptedFacts.actorSeat,
      winningCells,
      terminalResult,
    };

    const effects: ConnectFourEffect[] = [
      {
        type: "disc-dropped",
        seat: acceptedFacts.actorSeat,
        row: targetRow,
        col,
        column: col,
      },
      {
        type: "game-won",
        winner: acceptedFacts.actorSeat,
        winningCells,
      },
    ];

    return {
      success: true,
      newState,
      effects,
      terminalResult,
    };
  }

  // 9. Check for full board draw (evaluated only if no winning move)
  const isBoardFull = newBoard[0].every((cell) => cell !== null);
  if (isBoardFull) {
    const terminalResult: TerminalResult = {
      winner: null,
      reason: "rules_draw",
      scores: {
        A: 0,
        B: 0,
      },
      finishedAt: acceptedFacts.serverTime,
    };

    const newState: ConnectFourState = {
      board: newBoard,
      activeSeat: state.activeSeat,
      status: "completed",
      winner: null,
      winningCells: [],
      terminalResult,
    };

    const effects: ConnectFourEffect[] = [
      {
        type: "disc-dropped",
        seat: acceptedFacts.actorSeat,
        row: targetRow,
        col,
        column: col,
      },
      {
        type: "game-drawn",
      },
    ];

    return {
      success: true,
      newState,
      effects,
      terminalResult,
    };
  }

  // 10. Normal non-terminal move: toggle turn to opponent
  const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";
  const newState: ConnectFourState = {
    board: newBoard,
    activeSeat: nextSeat,
    status: "active",
    winner: null,
    winningCells: [],
  };

  const effects: ConnectFourEffect[] = [
    {
      type: "disc-dropped",
      seat: acceptedFacts.actorSeat,
      row: targetRow,
      col,
      column: col,
    },
  ];

  return {
    success: true,
    newState,
    effects,
  };
}

/**
 * Returns available legal actions for a seat.
 */
export function legalActions(state: ConnectFourState, seat: Seat): ActionType[] {
  if (state.status === "completed" || isTerminal(state) !== null) {
    return [];
  }
  if (seat === state.activeSeat) {
    return ["connect-four.drop"];
  }
  return [];
}

/**
 * Filters state for client presentation. All Connect Four discs are public.
 */
export function toPublicView(state: ConnectFourState, _viewer?: ViewerContext): ConnectFourView {
  return {
    board: state.board.map((rowCells) => [...rowCells]),
    activeSeat: state.activeSeat,
    status: state.status,
    winner: state.winner,
    winningCells: state.winningCells.map(([r, c]) => [r, c]),
    ...(state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks whether the state is in a terminal condition.
 */
export function isTerminal(state: ConnectFourState): TerminalResult | null {
  if (state.terminalResult) {
    return state.terminalResult;
  }
  if (state.status === "completed") {
    return {
      winner: state.winner,
      reason: state.winner ? "rules_win" : "rules_draw",
      scores: {
        A: state.winner === "A" ? 1 : 0,
        B: state.winner === "B" ? 1 : 0,
      },
      finishedAt: 0,
    };
  }
  return null;
}
