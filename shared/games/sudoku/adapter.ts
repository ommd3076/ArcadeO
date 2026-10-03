/**
 * ArcadeO V1 — Sudoku Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { SudokuActionPayload, SudokuEffect, SudokuState, SudokuView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const sudokuEngineAdapter: GameEngineAdapter<
  SudokuState,
  SudokuActionPayload,
  SudokuEffect,
  SudokuView
> = {
  gameId: "sudoku",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
