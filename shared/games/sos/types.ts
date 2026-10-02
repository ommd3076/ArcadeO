/**
 * Private Arcade V1 — SOS Game Types
 *
 * Server-authoritative, deterministic pure types for SOS.
 * 5x5 grid (25 cells).
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const SOS_BOARD_SIZE = 5;
export const SOS_TOTAL_CELLS = 25;
export type GridSize = 5 | 7 | 9;
export function gridSize(value: unknown): GridSize {
  if (value === undefined || value === null) return 5;
  if (value === 5 || value === 7 || value === 9) return value;
  throw new Error(`Invalid grid size: ${String(value)}. Expected 5, 7, or 9.`);
}

export type SOSLetter = "S" | "O";
export type SOSCell = SOSLetter | null;

export interface SOSLine {
  id: string; // Canonical line key, e.g. "0,0-0,2"
  from: [number, number]; // [r1, c1] where (r1, c1) < (r2, c2)
  to: [number, number]; // [r2, c2]
  claimedBy: Seat;
}

export interface SOSState {
  gridSize?: GridSize; // Missing on saved legacy matches: 5 cells.
  board: SOSCell[][]; // 5 rows x 5 cols
  lines: SOSLine[];
  scores: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}

export type SOSEffect =
  | {
      type: "letter-placed";
      seat: Seat;
      row: number;
      col: number;
      letter: SOSLetter;
    }
  | {
      type: "lines-formed";
      seat: Seat;
      lines: SOSLine[];
    }
  | {
      type: "turn-changed";
      fromSeat: Seat;
      toSeat: Seat;
    }
  | {
      type: "game-won";
      winner: Seat;
      scores: Record<Seat, number>;
    }
  | {
      type: "game-drawn";
      scores: Record<Seat, number>;
    };

export interface SOSView {
  gridSize?: GridSize;
  board: SOSCell[][];
  lines: SOSLine[];
  scores: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}
