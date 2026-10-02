/**
 * Private Arcade V1 — Snakes & Ladders Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Snakes & Ladders.
 * 10x10 board, positions 0 (off-board) to 100 (win).
 * Exact arrival at 100 required; overshoot holds in place and passes turn.
 * Rolling a 6 grants NO bonus roll.
 * Single transition trigger on landing; shared occupancy allowed without captures.
 */

import { ActionType, Seat, TerminalResult, ViewerContext } from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import {
  boardMapFor,
  REFERENCE_BOARD_VERSION,
  SNAKES_AND_LADDERS_MAX_POSITION,
  SNAKES_AND_LADDERS_START_POSITION,
  SnakesAndLaddersEffect,
  SnakesAndLaddersState,
  SnakesAndLaddersView,
} from "./types";

/**
 * Creates the initial Snakes & Ladders state.
 */
export function createInitialState(startFacts: SuppliedStartFacts): SnakesAndLaddersState {
  return {
    boardVersion: REFERENCE_BOARD_VERSION,
    positions: {
      A: SNAKES_AND_LADDERS_START_POSITION,
      B: SNAKES_AND_LADDERS_START_POSITION,
    },
    activeSeat: startFacts.startingSeat ?? "A",
    status: "active",
    winner: null,
    lastRoll: null,
  };
}

/**
 * Maps a board position (1..100) to its [row, col] on a 10x10 grid (0-indexed from top-left).
 * Returns null if off-board (position 0).
 */
export function getBoardCoordinate(position: number): [number, number] | null {
  if (position < 1 || position > SNAKES_AND_LADDERS_MAX_POSITION) {
    return null;
  }
  const band = Math.floor((position - 1) / 10);
  const row = 9 - band;
  const col = band % 2 === 0 ? (position - 1) % 10 : 9 - ((position - 1) % 10);
  return [row, col];
}

/**
 * Pure validator and reducer for Snakes & Ladders actions.
 */
export function validateAndReduce(
  state: SnakesAndLaddersState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<SnakesAndLaddersState, SnakesAndLaddersEffect> {
  // 1. Guard against moves after match completion
  if (state.status === "completed" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  // 2. Action type validation
  if (action.action !== "dice.roll") {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        `Expected action 'dice.roll', got '${action.action}'`,
      ),
    };
  }

  // 3. Turn verification
  if (acceptedFacts.actorSeat !== state.activeSeat) {
    return {
      success: false,
      error: createError(
        ErrorCode.NOT_YOUR_TURN,
        `It is player ${state.activeSeat}'s turn, but player ${acceptedFacts.actorSeat} attempted to roll`,
      ),
    };
  }

  // 4. Validate dice roll fact
  const roll = acceptedFacts.randomValues?.[0];
  if (typeof roll !== "number" || !Number.isInteger(roll) || roll < 1 || roll > 6) {
    return {
      success: false,
      error: createError(
        ErrorCode.INVALID_ACTION,
        "Valid die roll fact (1-6) must be supplied in acceptedFacts.randomValues",
      ),
    };
  }

  const currentPos = state.positions[state.activeSeat];
  const targetPos = currentPos + roll;
  const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";

  // Branch 1: Overshoot (> 100) -> Stays in place and passes turn
  if (targetPos > SNAKES_AND_LADDERS_MAX_POSITION) {
    const newState: SnakesAndLaddersState = {
      ...state,
      activeSeat: nextSeat,
      lastRoll: roll,
    };
    const effects: SnakesAndLaddersEffect[] = [
      {
        type: "dice-rolled",
        seat: state.activeSeat,
        roll,
      },
      {
        type: "turn-changed",
        previousSeat: state.activeSeat,
        nextSeat,
      },
    ];
    return {
      success: true,
      newState,
      effects,
    };
  }

  // Branch 2: Exact finish (= 100) -> Game won immediately
  if (targetPos === SNAKES_AND_LADDERS_MAX_POSITION) {
    const newPositions = {
      ...state.positions,
      [state.activeSeat]: SNAKES_AND_LADDERS_MAX_POSITION,
    };
    const terminalResult: TerminalResult = {
      winner: state.activeSeat,
      reason: "rules_win",
      scores: {
        A: state.activeSeat === "A" ? 1 : 0,
        B: state.activeSeat === "B" ? 1 : 0,
      },
      finishedAt: acceptedFacts.serverTime,
    };
    const newState: SnakesAndLaddersState = {
      ...state,
      positions: newPositions,
      status: "completed",
      winner: state.activeSeat,
      lastRoll: roll,
      terminalResult,
    };
    const effects: SnakesAndLaddersEffect[] = [
      {
        type: "dice-rolled",
        seat: state.activeSeat,
        roll,
      },
      {
        type: "token-advanced",
        seat: state.activeSeat,
        from: currentPos,
        to: SNAKES_AND_LADDERS_MAX_POSITION,
      },
      {
        type: "game-won",
        winner: state.activeSeat,
      },
    ];
    return {
      success: true,
      newState,
      effects,
      terminalResult,
    };
  }

  // Branch 3: Advance within board (< 100)
  const effects: SnakesAndLaddersEffect[] = [
    {
      type: "dice-rolled",
      seat: state.activeSeat,
      roll,
    },
    {
      type: "token-advanced",
      seat: state.activeSeat,
      from: currentPos,
      to: targetPos,
    },
  ];

  let finalPos = targetPos;
  const { ladders, snakes } = boardMapFor(state.boardVersion);

  // Check for ladder
  if (targetPos in ladders) {
    const ladderDest = ladders[targetPos];
    effects.push({
      type: "ladder-climbed",
      seat: state.activeSeat,
      from: targetPos,
      to: ladderDest,
    });
    finalPos = ladderDest;
  } else if (targetPos in snakes) {
    // Check for snake
    const snakeDest = snakes[targetPos];
    effects.push({
      type: "snake-bitten",
      seat: state.activeSeat,
      from: targetPos,
      to: snakeDest,
    });
    finalPos = snakeDest;
  }

  // Turn always transfers to opponent; rolling a six gives NO bonus roll
  effects.push({
    type: "turn-changed",
    previousSeat: state.activeSeat,
    nextSeat,
  });

  const newPositions = {
    ...state.positions,
    [state.activeSeat]: finalPos,
  };

  const newState: SnakesAndLaddersState = {
    ...state,
    positions: newPositions,
    activeSeat: nextSeat,
    lastRoll: roll,
  };

  return {
    success: true,
    newState,
    effects,
  };
}

/**
 * Returns available legal action types for a seat.
 */
export function legalActions(state: SnakesAndLaddersState, seat: Seat): ActionType[] {
  if (state.status === "completed" || isTerminal(state) !== null) {
    return [];
  }
  if (seat === state.activeSeat) {
    return ["dice.roll"];
  }
  return [];
}

/**
 * Filters state for client presentation.
 */
export function toPublicView(
  state: SnakesAndLaddersState,
  _viewer?: ViewerContext,
): SnakesAndLaddersView {
  return {
    ...(state.boardVersion ? { boardVersion: state.boardVersion } : {}),
    positions: { ...state.positions },
    activeSeat: state.activeSeat,
    status: state.status,
    winner: state.winner,
    lastRoll: state.lastRoll,
    ...(state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks whether the state is in a terminal condition.
 */
export function isTerminal(state: SnakesAndLaddersState): TerminalResult | null {
  if (state.terminalResult) {
    return state.terminalResult;
  }
  if (state.status === "completed") {
    return {
      winner: state.winner,
      reason: "rules_win",
      scores: {
        A: state.winner === "A" ? 1 : 0,
        B: state.winner === "B" ? 1 : 0,
      },
      finishedAt: 0,
    };
  }
  return null;
}
