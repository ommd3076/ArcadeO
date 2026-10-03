/**
 * ArcadeO V1 — Dots & Boxes Game Types
 *
 * Server-authoritative, deterministic pure types for Dots & Boxes.
 * 5x5 dots giving 4x4 boxes (16 boxes total, 40 orthogonal edges).
 */

import { Seat, TerminalResult } from "../../protocol/types";

export const DOTS_ROWS = 5;
export const DOTS_COLS = 5;
export const BOXES_ROWS = 4;
export const BOXES_COLS = 4;
export const TOTAL_EDGES = 40;
export const TOTAL_BOXES = 16;
export type GridSize = 5 | 7 | 9;
export function gridSize(value: unknown): GridSize {
  if (value === undefined || value === null) return 5;
  if (value === 5 || value === 7 || value === 9) return value;
  throw new Error(`Invalid grid size: ${String(value)}. Expected 5, 7, or 9.`);
}

export interface DotsBoxesEdge {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface DotsBoxesPlacedEdge extends DotsBoxesEdge {
  claimedBy: Seat;
}

export interface DotsBoxesBoxCoordinate {
  row: number; // 0..3
  col: number; // 0..3
}

export interface DotsBoxesState {
  gridSize?: GridSize; // Missing on saved legacy matches: 5 dots.
  edges: DotsBoxesPlacedEdge[];
  boxes: (Seat | null)[][]; // 4 rows x 4 cols: boxes[row][col] is claiming Seat or null
  scores: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}

export type DotsBoxesEffect =
  | {
      type: "edge-placed";
      seat: Seat;
      edge: DotsBoxesEdge;
    }
  | {
      type: "boxes-claimed";
      seat: Seat;
      boxes: DotsBoxesBoxCoordinate[];
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

export interface DotsBoxesView {
  gridSize?: GridSize;
  edges: DotsBoxesPlacedEdge[];
  boxes: (Seat | null)[][];
  scores: Record<Seat, number>;
  activeSeat: Seat;
  status: "active" | "completed";
  winner: Seat | null;
  terminalResult?: TerminalResult;
}
