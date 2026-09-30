/**
 * Private Arcade V1 — Connect Four Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { ConnectFourDropPayload } from "../../protocol/types";
import { ConnectFourEffect, ConnectFourState, ConnectFourView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const connectFourEngineAdapter: GameEngineAdapter<
  ConnectFourState,
  ConnectFourDropPayload,
  ConnectFourEffect,
  ConnectFourView
> = {
  gameId: "connect-four",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
