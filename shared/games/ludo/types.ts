/**
 * Private Arcade V1 — Ludo Game Types
 *
 * Server-authoritative, deterministic pure types and fixed geometry for Ludo.
 * 15x15 board geometry with 52-cell shared ring and private home lanes.
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const LUDO_BOARD_SIZE = 15;
export const LUDO_RING_SIZE = 52;
export const LUDO_TOKENS_PER_SEAT = 4;
export const LUDO_YARD_PROGRESS = -1;
export const LUDO_HOME_PROGRESS = 56;
export const LUDO_SHARED_TRACK_MAX = 50;

export const LUDO_START_SQUARES: Record<Seat, number> = {
  A: 0,
  B: 26,
};

export const LUDO_SAFE_SQUARES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];

export const LUDO_SAFE_SQUARES_SET: ReadonlySet<number> = new Set(LUDO_SAFE_SQUARES);

/**
 * 52 ring coordinates [row, col] on a 15x15 grid, zero-based.
 * Fixed order from GAME-RULES.md:
 * 0–4:   [6,1] [6,2] [6,3] [6,4] [6,5]
 * 5–10:  [5,6] [4,6] [3,6] [2,6] [1,6] [0,6]
 * 11:    [0,7]
 * 12–17: [0,8] [1,8] [2,8] [3,8] [4,8] [5,8]
 * 18–23: [6,9] [6,10] [6,11] [6,12] [6,13] [6,14]
 * 24–25: [7,14] [8,14]
 * 26–30: [8,13] [8,12] [8,11] [8,10] [8,9]
 * 31–36: [9,8] [10,8] [11,8] [12,8] [13,8] [14,8]
 * 37:    [14,7]
 * 38–43: [14,6] [13,6] [12,6] [11,6] [10,6] [9,6]
 * 44–49: [8,5] [8,4] [8,3] [8,2] [8,1] [8,0]
 * 50–51: [7,0] [6,0]
 */
export const LUDO_RING_COORDINATES: readonly (readonly [number, number])[] = [
  // 0–4
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  // 5–10
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  // 11
  [0, 7],
  // 12–17
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  // 18–23
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  // 24–25
  [7, 14],
  [8, 14],
  // 26–30
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  // 31–36
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  // 37
  [14, 7],
  // 38–43
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  // 44–49
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  // 50–51
  [7, 0],
  [6, 0],
] as const;

/**
 * Private home lanes for Seat A and Seat B.
 * 6 steps each (progress 51 through 56; index 0..5).
 * A: [7,1]..[7,6]
 * B: [7,13]..[7,8]
 */
export const LUDO_HOME_COORDINATES: Record<Seat, readonly (readonly [number, number])[]> = {
  A: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  B: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
};

export type LudoPhase = "roll" | "choose-token" | "completed";

export type LudoTokensBySeat = Record<Seat, [number, number, number, number]>;

export interface LudoState {
  tokens: LudoTokensBySeat;
  activeSeat: Seat;
  phase: LudoPhase;
  consecutiveSixes: number; // 0, 1, or 2 (capped at 2)
  pendingRoll: number | null;
  legalTokenIds: number[];
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}

export type LudoEffect =
  | {
      type: "dice-rolled";
      seat: Seat;
      roll: number;
      ignored?: boolean;
    }
  | {
      type: "token-moved";
      seat: Seat;
      tokenId: number;
      from: number;
      to: number;
    }
  | {
      type: "token-captured";
      bySeat: Seat;
      byTokenId: number;
      capturedSeat: Seat;
      capturedTokenId: number;
      ringIndex: number;
    }
  | {
      type: "token-entered-home";
      seat: Seat;
      tokenId: number;
    }
  | {
      type: "turn-changed";
      previousSeat: Seat;
      nextSeat: Seat;
    }
  | {
      type: "game-won";
      winner: Seat;
    };

export interface LudoView {
  tokens: LudoTokensBySeat;
  activeSeat: Seat;
  phase: LudoPhase;
  consecutiveSixes: number;
  pendingRoll: number | null;
  legalTokenIds: number[];
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}
