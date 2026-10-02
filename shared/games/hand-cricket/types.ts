/**
 * Private Arcade V1 — Hand Cricket Game Types
 *
 * Server-authoritative state, effects, and views for Hand Cricket.
 * Numbers 1..6, one wicket each, two innings, no ball limit.
 */

import {
  CricketChooseRolePayload,
  Seat,
  SecretLockPayload,
  TerminalResult,
} from "../../protocol/types";

export type CricketRole = "bat" | "bowl";

export type CricketPhase = "toss" | "first_innings" | "second_innings" | "terminal";

export interface CricketDeliveryResult {
  innings: 1 | 2;
  deliveryId: number;
  runs: {
    bat: number; // 1..6
    bowl: number; // 1..6
  };
  outcome: "runs" | "out";
  scoredRuns: number; // 0 if out, else runs.bat
  batterRunsAfter: number;
}

export interface CricketState {
  mode?: "remote" | "together";
  revealed?: boolean;
  phase: CricketPhase;
  innings: 1 | 2;
  tossWinner: Seat;
  roles: {
    bat: Seat;
    bowl: Seat;
  } | null;
  firstInningsRuns: number;
  secondInningsRuns: number;
  target: number | null; // Set when 1st innings concludes: firstInningsRuns + 1 (special: 0 runs -> target 1)
  deliveryId: number; // Current delivery number in innings (1-indexed)
  secretDeliveries: {
    A?: number; // 1..6
    B?: number; // 1..6
  };
  lockedSeats: Seat[];
  lastDelivery: CricketDeliveryResult | null;
  readiness: Record<Seat, boolean>;
  terminalResult?: TerminalResult;
}

export type CricketEffect =
  | {
      type: "toss-resolved";
      tossWinner: Seat;
    }
  | {
      type: "role-chosen";
      tossWinner: Seat;
      choice: CricketRole;
      batter: Seat;
      bowler: Seat;
    }
  | {
      type: "delivery-locked";
      seat: Seat;
      innings: 1 | 2;
      deliveryId: number;
    }
  | {
      type: "delivery-resolved";
      innings: 1 | 2;
      deliveryId: number;
      batter: Seat;
      bowler: Seat;
      batterNumber: number;
      bowlerNumber: number;
      scoredRuns: number;
      totalRuns: number;
    }
  | {
      type: "wicket-fallen";
      innings: 1 | 2;
      deliveryId: number;
      batter: Seat;
      bowler: Seat;
      number: number;
      finalInningsRuns: number;
    }
  | {
      type: "innings-swapped";
      innings: 2;
      newBatter: Seat;
      newBowler: Seat;
      target: number;
    }
  | {
      type: "game-won";
      winner: Seat;
      scores: Record<Seat, number>;
      reason: string;
    }
  | {
      type: "game-drawn";
      scores: Record<Seat, number>;
      reason: string;
    };

export interface CricketView {
  revealed?: boolean;
  phase: CricketPhase;
  innings: 1 | 2;
  tossWinner: Seat;
  roles: {
    bat: Seat;
    bowl: Seat;
  } | null;
  firstInningsRuns: number;
  secondInningsRuns: number;
  target: number | null;
  deliveryId: number;
  lockedSeats: Seat[];
  lastDelivery: CricketDeliveryResult | null;
  readiness: Record<Seat, boolean>;
  terminalResult?: TerminalResult;
}

export type CricketActionPayload =
  CricketChooseRolePayload | SecretLockPayload | Record<string, never>;
