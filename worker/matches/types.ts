import type {
  AccountId,
  GameId,
  MatchLifecycle,
  PlayMode,
  Seat,
  TerminalResult,
} from "../../shared/protocol/types";

export interface ParticipantInfo {
  accountId: AccountId;
  displayName: string;
  ready: boolean;
}

export interface MatchParticipants {
  A: ParticipantInfo;
  B?: ParticipantInfo;
}

export interface ControllerInfo {
  controllingAccountId: AccountId;
  controllerGeneration: number;
}

export interface MatchSnapshotRow {
  [key: string]: any;
  matchId: string;
  gameId: GameId;
  mode: PlayMode;
  lifecycle: MatchLifecycle;
  deliveryVersion: number;
  schemaVersion: number;
  rulesVersion: number;
  turnSeat: Seat | null;
  turnId: number | null;
  roundId: number | null;
  gameState: string; // JSON
  readiness: string; // JSON: { A: boolean; B: boolean }
  participants: string; // JSON: MatchParticipants
  controller: string; // JSON: ControllerInfo
  result: string | null; // JSON: TerminalResult | null
}

export interface EventRow {
  [key: string]: any;
  sequence?: number;
  eventId: string;
  actionId: string;
  actorAccount: string;
  actorSeat: string;
  acceptedAt: number;
  effects: string; // JSON
}

export interface ActionReceiptRow {
  [key: string]: any;
  actorAccount: string;
  actionId: string;
  status: "accepted" | "superseded";
  acceptedVersion: number | null;
  eventId: string | null;
  canonicalPayloadDigest: string | null;
  createdAt: number;
}

export interface PrivateRoundChoiceRow {
  [key: string]: any;
  roundId: number;
  seat: Seat;
  choiceValue: string;
  lockedAt: number;
}

export interface ProjectionOutboxRow {
  [key: string]: any;
  projectionKey: string;
  requiredVersion: number;
  payload: string; // JSON
  retries: number;
  nextAttemptAt: number;
}

export interface SnapshotData {
  matchId: string;
  gameId: GameId;
  mode: PlayMode;
  lifecycle: MatchLifecycle;
  deliveryVersion: number;
  schemaVersion: number;
  rulesVersion: number;
  turnSeat: Seat | null;
  turnId: number | null;
  roundId: number | null;
  gameState: unknown;
  readiness: { A: boolean; B: boolean };
  participants: MatchParticipants;
  controller: ControllerInfo;
  result: TerminalResult | null;
}

export interface MatchInitializationParams {
  matchId: string;
  gameId: GameId;
  mode: PlayMode;
  creatorAccountId: AccountId;
  participants: MatchParticipants;
  gameOptions?: Record<string, unknown>;
  startingSeat?: Seat;
}

export interface ProjectionPayload {
  matchId: string;
  deliveryVersion: number;
  lifecycle: MatchLifecycle;
  result?: TerminalResult | null;
  lastActionAt: number;
  finishedAt?: number | null;
  gameId?: GameId;
  mode?: PlayMode;
  participants?: MatchParticipants;
}
