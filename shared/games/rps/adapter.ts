/**
 * Private Arcade V1 — Rock Paper Scissors Game Engine Adapter
 */

import { GameEngineAdapter } from "../registry";
import { SecretLockPayload } from "../../protocol/types";
import { RPSEffect, RPSState, RPSView } from "./types";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "./engine";

export const rpsEngineAdapter: GameEngineAdapter<RPSState, SecretLockPayload, RPSEffect, RPSView> =
  {
    gameId: "rock-paper-scissors",
    createInitialState,
    validateAndReduce,
    legalActions: (state, seat) => legalActions(state, seat),
    toPublicView,
    isTerminal,
  };
