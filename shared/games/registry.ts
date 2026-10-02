import { ActionType, GameId, Seat, TerminalResult, ViewerContext } from "../protocol/types";
import { ErrorDetails } from "../protocol/errors";
import { connectFourEngineAdapter } from "./connect-four/adapter";
import { rpsEngineAdapter } from "./rps/adapter";
import { ludoEngineAdapter } from "./ludo/adapter";
import { snakesAndLaddersEngineAdapter } from "./snakes-and-ladders/adapter";
import { dotsBoxesEngineAdapter } from "./dots-boxes/adapter";
import { sosEngineAdapter } from "./sos/adapter";
import { sudokuEngineAdapter } from "./sudoku/adapter";
import { handCricketEngineAdapter } from "./hand-cricket/adapter";

export interface SuppliedStartFacts {
  serverTime: number;
  startingSeat: Seat;
  seed?: number;
  config?: Record<string, unknown>;
}

export interface AcceptedFacts {
  serverTime: number;
  actorSeat: Seat;
  randomValues?: number[]; // Pre-rolled dice or verified random tokens
}

export interface ReductionSuccess<TState = unknown, TEffect = unknown> {
  success: true;
  newState: TState;
  effects: TEffect[];
  terminalResult?: TerminalResult;
}

export interface ReductionFailure {
  success: false;
  error: ErrorDetails;
}

export type ReductionResult<TState = unknown, TEffect = unknown> =
  ReductionSuccess<TState, TEffect> | ReductionFailure;

export interface GameEngineAdapter<
  TState = unknown,
  TActionPayload = unknown,
  TEffect = unknown,
  TView = unknown,
> {
  gameId: GameId;
  createInitialState(startFacts: SuppliedStartFacts): TState;
  validateAndReduce(
    state: TState,
    action: { action: ActionType; payload: TActionPayload },
    acceptedFacts: AcceptedFacts,
  ): ReductionResult<TState, TEffect>;
  legalActions(state: TState, seat: Seat, serverTime?: number): ActionType[];
  toPublicView(state: TState, viewer: ViewerContext): TView;
  isTerminal(state: TState): TerminalResult | null;
}

const engineRegistry = new Map<GameId, GameEngineAdapter<any, any, any, any>>();

// Auto-register available engine adapters
registerGameEngine(connectFourEngineAdapter);
registerGameEngine(rpsEngineAdapter);
registerGameEngine(ludoEngineAdapter);
registerGameEngine(snakesAndLaddersEngineAdapter);
registerGameEngine(dotsBoxesEngineAdapter);
registerGameEngine(sosEngineAdapter);
registerGameEngine(sudokuEngineAdapter);
registerGameEngine(handCricketEngineAdapter);

export function registerGameEngine(adapter: GameEngineAdapter<any, any, any, any>): void {
  engineRegistry.set(adapter.gameId, adapter);
}

export function getGameEngine(gameId: GameId): GameEngineAdapter<any, any, any, any> | undefined {
  return engineRegistry.get(gameId);
}

export function getAllRegisteredGameIds(): GameId[] {
  return Array.from(engineRegistry.keys());
}
