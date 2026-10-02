/**
 * Private Arcade V1 — Hand Cricket Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Hand Cricket.
 *
 * - Current choices 1..10; legacy version 1 uses 1..6. No ball limit.
 * - Saved toss winner chooses Bat or Bowl. Different numbers add the batter's
 *   number; matching numbers score zero and dismiss the batter.
 * - Together version 2: both players bat until OUT, then compare totals.
 * - Remote/legacy games: the second batter can also win by reaching first total + 1.
 * - Together locks remain covered until explicit Reveal, including terminal balls.
 * - Next clears the current ball. Roles swap only after the first dismissal.
 * - The stored first_innings/second_innings fields retain saved-state compatibility.
 */

import {
  ActionType,
  CricketChooseRolePayload,
  Seat,
  SecretLockPayload,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import { CricketDeliveryResult, CricketEffect, CricketState, CricketView } from "./types";

/**
 * Creates initial Hand Cricket state from start facts.
 * Server toss picks startingSeat as toss winner.
 */
export function createInitialState(startFacts: SuppliedStartFacts): CricketState {
  const tossWinner = startFacts.startingSeat;
  const rulesVersion =
    typeof startFacts.config?.rulesVersion === "number" ? startFacts.config.rulesVersion : 1;

  return {
    rulesVersion,
    mode: startFacts.config?.mode === "together" ? "together" : "remote",
    revealed: false,
    phase: "toss",
    innings: 1,
    tossWinner,
    roles: null,
    firstInningsRuns: 0,
    secondInningsRuns: 0,
    target: null,
    deliveryId: 1,
    secretDeliveries: {},
    lockedSeats: [],
    lastDelivery: null,
    readiness: { A: false, B: false },
  };
}

/**
 * Validates and reduces a Hand Cricket action deterministically.
 */
export function validateAndReduce(
  state: CricketState,
  action: { action: ActionType; payload: unknown },
  acceptedFacts: AcceptedFacts,
): ReductionResult<CricketState, CricketEffect> {
  // Owner's Together rules: each person bats until dismissed, then compare both totals.
  // Legacy 1..6 games and remote games retain their saved chase rules.
  const playUntilBothOut = state.mode === "together" && state.rulesVersion === 2;
  // A chase win that was still covered was not a completed match. Keep its accepted
  // runs, but let that batter continue under the owner's corrected Together rules.
  if (
    playUntilBothOut &&
    state.phase === "terminal" &&
    state.lastDelivery?.outcome === "runs" &&
    !state.revealed
  ) {
    state = { ...state, phase: "second_innings", terminalResult: undefined, target: null };
  }
  if (
    action.action === "secret.reveal" &&
    state.mode === "together" &&
    state.lastDelivery &&
    !state.revealed
  ) {
    return {
      success: true,
      newState: { ...state, revealed: true },
      effects: [],
      terminalResult: state.terminalResult,
    };
  }
  // 1. Guard against moves if already terminal
  if (state.phase === "terminal" || state.terminalResult !== undefined) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already concluded"),
    };
  }

  const { actorSeat, serverTime } = acceptedFacts;

  // 2. Action: cricket.choose-role (toss phase)
  if (action.action === "cricket.choose-role") {
    if (state.phase !== "toss") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot choose role during '${state.phase}' phase`,
        ),
      };
    }

    if (actorSeat !== state.tossWinner) {
      return {
        success: false,
        error: createError(
          ErrorCode.NOT_YOUR_TURN,
          `Only toss winner (${state.tossWinner}) can choose role`,
        ),
      };
    }

    const payload = action.payload as CricketChooseRolePayload | undefined;
    const role = payload?.role;
    if (role !== "bat" && role !== "bowl") {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "Role must be 'bat' or 'bowl'"),
      };
    }

    const otherSeat: Seat = state.tossWinner === "A" ? "B" : "A";
    const batter: Seat = role === "bat" ? state.tossWinner : otherSeat;
    const bowler: Seat = role === "bowl" ? state.tossWinner : otherSeat;

    const newState: CricketState = {
      ...state,
      phase: "first_innings",
      innings: 1,
      roles: {
        bat: batter,
        bowl: bowler,
      },
      readiness: { A: false, B: false },
    };

    const effects: CricketEffect[] = [
      {
        type: "toss-resolved",
        tossWinner: state.tossWinner,
      },
      {
        type: "role-chosen",
        tossWinner: state.tossWinner,
        choice: role,
        batter,
        bowler,
      },
    ];

    return {
      success: true,
      newState,
      effects,
    };
  }

  // 3. Action: secret.lock (during first_innings or second_innings delivery locking)
  if (action.action === "secret.lock") {
    if (state.phase !== "first_innings" && state.phase !== "second_innings") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot lock number during '${state.phase}' phase`,
        ),
      };
    }

    // If waiting for readiness acknowledgment on previous delivery / innings end
    if (state.lastDelivery !== null) {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          "Must acknowledge previous delivery with 'secret.next' before locking new delivery",
        ),
      };
    }

    if (state.lockedSeats.includes(actorSeat)) {
      return {
        success: false,
        error: createError(
          ErrorCode.CHOICE_LOCKED,
          `Seat ${actorSeat} has already locked a number for this delivery`,
        ),
      };
    }

    const rulesVersion = state.rulesVersion ?? 1;
    const maxVal = rulesVersion === 2 ? 10 : 6;
    const payload = action.payload as SecretLockPayload | undefined;
    const value = payload?.value;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > maxVal) {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Delivery number must be an integer between 1 and ${maxVal}`,
        ),
      };
    }

    const newSecretDeliveries = {
      ...state.secretDeliveries,
      [actorSeat]: value,
    };
    const newLockedSeats: Seat[] = [...state.lockedSeats, actorSeat];

    // Check if both seats have locked
    const bothLocked = newSecretDeliveries.A !== undefined && newSecretDeliveries.B !== undefined;

    if (!bothLocked) {
      const newState: CricketState = {
        ...state,
        secretDeliveries: newSecretDeliveries,
        lockedSeats: newLockedSeats,
      };

      const effects: CricketEffect[] = [
        {
          type: "delivery-locked",
          seat: actorSeat,
          innings: state.innings,
          deliveryId: state.deliveryId,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    // Both seats have locked! Resolve the delivery.
    if (!state.roles) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "Roles have not been assigned"),
      };
    }

    const batterSeat = state.roles.bat;
    const bowlerSeat = state.roles.bowl;
    const batterNumber = newSecretDeliveries[batterSeat] as number;
    const bowlerNumber = newSecretDeliveries[bowlerSeat] as number;

    const isWicket = batterNumber === bowlerNumber;

    if (state.innings === 1) {
      if (isWicket) {
        // First innings dismissal
        const target = playUntilBothOut ? null : state.firstInningsRuns + 1;
        const lastDelivery: CricketDeliveryResult = {
          innings: 1,
          deliveryId: state.deliveryId,
          runs: {
            bat: batterNumber,
            bowl: bowlerNumber,
          },
          outcome: "out",
          scoredRuns: 0,
          batterRunsAfter: state.firstInningsRuns,
        };

        const newState: CricketState = {
          ...state,
          target,
          secretDeliveries: newSecretDeliveries,
          lockedSeats: newLockedSeats,
          lastDelivery,

          revealed: state.mode !== "together",
          readiness: { A: false, B: false },
        };

        const effects: CricketEffect[] = [
          {
            type: "delivery-locked",
            seat: actorSeat,
            innings: 1,
            deliveryId: state.deliveryId,
          },
          {
            type: "wicket-fallen",
            innings: 1,
            deliveryId: state.deliveryId,
            batter: batterSeat,
            bowler: bowlerSeat,
            number: batterNumber,
            finalInningsRuns: state.firstInningsRuns,
          },
        ];

        return {
          success: true,
          newState,
          effects,
        };
      } else {
        // Runs scored in first innings
        const newFirstInningsRuns = state.firstInningsRuns + batterNumber;
        const lastDelivery: CricketDeliveryResult = {
          innings: 1,
          deliveryId: state.deliveryId,
          runs: {
            bat: batterNumber,
            bowl: bowlerNumber,
          },
          outcome: "runs",
          scoredRuns: batterNumber,
          batterRunsAfter: newFirstInningsRuns,
        };

        const newState: CricketState = {
          ...state,
          firstInningsRuns: newFirstInningsRuns,
          secretDeliveries: newSecretDeliveries,
          lockedSeats: newLockedSeats,
          lastDelivery,

          revealed: state.mode !== "together",
          readiness: { A: false, B: false },
        };

        const effects: CricketEffect[] = [
          {
            type: "delivery-locked",
            seat: actorSeat,
            innings: 1,
            deliveryId: state.deliveryId,
          },
          {
            type: "delivery-resolved",
            innings: 1,
            deliveryId: state.deliveryId,
            batter: batterSeat,
            bowler: bowlerSeat,
            batterNumber,
            bowlerNumber,
            scoredRuns: batterNumber,
            totalRuns: newFirstInningsRuns,
          },
        ];

        return {
          success: true,
          newState,
          effects,
        };
      }
    } else {
      // Innings 2 (chase)
      const target = state.target ?? state.firstInningsRuns + 1;

      if (isWicket) {
        // Second innings dismissal (wicket fallen) -> Match ends immediately!
        const lastDelivery: CricketDeliveryResult = {
          innings: 2,
          deliveryId: state.deliveryId,
          runs: {
            bat: batterNumber,
            bowl: bowlerNumber,
          },
          outcome: "out",
          scoredRuns: 0,
          batterRunsAfter: state.secondInningsRuns,
        };

        const firstBatter = bowlerSeat; // because roles were swapped for innings 2
        const secondBatter = batterSeat;

        // Scores mapping per seat
        const scores: Record<Seat, number> = {
          [firstBatter]: state.firstInningsRuns,
          [secondBatter]: state.secondInningsRuns,
        } as Record<Seat, number>;

        if (state.secondInningsRuns === state.firstInningsRuns) {
          // Equal scores: DRAW
          const terminalResult: TerminalResult = {
            winner: null,
            reason: "rules_draw",
            scores,
            finishedAt: serverTime,
            details: {
              firstInningsRuns: state.firstInningsRuns,
              secondInningsRuns: state.secondInningsRuns,
            },
          };

          const newState: CricketState = {
            ...state,
            phase: "terminal",
            target: playUntilBothOut ? null : state.target,
            secretDeliveries: newSecretDeliveries,
            lockedSeats: newLockedSeats,
            lastDelivery,

            revealed: state.mode !== "together",
            readiness: { A: false, B: false },
            terminalResult,
          };

          const effects: CricketEffect[] = [
            {
              type: "delivery-locked",
              seat: actorSeat,
              innings: 2,
              deliveryId: state.deliveryId,
            },
            {
              type: "wicket-fallen",
              innings: 2,
              deliveryId: state.deliveryId,
              batter: batterSeat,
              bowler: bowlerSeat,
              number: batterNumber,
              finalInningsRuns: state.secondInningsRuns,
            },
            {
              type: "game-drawn",
              scores,
              reason: `Match tied: both scored ${state.firstInningsRuns} runs`,
            },
          ];

          return {
            success: true,
            newState,
            effects,
            terminalResult: state.mode === "together" ? undefined : terminalResult,
          };
        } else {
          const winner =
            state.secondInningsRuns > state.firstInningsRuns ? secondBatter : firstBatter;
          const terminalResult: TerminalResult = {
            winner,
            reason: "rules_win",
            scores,
            finishedAt: serverTime,
            details: {
              firstInningsRuns: state.firstInningsRuns,
              secondInningsRuns: state.secondInningsRuns,
            },
          };

          const newState: CricketState = {
            ...state,
            phase: "terminal",
            target: playUntilBothOut ? null : state.target,
            secretDeliveries: newSecretDeliveries,
            lockedSeats: newLockedSeats,
            lastDelivery,

            revealed: state.mode !== "together",
            readiness: { A: false, B: false },
            terminalResult,
          };

          const effects: CricketEffect[] = [
            {
              type: "delivery-locked",
              seat: actorSeat,
              innings: 2,
              deliveryId: state.deliveryId,
            },
            {
              type: "wicket-fallen",
              innings: 2,
              deliveryId: state.deliveryId,
              batter: batterSeat,
              bowler: bowlerSeat,
              number: batterNumber,
              finalInningsRuns: state.secondInningsRuns,
            },
            {
              type: "game-won",
              winner,
              scores,
              reason: playUntilBothOut
                ? `Seat ${winner} finished with the higher batting total`
                : `Seat ${firstBatter} defended ${state.firstInningsRuns} runs`,
            },
          ];

          return {
            success: true,
            newState,
            effects,
            terminalResult: state.mode === "together" ? undefined : terminalResult,
          };
        }
      } else {
        // Runs scored in second innings
        const newSecondInningsRuns = state.secondInningsRuns + batterNumber;
        const lastDelivery: CricketDeliveryResult = {
          innings: 2,
          deliveryId: state.deliveryId,
          runs: {
            bat: batterNumber,
            bowl: bowlerNumber,
          },
          outcome: "runs",
          scoredRuns: batterNumber,
          batterRunsAfter: newSecondInningsRuns,
        };

        const firstBatter = bowlerSeat;
        const secondBatter = batterSeat;
        const scores: Record<Seat, number> = {
          [firstBatter]: state.firstInningsRuns,
          [secondBatter]: newSecondInningsRuns,
        } as Record<Seat, number>;

        // Check if chasing batter reached target immediately!
        if (!playUntilBothOut && newSecondInningsRuns >= target) {
          const terminalResult: TerminalResult = {
            winner: secondBatter,
            reason: "rules_win",
            scores,
            finishedAt: serverTime,
            details: {
              firstInningsRuns: state.firstInningsRuns,
              secondInningsRuns: newSecondInningsRuns,
              target,
            },
          };

          const newState: CricketState = {
            ...state,
            secondInningsRuns: newSecondInningsRuns,
            phase: "terminal",
            secretDeliveries: newSecretDeliveries,
            lockedSeats: newLockedSeats,
            lastDelivery,

            revealed: state.mode !== "together",
            readiness: { A: false, B: false },
            terminalResult,
          };

          const effects: CricketEffect[] = [
            {
              type: "delivery-locked",
              seat: actorSeat,
              innings: 2,
              deliveryId: state.deliveryId,
            },
            {
              type: "delivery-resolved",
              innings: 2,
              deliveryId: state.deliveryId,
              batter: batterSeat,
              bowler: bowlerSeat,
              batterNumber,
              bowlerNumber,
              scoredRuns: batterNumber,
              totalRuns: newSecondInningsRuns,
            },
            {
              type: "game-won",
              winner: secondBatter,
              scores,
              reason: `Seat ${secondBatter} reached target of ${target} runs`,
            },
          ];

          return {
            success: true,
            newState,
            effects,
            terminalResult: state.mode === "together" ? undefined : terminalResult,
          };
        }

        // Target not yet reached: wait for acknowledgment before next delivery
        const newState: CricketState = {
          ...state,
          secondInningsRuns: newSecondInningsRuns,
          secretDeliveries: newSecretDeliveries,
          lockedSeats: newLockedSeats,
          lastDelivery,

          revealed: state.mode !== "together",
          readiness: { A: false, B: false },
        };

        const effects: CricketEffect[] = [
          {
            type: "delivery-locked",
            seat: actorSeat,
            innings: 2,
            deliveryId: state.deliveryId,
          },
          {
            type: "delivery-resolved",
            innings: 2,
            deliveryId: state.deliveryId,
            batter: batterSeat,
            bowler: bowlerSeat,
            batterNumber,
            bowlerNumber,
            scoredRuns: batterNumber,
            totalRuns: newSecondInningsRuns,
          },
        ];

        return {
          success: true,
          newState,
          effects,
        };
      }
    }
  }

  // 4. Action: secret.next (acknowledging resolved delivery or innings transition)
  if (action.action === "secret.next") {
    if (state.phase !== "first_innings" && state.phase !== "second_innings") {
      return {
        success: false,
        error: createError(
          ErrorCode.INVALID_ACTION,
          `Cannot acknowledge delivery in '${state.phase}' phase`,
        ),
      };
    }

    if (state.lastDelivery === null) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "No resolved delivery pending acknowledgment"),
      };
    }

    if (state.mode === "together" && !state.revealed)
      return { success: false, error: createError(ErrorCode.INVALID_ACTION, "Reveal before Next") };
    const newReadiness: Record<Seat, boolean> = {
      ...state.readiness,
      [actorSeat]: true,
    };

    if (state.mode === "together") {
      newReadiness.A = true;
      newReadiness.B = true;
    }
    const bothReady = newReadiness.A && newReadiness.B;

    if (!bothReady) {
      const newState: CricketState = {
        ...state,
        readiness: newReadiness,
      };

      return {
        success: true,
        newState,
        effects: [],
      };
    }

    // Both are ready! Check if 1st innings wicket fell (time to swap innings)
    if (state.innings === 1 && state.lastDelivery.outcome === "out") {
      if (!state.roles) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Roles not set"),
        };
      }

      const newBatter: Seat = state.roles.bowl;
      const newBowler: Seat = state.roles.bat;
      const target = playUntilBothOut ? null : (state.target ?? state.firstInningsRuns + 1);

      const newState: CricketState = {
        ...state,
        phase: "second_innings",
        innings: 2,
        roles: {
          bat: newBatter,
          bowl: newBowler,
        },
        target,
        deliveryId: state.deliveryId + 1,
        secretDeliveries: {},
        lockedSeats: [],
        lastDelivery: null,
        revealed: false,
        readiness: { A: false, B: false },
      };

      const effects: CricketEffect[] = [
        {
          type: "innings-swapped",
          innings: 2,
          newBatter,
          newBowler,
          target,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    // Normal delivery advancement within innings 1 or 2
    const newState: CricketState = {
      ...state,
      target: playUntilBothOut ? null : state.target,
      deliveryId: state.deliveryId + 1,
      secretDeliveries: {},
      lockedSeats: [],
      lastDelivery: null,
      revealed: false,
      readiness: { A: false, B: false },
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
      `Unrecognized action '${action.action}' for Hand Cricket`,
    ),
  };
}

/**
 * Returns legal actions for a seat given current Cricket state.
 */
export function legalActions(
  state: CricketState,
  seat: Seat,
  _mode?: "remote" | "together",
): ActionType[] {
  if (state.mode === "together" && state.lastDelivery && !state.revealed) return ["secret.reveal"];
  if (state.phase === "terminal" || state.terminalResult !== undefined) {
    return [];
  }

  if (state.phase === "toss") {
    if (seat === state.tossWinner) {
      return ["cricket.choose-role"];
    }
    return [];
  }

  if (state.phase === "first_innings" || state.phase === "second_innings") {
    // If there is an unresolved delivery awaiting acknowledgment
    if (state.lastDelivery !== null) {
      if (!state.readiness[seat]) {
        return ["secret.next"];
      }
      return [];
    }

    // In locking phase of delivery
    if (!state.lockedSeats.includes(seat)) {
      return ["secret.lock"];
    }
    return [];
  }

  return [];
}

/**
 * Converts CricketState to public/filtered view.
 * Guarantees secret delivery numbers are NEVER exposed in any way until resolved in lastDelivery.
 */
export function toPublicView(state: CricketState, _viewer?: ViewerContext): CricketView {
  const rulesVersion = state.rulesVersion ?? 1;
  const maxNumber = rulesVersion === 2 ? 10 : 6;
  const allowedNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);

  let expectedChooser: Seat | undefined = undefined;
  let expectedRole: "bat" | "bowl" | undefined = undefined;

  if (
    state.roles &&
    (state.phase === "first_innings" || state.phase === "second_innings") &&
    state.lastDelivery === null
  ) {
    if (rulesVersion === 2) {
      // Version 2: Batter chooses first, bowler second
      if (!state.lockedSeats.includes(state.roles.bat)) {
        expectedChooser = state.roles.bat;
        expectedRole = "bat";
      } else if (!state.lockedSeats.includes(state.roles.bowl)) {
        expectedChooser = state.roles.bowl;
        expectedRole = "bowl";
      }
    } else {
      // Version 1 legacy: deliveryId % 2 === 1 ? "A" : "B"
      const first: Seat = state.deliveryId % 2 === 1 ? "A" : "B";
      const second: Seat = first === "A" ? "B" : "A";
      if (!state.lockedSeats.includes(first)) {
        expectedChooser = first;
        expectedRole = state.roles.bat === first ? "bat" : "bowl";
      } else if (!state.lockedSeats.includes(second)) {
        expectedChooser = second;
        expectedRole = state.roles.bat === second ? "bat" : "bowl";
      }
    }
  }

  const hidden = state.mode === "together" && Boolean(state.lastDelivery) && !state.revealed;
  const publicPhase = hidden
    ? state.innings === 1
      ? "first_innings"
      : "second_innings"
    : state.phase;

  return {
    rulesVersion,
    completionRule: state.mode === "together" && rulesVersion === 2 ? "both-out" : "chase",
    allowedNumbers,
    expectedChooser,
    expectedRole,
    // Old saved games may have kept the previous ball's reveal flag after Next.
    revealed: Boolean(state.lastDelivery && state.revealed),
    phase: publicPhase,
    innings: state.innings,
    tossWinner: state.tossWinner,
    roles: state.roles ? { ...state.roles } : null,
    firstInningsRuns:
      state.firstInningsRuns - (hidden && state.innings === 1 ? state.lastDelivery!.scoredRuns : 0),
    secondInningsRuns:
      state.secondInningsRuns -
      (hidden && state.innings === 2 ? state.lastDelivery!.scoredRuns : 0),
    target:
      (state.mode === "together" && rulesVersion === 2) ||
      (hidden && state.innings === 1 && state.lastDelivery?.outcome === "out")
        ? null
        : state.target,
    deliveryId: state.deliveryId,
    lockedSeats: [...state.lockedSeats],
    lastDelivery: !hidden && state.lastDelivery ? { ...state.lastDelivery } : null,
    readiness: { ...state.readiness },
    ...(!hidden && state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks if current state is terminal.
 */
export function isTerminal(state: CricketState): TerminalResult | null {
  if (state.mode === "together" && !state.revealed) return null;
  if (state.terminalResult) {
    return state.terminalResult;
  }
  return null;
}
