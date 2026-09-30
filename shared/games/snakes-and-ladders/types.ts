/**
 * Private Arcade V1 — Snakes & Ladders Game Types
 *
 * Server-authoritative, deterministic pure types for Snakes & Ladders.
 * 10x10 board with positions 0 (off-board) to 100 (win).
 * Fixed serpentine geometry, fixed ladders and snakes.
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const SNAKES_AND_LADDERS_BOARD_SIZE = 10;
export const SNAKES_AND_LADDERS_MAX_POSITION = 100;
export const SNAKES_AND_LADDERS_START_POSITION = 0;

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

export interface SnakesAndLaddersState {
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
  positions: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  lastRoll: number | null;
  terminalResult?: TerminalResult;
}
