/**
 * Private Arcade V1 — Ludo Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Ludo.
 * 4 tokens per seat (IDs 0..3), 52-cell shared ring, safe squares,
 * lowest-ID capture on unsafe squares, third-consecutive-six ignored,
 * single bonus roll per turn, exact finish at home (progress 56).
 * Every legal roll is saved before the owner deliberately selects a pawn.
 */

import {
  ActionType,
  LudoMovePayload,
  Seat,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import {
  LUDO_HOME_COORDINATES,
  LUDO_HOME_PROGRESS,
  LUDO_RING_COORDINATES,
  LUDO_RING_SIZE,
  LUDO_SAFE_SQUARES_SET,
  LUDO_SHARED_TRACK_MAX,
  LUDO_START_SQUARES,
  LUDO_YARD_PROGRESS,
  LUDO_COLOUR_PALETTE,
  LUDO_DEFAULT_COLOURS,
  type LudoColourId,
  LudoEffect,
  LudoState,
  LudoTokensBySeat,
  LudoView,
} from "./types";

/**
 * Creates the initial Ludo state.
 */
export function createInitialState(startFacts: SuppliedStartFacts): LudoState {
  const requested = startFacts.config?.colours as Partial<Record<Seat, LudoColourId>> | undefined;
  const initialColours = { ...LUDO_DEFAULT_COLOURS };
  if (requested?.A && Object.prototype.hasOwnProperty.call(LUDO_COLOUR_PALETTE, requested.A))
    initialColours.A = requested.A;
  if (
    requested?.B &&
    Object.prototype.hasOwnProperty.call(LUDO_COLOUR_PALETTE, requested.B) &&
    requested.B !== initialColours.A
  )
    initialColours.B = requested.B;
  return {
    colours: initialColours,
    lastRollNotice: "none",
    tokens: {
      A: [-1, -1, -1, -1],
      B: [-1, -1, -1, -1],
    },
    activeSeat: startFacts.startingSeat ?? "A",
    phase: "roll",
    consecutiveSixes: 0,
    pendingRoll: null,
    legalTokenIds: [],
    status: "active",
    winner: null,
  };
}

/**
 * Returns the ring index (0..51) for a token on the shared track (progress 0..50),
 * or null if the token is in yard (-1) or private home lane (51..56).
 */
export function getRingIndex(seat: Seat, progress: number): number | null {
  if (progress < 0 || progress > LUDO_SHARED_TRACK_MAX) {
    return null;
  }
  return (LUDO_START_SQUARES[seat] + progress) % LUDO_RING_SIZE;
}

/**
 * Returns the 15x15 board coordinate [row, col] for a token, or null if in yard.
 */
export function getBoardCoordinate(seat: Seat, progress: number): [number, number] | null {
  if (progress < 0) {
    return null;
  }
  if (progress <= LUDO_SHARED_TRACK_MAX) {
    const ringIndex = (LUDO_START_SQUARES[seat] + progress) % LUDO_RING_SIZE;
    const coord = LUDO_RING_COORDINATES[ringIndex];
    return [coord[0], coord[1]];
  }
  if (progress <= LUDO_HOME_PROGRESS) {
    const homeIdx = progress - 51;
    const coord = LUDO_HOME_COORDINATES[seat][homeIdx];
    return [coord[0], coord[1]];
  }
  return null;
}

/**
 * Computes which token IDs (0..3) can legally move given a roll (1..6).
 */
export function getLegalMovesForRoll(
  tokens: readonly [number, number, number, number],
  roll: number,
): number[] {
  const legal: number[] = [];
  for (let id = 0; id < 4; id++) {
    const prog = tokens[id];
    if (prog === LUDO_YARD_PROGRESS) {
      if (roll === 6) {
        legal.push(id);
      }
    } else if (prog >= 0 && prog < LUDO_HOME_PROGRESS) {
      if (prog + roll <= LUDO_HOME_PROGRESS) {
        legal.push(id);
      }
    }
  }
  return legal;
}

interface ApplyMoveOutcome {
  newTokens: LudoTokensBySeat;
  effects: LudoEffect[];
  hasBonus: boolean;
  isWin: boolean;
  terminalResult?: TerminalResult;
}

/**
 * Pure helper to apply a token move, calculate captures, home arrivals, and win condition.
 */
function applyMove(
  tokens: LudoTokensBySeat,
  seat: Seat,
  tokenId: number,
  roll: number,
  serverTime: number,
): ApplyMoveOutcome {
  const fromProgress = tokens[seat][tokenId];
  const toProgress = fromProgress === LUDO_YARD_PROGRESS ? 0 : fromProgress + roll;

  const newTokens: LudoTokensBySeat = {
    A: [...tokens.A],
    B: [...tokens.B],
  };
  newTokens[seat][tokenId] = toProgress;

  const effects: LudoEffect[] = [
    {
      type: "token-moved",
      seat,
      tokenId,
      from: fromProgress,
      to: toProgress,
    },
  ];

  let captured = false;

  // Check capture on shared track unsafe squares
  if (toProgress >= 0 && toProgress <= LUDO_SHARED_TRACK_MAX) {
    const landingRingIndex = (LUDO_START_SQUARES[seat] + toProgress) % LUDO_RING_SIZE;
    if (!LUDO_SAFE_SQUARES_SET.has(landingRingIndex)) {
      const oppSeat: Seat = seat === "A" ? "B" : "A";
      const oppStart = LUDO_START_SQUARES[oppSeat];

      // Find all opposing tokens on this exact ring square
      const matchingOppIds: number[] = [];
      for (let oppId = 0; oppId < 4; oppId++) {
        const oppProg = newTokens[oppSeat][oppId];
        if (oppProg >= 0 && oppProg <= LUDO_SHARED_TRACK_MAX) {
          const oppRing = (oppStart + oppProg) % LUDO_RING_SIZE;
          if (oppRing === landingRingIndex) {
            matchingOppIds.push(oppId);
          }
        }
      }

      // Capture only the LOWEST-ID opposing token
      if (matchingOppIds.length > 0) {
        const lowestOppId = Math.min(...matchingOppIds);
        newTokens[oppSeat][lowestOppId] = LUDO_YARD_PROGRESS;
        captured = true;
        effects.push({
          type: "token-captured",
          bySeat: seat,
          byTokenId: tokenId,
          capturedSeat: oppSeat,
          capturedTokenId: lowestOppId,
          ringIndex: landingRingIndex,
        });
      }
    }
  }

  // Check reaching home
  let reachedHome = false;
  if (toProgress === LUDO_HOME_PROGRESS) {
    reachedHome = true;
    effects.push({
      type: "token-entered-home",
      seat,
      tokenId,
    });
  }

  // Check win condition: all 4 tokens finished at 56
  const isWin = newTokens[seat].every((p) => p === LUDO_HOME_PROGRESS);
  if (isWin) {
    effects.push({
      type: "game-won",
      winner: seat,
    });
    const terminalResult: TerminalResult = {
      winner: seat,
      reason: "rules_win",
      scores: {
        A: seat === "A" ? 1 : 0,
        B: seat === "B" ? 1 : 0,
      },
      finishedAt: serverTime,
    };
    return {
      newTokens,
      effects,
      hasBonus: false, // Winning move ends match immediately before any bonus
      isWin: true,
      terminalResult,
    };
  }

  // Bonus roll granted for: rolling six, capturing an opponent, or reaching home
  const hasBonus = roll === 6 || captured || reachedHome;

  return {
    newTokens,
    effects,
    hasBonus,
    isWin: false,
  };
}

/**
 * Pure validator and reducer for Ludo actions.
 */
export function validateAndReduce(
  state: LudoState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<LudoState, LudoEffect> {
  // 1. Guard against moves after match completion
  if (state.status === "completed" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  // Appearance is personal to the acting seat and is independent of the game turn.
  // Spreading the current state keeps tokens, pending selection and all outcome facts intact.
  if (action.action === "ludo.set-colour") {
    const colourId = (action.payload as { colourId?: unknown } | null)?.colourId;
    if (
      typeof colourId !== "string" ||
      !Object.prototype.hasOwnProperty.call(LUDO_COLOUR_PALETTE, colourId)
    ) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "Choose a curated Ludo colour"),
      };
    }
    const colours = { ...LUDO_DEFAULT_COLOURS, ...state.colours };
    const otherSeat: Seat = acceptedFacts.actorSeat === "A" ? "B" : "A";
    const tooSimilar: Record<string, string> = {
      blue: "cyan",
      cyan: "blue",
      red: "pink",
      pink: "red",
      yellow: "orange",
      orange: "yellow",
    };
    if (colourId === colours[otherSeat] || tooSimilar[colourId] === colours[otherSeat]) {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          "Choose a colour distinct from the other player's colour",
        ),
      };
    }
    const chosen = colourId as LudoColourId;
    return {
      success: true,
      newState: { ...state, colours: { ...colours, [acceptedFacts.actorSeat]: chosen } },
      effects: [{ type: "colour-changed", seat: acceptedFacts.actorSeat, colourId: chosen }],
    };
  }

  // 2. Turn verification
  if (acceptedFacts.actorSeat !== state.activeSeat) {
    return {
      success: false,
      error: createError(
        ErrorCode.NOT_YOUR_TURN,
        `It is player ${state.activeSeat}'s turn, but player ${acceptedFacts.actorSeat} attempted to act`,
      ),
    };
  }

  // 3. Action handling
  if (action.action === "dice.roll") {
    if (state.phase !== "roll") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot roll dice in '${state.phase}' phase; pending move required`,
        ),
      };
    }

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

    // Check third consecutive six: ignored and grants another roll until 1-5 appears.
    // Capped streak at 2.
    if (roll === 6 && state.consecutiveSixes >= 2) {
      const newState: LudoState = {
        ...state,
        phase: "roll",
        lastRollNotice: "ignored-six",
        consecutiveSixes: 2,
        pendingRoll: null,
        legalTokenIds: [],
      };
      return {
        success: true,
        newState,
        effects: [
          {
            type: "dice-rolled",
            seat: state.activeSeat,
            roll: 6,
            ignored: true,
          },
        ],
      };
    }

    const nextStreak = roll === 6 ? state.consecutiveSixes + 1 : 0;
    const legalTokenIds = getLegalMovesForRoll(state.tokens[state.activeSeat], roll);

    // Branch A: No legal moves
    if (legalTokenIds.length === 0) {
      if (roll === 6) {
        // Roll of 6 with no legal moves grants another roll
        const newState: LudoState = {
          ...state,
          phase: "roll",
          lastRollNotice: "no-legal-move",
          consecutiveSixes: nextStreak,
          pendingRoll: null,
          legalTokenIds: [],
        };
        return {
          success: true,
          newState,
          effects: [
            {
              type: "dice-rolled",
              seat: state.activeSeat,
              roll,
            },
          ],
        };
      } else {
        // Non-six with no legal moves passes the turn
        const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";
        const newState: LudoState = {
          ...state,
          activeSeat: nextSeat,
          lastRollNotice: "no-legal-move",
          phase: "roll",
          consecutiveSixes: 0,
          pendingRoll: null,
          legalTokenIds: [],
        };
        return {
          success: true,
          newState,
          effects: [
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
          ],
        };
      }
    }

    // Every legal roll waits for a deliberate token selection, including one legal token.
    const newState: LudoState = {
      ...state,
      phase: "choose-token",
      lastRollNotice: "none",
      consecutiveSixes: nextStreak,
      pendingRoll: roll,
      legalTokenIds,
    };
    return {
      success: true,
      newState,
      effects: [
        {
          type: "dice-rolled",
          seat: state.activeSeat,
          roll,
        },
      ],
    };
  }

  if (action.action === "ludo.move") {
    if (state.phase !== "choose-token") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot move token during '${state.phase}' phase`,
        ),
      };
    }

    const payload = action.payload as LudoMovePayload | undefined;
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.tokenId !== "number" ||
      !Number.isInteger(payload.tokenId) ||
      payload.tokenId < 0 ||
      payload.tokenId > 3
    ) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "Payload tokenId must be an integer (0..3)"),
      };
    }

    if (!state.legalTokenIds.includes(payload.tokenId)) {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Token ${payload.tokenId} is not a legal move for pending roll ${state.pendingRoll}`,
        ),
      };
    }

    const roll = state.pendingRoll!;
    const outcome = applyMove(
      state.tokens,
      state.activeSeat,
      payload.tokenId,
      roll,
      acceptedFacts.serverTime,
    );

    const effects: LudoEffect[] = [...outcome.effects];

    if (outcome.isWin) {
      const newState: LudoState = {
        ...state,
        tokens: outcome.newTokens,
        lastRollNotice: "none",
        status: "completed",
        phase: "completed",
        winner: state.activeSeat,
        pendingRoll: null,
        legalTokenIds: [],
        terminalResult: outcome.terminalResult,
      };
      return {
        success: true,
        newState,
        effects,
        terminalResult: outcome.terminalResult,
      };
    }

    if (outcome.hasBonus) {
      const newState: LudoState = {
        ...state,
        tokens: outcome.newTokens,
        lastRollNotice: "none",
        phase: "roll",
        consecutiveSixes: state.consecutiveSixes,
        pendingRoll: null,
        legalTokenIds: [],
      };
      return {
        success: true,
        newState,
        effects,
      };
    } else {
      const nextSeat: Seat = state.activeSeat === "A" ? "B" : "A";
      effects.push({
        type: "turn-changed",
        previousSeat: state.activeSeat,
        nextSeat,
      });
      const newState: LudoState = {
        ...state,
        tokens: outcome.newTokens,
        lastRollNotice: "none",
        activeSeat: nextSeat,
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
      };
      return {
        success: true,
        newState,
        effects,
      };
    }
  }

  return {
    success: false,
    error: createError(
      ErrorCode.INVALID_ACTION,
      `Unexpected action '${action.action}' for Ludo engine`,
    ),
  };
}

/**
 * Returns legal action types for a seat.
 */
export function legalActions(state: LudoState, seat: Seat): ActionType[] {
  if (state.status === "completed" || isTerminal(state) !== null) {
    return [];
  }
  const appearanceAction: ActionType = "ludo.set-colour";
  if (seat !== state.activeSeat) return [appearanceAction];
  if (state.phase === "roll") {
    return ["dice.roll", appearanceAction];
  }
  if (state.phase === "choose-token") {
    return ["ludo.move", appearanceAction];
  }
  return [];
}

/**
 * Produces a public view of the Ludo state.
 */
export function toPublicView(state: LudoState, _viewer?: ViewerContext): LudoView {
  return {
    colours: { ...LUDO_DEFAULT_COLOURS, ...state.colours },
    lastRollNotice: state.lastRollNotice ?? "none",
    tokens: {
      A: [...state.tokens.A],
      B: [...state.tokens.B],
    },
    activeSeat: state.activeSeat,
    phase: state.phase,
    consecutiveSixes: state.consecutiveSixes,
    pendingRoll: state.pendingRoll,
    legalTokenIds: [...state.legalTokenIds],
    status: state.status,
    winner: state.winner,
    ...(state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks whether the state is in a terminal condition.
 */
export function isTerminal(state: LudoState): TerminalResult | null {
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
