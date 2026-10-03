/**
 * ArcadeO V1 — Rock Paper Scissors Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Rock Paper Scissors.
 *
 * Rules Summary:
 * - Best of 3 (target 2 wins), best of 5 (target 3 wins), or best of 7 (target 4 wins).
 * - Rock beats scissors, scissors beats paper, paper beats rock. Equal choices draw.
 * - Draws score neither player and round still completes.
 * - Private locks per seat in 'locking' phase.
 * - When both lock: resolves round, increments winner score (if not draw).
 * - If targetWins reached: phase -> 'terminal', terminalResult created, 'game-won' effect.
 * - Else: phase -> 'resolved', 'round-resolved' effect.
 * - In together mode: reveal step sets revealed = true. In remote mode, revealed is immediately true.
 * - Next round advances on readiness: in remote, both A and B must confirm 'secret.next'; in together, one confirm advances.
 */

import {
  ActionType,
  RPSChoice,
  Seat,
  SecretLockPayload,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import { RPSEffect, RPSFormat, RPSRoundResult, RPSState, RPSView } from "./types";

const VALID_CHOICES: ReadonlySet<string> = new Set<RPSChoice>(["rock", "paper", "scissors"]);

/**
 * Determines the outcome of an RPS matchup between Seat A and Seat B.
 * Returns the winning seat ('A' | 'B') or 'draw'.
 */
export function evaluateRPS(choiceA: RPSChoice, choiceB: RPSChoice): Seat | "draw" {
  if (choiceA === choiceB) {
    return "draw";
  }
  if (
    (choiceA === "rock" && choiceB === "scissors") ||
    (choiceA === "scissors" && choiceB === "paper") ||
    (choiceA === "paper" && choiceB === "rock")
  ) {
    return "A";
  }
  return "B";
}

/**
 * Parses target wins from format option or config. Defaults to best-of-3 (target 2).
 */
export function resolveTargetWins(format?: unknown): 2 | 3 | 4 {
  if (format === "best-of-5") return 3;
  if (format === "best-of-7") return 4;
  return 2;
}

/**
 * Creates initial RPS state.
 */
export function createInitialState(startFacts: SuppliedStartFacts): RPSState {
  const format = startFacts.config?.format as RPSFormat | undefined;
  const targetWins = resolveTargetWins(format);

  return {
    mode: startFacts.config?.mode === "together" ? "together" : "remote",
    targetWins,
    scores: { A: 0, B: 0 },
    roundId: 1,
    phase: "locking",
    secretChoices: {},
    lockedSeats: [],
    roundResult: null,
    revealed: false,
    readiness: { A: false, B: false },
  };
}

/**
 * Pure validator and state reducer for Rock Paper Scissors.
 */
export function validateAndReduce(
  state: RPSState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<RPSState, RPSEffect> {
  if (
    action.action === "secret.reveal" &&
    state.mode === "together" &&
    !state.revealed &&
    state.phase === "terminal"
  ) {
    return {
      success: true,
      newState: { ...state, revealed: true },
      effects: [],
      terminalResult: state.terminalResult,
    };
  }
  // 1. Guard against any moves if already terminal
  if (state.phase === "terminal" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  const { actorSeat, serverTime } = acceptedFacts;

  // 2. Action: secret.lock
  if (action.action === "secret.lock") {
    if (state.phase !== "locking") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot lock choice during '${state.phase}' phase`,
        ),
      };
    }

    if (state.lockedSeats.includes(actorSeat)) {
      return {
        success: false,
        error: createError(
          ErrorCode.CHOICE_LOCKED,
          `Seat ${actorSeat} has already locked a choice for round ${state.roundId}`,
        ),
      };
    }

    const payload = action.payload as SecretLockPayload | undefined;
    const choice = payload?.choice;
    if (!choice || !VALID_CHOICES.has(choice)) {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          "Choice must be 'rock', 'paper', or 'scissors'",
        ),
      };
    }

    // Record the secret choice and update lockedSeats
    const newSecretChoices = {
      ...state.secretChoices,
      [actorSeat]: choice,
    };
    const newLockedSeats: Seat[] = [...state.lockedSeats, actorSeat];

    // Check if both players have now locked
    const bothLocked = newSecretChoices.A !== undefined && newSecretChoices.B !== undefined;

    if (!bothLocked) {
      const newState: RPSState = {
        ...state,
        secretChoices: newSecretChoices,
        lockedSeats: newLockedSeats,
      };

      const effects: RPSEffect[] = [
        {
          type: "secret-locked",
          seat: actorSeat,
          roundId: state.roundId,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    // Both seats have locked: evaluate round outcome
    const choiceA = newSecretChoices.A as RPSChoice;
    const choiceB = newSecretChoices.B as RPSChoice;
    const roundWinner = evaluateRPS(choiceA, choiceB);

    const newScores: Record<Seat, number> = {
      A: roundWinner === "A" ? state.scores.A + 1 : state.scores.A,
      B: roundWinner === "B" ? state.scores.B + 1 : state.scores.B,
    };

    const roundResult: RPSRoundResult = {
      roundId: state.roundId,
      choices: { A: choiceA, B: choiceB },
      winner: roundWinner,
    };

    // Check if any player has reached targetWins
    const matchWinner: Seat | null =
      newScores.A >= state.targetWins ? "A" : newScores.B >= state.targetWins ? "B" : null;

    if (matchWinner !== null) {
      const terminalResult: TerminalResult = {
        winner: matchWinner,
        reason: "rules_win",
        scores: newScores,
        finishedAt: serverTime,
      };

      const newState: RPSState = {
        ...state,
        scores: newScores,
        phase: "terminal",
        secretChoices: newSecretChoices,
        lockedSeats: newLockedSeats,
        roundResult,
        revealed: state.mode !== "together",
        readiness: { A: false, B: false },
        terminalResult,
      };

      const effects: RPSEffect[] = [
        {
          type: "secret-locked",
          seat: actorSeat,
          roundId: state.roundId,
        },
        {
          type: "round-resolved",
          roundId: state.roundId,
          winner: roundWinner,
          scores: newScores,
        },
        {
          type: "game-won",
          winner: matchWinner,
          scores: newScores,
        },
      ];

      return {
        success: true,
        newState,
        effects,
        terminalResult: state.mode === "together" ? undefined : terminalResult,
      };
    }

    // Match continues: transition to 'resolved' phase
    const newState: RPSState = {
      ...state,
      scores: newScores,
      phase: "resolved",
      secretChoices: newSecretChoices,
      lockedSeats: newLockedSeats,
      roundResult,
      revealed: false, // In together mode, unrevealed until reveal action; in remote, toPublicView shows resolved round
      readiness: { A: false, B: false },
    };

    const effects: RPSEffect[] = [
      {
        type: "secret-locked",
        seat: actorSeat,
        roundId: state.roundId,
      },
      {
        type: "round-resolved",
        roundId: state.roundId,
        winner: roundWinner,
        scores: newScores,
      },
    ];

    return {
      success: true,
      newState,
      effects,
    };
  }

  // 3. Action: secret.reveal (together mode)
  if (action.action === "secret.reveal") {
    if (state.phase !== "resolved") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot reveal choices in '${state.phase}' phase`,
        ),
      };
    }

    if (state.revealed) {
      // Harmless repeat or already revealed
      return {
        success: true,
        newState: state,
        effects: [],
      };
    }

    const newState: RPSState = {
      ...state,
      revealed: true,
    };

    return {
      success: true,
      newState,
      effects: [],
    };
  }

  // 4. Action: secret.next
  if (action.action === "secret.next") {
    if (state.phase !== "resolved") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot advance round in '${state.phase}' phase`,
        ),
      };
    }

    if (state.mode === "together" && !state.revealed)
      return { success: false, error: createError(ErrorCode.INVALID_ACTION, "Reveal before Next") };
    // Create updated readiness
    const newReadiness: Record<Seat, boolean> = { ...state.readiness };

    // In together mode, or if already revealed, advancing can mark the actor ready
    newReadiness[actorSeat] = true;
    if (state.mode === "together") {
      newReadiness.A = true;
      newReadiness.B = true;
    }

    // If both seats are ready, reset for the next round
    const bothReady = newReadiness.A && newReadiness.B;

    if (bothReady) {
      const newState: RPSState = {
        ...state,
        roundId: state.roundId + 1,
        phase: "locking",
        secretChoices: {},
        lockedSeats: [],
        roundResult: null,
        revealed: false,
        readiness: { A: false, B: false },
      };

      return {
        success: true,
        newState,
        effects: [],
      };
    }

    const newState: RPSState = {
      ...state,
      readiness: newReadiness,
    };

    return {
      success: true,
      newState,
      effects: [],
    };
  }

  // 5. Unrecognized action
  return {
    success: false,
    error: createError(
      ErrorCode.INVALID_ACTION,
      `Unrecognized action '${action.action}' for Rock Paper Scissors`,
    ),
  };
}

/**
 * Returns legal actions for a seat given the current RPS state.
 */
export function legalActions(
  state: RPSState,
  seat: Seat,
  mode?: "remote" | "together",
): ActionType[] {
  mode = mode ?? state.mode;
  if (state.phase === "terminal" && mode === "together" && !state.revealed)
    return ["secret.reveal"];
  if (state.phase === "terminal" || state.terminalResult !== undefined) {
    return [];
  }

  if (state.phase === "locking") {
    if (!state.lockedSeats.includes(seat)) {
      return ["secret.lock"];
    }
    return [];
  }

  if (state.phase === "resolved") {
    if (mode === "together") {
      if (!state.revealed) {
        return ["secret.reveal"];
      }
      return ["secret.next"];
    }

    // In remote mode (or default):
    if (!state.readiness[seat]) {
      return ["secret.next"];
    }
    return [];
  }

  return [];
}

/**
 * Converts RPSState to RPSView with complete privacy protection:
 * - While in 'locking' phase: secretChoices are NEVER exposed in any way; only `lockedSeats` is visible.
 * - In 'resolved' phase:
 *   - In together mode: roundResult choices/winner are hidden until `revealed === true`.
 *   - In remote mode: roundResult is visible to both once resolved.
 * - In 'terminal' phase: roundResult and terminalResult are visible.
 */
export function toPublicView(state: RPSState, viewer?: ViewerContext): RPSView {
  const isTogether = viewer?.mode === "together";

  // Hide roundResult in together mode until explicitly revealed
  const shouldHideRoundResult =
    state.phase === "locking" || (isTogether && !state.revealed && state.roundResult !== null);

  return {
    targetWins: state.targetWins,
    scores:
      shouldHideRoundResult && state.roundResult
        ? {
            A: state.scores.A - (state.roundResult.winner === "A" ? 1 : 0),
            B: state.scores.B - (state.roundResult.winner === "B" ? 1 : 0),
          }
        : { ...state.scores },
    roundId: state.roundId,
    phase: state.phase === "terminal" && isTogether && !state.revealed ? "resolved" : state.phase,
    lockedSeats: [...state.lockedSeats],
    roundResult: shouldHideRoundResult ? null : state.roundResult ? { ...state.roundResult } : null,
    revealed: state.revealed,
    readiness: { ...state.readiness },
    ...(!shouldHideRoundResult && state.terminalResult
      ? { terminalResult: { ...state.terminalResult } }
      : {}),
  };
}

/**
 * Returns terminal result if game is terminal, null otherwise.
 */
export function isTerminal(state: RPSState): TerminalResult | null {
  if (state.mode === "together" && !state.revealed) return null;
  if (state.terminalResult) {
    return state.terminalResult;
  }
  if (state.phase === "terminal") {
    const winner: Seat | null =
      state.scores.A > state.scores.B ? "A" : state.scores.B > state.scores.A ? "B" : null;
    return {
      winner,
      reason: "rules_win",
      scores: { ...state.scores },
      finishedAt: 0,
    };
  }
  return null;
}
