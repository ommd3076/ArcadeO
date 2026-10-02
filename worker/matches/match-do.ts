import {
  AcceptedReply,
  AccountId,
  ActionEnvelope,
  ActionResponse,
  ActionType,
  FilteredMatchView,
  MatchLifecycle,
  Seat,
  TerminalResult,
  ViewerContext,
} from "../../shared/protocol/types";
import { ErrorCode } from "../../shared/protocol/errors";
import { validateActionPayload } from "../../shared/protocol/guards";
import { getGameEngine } from "../../shared/games/registry";
import { generateUuid, isValidUuid } from "../../shared/utils/uuid";
import {
  ActionReceiptRow,
  EventRow,
  MatchInitializationParams,
  MatchSnapshotRow,
  ProjectionOutboxRow,
  ProjectionPayload,
  SnapshotData,
} from "./types";
import { computeCanonicalPayloadDigest } from "./digest";
import { activateDuel, acceptChallenge } from "../../shared/games/sudoku/engine";
import { projectSudokuRecord, getCompletedPuzzleIds } from "../sudoku/records";
import type { SudokuRecordParams } from "../sudoku/records";
import type { SudokuState } from "../../shared/games/sudoku/types";

function activeSudokuSeats(game: SudokuState): Seat[] {
  if (game.mode === "practice") return ["A"];
  if (game.mode === "duel") return ["A", "B"];
  if (game.challengePublished && game.receiverAccepted) {
    const sender = game.senderSeat ?? "A";
    return [sender === "A" ? "B" : "A"];
  }
  return game.challengePublished ? [] : [game.senderSeat ?? "A"];
}
import type { CricketState } from "../../shared/games/hand-cricket/types";

export interface MatchDoEnv {
  DB?: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
}

interface SocketClient {
  ws: WebSocket;
  accountId: AccountId;
  sessionId?: string;
}

/**
 * SQLite-backed Match Authority Durable Object
 * Single source of truth for live match state, atomic acceptance, and receipts.
 */
export class MatchDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: MatchDoEnv;
  private initialized = false;
  private connectedSockets = new Set<SocketClient>();
  private authorityTail: Promise<unknown> = Promise.resolve();

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.authorityTail.then(operation, operation);
    this.authorityTail = next.catch(() => {});
    return next;
  }

  private isSolo(snapshot: SnapshotData): boolean {
    return (
      snapshot.gameId === "sudoku" &&
      (snapshot.mode === "practice" ||
        (snapshot.mode === "challenge" && !(snapshot.gameState as SudokuState).challengePublished))
    );
  }

  private isMember(snapshot: SnapshotData, account: AccountId): boolean {
    if (this.isSolo(snapshot)) return snapshot.participants.A.accountId === account;
    return (
      snapshot.participants.A.accountId === account ||
      snapshot.participants.B?.accountId === account
    );
  }

  private safeEffects(snapshot: SnapshotData, effects?: unknown[]): unknown[] {
    if (snapshot.gameId === "sudoku") return [];
    if (
      snapshot.mode === "together" &&
      ["rock-paper-scissors", "hand-cricket"].includes(snapshot.gameId) &&
      !(snapshot.gameState as { revealed?: boolean }).revealed
    )
      return [];
    return effects ?? [];
  }

  private async authorizeSession(account: AccountId, sessionId?: string): Promise<boolean> {
    if (!this.env.DB) return false;
    if (!sessionId) return false;
    const primary =
      typeof this.env.DB.withSession === "function"
        ? this.env.DB.withSession("first-primary")
        : this.env.DB;
    const row = await primary
      .prepare("SELECT accountId, expiresAt, revokedAt FROM sessions WHERE sessionId = ?")
      .bind(sessionId)
      .first<{ accountId: string; expiresAt: number; revokedAt: number | null }>();
    return (
      !!row && row.accountId === account && row.revokedAt == null && row.expiresAt > Date.now()
    );
  }

  private sudokuRecords(snapshot: SnapshotData, game: SudokuState): SudokuRecordParams[] {
    return (["A", "B"] as const).flatMap((seat) => {
      const player = game.players[seat];
      const participant = snapshot.participants[seat];
      if (
        !participant ||
        player.completedAt === null ||
        (game.challengePublished && seat === (game.senderSeat ?? "A"))
      )
        return [];
      return [
        {
          attemptId: snapshot.matchId,
          accountId: participant.accountId,
          puzzleId: game.puzzleId,
          mode: game.mode,
          elapsedMs: player.elapsedMs,
          assisted: player.assisted,
          replay: Boolean(game.replay),
          interrupted: game.mode === "duel" && Boolean(game.interrupted),
          completedAt: player.completedAt,
          resultMatchId:
            game.mode === "practice" || (!game.challengePublished && game.mode === "challenge")
              ? undefined
              : snapshot.matchId,
        },
      ];
    });
  }

  private randomDie(): number {
    const value = new Uint32Array(1);
    do {
      crypto.getRandomValues(value);
    } while (value[0] >= 4294967292);
    return (value[0] % 6) + 1;
  }

  private async scheduleEarliestAlarm(): Promise<void> {
    if (typeof this.state.storage.setAlarm !== "function") return;
    const now = Date.now();
    const times: number[] = [];

    // A Sudoku Duel becomes editable when its persisted start time arrives. Keep
    // that wakeup in Durable Object storage so it survives eviction and wakes
    // connected hibernating sockets without a client action or reload.
    const snapshot = this.getSnapshot();
    if (
      snapshot?.gameId === "sudoku" &&
      snapshot.mode === "duel" &&
      snapshot.lifecycle === "active"
    ) {
      const game = snapshot.gameState as SudokuState;
      if (
        !game.terminalResult &&
        typeof game.scheduledStartTime === "number" &&
        game.scheduledStartTime > now
      )
        times.push(game.scheduledStartTime);
    }

    const pending = this.state.storage.sql
      .exec<{ nextAttemptAt: number }>(
        "SELECT MIN(nextAttemptAt) AS nextAttemptAt FROM projection_outbox",
      )
      .toArray()[0];
    if (pending?.nextAttemptAt) {
      times.push(Math.max(now + 1, pending.nextAttemptAt));
    }

    if (times.length > 0) {
      const earliest = Math.min(...times);
      await this.state.storage.setAlarm(earliest);
    } else if (typeof this.state.storage.deleteAlarm === "function") {
      await this.state.storage.deleteAlarm();
    }
  }

  constructor(state: DurableObjectState, env: MatchDoEnv) {
    this.state = state;
    this.env = env;
  }

  /**
   * Initializes the SQLite schema tables if they do not yet exist.
   */
  private ensureSchema(): void {
    if (this.initialized) return;

    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS initialization_identity (digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS match_snapshot (
        matchId TEXT PRIMARY KEY,
        gameId TEXT NOT NULL,
        mode TEXT NOT NULL,
        lifecycle TEXT NOT NULL,
        deliveryVersion INTEGER NOT NULL,
        schemaVersion INTEGER NOT NULL,
        rulesVersion INTEGER NOT NULL,
        turnSeat TEXT,
        turnId INTEGER,
        roundId INTEGER,
        pauseId TEXT,
        savedAt INTEGER,
        expiresAt INTEGER,
        resumeReadiness TEXT,
        authorityEpoch INTEGER,
        gameState TEXT NOT NULL,
        readiness TEXT NOT NULL,
        participants TEXT NOT NULL,
        controller TEXT NOT NULL,
        result TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId TEXT UNIQUE NOT NULL,
        actionId TEXT NOT NULL,
        actorAccount TEXT NOT NULL,
        actorSeat TEXT NOT NULL,
        acceptedAt INTEGER NOT NULL,
        effects TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS action_receipts (
        actorAccount TEXT NOT NULL,
        actionId TEXT NOT NULL,
        status TEXT NOT NULL,
        acceptedVersion INTEGER,
        eventId TEXT,
        canonicalPayloadDigest TEXT,
        createdAt INTEGER NOT NULL,
        actionType TEXT,
        actorSeat TEXT,
        roundId INTEGER,
        controllerGeneration INTEGER,
        authorityEpoch INTEGER,
        PRIMARY KEY (actorAccount, actionId)
      );

      CREATE TABLE IF NOT EXISTS private_round_choices (
        roundId INTEGER NOT NULL,
        seat TEXT NOT NULL,
        choiceValue TEXT NOT NULL,
        lockedAt INTEGER NOT NULL,
        PRIMARY KEY (roundId, seat)
      );

      CREATE TABLE IF NOT EXISTS projection_outbox (
        projectionKey TEXT PRIMARY KEY,
        requiredVersion INTEGER NOT NULL,
        payload TEXT NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0,
        nextAttemptAt INTEGER NOT NULL
      );
    `);

    const addColumn = (table: string, colDef: string) => {
      try {
        this.state.storage.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch {
        // Column already exists
      }
    };
    addColumn("match_snapshot", "pauseId TEXT");
    addColumn("match_snapshot", "savedAt INTEGER");
    addColumn("match_snapshot", "expiresAt INTEGER");
    addColumn("match_snapshot", "resumeReadiness TEXT");
    addColumn("match_snapshot", "authorityEpoch INTEGER");

    addColumn("action_receipts", "actionType TEXT");
    addColumn("action_receipts", "actorSeat TEXT");
    addColumn("action_receipts", "roundId INTEGER");
    addColumn("action_receipts", "controllerGeneration INTEGER");
    addColumn("action_receipts", "authorityEpoch INTEGER");

    this.initialized = true;
  }

  /**
   * Reads and parses the current match_snapshot row.
   */
  public getSnapshot(): SnapshotData | null {
    this.ensureSchema();
    const rows = this.state.storage.sql
      .exec<MatchSnapshotRow>("SELECT * FROM match_snapshot LIMIT 1")
      .toArray();

    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      matchId: r.matchId,
      gameId: r.gameId,
      mode: r.mode,
      lifecycle: r.lifecycle,
      deliveryVersion: Number(r.deliveryVersion),
      schemaVersion: Number(r.schemaVersion),
      rulesVersion: Number(r.rulesVersion),
      turnSeat: r.turnSeat,
      turnId: r.turnId !== null ? Number(r.turnId) : null,
      roundId: r.roundId !== null ? Number(r.roundId) : null,
      pauseId: r.pauseId ?? null,
      savedAt: r.savedAt !== null && r.savedAt !== undefined ? Number(r.savedAt) : null,
      expiresAt: r.expiresAt !== null && r.expiresAt !== undefined ? Number(r.expiresAt) : null,
      resumeReadiness: r.resumeReadiness ? JSON.parse(r.resumeReadiness) : null,
      authorityEpoch:
        r.authorityEpoch !== null && r.authorityEpoch !== undefined
          ? Number(r.authorityEpoch)
          : null,
      gameState: JSON.parse(r.gameState),
      readiness: JSON.parse(r.readiness),
      participants:
        r.gameId === "sudoku" &&
        (r.mode === "practice" ||
          (r.mode === "challenge" && !JSON.parse(r.gameState).challengePublished))
          ? { A: JSON.parse(r.participants).A }
          : JSON.parse(r.participants),
      controller: JSON.parse(r.controller),
      result: r.result ? JSON.parse(r.result) : null,
    };
  }

  /**
   * Generates a viewer-filtered match view conforming to protocol specifications.
   */
  public buildFilteredView(
    snapshot: SnapshotData,
    viewerAccountId: AccountId,
    viewerSessionId?: string,
  ): FilteredMatchView {
    let viewerSeat: Seat | undefined;
    let isController = false;

    if (snapshot.mode === "together") {
      isController =
        snapshot.controller.controllingAccountId === viewerAccountId &&
        (!snapshot.controller.controllingSessionId ||
          snapshot.controller.controllingSessionId === viewerSessionId);
      const secret = snapshot.gameState as {
        phase?: string;
        tossWinner?: Seat;
        lockedSeats?: Seat[];
        roundId?: number;
        deliveryId?: number;
        roles?: { bat: Seat; bowl: Seat };
      };
      if (
        ["rock-paper-scissors", "hand-cricket"].includes(snapshot.gameId) &&
        secret.phase !== "toss"
      ) {
        let first: Seat;
        if (snapshot.gameId === "hand-cricket" && snapshot.rulesVersion === 2 && secret.roles) {
          first = secret.roles.bat;
        } else {
          first = (secret.roundId ?? secret.deliveryId ?? 1) % 2 === 1 ? "A" : "B";
        }
        const second: Seat =
          snapshot.gameId === "hand-cricket" && snapshot.rulesVersion === 2 && secret.roles
            ? secret.roles.bowl
            : first === "A"
              ? "B"
              : "A";
        viewerSeat = secret.lockedSeats?.includes(first) ? second : first;
      } else viewerSeat = snapshot.turnSeat ?? "A";
    } else {
      if (snapshot.participants.A.accountId === viewerAccountId) {
        viewerSeat = "A";
      } else if (snapshot.participants.B?.accountId === viewerAccountId) {
        viewerSeat = "B";
      }
      if (snapshot.gameId === "sudoku") {
        const controller = snapshot.controller.playerControllers?.[viewerAccountId];
        isController =
          !!viewerSeat && (!controller?.sessionId || controller.sessionId === viewerSessionId);
      } else isController = viewerSeat === snapshot.turnSeat;
    }

    const engine = getGameEngine(snapshot.gameId, snapshot.rulesVersion);
    const viewerContext: ViewerContext = {
      viewerAccountId,
      viewerSeat,
      isController,
      mode: snapshot.mode,
      serverTime: Date.now(),
    };

    let filteredGameState: unknown = null;
    if (engine && typeof engine.toPublicView === "function") {
      try {
        filteredGameState = engine.toPublicView(snapshot.gameState, viewerContext);
      } catch (err) {
        console.error("Failed to build public view:", err);
        filteredGameState = null;
      }
    }

    let legalActions: ActionType[] = [];
    if (snapshot.lifecycle === "active") {
      if (engine && viewerSeat && typeof engine.legalActions === "function") {
        legalActions = engine.legalActions(snapshot.gameState, viewerSeat, Date.now());
      }
      legalActions.push("match.leave-save");
      if (this.isSolo(snapshot)) legalActions.push("match.request-abandon");
      else legalActions.push("match.resign");
      if (snapshot.mode === "together") legalActions.push("match.agree-abandon");
      if (snapshot.mode === "remote") {
        legalActions.push("match.request-abandon");
        if (
          snapshot.controller.abandonRequestedBy &&
          snapshot.controller.abandonRequestedBy !== viewerSeat
        )
          legalActions.push("match.agree-abandon");
      }
    } else if (snapshot.lifecycle === "saved") {
      legalActions = ["match.resume"];
      if (this.isSolo(snapshot)) legalActions.push("match.request-abandon");
      else legalActions.push("match.resign");
      if (snapshot.mode === "together") legalActions.push("match.agree-abandon");
    } else if (snapshot.lifecycle === "waiting") {
      legalActions = snapshot.controller.invitationAccepted
        ? ["match.ready"]
        : viewerSeat === "B"
          ? ["match.accept", "match.decline"]
          : ["match.cancel"];
      if (viewerSeat === "A") legalActions.push("match.cancel");
    }

    if ((snapshot.mode === "together" || snapshot.gameId === "sudoku") && !isController)
      legalActions = [];
    return {
      matchId: snapshot.matchId,
      gameId: snapshot.gameId,
      mode: snapshot.mode,
      lifecycle: snapshot.lifecycle,
      deliveryVersion: snapshot.deliveryVersion,
      schemaVersion: snapshot.schemaVersion,
      rulesVersion: snapshot.rulesVersion,
      pauseId: snapshot.pauseId ?? undefined,
      savedAt: snapshot.savedAt ?? undefined,
      // Legacy saved-snapshot expiry metadata is ignored. Saved matches remain
      // resumable until an explicit terminal action.
      resumeReadiness: (snapshot.resumeReadiness as Record<Seat, boolean>) ?? undefined,
      invitationAccepted: Boolean(snapshot.controller.invitationAccepted),
      readiness: { ...snapshot.readiness },
      participants: {
        A: snapshot.participants.A,
        B: snapshot.participants.B,
      },
      controller: {
        controllingAccountId: snapshot.controller.controllingAccountId,
        controllerGeneration:
          snapshot.controller.playerControllers?.[viewerAccountId]?.generation ??
          snapshot.controller.controllerGeneration,
        isController,
      },
      gameState: filteredGameState,
      turnSeat: snapshot.mode === "together" ? viewerSeat : (snapshot.turnSeat ?? undefined),
      turnId: snapshot.turnId ?? undefined,
      roundId: snapshot.roundId ?? undefined,
      legalActions,
      result: snapshot.result ?? undefined,
      serverTime: Date.now(),
    };
  }

  /**
   * Initializes a new match within the Durable Object.
   */
  public initializeMatch(params: MatchInitializationParams): Promise<FilteredMatchView> {
    return this.serialize(() => this.initializeSerialized(params));
  }

  private async initializeSerialized(
    params: MatchInitializationParams,
  ): Promise<FilteredMatchView> {
    this.ensureSchema();
    const initializationDigest = await computeCanonicalPayloadDigest("match.initialize", {
      matchId: params.matchId,
      gameId: params.gameId,
      mode: params.mode,
      creatorAccountId: params.creatorAccountId,
      participants: params.participants,
      gameOptions: params.gameOptions ?? {},
      startingSeat: params.startingSeat ?? "A",
    });
    const reservation = this.state.storage.sql
      .exec<{ digest: string }>("SELECT digest FROM initialization_identity LIMIT 1")
      .toArray()[0];
    if (reservation?.digest === "cancelled") throw new Error("Reservation expired");
    const existing = this.getSnapshot();
    if (existing) {
      const identity = this.state.storage.sql
        .exec<{ digest: string }>("SELECT digest FROM initialization_identity LIMIT 1")
        .toArray()[0];
      if (identity && identity.digest !== initializationDigest)
        throw new Error("Initialization conflict");
      if (
        existing.matchId !== params.matchId ||
        existing.gameId !== params.gameId ||
        existing.mode !== params.mode ||
        !this.isMember(existing, params.creatorAccountId)
      )
        throw new Error("Initialization conflict");
      return this.buildFilteredView(existing, params.creatorAccountId, params.creatorSessionId);
    }

    const requestedRulesVersion =
      typeof params.gameOptions?.rulesVersion === "number"
        ? (params.gameOptions.rulesVersion as number)
        : undefined;
    const engine = getGameEngine(params.gameId, requestedRulesVersion);
    if (!engine) {
      throw new Error(`Unsupported game engine: ${params.gameId}`);
    }

    const rulesVersion = engine.rulesVersion ?? requestedRulesVersion ?? 1;
    const initialGameState = engine.createInitialState({
      serverTime: Date.now(),
      startingSeat:
        params.startingSeat ??
        (params.gameId === "hand-cricket" && this.randomDie() % 2 === 0 ? "B" : "A"),
      config: { ...params.gameOptions, mode: params.mode, rulesVersion },
    });

    const isTogether = params.mode === "together";
    const isPractice = params.mode === "practice";
    const lifecycle: MatchLifecycle =
      isTogether ||
      isPractice ||
      (params.mode === "challenge" && !params.gameOptions?.challengePublished)
        ? "active"
        : "waiting";

    const snapshot: SnapshotData = {
      matchId: params.matchId,
      gameId: params.gameId,
      mode: params.mode,
      lifecycle,
      deliveryVersion: 1,
      schemaVersion: 1,
      rulesVersion,
      turnSeat:
        (initialGameState as { activeSeat?: Seat; tossWinner?: Seat }).activeSeat ??
        (initialGameState as { tossWinner?: Seat }).tossWinner ??
        "A",
      turnId: 1,
      roundId: 1,
      gameState: initialGameState,
      readiness: {
        A: isTogether || isPractice,
        B: isTogether || isPractice,
      },
      participants:
        params.gameId === "sudoku" &&
        (params.mode === "practice" ||
          (params.mode === "challenge" && !params.gameOptions?.challengePublished))
          ? { A: params.participants.A }
          : params.participants,
      controller: {
        controllingAccountId: params.creatorAccountId,
        controllerGeneration: 1,
        controllingSessionId: params.creatorSessionId,
        ...(params.gameId === "sudoku"
          ? {
              playerControllers: {
                [params.creatorAccountId]: { sessionId: params.creatorSessionId, generation: 1 },
              },
            }
          : {}),
      },
      result: null,
    };

    const outboxPayload: ProjectionPayload = {
      matchId: params.matchId,
      deliveryVersion: snapshot.deliveryVersion,
      lifecycle: snapshot.lifecycle,
      result: null,
      lastActionAt: Date.now(),
      finishedAt: null,
      gameId: params.gameId,
      mode: params.mode,
      participants: snapshot.participants,
    };

    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        "INSERT INTO initialization_identity (digest) VALUES (?)",
        initializationDigest,
      );
      this.state.storage.sql.exec(
        `INSERT INTO match_snapshot (
          matchId, gameId, mode, lifecycle, deliveryVersion, schemaVersion, rulesVersion,
          turnSeat, turnId, roundId, gameState, readiness, participants, controller, result
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        snapshot.matchId,
        snapshot.gameId,
        snapshot.mode,
        snapshot.lifecycle,
        snapshot.deliveryVersion,
        snapshot.schemaVersion,
        snapshot.rulesVersion,
        snapshot.turnSeat,
        snapshot.turnId,
        snapshot.roundId,
        JSON.stringify(snapshot.gameState),
        JSON.stringify(snapshot.readiness),
        JSON.stringify(snapshot.participants),
        JSON.stringify(snapshot.controller),
        null,
      );

      this.state.storage.sql.exec(
        `INSERT INTO projection_outbox (projectionKey, requiredVersion, payload, retries, nextAttemptAt)
         VALUES (?, ?, ?, 0, ?)`,
        `proj_${snapshot.matchId}_${snapshot.deliveryVersion}`,
        snapshot.deliveryVersion,
        JSON.stringify(outboxPayload),
        Date.now(),
      );
    });

    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    this.state.waitUntil?.(this.flushProjectionOutbox().catch(() => {}));

    return this.buildFilteredView(snapshot, params.creatorAccountId, params.creatorSessionId);
  }

  /**
   * Acceptance Pipeline (HTTP and WebSocket shared)
   */
  public async handleAction(
    envelope: ActionEnvelope,
    actorAccountId: AccountId,
    sessionId?: string,
    requestingSocket?: WebSocket,
  ): Promise<ActionResponse> {
    return this.serialize(async () => {
      if (!(await this.authorizeSession(actorAccountId, sessionId)))
        return {
          status: "rejected",
          actionId: envelope?.actionId,
          code: ErrorCode.AUTH_REQUIRED,
          message: "Current session required",
          retryable: false,
        };
      let replayAtAcceptance = false;
      const snapshot = this.getSnapshot();
      if (
        this.env.DB &&
        snapshot?.gameId === "sudoku" &&
        snapshot.mode === "challenge" &&
        envelope.action === "match.accept"
      )
        replayAtAcceptance = (await getCompletedPuzzleIds(this.env.DB, actorAccountId)).has(
          (snapshot.gameState as SudokuState).puzzleId,
        );
      return this.handleActionSerialized(
        envelope,
        actorAccountId,
        sessionId,
        replayAtAcceptance,
        requestingSocket,
      );
    });
  }

  private async handleActionSerialized(
    envelope: ActionEnvelope,
    actorAccountId: AccountId,
    sessionId?: string,
    replayAtAcceptance = false,
    requestingSocket?: WebSocket,
  ): Promise<ActionResponse> {
    this.ensureSchema();
    const snapshot = this.getSnapshot();

    if (!snapshot) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.NOT_FOUND,
        message: "Match not found",
        retryable: false,
      };
    }

    const reject = (
      code: (typeof ErrorCode)[keyof typeof ErrorCode],
      message: string,
    ): ActionResponse => ({
      status: "rejected",
      actionId: envelope?.actionId,
      code,
      message,
      retryable: false,
      ...(this.isMember(snapshot, actorAccountId)
        ? { latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId) }
        : {}),
    });
    if (!this.isMember(snapshot, actorAccountId))
      return reject(ErrorCode.FORBIDDEN, "Match unavailable");
    if (envelope?.protocolVersion !== 1 && envelope?.protocolVersion !== 2)
      return reject(ErrorCode.PROTOCOL_MISMATCH, "Update required");
    const envelopeKeys = [
      "protocolVersion",
      "matchId",
      "actionId",
      "action",
      "payload",
      "expectedVersion",
      "turnId",
      "roundId",
      "progressRevision",
      "controllerGeneration",
      "pauseId",
    ];
    if (
      !envelope ||
      Object.keys(envelope).some((key) => !envelopeKeys.includes(key)) ||
      envelope.matchId !== snapshot.matchId ||
      typeof envelope.action !== "string" ||
      typeof envelope.actionId !== "string" ||
      !isValidUuid(envelope.actionId)
    )
      return reject(ErrorCode.INVALID_ACTION, "Invalid action envelope");
    // Step 1: Authenticate actor membership & check controller generation
    let actorSeat: Seat;
    if (snapshot.mode === "together") {
      const payloadResign = (envelope.payload as { resigningSeat?: Seat })?.resigningSeat;
      const game = snapshot.gameState as {
        lockedSeats?: Seat[];
        roundId?: number;
        deliveryId?: number;
        roles?: { bat: Seat; bowl: Seat };
      };
      let firstSeat: Seat;
      if (snapshot.gameId === "hand-cricket" && snapshot.rulesVersion === 2 && game.roles) {
        firstSeat = game.roles.bat;
      } else {
        firstSeat = (game.roundId ?? game.deliveryId ?? 1) % 2 === 1 ? "A" : "B";
      }
      const secondSeat: Seat =
        snapshot.gameId === "hand-cricket" && snapshot.rulesVersion === 2 && game.roles
          ? game.roles.bowl
          : firstSeat === "A"
            ? "B"
            : "A";
      actorSeat =
        envelope.action === "match.resign"
          ? payloadResign!
          : envelope.action === "ludo.set-colour"
            ? ((envelope.payload as { seat?: Seat })?.seat ?? snapshot.turnSeat ?? "A")
            : envelope.action === "secret.lock"
              ? game.lockedSeats?.includes(firstSeat)
                ? secondSeat
                : firstSeat
              : snapshot.turnSeat || "A";
      if (envelope.action === "match.resign" && payloadResign !== "A" && payloadResign !== "B")
        return reject(ErrorCode.INVALID_ACTION, "Choose the resigning seat");
    } else {
      if (snapshot.participants.A.accountId === actorAccountId) {
        actorSeat = "A";
      } else if (snapshot.participants.B?.accountId === actorAccountId) {
        actorSeat = "B";
      } else {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.FORBIDDEN,
          message: "Actor is not an authorized participant in this match",
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }
    }
    // Step 2: Check existing receipt for actorAccount + actionId
    const currentDigest = await computeCanonicalPayloadDigest(envelope.action, envelope.payload);
    const existingReceipts = this.state.storage.sql
      .exec<ActionReceiptRow>(
        "SELECT * FROM action_receipts WHERE actorAccount = ? AND actionId = ? LIMIT 1",
        actorAccountId,
        envelope.actionId,
      )
      .toArray();

    if (existingReceipts.length > 0) {
      const receipt = existingReceipts[0];
      if (receipt.status === "superseded") {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.ACTION_SUPERSEDED,
          message: "This action was previously superseded during recovery and cannot be replayed",
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }

      if (receipt.status === "accepted") {
        if (receipt.canonicalPayloadDigest === currentDigest) {
          // Idempotent cached reply
          let cachedEffects: unknown[] | undefined;
          if (receipt.eventId) {
            const evRows = this.state.storage.sql
              .exec<EventRow>(
                "SELECT effects FROM events WHERE eventId = ? LIMIT 1",
                receipt.eventId,
              )
              .toArray();
            if (evRows.length > 0 && evRows[0].effects) {
              cachedEffects = JSON.parse(evRows[0].effects);
            }
          }

          return {
            status: "accepted",
            actionId: envelope.actionId,
            acceptedVersion: receipt.acceptedVersion!,
            eventId: receipt.eventId!,
            serverTime: receipt.createdAt,
            view: this.buildFilteredView(snapshot, actorAccountId, sessionId),
            effects: this.safeEffects(snapshot, cachedEffects),
          };
        } else {
          return {
            status: "rejected",
            actionId: envelope.actionId,
            code: ErrorCode.ID_REUSED,
            message: "Action ID was previously used with a different payload",
            retryable: false,
            latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
          };
        }
      }
    }

    if (snapshot.mode === "together") {
      if (
        snapshot.controller.controllingAccountId !== actorAccountId ||
        envelope.controllerGeneration !== snapshot.controller.controllerGeneration ||
        (snapshot.controller.controllingSessionId &&
          snapshot.controller.controllingSessionId !== sessionId)
      ) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.CONTROL_TRANSFERRED,
          message: "Control has been transferred to another device or session",
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }
    }

    const gameEngine = getGameEngine(snapshot.gameId, snapshot.rulesVersion);
    if (!gameEngine || snapshot.schemaVersion !== 1)
      return reject(ErrorCode.UNSUPPORTED_RULES, "Saved rules require a compatible update");
    // A resolved winning secret round is immutable before its presentation reveal.
    if (
      (snapshot.gameState as { terminalResult?: unknown }).terminalResult &&
      snapshot.mode === "together" &&
      envelope.action !== "secret.reveal"
    )
      return reject(ErrorCode.MATCH_FINISHED, "Only reveal remains");
    // Step 3: Guard checks (lifecycle, concurrency, turn seat)
    if (
      ["completed", "resigned", "abandoned", "cancelled", "expired"].includes(snapshot.lifecycle)
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.MATCH_FINISHED,
        message: "Match has already finished",
        retryable: false,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      snapshot.lifecycle === "saved" &&
      !["match.resume", "match.resign", "match.request-abandon", "match.agree-abandon"].includes(
        envelope.action,
      )
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.INVALID_ACTION,
        message: "Match is paused and must be resumed",
        retryable: false,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    const payloadCheck = validateActionPayload(envelope.action, envelope.payload, {
      maxSecretValue: snapshot.rulesVersion === 2 ? 10 : 6,
    });
    if (!payloadCheck.valid) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: payloadCheck.error.code,
        message: payloadCheck.error.message,
        retryable: payloadCheck.error.retryable,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      !envelope.action.startsWith("secret.") &&
      !envelope.action.startsWith("sudoku.") &&
      envelope.expectedVersion !== undefined &&
      envelope.expectedVersion !== snapshot.deliveryVersion
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.STALE_STATE,
        message: `Expected delivery version ${envelope.expectedVersion}, but current is ${snapshot.deliveryVersion}`,
        retryable: true,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      envelope.turnId !== undefined &&
      snapshot.turnId !== null &&
      envelope.turnId !== snapshot.turnId
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.STALE_STATE,
        message: `Expected turn ${envelope.turnId}, but current is ${snapshot.turnId}`,
        retryable: true,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      envelope.roundId !== undefined &&
      snapshot.roundId !== null &&
      envelope.roundId !== snapshot.roundId
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.WRONG_ROUND,
        message: `Expected round ${envelope.roundId}, but current is ${snapshot.roundId}`,
        retryable: false,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      (envelope.action.startsWith("match.") ||
        [
          "connect-four.drop",
          "ludo.move",
          "ludo.set-colour",
          "dots-boxes.edge",
          "sos.place",
          "dice.roll",
          "cricket.choose-role",
        ].includes(envelope.action)) &&
      envelope.expectedVersion !== snapshot.deliveryVersion
    )
      return reject(ErrorCode.STALE_STATE, "Current version required");
    if (
      ["connect-four.drop", "ludo.move", "dots-boxes.edge", "sos.place", "dice.roll"].includes(
        envelope.action,
      ) &&
      envelope.turnId !== snapshot.turnId
    )
      return reject(ErrorCode.STALE_STATE, "Current turn required");
    if (envelope.action.startsWith("sudoku.")) {
      const controller = snapshot.controller.playerControllers?.[actorAccountId];
      if (
        controller &&
        (envelope.controllerGeneration !== controller.generation ||
          (controller.sessionId && controller.sessionId !== sessionId))
      )
        return reject(ErrorCode.CONTROL_TRANSFERRED, "Current Sudoku controller required");
      if (!controller && envelope.controllerGeneration !== snapshot.controller.controllerGeneration)
        return reject(ErrorCode.CONTROL_TRANSFERRED, "Current Sudoku generation required");
      const player = (snapshot.gameState as SudokuState).players[actorSeat];
      if (envelope.progressRevision !== player.progressRevision)
        return reject(ErrorCode.STALE_STATE, "Current progress revision required");
    }
    if (envelope.action.startsWith("secret.") && envelope.roundId !== snapshot.roundId)
      return reject(ErrorCode.WRONG_ROUND, "Current round required");
    if (
      ["match.accept", "match.decline", "match.cancel", "match.ready"].includes(envelope.action) &&
      snapshot.lifecycle !== "waiting"
    )
      return reject(ErrorCode.INVALID_ACTION, "Invitation is no longer waiting");
    if (["match.accept", "match.decline"].includes(envelope.action) && actorSeat !== "B")
      return reject(ErrorCode.FORBIDDEN, "Invitee required");
    if (envelope.action === "match.cancel" && actorSeat !== "A")
      return reject(ErrorCode.FORBIDDEN, "Creator required");
    if (envelope.action === "match.leave-save" && snapshot.lifecycle !== "active")
      return reject(ErrorCode.INVALID_ACTION, "Only active matches can be saved");
    if (envelope.action === "match.resume" && snapshot.lifecycle !== "saved")
      return reject(ErrorCode.INVALID_ACTION, "Only paused matches can be resumed");
    if (!envelope.action.startsWith("match.") && snapshot.lifecycle !== "active")
      return reject(ErrorCode.INVALID_ACTION, "Match has not started");

    // Turn seat check for turn-based moves
    const turnActions: ActionType[] = [
      "connect-four.drop",
      "ludo.move",
      "dots-boxes.edge",
      "sos.place",
      "dice.roll",
    ];
    if (turnActions.includes(envelope.action)) {
      if (snapshot.turnSeat !== null && actorSeat !== snapshot.turnSeat) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.NOT_YOUR_TURN,
          message: `It is not seat ${actorSeat}'s turn`,
          retryable: true,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }
    }

    // Step 4: Pure reduction
    let newGameState = snapshot.gameState;
    let newLifecycle = snapshot.lifecycle;
    let newTurnSeat = snapshot.turnSeat;
    let newTurnId = snapshot.turnId;
    let newRoundId = snapshot.roundId;
    let newPauseId: string | null = snapshot.pauseId ?? null;
    let newSavedAt: number | null = snapshot.savedAt ?? null;
    let newExpiresAt: number | null = snapshot.expiresAt ?? null;
    let newResumeReadiness = snapshot.resumeReadiness ? { ...snapshot.resumeReadiness } : null;
    const newAuthorityEpoch = snapshot.authorityEpoch ?? 1;
    const newReadiness = { ...snapshot.readiness };
    const newController = { ...snapshot.controller };
    if (snapshot.gameId === "sudoku" && !newController.playerControllers?.[actorAccountId])
      newController.playerControllers = {
        ...newController.playerControllers,
        [actorAccountId]: { sessionId, generation: 1 },
      };
    let effects: unknown[] = [];
    let terminalResult: TerminalResult | null = null;
    const serverTime = Date.now();

    if (envelope.action === "match.accept") {
      newController.invitationAccepted = true;
      if (snapshot.gameId === "sudoku" && snapshot.mode === "challenge") {
        newGameState = acceptChallenge(
          snapshot.gameState as SudokuState,
          actorSeat,
          serverTime,
          Boolean((snapshot.gameState as SudokuState).replay) || replayAtAcceptance,
        );
        newLifecycle = "active";
      }
      effects = [{ type: "invitation-accepted", seat: actorSeat }];
    } else if (envelope.action === "match.ready") {
      if (snapshot.mode !== "together" && !snapshot.controller.invitationAccepted)
        return reject(ErrorCode.INVALID_ACTION, "Accept invitation first");
      newReadiness[actorSeat] = true;
      if (snapshot.mode === "together") {
        newReadiness.A = true;
        newReadiness.B = true;
      }
      if (newReadiness.A && newReadiness.B) {
        newLifecycle = "active";
        if (snapshot.gameId === "sudoku" && snapshot.mode === "duel")
          newGameState = activateDuel(snapshot.gameState as SudokuState, serverTime);
      }
      effects = [{ type: "player-ready", seat: actorSeat, active: newLifecycle === "active" }];
    } else if (envelope.action === "match.decline") {
      newLifecycle = "cancelled";
      terminalResult = {
        winner: null,
        reason: "declined",
        finishedAt: serverTime,
        scores: { A: 0, B: 0 },
      };
      newTurnSeat = null;
      newPauseId = null;
      newSavedAt = null;
      newExpiresAt = null;
      newResumeReadiness = null;
      effects = [{ type: "invitation-declined", seat: actorSeat }];
    } else if (envelope.action === "match.cancel") {
      newLifecycle = "cancelled";
      terminalResult = {
        winner: null,
        reason: "cancelled",
        finishedAt: serverTime,
        scores: { A: 0, B: 0 },
      };
      newTurnSeat = null;
      newPauseId = null;
      newSavedAt = null;
      newExpiresAt = null;
      newResumeReadiness = null;
      effects = [{ type: "match-cancelled", seat: actorSeat }];
    } else if (envelope.action === "match.request-abandon") {
      if (this.isSolo(snapshot)) {
        newLifecycle = "abandoned";
        newTurnSeat = null;
        newPauseId = null;
        newSavedAt = null;
        newExpiresAt = null;
        newResumeReadiness = null;
        terminalResult = {
          winner: null,
          reason: "abandonment",
          finishedAt: serverTime,
          scores: { A: 0, B: 0 },
          details: { scored: false },
        };
        effects = [{ type: "match-abandoned" }];
      } else {
        newController.abandonRequestedBy = actorSeat;
        effects = [{ type: "abandon-requested", seat: actorSeat }];
      }
    } else if (envelope.action === "match.agree-abandon") {
      if (
        snapshot.mode !== "together" &&
        (!snapshot.controller.abandonRequestedBy ||
          snapshot.controller.abandonRequestedBy === actorSeat)
      )
        return reject(ErrorCode.INVALID_ACTION, "Other seat must request abandonment");
      newLifecycle = "abandoned";
      newTurnSeat = null;
      newPauseId = null;
      newSavedAt = null;
      newExpiresAt = null;
      newResumeReadiness = null;
      terminalResult = {
        winner: null,
        reason: "abandonment",
        finishedAt: serverTime,
        scores: { A: 0, B: 0 },
      };
      effects = [{ type: "match-abandoned" }];
    } else if (envelope.action === "match.resign") {
      if (this.isSolo(snapshot))
        return reject(ErrorCode.INVALID_ACTION, "Use unscored abandonment for a solo attempt");
      const resigningSeat =
        (snapshot.mode === "together" &&
          (envelope.payload as { resigningSeat?: Seat })?.resigningSeat) ||
        actorSeat;
      const winner: Seat = resigningSeat === "A" ? "B" : "A";
      terminalResult = {
        winner,
        reason: "resignation",
        resignedBy: resigningSeat,
        finishedAt: serverTime,
        scores: {
          A: winner === "A" ? 1 : 0,
          B: winner === "B" ? 1 : 0,
        },
      };
      newLifecycle = "resigned";
      newTurnSeat = null;
      newPauseId = null;
      newSavedAt = null;
      newExpiresAt = null;
      newResumeReadiness = null;
      effects = [{ type: "player-resigned", resigningSeat, winner }];
    } else if (envelope.action === "match.leave-save") {
      if (snapshot.lifecycle !== "active")
        return reject(ErrorCode.INVALID_ACTION, "Only active matches can be saved and paused");
      newLifecycle = "saved";
      newPauseId = generateUuid();
      newSavedAt = serverTime;
      newExpiresAt = null;
      newResumeReadiness = { A: false, B: false };
      if (snapshot.gameId === "sudoku") {
        const sState = JSON.parse(JSON.stringify(newGameState)) as SudokuState;
        if (sState.mode === "duel") sState.interrupted = true;
        // Practice and a history-only Duel pause their own clocks on deliberate
        // save. Async attempts use a continuous competitive clock: lifecycle
        // gating pauses input, but time continues so Save cannot improve a time.
        if (sState.mode !== "challenge") {
          for (const seat of activeSudokuSeats(sState)) {
            const p = sState.players?.[seat];
            if (p && !p.completedAt && !p.paused) {
              p.paused = true;
              p.pausedAt = serverTime;
              p.progressRevision = (p.progressRevision || 0) + 1;
            }
          }
        }
        newGameState = sState;
      }
      effects = [
        {
          type: "match-saved",
          pauseId: newPauseId,
          savedAt: newSavedAt,
          expiresAt: null,
          savedBy: actorSeat,
        },
      ];
    } else if (envelope.action === "match.resume") {
      if (snapshot.lifecycle !== "saved")
        return reject(ErrorCode.INVALID_ACTION, "Only paused matches can be resumed");
      const resumePayload = envelope.payload as { pauseId?: string } | undefined;
      const pauseId = envelope.pauseId ?? resumePayload?.pauseId;
      if (!snapshot.pauseId || pauseId !== snapshot.pauseId) {
        return reject(ErrorCode.INVALID_ACTION, "Invalid pause ID");
      }
      const unpauseSudokuPlayers = () => {
        if (snapshot.gameId === "sudoku") {
          const sState = JSON.parse(JSON.stringify(newGameState)) as SudokuState;
          for (const seat of activeSudokuSeats(sState)) {
            const p = sState.players?.[seat];
            if (p && !p.completedAt && p.paused && p.pausedAt !== null) {
              if (sState.mode === "challenge") {
                // Older saved Challenge snapshots paused the receiver. Clear
                // that legacy presentation flag without subtracting saved time.
                p.elapsedMs = Math.max(0, serverTime - p.startedAt - (p.totalPausedMs || 0));
              } else {
                const pausedDuration = Math.max(0, serverTime - p.pausedAt);
                p.totalPausedMs = (p.totalPausedMs || 0) + pausedDuration;
                p.elapsedMs = Math.max(0, serverTime - p.startedAt - p.totalPausedMs);
              }
              p.paused = false;
              p.pausedAt = null;
              p.progressRevision = (p.progressRevision || 0) + 1;
            }
          }
          newGameState = sState;
        }
      };

      if (snapshot.mode === "together") {
        newLifecycle = "active";
        newPauseId = null;
        newSavedAt = null;
        newExpiresAt = null;
        newResumeReadiness = null;
        unpauseSudokuPlayers();
        effects = [{ type: "match-resumed", resumedBy: actorSeat, active: true }];
      } else {
        const currentReadiness = snapshot.resumeReadiness ?? { A: false, B: false };
        const resumeSeats: Seat[] =
          snapshot.gameId === "sudoku"
            ? activeSudokuSeats(snapshot.gameState as SudokuState)
            : ["A", "B"];
        if (!resumeSeats.includes(actorSeat))
          return reject(
            ErrorCode.INVALID_ACTION,
            "This participant does not resume the saved attempt",
          );
        const nextReadiness = { ...currentReadiness, [actorSeat]: true };
        if (resumeSeats.every((seat) => nextReadiness[seat])) {
          newLifecycle = "active";
          newPauseId = null;
          newSavedAt = null;
          newExpiresAt = null;
          newResumeReadiness = null;
          unpauseSudokuPlayers();
          effects = [{ type: "match-resumed", resumedBy: actorSeat, active: true }];
        } else {
          newLifecycle = "saved";
          newPauseId = snapshot.pauseId ?? null;
          newSavedAt = snapshot.savedAt ?? null;
          newExpiresAt = null;
          newResumeReadiness = nextReadiness;
          effects = [{ type: "resume-ready", seat: actorSeat, active: false }];
        }
      }
    } else {
      const engine = getGameEngine(snapshot.gameId, snapshot.rulesVersion);
      if (!engine) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.UNSUPPORTED_RULES,
          message: `Unsupported game engine for ${snapshot.gameId}`,
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }

      const reduction = engine.validateAndReduce(
        snapshot.gameState,
        { action: envelope.action, payload: envelope.payload },
        { serverTime, actorSeat, randomValues: [this.randomDie()] },
      );

      if (!reduction.success) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: reduction.error.code,
          message: reduction.error.message,
          retryable: reduction.error.retryable,
          latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }

      newGameState = reduction.newState;
      effects = reduction.effects || [];
      terminalResult = reduction.terminalResult || engine.isTerminal(newGameState) || null;

      if (terminalResult) {
        newLifecycle = "completed";
        newTurnSeat = null;
        newPauseId = null;
        newSavedAt = null;
        newExpiresAt = null;
        newResumeReadiness = null;

        if (snapshot.gameId === "hand-cricket") {
          const cState = newGameState as CricketState;
          const firstBatter: Seat = cState.roles?.bat === "A" ? "B" : "A";
          const secondBatter: Seat = cState.roles?.bat ?? "A";
          const firstBowler: Seat = secondBatter;
          const secondBowler: Seat = firstBatter;

          const innings2Dismissal = cState.lastDelivery?.outcome === "out";
          const innings = [
            {
              innings: 1,
              batterSeat: firstBatter,
              bowlerSeat: firstBowler,
              runs: cState.firstInningsRuns,
              wickets: 1,
              completed: true,
            },
            {
              innings: 2,
              batterSeat: secondBatter,
              bowlerSeat: secondBowler,
              runs: cState.secondInningsRuns,
              wickets: innings2Dismissal ? 1 : 0,
              completed: true,
            },
          ];

          const battingRuns: Record<string, number> = {
            [firstBatter]: cState.firstInningsRuns,
            [secondBatter]: cState.secondInningsRuns,
          };
          const bowlingWickets: Record<string, number> = {
            [firstBowler]: 1,
            [secondBowler]: innings2Dismissal ? 1 : 0,
          };

          terminalResult = {
            ...terminalResult,
            details: {
              ...terminalResult.details,
              firstInningsRuns: cState.firstInningsRuns,
              secondInningsRuns: cState.secondInningsRuns,
              target: cState.target,
              innings,
              battingRuns,
              bowlingWickets,
              highestInnings: Math.max(cState.firstInningsRuns, cState.secondInningsRuns),
            },
          };
        }
      } else {
        const state = newGameState as {
          activeSeat?: Seat;
          roundId?: number;
          deliveryId?: number;
          innings?: number;
        };
        newTurnSeat = state.activeSeat ?? snapshot.turnSeat;
        newTurnId =
          envelope.action === "ludo.set-colour" ? snapshot.turnId : (snapshot.turnId ?? 0) + 1;
        newRoundId =
          state.roundId ?? (state.deliveryId === undefined ? snapshot.roundId : state.deliveryId);
      }
    }

    const newDeliveryVersion = snapshot.deliveryVersion + 1;
    const eventId = crypto.randomUUID();

    const outboxPayload: ProjectionPayload = {
      matchId: snapshot.matchId,
      deliveryVersion: newDeliveryVersion,
      lifecycle: newLifecycle,
      result: terminalResult,
      lastActionAt: serverTime,
      finishedAt: terminalResult?.finishedAt ?? null,
      gameId: snapshot.gameId,
      mode: snapshot.mode,
      participants: snapshot.participants,
      interrupted:
        snapshot.gameId === "sudoku" &&
        snapshot.mode === "duel" &&
        Boolean((newGameState as SudokuState).interrupted),
      sudokuRecords:
        snapshot.gameId === "sudoku"
          ? this.sudokuRecords(snapshot, newGameState as SudokuState)
          : undefined,
    };

    // Step 5: Atomic commit: synchronous SQLite transaction
    this.state.storage.transactionSync(() => {
      if (envelope.action === "secret.lock") {
        const payload = envelope.payload as { choice?: string; value?: number };
        this.state.storage.sql.exec(
          "INSERT INTO private_round_choices (roundId, seat, choiceValue, lockedAt) VALUES (?, ?, ?, ?)",
          snapshot.roundId!,
          actorSeat,
          JSON.stringify(payload.choice ?? payload.value),
          serverTime,
        );
      }
      this.state.storage.sql.exec(
        `INSERT INTO events (eventId, actionId, actorAccount, actorSeat, acceptedAt, effects)
         VALUES (?, ?, ?, ?, ?, ?)`,
        eventId,
        envelope.actionId,
        actorAccountId,
        actorSeat,
        serverTime,
        JSON.stringify(effects),
      );

      this.state.storage.sql.exec(
        `INSERT INTO action_receipts (actorAccount, actionId, status, acceptedVersion, eventId, canonicalPayloadDigest, createdAt, actionType, actorSeat, roundId, controllerGeneration, authorityEpoch)
         VALUES (?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        actorAccountId,
        envelope.actionId,
        newDeliveryVersion,
        eventId,
        currentDigest,
        serverTime,
        envelope.action,
        actorSeat,
        snapshot.roundId,
        envelope.controllerGeneration ?? snapshot.controller.controllerGeneration,
        newAuthorityEpoch,
      );

      this.state.storage.sql.exec(
        `UPDATE match_snapshot
         SET deliveryVersion = ?, lifecycle = ?, turnSeat = ?, turnId = ?, roundId = ?,
             gameState = ?, readiness = ?, result = ?, controller = ?,
             pauseId = ?, savedAt = ?, expiresAt = ?, resumeReadiness = ?, authorityEpoch = ?
         WHERE matchId = ?`,
        newDeliveryVersion,
        newLifecycle,
        newTurnSeat,
        newTurnId,
        newRoundId,
        JSON.stringify(newGameState),
        JSON.stringify(newReadiness),
        terminalResult ? JSON.stringify(terminalResult) : null,
        JSON.stringify(newController),
        newPauseId,
        newSavedAt,
        newExpiresAt,
        newResumeReadiness ? JSON.stringify(newResumeReadiness) : null,
        newAuthorityEpoch,
        snapshot.matchId,
      );

      this.state.storage.sql.exec(
        `INSERT INTO projection_outbox (projectionKey, requiredVersion, payload, retries, nextAttemptAt)
         VALUES (?, ?, ?, 0, ?)`,
        `proj_${snapshot.matchId}_${newDeliveryVersion}`,
        newDeliveryVersion,
        JSON.stringify(outboxPayload),
        serverTime,
      );
    });

    // Step 6: Durable sync
    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    const updatedSnapshot: SnapshotData = {
      ...snapshot,
      deliveryVersion: newDeliveryVersion,
      lifecycle: newLifecycle,
      turnSeat: newTurnSeat,
      turnId: newTurnId,
      roundId: newRoundId,
      pauseId: newPauseId,
      savedAt: newSavedAt,
      expiresAt: newExpiresAt,
      resumeReadiness: newResumeReadiness,
      authorityEpoch: newAuthorityEpoch,
      gameState: newGameState,
      readiness: newReadiness,
      controller: newController,
      result: terminalResult,
    };

    // Step 7: Filtered Reply, Broadcast, and Outbox flush
    const filteredView = this.buildFilteredView(updatedSnapshot, actorAccountId, sessionId);
    const reply: AcceptedReply = {
      status: "accepted",
      actionId: envelope.actionId,
      acceptedVersion: newDeliveryVersion,
      eventId,
      serverTime,
      view: filteredView,
      effects: this.safeEffects(updatedSnapshot, effects),
    };

    await this.broadcastEvent(
      updatedSnapshot,
      eventId,
      newDeliveryVersion,
      effects,
      requestingSocket,
    );
    await this.scheduleEarliestAlarm();
    this.state.waitUntil?.(this.flushProjectionOutbox().catch(() => {}));

    return reply;
  }

  /**
   * Controller takeover endpoint
   */
  public async handleControllerTakeover(
    actorAccountId: AccountId,
    expectedGeneration?: number,
    sessionId?: string,
  ): Promise<
    | {
        success: true;
        controllerGeneration: number;
        deliveryVersion: number;
        view: FilteredMatchView;
      }
    | { success: false; code: string; message: string; latestView?: FilteredMatchView }
  > {
    return this.serialize(() =>
      this.takeoverSerialized(actorAccountId, expectedGeneration, sessionId),
    );
  }

  private async takeoverSerialized(
    actorAccountId: AccountId,
    expectedGeneration?: number,
    sessionId?: string,
  ) {
    this.ensureSchema();
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      return { success: false as const, code: ErrorCode.NOT_FOUND, message: "Match not found" };
    }

    // Verify actor is a participant
    if (true) {
      if (
        snapshot.participants.A.accountId !== actorAccountId &&
        snapshot.participants.B?.accountId !== actorAccountId
      ) {
        return {
          success: false as const,
          code: ErrorCode.FORBIDDEN,
          message: "Actor is not a participant in this match",
        };
      }
    }

    if (
      expectedGeneration !==
      (snapshot.gameId === "sudoku"
        ? (snapshot.controller.playerControllers?.[actorAccountId]?.generation ??
          snapshot.controller.controllerGeneration)
        : snapshot.controller.controllerGeneration)
    ) {
      return {
        success: false as const,
        code: ErrorCode.STALE_STATE,
        message: `Expected controller generation ${expectedGeneration}, but current is ${snapshot.controller.controllerGeneration}`,
        latestView: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (!(await this.authorizeSession(actorAccountId, sessionId)))
      return {
        success: false as const,
        code: ErrorCode.AUTH_REQUIRED,
        message: "Current session required",
      };
    if (["completed", "resigned", "cancelled", "abandoned"].includes(snapshot.lifecycle))
      return { success: false as const, code: ErrorCode.MATCH_FINISHED, message: "Match finished" };
    const newGeneration =
      (snapshot.gameId === "sudoku"
        ? (snapshot.controller.playerControllers?.[actorAccountId]?.generation ??
          snapshot.controller.controllerGeneration)
        : snapshot.controller.controllerGeneration) + 1;
    const newDeliveryVersion = snapshot.deliveryVersion + 1;
    const newController = {
      ...snapshot.controller,
      ...(snapshot.gameId === "sudoku"
        ? {
            playerControllers: {
              ...snapshot.controller.playerControllers,
              [actorAccountId]: { sessionId, generation: newGeneration },
            },
          }
        : {}),
      controllingAccountId: actorAccountId,
      controllerGeneration:
        snapshot.gameId === "sudoku" ? snapshot.controller.controllerGeneration : newGeneration,
      controllingSessionId: sessionId,
    };

    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        `UPDATE match_snapshot
         SET controller = ?, deliveryVersion = ?
         WHERE matchId = ?`,
        JSON.stringify(newController),
        newDeliveryVersion,
        snapshot.matchId,
      );
      const projection: ProjectionPayload = {
        matchId: snapshot.matchId,
        deliveryVersion: newDeliveryVersion,
        lifecycle: snapshot.lifecycle,
        result: snapshot.result,
        finishedAt: snapshot.result?.finishedAt ?? null,
        lastActionAt: Date.now(),
        gameId: snapshot.gameId,
        mode: snapshot.mode,
        participants: snapshot.participants,
        interrupted:
          snapshot.gameId === "sudoku" &&
          snapshot.mode === "duel" &&
          Boolean((snapshot.gameState as SudokuState).interrupted),
      };
      this.state.storage.sql.exec(
        "INSERT INTO projection_outbox (projectionKey, requiredVersion, payload, retries, nextAttemptAt) VALUES (?, ?, ?, 0, ?)",
        `proj_${snapshot.matchId}_${newDeliveryVersion}`,
        newDeliveryVersion,
        JSON.stringify(projection),
        Date.now(),
      );
    });

    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    const updatedSnapshot: SnapshotData = {
      ...snapshot,
      controller: newController,
      deliveryVersion: newDeliveryVersion,
    };

    await this.broadcastControlChanged(updatedSnapshot);
    this.state.waitUntil?.(this.flushProjectionOutbox().catch(() => {}));
    return {
      success: true as const,
      controllerGeneration: newGeneration,
      deliveryVersion: newDeliveryVersion,
      view: this.buildFilteredView(updatedSnapshot, actorAccountId, sessionId),
    };
  }

  /**
   * Secret recovery endpoint
   */
  public async handleSecretRecovery(
    pendingActionId: string,
    actorAccountId: AccountId,
    roundId?: number,
    sessionId?: string,
    controllerGeneration?: number,
  ): Promise<{ status: "accepted" | "superseded"; locked: boolean; view: FilteredMatchView }> {
    return this.serialize(() =>
      this.recoverSerialized(
        pendingActionId,
        actorAccountId,
        roundId,
        sessionId,
        controllerGeneration,
      ),
    );
  }

  private async recoverSerialized(
    pendingActionId: string,
    actorAccountId: AccountId,
    roundId?: number,
    sessionId?: string,
    controllerGeneration?: number,
  ): Promise<{ status: "accepted" | "superseded"; locked: boolean; view: FilteredMatchView }> {
    this.ensureSchema();
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      throw new Error("Match not found");
    }

    if (
      !this.isMember(snapshot, actorAccountId) ||
      !(await this.authorizeSession(actorAccountId, sessionId))
    )
      throw new Error("Match unavailable");

    if (typeof pendingActionId !== "string" || !isValidUuid(pendingActionId)) {
      throw new Error("Invalid pendingActionId: must be a valid UUID");
    }

    const existingReceipts = this.state.storage.sql
      .exec<ActionReceiptRow>(
        "SELECT * FROM action_receipts WHERE actorAccount = ? AND actionId = ? LIMIT 1",
        actorAccountId,
        pendingActionId,
      )
      .toArray();

    let actorSeat: Seat | undefined;
    if (snapshot.participants.A.accountId === actorAccountId) {
      actorSeat = "A";
    } else if (snapshot.participants.B?.accountId === actorAccountId) {
      actorSeat = "B";
    }

    if (existingReceipts.length > 0) {
      const receipt = existingReceipts[0];
      const targetSeat: Seat | undefined =
        snapshot.mode === "together" ? (receipt.actorSeat as Seat) : actorSeat;

      const isAcceptedSecret =
        receipt.status === "accepted" &&
        (!receipt.actionType || receipt.actionType === "secret.lock") &&
        (receipt.roundId === undefined ||
          receipt.roundId === null ||
          receipt.roundId === snapshot.roundId) &&
        (snapshot.mode !== "together" ||
          controllerGeneration === undefined ||
          receipt.controllerGeneration === undefined ||
          receipt.controllerGeneration === snapshot.controller.controllerGeneration) &&
        (targetSeat
          ? (snapshot.gameState as { lockedSeats?: Seat[] }).lockedSeats?.includes(targetSeat)
          : true);

      if (isAcceptedSecret) {
        return {
          status: "accepted",
          locked: true,
          view: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        };
      }
      return {
        status: "superseded",
        locked: false,
        view: this.buildFilteredView(snapshot, actorAccountId, sessionId),
      };
    }

    if (
      roundId !== snapshot.roundId ||
      typeof pendingActionId !== "string" ||
      !["rock-paper-scissors", "hand-cricket"].includes(snapshot.gameId)
    )
      throw new Error("Invalid recovery request");
    if (
      snapshot.mode === "together" &&
      (controllerGeneration !== snapshot.controller.controllerGeneration ||
        snapshot.controller.controllingAccountId !== actorAccountId ||
        (snapshot.controller.controllingSessionId &&
          snapshot.controller.controllingSessionId !== sessionId))
    )
      throw new Error("Control transferred");
    // Persist a superseded tombstone for this pending action ID
    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        `INSERT INTO action_receipts (actorAccount, actionId, status, acceptedVersion, eventId, canonicalPayloadDigest, createdAt, actionType, actorSeat, roundId, controllerGeneration, authorityEpoch)
         VALUES (?, ?, 'superseded', NULL, NULL, NULL, ?, 'secret.lock', ?, ?, ?, ?)`,
        actorAccountId,
        pendingActionId,
        Date.now(),
        actorSeat,
        snapshot.roundId,
        snapshot.controller.controllerGeneration,
        snapshot.authorityEpoch ?? 1,
      );
    });

    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    return {
      status: "superseded",
      locked: false,
      view: this.buildFilteredView(snapshot, actorAccountId, sessionId),
    };
  }

  /**
   * Receipt lookup endpoint
   */
  public handleGetReceipt(
    actionId: string,
    actorAccountId: AccountId,
    sessionId?: string,
  ): {
    status: "accepted" | "superseded" | "unknown";
    acceptedVersion?: number;
    eventId?: string;
    createdAt?: number;
    view?: FilteredMatchView;
  } {
    this.ensureSchema();
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      return { status: "unknown" };
    }

    const receipts = this.state.storage.sql
      .exec<ActionReceiptRow>(
        "SELECT * FROM action_receipts WHERE actorAccount = ? AND actionId = ? LIMIT 1",
        actorAccountId,
        actionId,
      )
      .toArray();

    if (!this.isMember(snapshot, actorAccountId)) return { status: "unknown" };
    const view = this.buildFilteredView(snapshot, actorAccountId, sessionId);

    if (receipts.length === 0) {
      return { status: "unknown", view };
    }

    const r = receipts[0];
    return {
      status: r.status,
      acceptedVersion: r.acceptedVersion ?? undefined,
      eventId: r.eventId ?? undefined,
      createdAt: r.createdAt,
      view,
    };
  }

  /**
   * Flushes pending rows in projection_outbox to D1 match_registry and results.
   */
  public async flushProjectionOutbox(): Promise<void> {
    if (!this.env.DB) return;

    this.ensureSchema();
    const rows = this.state.storage.sql
      .exec<ProjectionOutboxRow>(
        "SELECT * FROM projection_outbox WHERE nextAttemptAt <= ? ORDER BY requiredVersion ASC LIMIT 10",
        Date.now(),
      )
      .toArray();

    for (const row of rows) {
      try {
        const payload: ProjectionPayload = JSON.parse(row.payload);
        const interruptedDuel =
          payload.gameId === "sudoku" &&
          payload.mode === "duel" &&
          (payload.interrupted === true || payload.result?.details?.interrupted === true);

        // Update match_registry in D1
        await this.env.DB.prepare(
          `UPDATE match_registry
           SET deliveryVersion = ?, lifecycle = ?, finishedAt = ?, lastActionAt = ?
           WHERE matchId = ? AND deliveryVersion <= ?`,
        )
          .bind(
            payload.deliveryVersion,
            payload.lifecycle,
            payload.finishedAt,
            payload.lastActionAt,
            payload.matchId,
            payload.deliveryVersion,
          )
          .run();

        for (const record of payload.sudokuRecords ?? [])
          await projectSudokuRecord(this.env.DB, {
            ...record,
            interrupted: Boolean(record.interrupted || interruptedDuel),
          });
        // If match finished, insert results row and release slot
        if (
          payload.result &&
          ["completed", "resigned", "cancelled", "abandoned", "expired"].includes(payload.lifecycle)
        ) {
          const scoresJson = payload.result.scores ? JSON.stringify(payload.result.scores) : null;
          const detailsJson = payload.result.details
            ? JSON.stringify(payload.result.details)
            : null;
          const participantsJson = JSON.stringify(payload.participants || {});

          await this.env.DB.prepare(
            `INSERT INTO results
             (matchId, projectedVersion, gameId, mode, participants, winner, reason, scores, finishedAt, details, interrupted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(matchId) DO UPDATE SET projectedVersion = excluded.projectedVersion, winner = excluded.winner,
             reason = excluded.reason, scores = excluded.scores, finishedAt = excluded.finishedAt, details = excluded.details,
             interrupted = MAX(results.interrupted, excluded.interrupted)
             WHERE results.projectedVersion < excluded.projectedVersion`,
          )
            .bind(
              payload.matchId,
              payload.deliveryVersion,
              payload.gameId || "",
              payload.mode || "",
              participantsJson,
              payload.result.winner,
              payload.result.reason,
              scoresJson,
              payload.result.finishedAt,
              detailsJson,
              interruptedDuel ? 1 : 0,
            )
            .run();

          await this.env.DB.prepare("DELETE FROM active_slots WHERE matchId = ?")
            .bind(payload.matchId)
            .run();
        }

        // Successfully projected -> remove from outbox
        this.state.storage.sql.exec(
          "DELETE FROM projection_outbox WHERE projectionKey = ? AND requiredVersion = ?",
          row.projectionKey,
          row.requiredVersion,
        );
      } catch {
        const nextRetries = row.retries + 1;
        const delay = Math.min(60000, 1000 * Math.pow(2, nextRetries));
        this.state.storage.sql.exec(
          "UPDATE projection_outbox SET retries = ?, nextAttemptAt = ? WHERE projectionKey = ? AND requiredVersion = ?",
          nextRetries,
          Date.now() + delay,
          row.projectionKey,
          row.requiredVersion,
        );
      }
    }
    await this.scheduleEarliestAlarm();
  }

  async alarm(): Promise<void> {
    const startRefreshed = await this.refreshDueScheduledStart();
    await this.flushProjectionOutbox();
    // An earlier projection retry may have woken this alarm just before the
    // Duel deadline. Re-read authoritative state after the flush in case the
    // deadline became due while D1 work was in flight.
    if (!startRefreshed) await this.refreshDueScheduledStart();
    await this.scheduleEarliestAlarm();
  }

  private refreshDueScheduledStart(): Promise<boolean> {
    return this.serialize(async () => {
      const snapshot = this.getSnapshot();
      if (
        snapshot?.gameId === "sudoku" &&
        snapshot.mode === "duel" &&
        snapshot.lifecycle === "active"
      ) {
        const game = snapshot.gameState as SudokuState;
        if (
          !game.terminalResult &&
          typeof game.scheduledStartTime === "number" &&
          game.scheduledStartTime <= Date.now()
        ) {
          await this.broadcastScheduledStart(snapshot);
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Refreshes each currently authorized player's filtered view at the
   * persisted Duel start deadline. This is a read-only snapshot delivery: it
   * does not invent a match event or advance the accepted version.
   */
  private async broadcastScheduledStart(snapshot: SnapshotData): Promise<void> {
    for (const client of this.getActiveSockets()) {
      try {
        if (
          !this.isMember(snapshot, client.accountId) ||
          !(await this.authorizeSession(client.accountId, client.sessionId))
        ) {
          client.ws.close(1008, "Session expired");
          continue;
        }
        client.ws.send(
          JSON.stringify({
            type: "snapshot",
            view: this.buildFilteredView(snapshot, client.accountId, client.sessionId),
            serverTime: Date.now(),
          }),
        );
      } catch {
        // A disconnected socket can be cleaned up by the platform.
      }
    }
  }

  /**
   * WebSocket Broadcast on accepted event
   */
  private async broadcastEvent(
    snapshot: SnapshotData,
    eventId: string,
    acceptedVersion: number,
    effects: unknown[],
    requestingSocket?: WebSocket,
  ): Promise<void> {
    const clients = this.getActiveSockets();
    for (const client of clients) {
      try {
        // The initiating socket receives the accepted reply with the same saved,
        // filtered view and effects after handleAction returns.
        if (client.ws === requestingSocket) continue;
        if (!(await this.authorizeSession(client.accountId, client.sessionId))) {
          client.ws.close(1008, "Session expired");
          continue;
        }
        const view = this.buildFilteredView(snapshot, client.accountId, client.sessionId);
        client.ws.send(
          JSON.stringify({
            type: "event",
            eventId,
            acceptedVersion,
            view,
            effects: this.safeEffects(snapshot, effects),
            serverTime: Date.now(),
          }),
        );
      } catch {
        // Socket closed or failed
      }
    }
  }

  /**
   * WebSocket Broadcast on control takeover
   */
  private async broadcastControlChanged(snapshot: SnapshotData): Promise<void> {
    const clients = this.getActiveSockets();
    for (const client of clients) {
      try {
        if (!(await this.authorizeSession(client.accountId, client.sessionId))) {
          client.ws.close(1008, "Session expired");
          continue;
        }
        const view = this.buildFilteredView(snapshot, client.accountId, client.sessionId);
        client.ws.send(
          JSON.stringify({
            type: "control-changed",
            controller: view.controller,
            deliveryVersion: snapshot.deliveryVersion,
            view,
            serverTime: Date.now(),
          }),
        );
      } catch {}
    }
  }

  private getActiveSockets(): SocketClient[] {
    if (typeof this.state.getWebSockets === "function")
      return this.state.getWebSockets().flatMap((ws) => {
        const attachment = ws.deserializeAttachment() as {
          accountId?: AccountId;
          sessionId?: string;
        } | null;
        return attachment?.accountId
          ? [{ ws, accountId: attachment.accountId, sessionId: attachment.sessionId }]
          : [];
      });
    return [...this.connectedSockets].filter((client) => client.ws.readyState === 1);
  }

  private async handleWebSocketUpgrade(
    request: Request,
    actorAccountId: AccountId,
    sessionId?: string,
  ): Promise<Response> {
    const snapshot = this.getSnapshot();
    if (
      !snapshot ||
      !this.isMember(snapshot, actorAccountId) ||
      !(await this.authorizeSession(actorAccountId, sessionId))
    )
      return Response.json(
        { code: ErrorCode.FORBIDDEN, error: "Match unavailable" },
        { status: 403 },
      );
    const origin = request.headers.get("Origin");
    if (
      !origin ||
      (this.env.ALLOWED_ORIGIN &&
        this.env.ALLOWED_ORIGIN !== "*" &&
        origin !== (this.env.ALLOWED_ORIGIN || new URL(request.url).origin))
    )
      return new Response("Origin mismatch", { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [actorAccountId]);
    server.serializeAttachment({
      accountId: actorAccountId,
      sessionId,
      controllerGeneration: snapshot.controller.controllerGeneration,
    });
    server.send(
      JSON.stringify({
        type: "snapshot",
        view: this.buildFilteredView(snapshot, actorAccountId, sessionId),
        serverTime: Date.now(),
      }),
    );
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const identity = ws.deserializeAttachment() as {
      accountId: AccountId;
      sessionId?: string;
    } | null;
    try {
      if (!identity || !(await this.authorizeSession(identity.accountId, identity.sessionId))) {
        ws.close(1008, "Session expired");
        return;
      }
      const data = typeof message === "string" ? JSON.parse(message) : null;
      if (data?.type === "action" || data?.action) {
        const reply = await this.handleAction(
          data.type === "action" ? data.envelope : data,
          identity.accountId,
          identity.sessionId,
          ws,
        );
        ws.send(JSON.stringify(reply));
      } else if (data?.type === "ping")
        ws.send(JSON.stringify({ type: "pong", serverTime: Date.now() }));
    } catch {
      ws.send(
        JSON.stringify({
          status: "rejected",
          code: ErrorCode.UNAVAILABLE,
          message: "Message could not be processed",
          retryable: true,
        }),
      );
    }
  }

  webSocketClose(ws: WebSocket): void {
    try {
      ws.close();
    } catch {}
  }
  webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, "Connection interrupted");
    } catch {}
  }

  /**
   * Durable Object fetch dispatcher
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const actorAccountId = request.headers.get("X-Actor-Account") as AccountId;
    const sessionId = request.headers.get("X-Session-Id") || undefined;

    if (request.method === "POST" && path.endsWith("/abort-initialization")) {
      const aborted = await this.serialize(async () => {
        if (this.getSnapshot()) return false;
        this.state.storage.transactionSync(() => {
          this.state.storage.sql.exec("DELETE FROM initialization_identity");
          this.state.storage.sql.exec(
            "INSERT INTO initialization_identity (digest) VALUES (?)",
            "cancelled",
          );
        });
        await this.state.storage.sync();
        return true;
      });
      return Response.json({ aborted });
    }

    if (path.endsWith("/challenge-source")) {
      const snapshot = this.getSnapshot();
      if (
        !snapshot ||
        !this.isMember(snapshot, actorAccountId) ||
        !(await this.authorizeSession(actorAccountId, sessionId))
      )
        return Response.json(
          { code: ErrorCode.FORBIDDEN, error: "Match unavailable" },
          { status: 403 },
        );
      const game = snapshot.gameState as SudokuState;
      const senderSeat = game.senderSeat ?? "A";
      const player = game.players?.[senderSeat];
      if (
        snapshot.gameId !== "sudoku" ||
        snapshot.mode !== "challenge" ||
        game.challengePublished ||
        snapshot.participants[senderSeat]?.accountId !== actorAccountId ||
        !player?.completedAt ||
        player.assisted
      )
        return new Response("Sender attempt ineligible", { status: 409 });
      return Response.json({
        puzzleId: game.puzzleId,
        senderElapsedMs: player.elapsedMs,
        replay: Boolean(game.replay),
        senderSeat,
      });
    }

    // WebSocket Upgrade
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket" || path.endsWith("/socket")) {
      return this.handleWebSocketUpgrade(request, actorAccountId, sessionId);
    }

    // POST /initialize
    if (request.method === "POST" && (path === "/initialize" || path.endsWith("/initialize"))) {
      const body = (await request.json()) as MatchInitializationParams;
      const view = await this.initializeMatch({ ...body, creatorSessionId: sessionId });
      return new Response(JSON.stringify({ status: "ok", view }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path.includes("/view") || path.includes("/snapshot") || path.includes("/receipts/")) {
      if (!(await this.authorizeSession(actorAccountId, sessionId)))
        return Response.json(
          { code: ErrorCode.AUTH_REQUIRED, error: "Current session required" },
          { status: 401 },
        );
    }
    // GET /view or /snapshot
    if (
      request.method === "GET" &&
      (path === "/view" ||
        path === "/snapshot" ||
        path.endsWith("/snapshot") ||
        path.endsWith("/view"))
    ) {
      const snapshot = this.getSnapshot();
      if (!snapshot) {
        return new Response(
          JSON.stringify({ error: "Match not found", code: ErrorCode.NOT_FOUND }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (!this.isMember(snapshot, actorAccountId))
        return Response.json(
          { code: ErrorCode.FORBIDDEN, error: "Match unavailable" },
          { status: 403 },
        );
      const view = this.buildFilteredView(snapshot, actorAccountId, sessionId);
      return new Response(JSON.stringify(view), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /action
    if (
      request.method === "POST" &&
      (path === "/action" || path.endsWith("/actions") || path.endsWith("/action"))
    ) {
      const envelope = (await request.json()) as ActionEnvelope;
      const reply = await this.handleAction(envelope, actorAccountId, sessionId);
      return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /receipts/:actionId
    const receiptMatch = path.match(/\/receipts\/([^/]+)$/);
    if (request.method === "GET" && receiptMatch) {
      const snapshot = this.getSnapshot();
      if (!snapshot || !this.isMember(snapshot, actorAccountId))
        return Response.json({ code: ErrorCode.FORBIDDEN }, { status: 403 });
      const actionId = receiptMatch[1];
      const receiptRes = this.handleGetReceipt(actionId, actorAccountId, sessionId);
      return new Response(JSON.stringify(receiptRes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /controller
    if (request.method === "POST" && (path === "/controller" || path.endsWith("/controller"))) {
      let body: { expectedControllerGeneration?: number } = {};
      try {
        body = await request.json();
      } catch {}
      const takeoverRes = await this.handleControllerTakeover(
        actorAccountId,
        body.expectedControllerGeneration,
        sessionId,
      );
      return new Response(JSON.stringify(takeoverRes), {
        status: takeoverRes.success ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /secret-recovery
    if (
      request.method === "POST" &&
      (path === "/secret-recovery" || path.endsWith("/secret-recovery"))
    ) {
      const body = (await request.json()) as {
        pendingActionId: string;
        roundId?: number;
        controllerGeneration?: number;
      };
      const recoveryRes = await this.handleSecretRecovery(
        body.pendingActionId,
        actorAccountId,
        body.roundId,
        sessionId,
        body.controllerGeneration,
      );
      return new Response(JSON.stringify(recoveryRes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
