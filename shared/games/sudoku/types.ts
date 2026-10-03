/**
 * ArcadeO V1 — Sudoku Game Types
 *
 * Pure, server-authoritative state, actions, effects, and views for Sudoku.
 * Conforms to GAME-RULES.md, PRD.md, TDD.md, DATA-MODEL.md, and shared protocol.
 */

import {
  Seat,
  SudokuEditPayload,
  SudokuPlayMode,
  TerminalResult,
  ViewerContext,
} from "../../protocol/types";

export interface SudokuViewerContext extends ViewerContext {
  serverTime?: number;
}

export type SudokuOperation = "set" | "erase" | "toggle-note";

export type SudokuEditActionPayload = SudokuEditPayload;

export type SudokuActionPayload = SudokuEditActionPayload | Record<string, never>; // For undo, check, pause, resume

export interface SudokuCellUndoRecord {
  index: number; // 0..80 (row * 9 + col)
  prevDigit: number; // 0..9 (0 = empty)
  prevNotes: number; // bitmask 1..9
}

export interface PlayerSudokuState {
  cells: number[]; // 81 integers: 0 (empty) or 1..9
  notes: number[]; // 81 integers: bitmask representing notes 1..9 (1 << digit)
  undoStack: SudokuCellUndoRecord[];
  progressRevision: number; // increments on each accepted edit/undo
  assisted: boolean; // permanently true once Check is invoked
  paused: boolean; // practice mode only
  pausedAt: number | null; // server timestamp when paused
  totalPausedMs: number; // accumulated paused duration
  startedAt: number; // server timestamp when this player started
  completedAt: number | null; // server timestamp when completed
  elapsedMs: number; // calculated elapsed ms (server duration minus paused intervals)
  incorrectCells?: number[]; // indices of incorrect cells returned by Check (practice mode only)
}

export interface SudokuState {
  replay?: boolean;
  interrupted?: boolean;
  puzzleId: string;
  givens: string; // 81 characters '0'..'9'
  solution: string; // 81 characters '1'..'9' (server private solution)
  mode: SudokuPlayMode; // 'practice' | 'duel' | 'challenge'
  players: Record<Seat, PlayerSudokuState>;

  // Duel-specific timing
  scheduledStartTime?: number; // server start + 3s for duel

  // Challenge-specific properties
  senderSeat?: Seat; // who created the challenge (default "A")
  senderElapsedMs?: number; // target elapsedMs from sender
  challengePublished?: boolean;
  receiverAccepted?: boolean;

  // Terminal status
  terminalResult?: TerminalResult;
}

export type SudokuEffect =
  | {
      type: "sudoku-cell-edited";
      seat: Seat;
      row: number;
      col: number;
      index: number;
      operation: SudokuOperation;
      value?: number;
      filledCount: number;
    }
  | {
      type: "sudoku-undone";
      seat: Seat;
      index: number;
      filledCount: number;
    }
  | {
      type: "sudoku-checked";
      seat: Seat;
      incorrectIndices: number[];
    }
  | {
      type: "sudoku-paused";
      seat: Seat;
      pausedAt: number;
    }
  | {
      type: "sudoku-resumed";
      seat: Seat;
      resumedAt: number;
      elapsedMs: number;
    }
  | {
      type: "sudoku-completed";
      seat: Seat;
      elapsedMs: number;
      winner: Seat | null; // null for draw (challenge mode)
    };

/**
 * Filtered public view delivered to a specific viewer.
 * NEVER exposes private solution or opponent's cell values, correctness, or notes.
 */
export interface PlayerPublicView {
  progressRevision?: number;
  filledCount: number;
  completed: boolean;
  elapsedMs: number;
  paused: boolean;
  assisted: boolean;
  // Own private fields only:
  cells?: number[];
  notes?: number[];
  undoAvailable?: boolean;
  incorrectCells?: number[]; // returned on check in practice mode
}

export interface SudokuView {
  replay?: boolean;
  puzzleId: string;
  givens: string; // 81 chars, or hidden before scheduledStartTime in duel
  mode: SudokuPlayMode;
  scheduledStartTime?: number;
  hasStarted: boolean;
  self: PlayerPublicView;
  opponent?: PlayerPublicView; // opponent filled count only, never cells or notes
  challenge?: {
    targetElapsedMs?: number;
    published: boolean;
    accepted: boolean;
  };
  terminalResult?: TerminalResult;
}
