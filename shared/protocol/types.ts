/**
 * Private Arcade V1 — Shared Protocol Types
 * Server-authoritative contract for all game engines, matches, and actions.
 */

export type GameId =
  | "connect-four"
  | "rock-paper-scissors"
  | "ludo"
  | "snakes-and-ladders"
  | "dots-boxes"
  | "sos"
  | "hand-cricket"
  | "sudoku";

export type SharedGameId = Exclude<GameId, "sudoku">;

export type SharedPlayMode = "remote" | "together";
export type SudokuPlayMode = "practice" | "duel" | "challenge";
export type PlayMode = SharedPlayMode | SudokuPlayMode;

export type AccountId = "A" | "B";
export type Seat = "A" | "B";

export type PaletteFamily = "standard" | "romantic";
export type ThemeMode = "light" | "dark" | "system";
export type AccentFamily = "teal" | "violet" | "cyan" | "mint" | "pink" | "yellow";

export type MatchLifecycle =
  "waiting" | "active" | "saved" | "completed" | "resigned" | "abandoned" | "cancelled" | "expired";

export type TerminalReason =
  "rules_win" | "rules_draw" | "resignation" | "abandonment" | "declined" | "cancelled" | "expired";

export interface TerminalResult {
  winner: Seat | null; // null indicates draw or unranked/abandoned
  reason: TerminalReason;
  scores: Record<Seat, number>;
  finishedAt: number; // UTC ms
  resignedBy?: Seat;
  details?: Record<string, unknown>;
}

// Action Types
export type ActionType =
  | "match.accept"
  | "match.decline"
  | "match.cancel"
  | "match.ready"
  | "match.resign"
  | "match.request-abandon"
  | "match.agree-abandon"
  | "match.leave-save"
  | "match.resume"
  | "dice.roll"
  | "ludo.move"
  | "ludo.set-colour"
  | "connect-four.drop"
  | "dots-boxes.edge"
  | "sos.place"
  | "secret.lock"
  | "secret.reveal"
  | "secret.next"
  | "cricket.choose-role"
  | "sudoku.edit"
  | "sudoku.undo"
  | "sudoku.check"
  | "sudoku.pause"
  | "sudoku.resume"
  | "challenge.publish";

// Payloads
export type RPSChoice = "rock" | "paper" | "scissors";

export interface ConnectFourDropPayload {
  column: number; // 0..6
}

export interface SecretLockPayload {
  choice?: RPSChoice; // for RPS
  value?: number; // for Hand Cricket (1..6)
}

export interface LudoMovePayload {
  tokenId: number; // 0..3
}

export interface DotsBoxesEdgePayload {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface SOSPlacePayload {
  row: number;
  col: number;
  letter: "S" | "O";
}

export interface CricketChooseRolePayload {
  role: "bat" | "bowl";
}

export interface SudokuEditPayload {
  row: number;
  col: number;
  operation: "set" | "erase" | "toggle-note";
  value?: number; // 1..9 for 'set' or 'toggle-note'
}

export interface MatchResignPayload {
  resigningSeat?: Seat; // Required only for 'together' mode
}

export interface ChallengePublishPayload {
  senderAttemptId: string;
}

export interface MatchResumePayload {
  pauseId: string;
}

export type ActionPayloadMap = {
  "match.accept": Record<string, never>;
  "match.decline": Record<string, never>;
  "match.cancel": Record<string, never>;
  "match.ready": Record<string, never>;
  "match.resign": MatchResignPayload;
  "match.request-abandon": Record<string, never>;
  "match.agree-abandon": Record<string, never>;
  "match.leave-save": Record<string, never>;
  "match.resume": MatchResumePayload;
  "dice.roll": Record<string, never>;
  "ludo.move": LudoMovePayload;
  "ludo.set-colour": {
    colourId: "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "cyan" | "pink";
    seat?: Seat;
  };
  "connect-four.drop": ConnectFourDropPayload;
  "dots-boxes.edge": DotsBoxesEdgePayload;
  "sos.place": SOSPlacePayload;
  "secret.lock": SecretLockPayload;
  "secret.reveal": Record<string, never>;
  "secret.next": Record<string, never>;
  "cricket.choose-role": CricketChooseRolePayload;
  "sudoku.edit": SudokuEditPayload;
  "sudoku.undo": Record<string, never>;
  "sudoku.check": Record<string, never>;
  "sudoku.pause": Record<string, never>;
  "sudoku.resume": Record<string, never>;
  "challenge.publish": ChallengePublishPayload;
};

// Envelope
export interface ActionEnvelope<T extends ActionType = ActionType> {
  protocolVersion: 1 | 2;
  matchId: string;
  actionId: string; // UUID v4
  action: T;
  payload: ActionPayloadMap[T];
  expectedVersion?: number;
  turnId?: number;
  roundId?: number;
  progressRevision?: number;
  controllerGeneration?: number;
  pauseId?: string;
}

// Viewer Context for filtering
export interface ViewerContext {
  serverTime?: number;
  viewerAccountId: AccountId;
  viewerSeat?: Seat;
  isController: boolean;
  mode: PlayMode;
}

// Filtered View for Clients
export interface FilteredMatchView {
  matchId: string;
  gameId: GameId;
  mode: PlayMode;
  lifecycle: MatchLifecycle;
  deliveryVersion: number;
  schemaVersion?: number;
  rulesVersion?: number;
  participants: {
    A: { accountId: AccountId; displayName: string; ready: boolean; accentFamily?: AccentFamily };
    B?: { accountId: AccountId; displayName: string; ready: boolean; accentFamily?: AccentFamily };
  };
  controller: {
    controllingAccountId: AccountId;
    controllerGeneration: number;
    isController: boolean;
  };
  gameState: unknown; // Filtered game-specific state
  turnSeat?: Seat;
  turnId?: number;
  roundId?: number;
  pauseId?: string;
  savedAt?: number;
  expiresAt?: number;
  resumeReadiness?: Record<Seat, boolean>;
  disconnectEligibility?: { seat: Seat; eligibleAt: number };
  legalActions: ActionType[];
  result?: TerminalResult;
  serverTime: number;
}

// Responses
export interface AcceptedReply {
  status: "accepted";
  actionId: string;
  acceptedVersion: number;
  eventId: string;
  serverTime: number;
  view: FilteredMatchView;
  effects?: unknown[];
}

export interface RejectedReply {
  status: "rejected";
  actionId: string;
  code: string;
  message: string;
  retryable: boolean;
  latestView?: FilteredMatchView;
}

export type ActionResponse = AcceptedReply | RejectedReply;
