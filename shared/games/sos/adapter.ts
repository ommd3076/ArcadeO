/**
 * Private Arcade V1 — SOS Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { SOSPlacePayload } from "../../protocol/types";
import { SOSEffect, SOSState, SOSView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const sosEngineAdapter: GameEngineAdapter<SOSState, SOSPlacePayload, SOSEffect, SOSView> = {
  gameId: "sos",
  createInitialState,
  validateAndReduce,
  legalActions,
  toPublicView,
  isTerminal,
};
