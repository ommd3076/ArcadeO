import { ActionType, GameId, Seat, TerminalResult, ViewerContext } from "../protocol/types";
import { ErrorDetails } from "../protocol/errors";
import { connectFourEngineAdapter } from "./connect-four/adapter";
import { rpsEngineAdapter } from "./rps/adapter";
import { ludoEngineAdapter } from "./ludo/adapter";
import { snakesAndLaddersEngineAdapter } from "./snakes-and-ladders/adapter";
import { dotsBoxesEngineAdapter } from "./dots-boxes/adapter";
import { sosEngineAdapter } from "./sos/adapter";
import { sudokuEngineAdapter } from "./sudoku/adapter";
import { handCricketV1EngineAdapter, handCricketV2EngineAdapter } from "./hand-cricket/adapter";

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
  rulesVersion?: number;
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

const engineRegistry = new Map<string, GameEngineAdapter<any, any, any, any>>();
const defaultVersions = new Map<GameId, number>();

export function registerGameEngine(adapter: GameEngineAdapter<any, any, any, any>): void {
  const version = adapter.rulesVersion ?? 1;
  const key = `${adapter.gameId}@${version}`;
  engineRegistry.set(key, adapter);

  // If this version is >= current default, it becomes the default lookup
  const currentDefault = defaultVersions.get(adapter.gameId) ?? 0;
  if (version >= currentDefault) {
    defaultVersions.set(adapter.gameId, version);
  }
}

export function getGameEngine(
  gameId: GameId,
  rulesVersion?: number,
): GameEngineAdapter<any, any, any, any> | undefined {
  if (rulesVersion !== undefined) {
    return engineRegistry.get(`${gameId}@${rulesVersion}`);
  }
  const defaultVersion = defaultVersions.get(gameId) ?? 1;
  return engineRegistry.get(`${gameId}@${defaultVersion}`);
}

export function getAllRegisteredGameIds(): GameId[] {
  return Array.from(defaultVersions.keys());
}

// Auto-register available engine adapters
registerGameEngine(connectFourEngineAdapter);
registerGameEngine(rpsEngineAdapter);
registerGameEngine(ludoEngineAdapter);
registerGameEngine(snakesAndLaddersEngineAdapter);
registerGameEngine(dotsBoxesEngineAdapter);
registerGameEngine(sosEngineAdapter);
registerGameEngine(sudokuEngineAdapter);
registerGameEngine(handCricketV1EngineAdapter);
registerGameEngine(handCricketV2EngineAdapter);
