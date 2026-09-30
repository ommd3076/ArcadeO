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
      gameState: JSON.parse(r.gameState),
      readiness: JSON.parse(r.readiness),
      participants: JSON.parse(r.participants),
      controller: JSON.parse(r.controller),
      result: r.result ? JSON.parse(r.result) : null,
    };
  }

  /**
   * Generates a viewer-filtered match view conforming to protocol specifications.
   */
  public buildFilteredView(snapshot: SnapshotData, viewerAccountId: AccountId): FilteredMatchView {
    let viewerSeat: Seat | undefined;
    let isController = false;

    if (snapshot.mode === "together") {
      isController = snapshot.controller.controllingAccountId === viewerAccountId;
      viewerSeat = snapshot.turnSeat ?? "A";
    } else {
      if (snapshot.participants.A.accountId === viewerAccountId) {
        viewerSeat = "A";
      } else if (snapshot.participants.B?.accountId === viewerAccountId) {
        viewerSeat = "B";
      }
      isController = viewerSeat === snapshot.turnSeat;
    }

    const engine = getGameEngine(snapshot.gameId);
    const viewerContext: ViewerContext = {
      viewerAccountId,
      viewerSeat,
      isController,
      mode: snapshot.mode,
    };

    let filteredGameState: unknown = snapshot.gameState;
    if (engine && typeof engine.toPublicView === "function") {
      filteredGameState = engine.toPublicView(snapshot.gameState, viewerContext);
    }

    let legalActions: ActionType[] = [];
    if (snapshot.lifecycle === "active") {
      if (engine && viewerSeat && typeof engine.legalActions === "function") {
        legalActions = engine.legalActions(snapshot.gameState, viewerSeat);
      }
      legalActions.push("match.resign");
      if (snapshot.mode === "remote") {
        legalActions.push("match.request-abandon");
      }
    } else if (snapshot.lifecycle === "waiting") {
      legalActions = ["match.ready", "match.accept", "match.decline", "match.cancel"];
    }

    return {
      matchId: snapshot.matchId,
      gameId: snapshot.gameId,
      mode: snapshot.mode,
      lifecycle: snapshot.lifecycle,
      deliveryVersion: snapshot.deliveryVersion,
      participants: {
        A: snapshot.participants.A,
        B: snapshot.participants.B,
      },
      controller: {
        controllingAccountId: snapshot.controller.controllingAccountId,
        controllerGeneration: snapshot.controller.controllerGeneration,
        isController,
      },
      gameState: filteredGameState,
      turnSeat: snapshot.turnSeat ?? undefined,
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
  public async initializeMatch(params: MatchInitializationParams): Promise<FilteredMatchView> {
    this.ensureSchema();
    const existing = this.getSnapshot();
    if (existing) {
      return this.buildFilteredView(existing, params.creatorAccountId);
    }

    const engine = getGameEngine(params.gameId);
    if (!engine) {
      throw new Error(`Unsupported game engine: ${params.gameId}`);
    }

    const initialGameState = engine.createInitialState({
      serverTime: Date.now(),
      startingSeat: params.startingSeat ?? "A",
      config: params.gameOptions,
    });

    const isTogether = params.mode === "together";
    const lifecycle: MatchLifecycle = isTogether ? "active" : "waiting";

    const snapshot: SnapshotData = {
      matchId: params.matchId,
      gameId: params.gameId,
      mode: params.mode,
      lifecycle,
      deliveryVersion: 1,
      schemaVersion: 1,
      rulesVersion: 1,
      turnSeat: "A",
      turnId: 1,
      roundId: 1,
      gameState: initialGameState,
      readiness: {
        A: true,
        B: isTogether,
      },
      participants: params.participants,
      controller: {
        controllingAccountId: params.creatorAccountId,
        controllerGeneration: 1,
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
      participants: params.participants,
    };

    this.state.storage.transactionSync(() => {
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

    this.flushProjectionOutbox().catch(() => {});

    return this.buildFilteredView(snapshot, params.creatorAccountId);
  }

  /**
   * Acceptance Pipeline (HTTP and WebSocket shared)
   */
  public async handleAction(
    envelope: ActionEnvelope,
    actorAccountId: AccountId,
    _sessionId?: string,
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

    // Step 1: Authenticate actor membership & check controller generation
    let actorSeat: Seat;
    if (snapshot.mode === "together") {
      const payloadResign = (envelope.payload as { resigningSeat?: Seat })?.resigningSeat;
      actorSeat = payloadResign || snapshot.turnSeat || "A";
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
          latestView: this.buildFilteredView(snapshot, actorAccountId),
        };
      }
    }

    if (envelope.controllerGeneration !== undefined) {
      if (envelope.controllerGeneration < snapshot.controller.controllerGeneration) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.CONTROL_TRANSFERRED,
          message: "Control has been transferred to another device or session",
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId),
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
          latestView: this.buildFilteredView(snapshot, actorAccountId),
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
            view: this.buildFilteredView(snapshot, actorAccountId),
            effects: cachedEffects,
          };
        } else {
          return {
            status: "rejected",
            actionId: envelope.actionId,
            code: ErrorCode.ID_REUSED,
            message: "Action ID was previously used with a different payload",
            retryable: false,
            latestView: this.buildFilteredView(snapshot, actorAccountId),
          };
        }
      }
    }

    // Step 3: Guard checks (lifecycle, concurrency, turn seat)
    if (["completed", "resigned", "abandoned", "cancelled"].includes(snapshot.lifecycle)) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.MATCH_FINISHED,
        message: "Match has already finished",
        retryable: false,
        latestView: this.buildFilteredView(snapshot, actorAccountId),
      };
    }

    const payloadCheck = validateActionPayload(envelope.action, envelope.payload);
    if (!payloadCheck.valid) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: payloadCheck.error.code,
        message: payloadCheck.error.message,
        retryable: payloadCheck.error.retryable,
        latestView: this.buildFilteredView(snapshot, actorAccountId),
      };
    }

    if (
      envelope.expectedVersion !== undefined &&
      envelope.expectedVersion !== snapshot.deliveryVersion
    ) {
      return {
        status: "rejected",
        actionId: envelope.actionId,
        code: ErrorCode.STALE_STATE,
        message: `Expected delivery version ${envelope.expectedVersion}, but current is ${snapshot.deliveryVersion}`,
        retryable: true,
        latestView: this.buildFilteredView(snapshot, actorAccountId),
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
        latestView: this.buildFilteredView(snapshot, actorAccountId),
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
        latestView: this.buildFilteredView(snapshot, actorAccountId),
      };
    }

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
          latestView: this.buildFilteredView(snapshot, actorAccountId),
        };
      }
    }

    // Step 4: Pure reduction
    let newGameState = snapshot.gameState;
    let newLifecycle = snapshot.lifecycle;
    let newTurnSeat = snapshot.turnSeat;
    let newTurnId = snapshot.turnId;
    const newRoundId = snapshot.roundId;
    const newReadiness = { ...snapshot.readiness };
    let effects: unknown[] = [];
    let terminalResult: TerminalResult | null = null;
    const serverTime = Date.now();

    if (envelope.action === "match.ready" || envelope.action === "match.accept") {
      newReadiness[actorSeat] = true;
      if (snapshot.mode === "together") {
        newReadiness.A = true;
        newReadiness.B = true;
      }
      if (newReadiness.A && newReadiness.B) {
        newLifecycle = "active";
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
      effects = [{ type: "match-cancelled", seat: actorSeat }];
    } else if (envelope.action === "match.resign") {
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
      effects = [{ type: "player-resigned", resigningSeat, winner }];
    } else {
      const engine = getGameEngine(snapshot.gameId);
      if (!engine) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: ErrorCode.UNSUPPORTED_RULES,
          message: `Unsupported game engine for ${snapshot.gameId}`,
          retryable: false,
          latestView: this.buildFilteredView(snapshot, actorAccountId),
        };
      }

      const reduction = engine.validateAndReduce(
        snapshot.gameState,
        { action: envelope.action, payload: envelope.payload },
        { serverTime, actorSeat },
      );

      if (!reduction.success) {
        return {
          status: "rejected",
          actionId: envelope.actionId,
          code: reduction.error.code,
          message: reduction.error.message,
          retryable: reduction.error.retryable,
          latestView: this.buildFilteredView(snapshot, actorAccountId),
        };
      }

      newGameState = reduction.newState;
      effects = reduction.effects || [];
      terminalResult = reduction.terminalResult || engine.isTerminal(newGameState) || null;

      if (terminalResult) {
        newLifecycle = "completed";
        newTurnSeat = null;
      } else {
        newTurnSeat = actorSeat === "A" ? "B" : "A";
        newTurnId = (snapshot.turnId ?? 0) + 1;
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
    };

    // Step 5: Atomic commit: synchronous SQLite transaction
    this.state.storage.transactionSync(() => {
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
        `INSERT INTO action_receipts (actorAccount, actionId, status, acceptedVersion, eventId, canonicalPayloadDigest, createdAt)
         VALUES (?, ?, 'accepted', ?, ?, ?, ?)`,
        actorAccountId,
        envelope.actionId,
        newDeliveryVersion,
        eventId,
        currentDigest,
        serverTime,
      );

      this.state.storage.sql.exec(
        `UPDATE match_snapshot
         SET deliveryVersion = ?, lifecycle = ?, turnSeat = ?, turnId = ?, roundId = ?,
             gameState = ?, readiness = ?, result = ?
         WHERE matchId = ?`,
        newDeliveryVersion,
        newLifecycle,
        newTurnSeat,
        newTurnId,
        newRoundId,
        JSON.stringify(newGameState),
        JSON.stringify(newReadiness),
        terminalResult ? JSON.stringify(terminalResult) : null,
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
      gameState: newGameState,
      readiness: newReadiness,
      result: terminalResult,
    };

    // Step 7: Filtered Reply, Broadcast, and Outbox flush
    const filteredView = this.buildFilteredView(updatedSnapshot, actorAccountId);
    const reply: AcceptedReply = {
      status: "accepted",
      actionId: envelope.actionId,
      acceptedVersion: newDeliveryVersion,
      eventId,
      serverTime,
      view: filteredView,
      effects,
    };

    this.broadcastEvent(updatedSnapshot, eventId, newDeliveryVersion, effects);
    this.flushProjectionOutbox().catch(() => {});

    return reply;
  }

  /**
   * Controller takeover endpoint
   */
  public async handleControllerTakeover(
    actorAccountId: AccountId,
    expectedGeneration?: number,
  ): Promise<
    | {
        success: true;
        controllerGeneration: number;
        deliveryVersion: number;
        view: FilteredMatchView;
      }
    | { success: false; code: string; message: string; latestView?: FilteredMatchView }
  > {
    this.ensureSchema();
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      return { success: false, code: ErrorCode.NOT_FOUND, message: "Match not found" };
    }

    // Verify actor is a participant
    if (snapshot.mode === "remote") {
      if (
        snapshot.participants.A.accountId !== actorAccountId &&
        snapshot.participants.B?.accountId !== actorAccountId
      ) {
        return {
          success: false,
          code: ErrorCode.FORBIDDEN,
          message: "Actor is not a participant in this match",
          latestView: this.buildFilteredView(snapshot, actorAccountId),
        };
      }
    }

    if (
      expectedGeneration !== undefined &&
      expectedGeneration !== snapshot.controller.controllerGeneration
    ) {
      return {
        success: false,
        code: ErrorCode.STALE_STATE,
        message: `Expected controller generation ${expectedGeneration}, but current is ${snapshot.controller.controllerGeneration}`,
        latestView: this.buildFilteredView(snapshot, actorAccountId),
      };
    }

    const newGeneration = snapshot.controller.controllerGeneration + 1;
    const newDeliveryVersion = snapshot.deliveryVersion + 1;
    const newController = {
      controllingAccountId: actorAccountId,
      controllerGeneration: newGeneration,
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
    });

    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    const updatedSnapshot: SnapshotData = {
      ...snapshot,
      controller: newController,
      deliveryVersion: newDeliveryVersion,
    };

    this.broadcastControlChanged(updatedSnapshot);
    return {
      success: true,
      controllerGeneration: newGeneration,
      deliveryVersion: newDeliveryVersion,
      view: this.buildFilteredView(updatedSnapshot, actorAccountId),
    };
  }

  /**
   * Secret recovery endpoint
   */
  public async handleSecretRecovery(
    pendingActionId: string,
    actorAccountId: AccountId,
    _roundId?: number,
  ): Promise<{ status: "accepted" | "superseded"; locked: boolean; view: FilteredMatchView }> {
    this.ensureSchema();
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      throw new Error("Match not found");
    }

    const existingReceipts = this.state.storage.sql
      .exec<ActionReceiptRow>(
        "SELECT * FROM action_receipts WHERE actorAccount = ? AND actionId = ? LIMIT 1",
        actorAccountId,
        pendingActionId,
      )
      .toArray();

    if (existingReceipts.length > 0) {
      const receipt = existingReceipts[0];
      if (receipt.status === "accepted") {
        return {
          status: "accepted",
          locked: true,
          view: this.buildFilteredView(snapshot, actorAccountId),
        };
      }
      return {
        status: "superseded",
        locked: false,
        view: this.buildFilteredView(snapshot, actorAccountId),
      };
    }

    // Persist a superseded tombstone for this pending action ID
    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        `INSERT INTO action_receipts (actorAccount, actionId, status, acceptedVersion, eventId, canonicalPayloadDigest, createdAt)
         VALUES (?, ?, 'superseded', NULL, NULL, NULL, ?)`,
        actorAccountId,
        pendingActionId,
        Date.now(),
      );
    });

    if (typeof this.state.storage.sync === "function") {
      await this.state.storage.sync();
    }

    return {
      status: "superseded",
      locked: false,
      view: this.buildFilteredView(snapshot, actorAccountId),
    };
  }

  /**
   * Receipt lookup endpoint
   */
  public handleGetReceipt(
    actionId: string,
    actorAccountId: AccountId,
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

    const view = this.buildFilteredView(snapshot, actorAccountId);

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

        // If match finished, insert results row and release slot
        if (
          payload.result &&
          ["completed", "resigned", "cancelled", "abandoned"].includes(payload.lifecycle)
        ) {
          const scoresJson = payload.result.scores ? JSON.stringify(payload.result.scores) : null;
          const detailsJson = payload.result.details
            ? JSON.stringify(payload.result.details)
            : null;
          const participantsJson = JSON.stringify(payload.participants || {});

          await this.env.DB.prepare(
            `INSERT OR REPLACE INTO results
             (matchId, projectedVersion, gameId, mode, participants, winner, reason, scores, finishedAt, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            )
            .run();

          await this.env.DB.prepare("DELETE FROM active_slots WHERE matchId = ?")
            .bind(payload.matchId)
            .run();
        }

        // Successfully projected -> remove from outbox
        this.state.storage.sql.exec(
          "DELETE FROM projection_outbox WHERE projectionKey = ?",
          row.projectionKey,
        );
      } catch {
        const nextRetries = row.retries + 1;
        const delay = Math.min(60000, 1000 * Math.pow(2, nextRetries));
        this.state.storage.sql.exec(
          "UPDATE projection_outbox SET retries = ?, nextAttemptAt = ? WHERE projectionKey = ?",
          nextRetries,
          Date.now() + delay,
          row.projectionKey,
        );
      }
    }
  }

  /**
   * WebSocket Broadcast on accepted event
   */
  private broadcastEvent(
    snapshot: SnapshotData,
    eventId: string,
    acceptedVersion: number,
    effects: unknown[],
  ): void {
    const clients = this.getActiveSockets();
    for (const client of clients) {
      try {
        const view = this.buildFilteredView(snapshot, client.accountId);
        client.ws.send(
          JSON.stringify({
            type: "event",
            eventId,
            acceptedVersion,
            view,
            effects,
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
  private broadcastControlChanged(snapshot: SnapshotData): void {
    const clients = this.getActiveSockets();
    for (const client of clients) {
      try {
        const view = this.buildFilteredView(snapshot, client.accountId);
        client.ws.send(
          JSON.stringify({
            type: "control-changed",
            controller: snapshot.controller,
            deliveryVersion: snapshot.deliveryVersion,
            view,
            serverTime: Date.now(),
          }),
        );
      } catch {}
    }
  }

  private getActiveSockets(): SocketClient[] {
    const active: SocketClient[] = [];
    for (const item of this.connectedSockets) {
      try {
        if (item.ws.readyState === 1) {
          active.push(item);
        }
      } catch {}
    }
    return active;
  }

  /**
   * WebSocket upgrade handler
   */
  private handleWebSocketUpgrade(
    _request: Request,
    actorAccountId: AccountId,
    sessionId?: string,
  ): Response {
    if (typeof WebSocketPair === "undefined") {
      return new Response("WebSocketPair not available in this environment", { status: 501 });
    }

    const pair = new WebSocketPair();
    const clientWs = pair[0];
    const serverWs = pair[1];

    if (typeof (this.state as any).acceptWebSocket === "function") {
      (this.state as any).acceptWebSocket(serverWs, [actorAccountId]);
      if (typeof (serverWs as any).serializeAttachment === "function") {
        (serverWs as any).serializeAttachment({
          accountId: actorAccountId,
          sessionId,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      }
    } else if (typeof (serverWs as any).accept === "function") {
      (serverWs as any).accept();
    }

    const socketRecord: SocketClient = { ws: serverWs, accountId: actorAccountId, sessionId };
    this.connectedSockets.add(socketRecord);

    serverWs.addEventListener("message", async (evt: any) => {
      try {
        const data = typeof evt.data === "string" ? JSON.parse(evt.data) : null;
        if (!data) return;

        if (data.type === "action" || data.action) {
          const actionEnvelope = data.type === "action" ? data.envelope : data;
          const reply = await this.handleAction(actionEnvelope, actorAccountId, sessionId);
          serverWs.send(JSON.stringify(reply));
        } else if (data.type === "ping") {
          serverWs.send(JSON.stringify({ type: "pong", serverTime: Date.now() }));
        }
      } catch (err: any) {
        serverWs.send(
          JSON.stringify({
            status: "rejected",
            code: ErrorCode.INVALID_ACTION,
            message: err?.message || "Invalid socket message",
            retryable: false,
          }),
        );
      }
    });

    serverWs.addEventListener("close", () => {
      this.connectedSockets.delete(socketRecord);
    });

    // Send initial snapshot message
    const snapshot = this.getSnapshot();
    if (snapshot) {
      const initialView = this.buildFilteredView(snapshot, actorAccountId);
      serverWs.send(
        JSON.stringify({
          type: "snapshot",
          view: initialView,
          serverTime: Date.now(),
        }),
      );
    }

    return new Response(null, {
      status: 101,
      webSocket: clientWs,
    } as any);
  }

  /**
   * Durable Object fetch dispatcher
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const actorAccountId = (request.headers.get("X-Actor-Account") as AccountId) || "A";
    const sessionId = request.headers.get("X-Session-Id") || undefined;

    // WebSocket Upgrade
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket" || path.endsWith("/socket")) {
      return this.handleWebSocketUpgrade(request, actorAccountId, sessionId);
    }

    // POST /initialize
    if (request.method === "POST" && (path === "/initialize" || path.endsWith("/initialize"))) {
      const body = (await request.json()) as MatchInitializationParams;
      const view = await this.initializeMatch(body);
      return new Response(JSON.stringify({ status: "ok", view }), {
        headers: { "Content-Type": "application/json" },
      });
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
      const view = this.buildFilteredView(snapshot, actorAccountId);
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
      const actionId = receiptMatch[1];
      const receiptRes = this.handleGetReceipt(actionId, actorAccountId);
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
      const body = (await request.json()) as { pendingActionId: string; roundId?: number };
      const recoveryRes = await this.handleSecretRecovery(
        body.pendingActionId,
        actorAccountId,
        body.roundId,
      );
      return new Response(JSON.stringify(recoveryRes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
