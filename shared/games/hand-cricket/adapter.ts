/**
 * ArcadeO V1 — Hand Cricket Game Engine Adapters
 *
 * Rules Version 1: 1..6 choices (legacy saved matches)
 * Rules Version 2: 1..10 choices (confirmed owner rules for new matches)
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

export const handCricketV1EngineAdapter: GameEngineAdapter<
  CricketState,
  CricketActionPayload,
  CricketEffect,
  CricketView
> = {
  gameId: "hand-cricket",
  rulesVersion: 1,
  createInitialState: (startFacts) =>
    createInitialState({ ...startFacts, config: { ...startFacts.config, rulesVersion: 1 } }),
  validateAndReduce: (state, action, acceptedFacts) =>
    validateAndReduce({ ...state, rulesVersion: 1 }, action as any, acceptedFacts),
  legalActions: (state, seat) => legalActions({ ...state, rulesVersion: 1 }, seat),
  toPublicView: (state, viewer) => toPublicView({ ...state, rulesVersion: 1 }, viewer),
  isTerminal,
};

export const handCricketV2EngineAdapter: GameEngineAdapter<
  CricketState,
  CricketActionPayload,
  CricketEffect,
  CricketView
> = {
  gameId: "hand-cricket",
  rulesVersion: 2,
  createInitialState: (startFacts) =>
    createInitialState({ ...startFacts, config: { ...startFacts.config, rulesVersion: 2 } }),
  validateAndReduce: (state, action, acceptedFacts) =>
    validateAndReduce({ ...state, rulesVersion: 2 }, action as any, acceptedFacts),
  legalActions: (state, seat) => legalActions({ ...state, rulesVersion: 2 }, seat),
  toPublicView: (state, viewer) => toPublicView({ ...state, rulesVersion: 2 }, viewer),
  isTerminal,
};

export const handCricketEngineAdapter = handCricketV2EngineAdapter;
