/**
 * Private Arcade V1 — Hand Cricket Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { CricketActionPayload, CricketEffect, CricketState, CricketView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const handCricketEngineAdapter: GameEngineAdapter<
  CricketState,
  CricketActionPayload,
  CricketEffect,
  CricketView
> = {
  gameId: "hand-cricket",
  createInitialState,
  validateAndReduce: (state, action, acceptedFacts) =>
    validateAndReduce(state, action as any, acceptedFacts),
  legalActions: (state, seat) => legalActions(state, seat),
  toPublicView,
  isTerminal,
};
