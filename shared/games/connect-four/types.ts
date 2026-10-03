/**
 * ArcadeO V1 — Connect Four Game Types
 *
 * Server-authoritative state, effects, and views for Connect Four.
 * 7 columns x 6 rows board with gravity.
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const CONNECT_FOUR_ROWS = 6;
export const CONNECT_FOUR_COLS = 7;

export type ConnectFourCell = Seat | null;

/**
 * Coordinate tuple: [row, col] where:
 * row: 0 (top row) to 5 (bottom row)
 * col: 0 (leftmost column) to 6 (rightmost column)
 */
export type ConnectFourCoordinate = [number, number];

export interface ConnectFourState {
  board: ConnectFourCell[][]; // 6 rows x 7 cols: board[row][col]
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  winningCells: ConnectFourCoordinate[];
  terminalResult?: TerminalResult;
}

export type ConnectFourEffect =
  | {
      type: "disc-dropped";
      seat: Seat;
      row: number;
      col: number;
      column: number;
    }
  | {
      type: "game-won";
      winner: Seat;
      winningCells: ConnectFourCoordinate[];
    }
  | {
      type: "game-drawn";
    };

export interface ConnectFourView {
  board: ConnectFourCell[][];
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  winningCells: ConnectFourCoordinate[];
  terminalResult?: TerminalResult;
}
