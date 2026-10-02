/**
 * Private Arcade V1 — Rock Paper Scissors Game Types
 *
 * Server-authoritative state, effects, and views for Rock Paper Scissors.
 * Supports best of 3 (target 2), best of 5 (target 3), and best of 7 (target 4).
 */

import { RPSChoice, Seat, TerminalResult } from "../../protocol/types";

export type { RPSChoice };
export type RPSFormat = "best-of-3" | "best-of-5" | "best-of-7";

export type RPSPhase = "locking" | "resolved" | "terminal";

export interface RPSRoundResult {
  roundId: number;
  choices: {
    A: RPSChoice;
    B: RPSChoice;
  };
  winner: Seat | "draw";
}

export interface RPSState {
  mode?: "remote" | "together";
  targetWins: 2 | 3 | 4;
  scores: Record<Seat, number>;
  roundId: number;
  phase: RPSPhase;
  secretChoices: {
    A?: RPSChoice;
    B?: RPSChoice;
  };
  lockedSeats: Seat[];
  roundResult: RPSRoundResult | null;
  revealed: boolean;
  readiness: Record<Seat, boolean>;
  terminalResult?: TerminalResult;
}

export type RPSEffect =
  | {
      type: "secret-locked";
      seat: Seat;
      roundId: number;
    }
  | {
      type: "round-resolved";
      roundId: number;
      winner: Seat | "draw";
      scores: Record<Seat, number>;
    }
  | {
      type: "game-won";
      winner: Seat;
      scores: Record<Seat, number>;
    };

export interface RPSView {
  targetWins: 2 | 3 | 4;
  scores: Record<Seat, number>;
  roundId: number;
  phase: RPSPhase;
  lockedSeats: Seat[];
  roundResult: RPSRoundResult | null;
  revealed: boolean;
  readiness: Record<Seat, boolean>;
  terminalResult?: TerminalResult;
}
