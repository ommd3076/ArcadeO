/**
 * Private Arcade V1 — Dots & Boxes Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { DotsBoxesEdgePayload } from "../../protocol/types";
import { DotsBoxesEffect, DotsBoxesState, DotsBoxesView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const dotsBoxesEngineAdapter: GameEngineAdapter<
  DotsBoxesState,
  DotsBoxesEdgePayload,
  DotsBoxesEffect,
  DotsBoxesView
> = {
  gameId: "dots-boxes",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
