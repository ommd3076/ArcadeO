/**
 * ArcadeO V1 — Snakes & Ladders Game Types
 *
 * Server-authoritative, deterministic pure types for Snakes & Ladders.
 * 10x10 board with positions 0 (off-board) to 100 (win).
 * Fixed serpentine geometry, fixed ladders and snakes.
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const SNAKES_AND_LADDERS_BOARD_SIZE = 10;
export const SNAKES_AND_LADDERS_MAX_POSITION = 100;
export const SNAKES_AND_LADDERS_START_POSITION = 0;
export const REFERENCE_BOARD_VERSION = 2 as const;
export type SnakesBoardVersion = 1 | typeof REFERENCE_BOARD_VERSION;

/**
 * Fixed ladders: origin -> destination.
 * 2->23, 8->34, 20->41, 32->51, 49->70, 60->83, 73->94
 */
export const LADDERS: Readonly<Record<number, number>> = {
  2: 23,
  8: 34,
  20: 41,
  32: 51,
  49: 70,
  60: 83,
  73: 94,
};

/**
 * Fixed snakes: head -> tail.
 * 27->5, 39->16, 56->35, 68->46, 79->58, 88->66, 97->76
 */
export const SNAKES: Readonly<Record<number, number>> = {
  27: 5,
  39: 16,
  56: 35,
  68: 46,
  79: 58,
  88: 66,
  97: 76,
};

// Transcribed from the owner's supplied classic board. The saved version is
// essential: old matches without a version continue using the original map.
export const REFERENCE_LADDERS: Readonly<Record<number, number>> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  51: 67,
  72: 91,
  81: 99,
};

export const REFERENCE_SNAKES: Readonly<Record<number, number>> = {
  17: 7,
  53: 34,
  63: 18,
  64: 60,
  87: 45,
  92: 73,
  95: 75,
  98: 79,
};

export function boardMapFor(version?: SnakesBoardVersion) {
  if (version === undefined || version === null || version === 1) {
    return { ladders: LADDERS, snakes: SNAKES };
  }
  if (version === REFERENCE_BOARD_VERSION) {
    return { ladders: REFERENCE_LADDERS, snakes: REFERENCE_SNAKES };
  }
  throw new Error(`Invalid Snakes & Ladders board version: ${String(version)}. Expected 1 or 2.`);
}

export interface SnakesAndLaddersState {
  boardVersion?: SnakesBoardVersion;
  positions: Record<Seat, number>; // 0 (off-board) .. 100
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  lastRoll: number | null;
  terminalResult?: TerminalResult;
}

export type SnakesAndLaddersEffect =
  | {
      type: "dice-rolled";
      seat: Seat;
      roll: number;
    }
  | {
      type: "token-advanced";
      seat: Seat;
      from: number;
      to: number;
    }
  | {
      type: "snake-bitten";
      seat: Seat;
      from: number;
      to: number;
    }
  | {
      type: "ladder-climbed";
      seat: Seat;
      from: number;
      to: number;
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

export interface SnakesAndLaddersView {
  boardVersion?: SnakesBoardVersion;
  positions: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  lastRoll: number | null;
  terminalResult?: TerminalResult;
}
