import type {
  AccountId,
  ActionPayloadMap,
  ActionType,
  AcceptedReply,
  FilteredMatchView,
  RejectedReply,
} from "../../shared/protocol/types";

export type ConnectionState = "connected" | "connecting" | "disconnected" | "reconnecting";
export type SyncStatus = "idle" | "syncing" | "reconciling";
export type PendingActionStatus = "in-flight" | "retrying" | "reconciling";

export interface PendingAction<T extends ActionType = ActionType> {
  actionId: string;
  action: T;
  payload: ActionPayloadMap[T];
  expectedVersion?: number;
  roundId?: number;
  turnId?: number;
  progressRevision?: number;
  controllerGeneration?: number;
  isSecret: boolean;
  status: PendingActionStatus;
  submittedAt: number;
  retryCount: number;
}

export interface PendingActionMetadata {
  actionId: string;
  action: ActionType;
  expectedVersion?: number;
  roundId?: number;
  turnId?: number;
  progressRevision?: number;
  controllerGeneration?: number;
  isSecret: boolean;
  submittedAt: number;
  payload?: unknown;
}

export interface ControllerStatus {
  controllingAccountId: AccountId;
  controllerGeneration: number;
  isController: boolean;
  takeoverNotice?: boolean;
}

export interface SessionError {
  code: string;
  message: string;
  retryable?: boolean;
  category?: "game" | "transport";
  backendCode?: string;
  httpStatus?: number;
  timestamp: number;
}

export interface MatchSessionState {
  acceptedEvent?: { eventId: string; effects: unknown[] } | null;
  matchId: string;
  actorAccountId: AccountId;
  view: FilteredMatchView | null;
  deliveryVersion: number;
  connectionState: ConnectionState;
  syncStatus: SyncStatus;
  isOffline: boolean;
  isInputPaused: boolean;
  pendingAction: PendingAction | null;
  error: SessionError | null;
  controllerStatus: ControllerStatus | null;
  secretChoiceMasked: boolean;
}

export type SocketServerMessage =
  | {
      type: "snapshot";
      view: FilteredMatchView;
      serverTime: number;
    }
  | {
      type: "event";
      eventId: string;
      acceptedVersion: number;
      view: FilteredMatchView;
      effects?: unknown[];
      serverTime: number;
    }
  | {
      type: "control-changed";
      controller: FilteredMatchView["controller"];
      deliveryVersion: number;
      view?: FilteredMatchView;
      serverTime: number;
    }
  | {
      type: "pong";
      serverTime: number;
    }
  | {
      type: "auth-expired";
    }
  | {
      type: "protocol-update-needed";
    }
  | AcceptedReply
  | RejectedReply;

export interface SecretRecoveryResponse {
  status: "accepted" | "superseded";
  locked: boolean;
  view: FilteredMatchView;
}

export interface ReceiptResponse {
  status: "accepted" | "superseded" | "unknown";
  acceptedVersion?: number;
  eventId?: string;
  createdAt?: number;
  view?: FilteredMatchView;
}

export interface MatchSessionOptions {
  matchId: string;
  actorAccountId: AccountId;
  baseUrl?: string;
  wsUrl?: string;
  initialView?: FilteredMatchView | null;
  onStateChange?: (state: MatchSessionState) => void;
  onError?: (error: SessionError) => void;
  heartbeatIntervalMs?: number;
  pollIntervalMs?: number;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectBackoffFactor?: number;
  transport?: "auto" | "websocket" | "polling";
  fetchFn?: typeof fetch;
  webSocketClass?: any;
  storage?: Storage | null;
}
