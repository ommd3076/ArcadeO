/**
 * Private Arcade V1 — Snakes & Ladders Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { SnakesAndLaddersEffect, SnakesAndLaddersState, SnakesAndLaddersView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const snakesAndLaddersEngineAdapter: GameEngineAdapter<
  SnakesAndLaddersState,
  Record<string, never>,
  SnakesAndLaddersEffect,
  SnakesAndLaddersView
> = {
  gameId: "snakes-and-ladders",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
