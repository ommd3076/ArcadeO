/**
 * ArcadeO V1 — Ludo Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { LudoMovePayload } from "../../protocol/types";
import { LudoEffect, LudoState, LudoView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const ludoEngineAdapter: GameEngineAdapter<
  LudoState,
  LudoMovePayload | Record<string, never>,
  LudoEffect,
  LudoView
> = {
  gameId: "ludo",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
