import { apiFetch } from "../app/auth";
import type {
  AccountId,
  ActionPayloadMap,
  ActionType,
  AcceptedReply,
  FilteredMatchView,
  RejectedReply,
} from "../../shared/protocol/types";
import type {
  ConnectionState,
  ControllerStatus,
  MatchSessionOptions,
  MatchSessionState,
  PendingAction,
  PendingActionMetadata,
  ReceiptResponse,
  SecretRecoveryResponse,
  SessionError,
  SocketServerMessage,
} from "./types";
import { generateUuid } from "../../shared/utils/uuid";

function getStorageKey(accountId: AccountId, matchId: string): string {
  return `pa_pending_${accountId}_${matchId}`;
}

function safeGetStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") return true;
  return !document.hidden;
}

function generateActionId(): string {
  return generateUuid();
}

export class MatchSession {
  private readonly options: Required<Omit<MatchSessionOptions, "wsUrl" | "baseUrl" | "storage">> & {
    wsUrl?: string;
    baseUrl: string;
    storage: Storage | null;
  };

  private state: MatchSessionState;
  private readonly listeners = new Set<(state: MatchSessionState) => void>();

  private ws: any = null;
  private heartbeatTimer: any = null;
  private pollTimer: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private isDisposed = false;
  private isUsingPolling = false;

  private lastContactTimestamp = Date.now();
  private lastPingTimestamp: number | null = null;
  private pongTimeoutTimer: any = null;
  private reconciliationPromise: Promise<void> | null = null;
  private reconciliationGeneration = 0;

  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolver: {
    resolve: (res: AcceptedReply) => void;
    reject: (err: any) => void;
  } | null = null;

  private cleanupFns: Array<() => void> = [];

  constructor(options: MatchSessionOptions) {
    const baseUrl =
      options.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
    const storage = safeGetStorage(options.storage);

    this.options = {
      matchId: options.matchId,
      actorAccountId: options.actorAccountId,
      baseUrl,
      wsUrl: options.wsUrl,
      initialView: options.initialView ?? null,
      onStateChange: options.onStateChange ?? (() => {}),
      onError: options.onError ?? (() => {}),
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 15000,
      pollIntervalMs: options.pollIntervalMs ?? 3000,
      reconnectInitialDelayMs: options.reconnectInitialDelayMs ?? 500,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs ?? 10000,
      reconnectBackoffFactor: options.reconnectBackoffFactor ?? 1.5,
      transport: options.transport ?? "auto",
      fetchFn:
        options.fetchFn ?? (typeof fetch !== "undefined" ? apiFetch : async () => ({}) as any),
      webSocketClass:
        options.webSocketClass ?? (typeof WebSocket !== "undefined" ? WebSocket : null),
      storage,
    };

    const initialView = this.options.initialView;
    const initialDeliveryVersion = initialView?.deliveryVersion ?? 0;

    let initialControllerStatus: ControllerStatus | null = null;
    if (initialView?.controller) {
      initialControllerStatus = {
        controllingAccountId: initialView.controller.controllingAccountId,
        controllerGeneration: initialView.controller.controllerGeneration,
        isController:
          initialView.controller.isController ??
          initialView.controller.controllingAccountId === this.options.actorAccountId,
        takeoverNotice: false,
      };
    }

    const isOffline =
      typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
        ? !navigator.onLine
        : false;

    this.state = {
      matchId: this.options.matchId,
      actorAccountId: this.options.actorAccountId,
      view: initialView,
      deliveryVersion: initialDeliveryVersion,
      connectionState: "disconnected",
      syncStatus: "idle",
      isOffline,
      isInputPaused: true,
      pendingAction: null,
      error: null,
      controllerStatus: initialControllerStatus,
      secretChoiceMasked: false,
    };

    this.restorePendingActionFromStorage();
    this.updateState();
    this.attachDomListeners();
  }

  public getState(): Readonly<MatchSessionState> {
    return this.state;
  }

  public getLastContactTimestamp(): number {
    return this.lastContactTimestamp;
  }

  public getLastPingTimestamp(): number | null {
    return this.lastPingTimestamp;
  }

  public setConnectionState(connectionState: ConnectionState): void {
    this.updateState({ connectionState });
  }

  public subscribe(listener: (state: MatchSessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial?: Partial<MatchSessionState>): void {
    if (this.isDisposed) return;

    if (partial) {
      this.state = { ...this.state, ...partial };
    }

    const isOffline = this.state.isOffline;
    const connectionNotReady = this.state.connectionState !== "connected";
    const isReconciling = this.state.syncStatus === "reconciling";

    const isInputPaused =
      isOffline ||
      connectionNotReady ||
      isReconciling ||
      this.state.pendingAction !== null ||
      ((this.state.view?.mode === "together" || this.state.view?.gameId === "sudoku") &&
        !this.state.controllerStatus?.isController);

    if (this.state.isInputPaused !== isInputPaused) {
      this.state = { ...this.state, isInputPaused };
    }

    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Error in MatchSession subscriber:", err);
      }
    }
    this.options.onStateChange(this.state);
  }

  public connect(): void {
    if (this.isDisposed) {
      this.isDisposed = false;
      this.attachDomListeners();
    }
    if (this.state.connectionState === "connected" || this.state.connectionState === "connecting") {
      return;
    }

    this.updateState({ connectionState: "connecting", error: null });

    if (this.options.transport === "polling" || !this.options.webSocketClass) {
      this.startPollingFallback();
      return;
    }

    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (this.isDisposed) return;

    let wsUrl = this.options.wsUrl;
    if (!wsUrl) {
      const base = this.options.baseUrl;
      const proto = base.startsWith("https") ? "wss:" : "ws:";
      const host = base.replace(/^https?:\/\//, "");
      wsUrl = host
        ? `${proto}//${host}/api/v1/matches/${encodeURIComponent(this.options.matchId)}/socket`
        : `/api/v1/matches/${encodeURIComponent(this.options.matchId)}/socket`;
    }

    try {
      const WebSocketClass = this.options.webSocketClass;
      this.ws = new WebSocketClass(wsUrl);

      this.ws.onopen = () => {
        if (this.isDisposed) return;
        const wasReconnecting = this.state.connectionState === "reconnecting";
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        this.isUsingPolling = false;
        this.stopPolling();

        this.updateState({ connectionState: "connected" });
        this.startHeartbeat();

        if (wasReconnecting || this.state.pendingAction !== null || !this.state.view) {
          void this.reconcile();
        }
      };

      this.ws.onmessage = (event: any) => {
        if (this.isDisposed) return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          this.handleSocketMessage(data as SocketServerMessage);
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      };

      this.ws.onerror = (_evt: any) => {
        // Will trigger onclose and retry
      };

      this.ws.onclose = () => {
        if (this.isUsingPolling) return;
        if (this.pendingResolver) {
          this.reportTransportError(
            "TRANSPORT_NETWORK",
            "Connection lost before the saved action was acknowledged. Reconnect to check its receipt.",
          );
          this.pendingResolver.reject(
            new Error("Connection lost. Acceptance is unknown; reconnect to check."),
          );
          this.pendingResolver = null;
        }
        if (this.state.pendingAction) this.markPendingForRetry(this.state.pendingAction);
        if (this.isDisposed) return;
        this.stopHeartbeat();
        this.ws = null;
        this.handleConnectionDrop();
      };
    } catch {
      this.handleConnectionDrop();
    }
  }

  private handleConnectionDrop(): void {
    if (this.isDisposed) return;
    if (this.state.pendingAction?.isSecret) this.state.pendingAction.payload = {} as any;

    this.updateState({
      connectionState: "reconnecting",
      secretChoiceMasked: true,
    });

    if (this.reconnectAttempts >= 3 && this.options.transport === "auto") {
      this.startPollingFallback();
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      this.options.reconnectInitialDelayMs *
        Math.pow(this.options.reconnectBackoffFactor, this.reconnectAttempts),
      this.options.reconnectMaxDelayMs,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.isDisposed) {
        this.connectWebSocket();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.lastPingTimestamp = Date.now();
          this.ws.send(JSON.stringify({ type: "ping" }));
          this.clearPongTimeout();
          this.pongTimeoutTimer = setTimeout(() => {
            // Pong deadline expired (10s without response)
            if (this.ws && !this.isDisposed) {
              try {
                this.ws.close();
              } catch {}
            }
          }, 10000);
        } catch {
          // Socket write error
        }
      }
    }, this.options.heartbeatIntervalMs);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearPongTimeout();
  }

  private startPollingFallback(): void {
    this.isUsingPolling = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const wasReconnecting = this.state.connectionState === "reconnecting";
    this.updateState({ connectionState: "connecting" });
    if (wasReconnecting || this.state.pendingAction !== null || !this.state.view) {
      void this.reconcile();
    }
    this.scheduleNextPoll();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNextPoll(): void {
    this.stopPolling();
    if (!this.isUsingPolling || this.isDisposed) return;

    this.pollTimer = setTimeout(async () => {
      if (this.isDisposed) return;
      if (!isDocumentVisible()) return;
      await this.pollSnapshot();
      if (isDocumentVisible()) this.scheduleNextPoll();
    }, this.options.pollIntervalMs);
  }

  private async pollSnapshot(): Promise<void> {
    try {
      const url = `${this.options.baseUrl}/api/v1/matches/${encodeURIComponent(this.options.matchId)}`;
      const res = await this.options.fetchFn(url, {
        headers: { "X-Actor-Account": this.options.actorAccountId },
      });
      if (res.ok) {
        const view: FilteredMatchView = await res.json();
        this.handleSnapshotMessage({ view, serverTime: Date.now() });
        this.updateState({ connectionState: "connected" });
      } else {
        this.updateState({ connectionState: "disconnected" });
      }
    } catch {
      this.updateState({ connectionState: "disconnected" });
      // Temporary network error during poll
    }
  }

  private handleSocketMessage(msg: SocketServerMessage): void {
    this.lastContactTimestamp = Date.now();
    if ("status" in msg) {
      if (!this.state.pendingAction || msg.actionId !== this.state.pendingAction.actionId) {
        return;
      }
      if (msg.status === "accepted") {
        this.handleAcceptedReply(msg);
      } else if (msg.status === "rejected") {
        this.handleRejectedReply(msg);
      }
      return;
    }

    switch (msg.type) {
      case "snapshot":
        this.handleSnapshotMessage(msg);
        break;

      case "event":
        this.handleEventMessage(msg);
        break;

      case "control-changed":
        this.handleControlChangedMessage(msg);
        break;

      case "auth-expired":
        this.handleAuthExpired();
        break;

      case "protocol-update-needed":
        this.handleProtocolUpdateNeeded();
        break;

      case "pong":
        this.clearPongTimeout();
        break;
    }
  }

  private handleSnapshotMessage(msg: { view: FilteredMatchView; serverTime: number }): void {
    const currentVersion = this.state.deliveryVersion;
    if (msg.view.deliveryVersion < currentVersion) {
      // Stale snapshot, ignore
      return;
    }

    const view = this.preserveStartedSudokuDuelView(this.state.view, msg.view);
    const pendingAction = this.state.pendingAction;

    this.updateState({
      view,
      deliveryVersion: view.deliveryVersion,
      acceptedEvent: null,
      controllerStatus: this.controllerStatusFor(view),
      pendingAction,
      error: null,
    });
  }

  private handleEventMessage(msg: {
    eventId: string;
    acceptedVersion: number;
    view: FilteredMatchView;
    effects?: unknown[];
    serverTime: number;
  }): void {
    const currentVersion = this.state.deliveryVersion;

    if (msg.acceptedVersion <= currentVersion) {
      // Duplicate or stale event
      return;
    }

    if (msg.acceptedVersion > currentVersion + 1) {
      // GAP DETECTED: out of order delivery! Trigger immediate snapshot resync
      this.fetchSnapshot();
      return;
    }

    // Broadcasts do not prove acceptance of our action. Only its receipt/reply does.
    const pendingAction = this.state.pendingAction;

    const effectiveDeliveryVersion = msg.view.deliveryVersion ?? msg.acceptedVersion;
    this.updateState({
      view: msg.view,
      deliveryVersion: effectiveDeliveryVersion,
      acceptedEvent: { eventId: msg.eventId, effects: msg.effects ?? [] },
      controllerStatus: this.controllerStatusFor(msg.view),
      pendingAction,
    });
  }

  private handleControlChangedMessage(msg: {
    controller: FilteredMatchView["controller"];
    deliveryVersion: number;
    view?: FilteredMatchView;
    serverTime: number;
  }): void {
    if (msg.deliveryVersion <= this.state.deliveryVersion) return;
    if (msg.deliveryVersion > this.state.deliveryVersion + 1) {
      void this.fetchSnapshot();
      return;
    }

    const previous = this.state.controllerStatus;
    const exclusiveControl =
      this.state.view?.mode === "together" || this.state.view?.gameId === "sudoku";
    const updates: Partial<MatchSessionState> = {
      controllerStatus: msg.view
        ? this.controllerStatusFor(msg.view)
        : {
            controllingAccountId: msg.controller.controllingAccountId,
            controllerGeneration: msg.controller.controllerGeneration,
            isController: msg.controller.isController,
            takeoverNotice:
              exclusiveControl &&
              previous !== null &&
              previous.isController !== msg.controller.isController,
          },
    };

    if (msg.view) {
      updates.view = msg.view;
      updates.deliveryVersion = msg.deliveryVersion;
      updates.controllerStatus = this.controllerStatusFor(msg.view);
    } else {
      updates.deliveryVersion = msg.deliveryVersion;
    }

    this.updateState(updates);
  }

  private handleAuthExpired(): void {
    const error: SessionError = {
      code: "AUTH_REQUIRED",
      message: "Authentication session expired. Please sign in again.",
      retryable: false,
      timestamp: Date.now(),
    };
    this.updateState({
      error,
      secretChoiceMasked: true,
      connectionState: "disconnected",
    });
    this.options.onError(error);
    this.disconnect();
  }

  private handleProtocolUpdateNeeded(): void {
    const error: SessionError = {
      code: "PROTOCOL_MISMATCH",
      message: "Application update required. Please refresh.",
      retryable: false,
      timestamp: Date.now(),
    };
    this.updateState({
      error,
      connectionState: "disconnected",
    });
    this.options.onError(error);
  }

  private handleAcceptedReply(reply: AcceptedReply): void {
    const effectiveDeliveryVersion = reply.view?.deliveryVersion ?? reply.acceptedVersion;
    const animate =
      effectiveDeliveryVersion > this.state.deliveryVersion &&
      this.state.pendingAction?.status === "in-flight";
    if (this.state.pendingAction && this.state.pendingAction.actionId === reply.actionId) {
      if (this.pendingResolver) {
        this.pendingResolver.resolve(reply);
        this.pendingResolver = null;
      }
      this.clearPendingAction();
    }

    const replyView = reply.view
      ? this.preserveStartedSudokuDuelView(this.state.view, reply.view)
      : undefined;
    if (replyView && effectiveDeliveryVersion >= this.state.deliveryVersion) {
      this.updateState({
        view: replyView,
        deliveryVersion: effectiveDeliveryVersion,
        controllerStatus: this.controllerStatusFor(replyView),
        ...(animate
          ? { acceptedEvent: { eventId: reply.eventId, effects: reply.effects ?? [] } }
          : {}),
        error: null,
      });
    }
  }

  private handleRejectedReply(reply: RejectedReply): void {
    if (this.state.pendingAction && this.state.pendingAction.actionId === reply.actionId) {
      if (this.pendingResolver) {
        this.pendingResolver.reject(new Error(`[${reply.code}] ${reply.message}`));
        this.pendingResolver = null;
      }
      this.clearPendingAction();
    }

    const sessionError: SessionError = {
      code: reply.code,
      message: reply.message,
      retryable: reply.retryable,
      category: "game",
      timestamp: Date.now(),
    };

    const updates: Partial<MatchSessionState> = {
      error: sessionError,
    };

    const latestView = reply.latestView
      ? this.preserveStartedSudokuDuelView(this.state.view, reply.latestView)
      : undefined;
    if (latestView && latestView.deliveryVersion >= this.state.deliveryVersion) {
      updates.view = latestView;
      updates.deliveryVersion = latestView.deliveryVersion;
      updates.acceptedEvent = null;
      updates.controllerStatus = this.controllerStatusFor(latestView);
    }

    this.updateState(updates);
    this.options.onError(sessionError);
  }

  private controllerStatusFor(view: FilteredMatchView): ControllerStatus {
    const previous = this.state.controllerStatus;
    const isController = view.controller.isController;
    const exclusiveControl = view.mode === "together" || view.gameId === "sudoku";
    return {
      controllingAccountId: view.controller.controllingAccountId,
      controllerGeneration: view.controller.controllerGeneration,
      isController,
      takeoverNotice:
        exclusiveControl && previous !== null && previous.isController !== isController,
    };
  }

  /**
   * Duel start becomes visible as server time crosses its scheduled deadline,
   * without changing deliveryVersion. Do not let an older equal-version view
   * undo that visibility for this same viewer and unchanged active duel.
   */
  private preserveStartedSudokuDuelView(
    current: FilteredMatchView | null,
    incoming: FilteredMatchView,
  ): FilteredMatchView {
    if (!current) return incoming;

    const currentSudoku = current.gameState as {
      mode?: string;
      puzzleId?: string;
      scheduledStartTime?: number;
      hasStarted?: boolean;
      terminalResult?: unknown;
    };
    const incomingSudoku = incoming.gameState as {
      mode?: string;
      puzzleId?: string;
      scheduledStartTime?: number;
      hasStarted?: boolean;
      terminalResult?: unknown;
    };
    const currentActorSeat =
      current.participants.A.accountId === this.options.actorAccountId
        ? "A"
        : current.participants.B?.accountId === this.options.actorAccountId
          ? "B"
          : null;
    const incomingActorSeat =
      incoming.participants.A.accountId === this.options.actorAccountId
        ? "A"
        : incoming.participants.B?.accountId === this.options.actorAccountId
          ? "B"
          : null;

    const sameParticipantIdentity =
      currentActorSeat !== null &&
      currentActorSeat === incomingActorSeat &&
      current.participants.A.accountId === incoming.participants.A.accountId &&
      current.participants.B?.accountId === incoming.participants.B?.accountId;
    const sameControllerIdentity =
      current.controller.controllingAccountId === incoming.controller.controllingAccountId &&
      current.controller.controllerGeneration === incoming.controller.controllerGeneration &&
      current.controller.isController === incoming.controller.isController;

    if (
      current.matchId === incoming.matchId &&
      current.deliveryVersion === this.state.deliveryVersion &&
      current.deliveryVersion === incoming.deliveryVersion &&
      current.gameId === "sudoku" &&
      incoming.gameId === "sudoku" &&
      current.mode === "duel" &&
      incoming.mode === "duel" &&
      current.lifecycle === "active" &&
      incoming.lifecycle === "active" &&
      currentSudoku.mode === "duel" &&
      incomingSudoku.mode === "duel" &&
      currentSudoku.puzzleId === incomingSudoku.puzzleId &&
      typeof currentSudoku.scheduledStartTime === "number" &&
      currentSudoku.scheduledStartTime === incomingSudoku.scheduledStartTime &&
      currentSudoku.hasStarted === true &&
      incomingSudoku.hasStarted === false &&
      !currentSudoku.terminalResult &&
      !incomingSudoku.terminalResult &&
      sameParticipantIdentity &&
      sameControllerIdentity
    ) {
      return current;
    }

    return incoming;
  }

  public async sendAction<T extends ActionType>(
    action: T,
    payload: ActionPayloadMap[T],
    options?: {
      expectedVersion?: number;
      roundId?: number;
      turnId?: number;
      controllerGeneration?: number;
      isSecret?: boolean;
    },
  ): Promise<AcceptedReply> {
    if (this.state.pendingAction !== null) {
      throw new Error("An action is already in flight. Please wait for acceptance or retry.");
    }

    if (this.state.isInputPaused) {
      throw new Error(
        "Inputs are currently paused (connection disconnected, offline, or reconciling)",
      );
    }

    const actionId = generateActionId();
    const isSecret = options?.isSecret ?? action === "secret.lock";

    const pendingAction: PendingAction<T> = {
      actionId,
      action,
      payload,
      expectedVersion: options?.expectedVersion ?? this.state.deliveryVersion,
      roundId: options?.roundId ?? this.state.view?.roundId,
      turnId: options?.turnId ?? this.state.view?.turnId,
      progressRevision: (this.state.view?.gameState as { self?: { progressRevision?: number } })
        ?.self?.progressRevision,
      controllerGeneration:
        options?.controllerGeneration ?? this.state.view?.controller?.controllerGeneration,
      isSecret,
      status: "in-flight",
      submittedAt: Date.now(),
      retryCount: 0,
    };

    this.state = {
      ...this.state,
      pendingAction,
      error: null,
    };
    this.savePendingActionToStorage(pendingAction);
    this.updateState();

    return this.dispatchAction(pendingAction);
  }

  private async dispatchAction<T extends ActionType>(
    pendingAction: PendingAction<T>,
  ): Promise<AcceptedReply> {
    const secret = pendingAction.action.startsWith("secret.");
    const sudoku = pendingAction.action.startsWith("sudoku.");
    const envelope = {
      protocolVersion: 1 as const,
      matchId: this.options.matchId,
      actionId: pendingAction.actionId,
      action: pendingAction.action,
      payload: pendingAction.payload,
      ...(!secret && !sudoku ? { expectedVersion: pendingAction.expectedVersion } : {}),
      ...(secret ? { roundId: pendingAction.roundId } : {}),
      ...(!secret && !sudoku && !pendingAction.action.startsWith("match.")
        ? { turnId: pendingAction.turnId }
        : {}),
      ...(this.state.view?.mode === "together" || sudoku
        ? { controllerGeneration: pendingAction.controllerGeneration }
        : {}),
      ...(sudoku
        ? {
            progressRevision: pendingAction.progressRevision,
          }
        : {}),
    };

    if (this.ws && this.ws.readyState === 1) {
      return new Promise<AcceptedReply>((resolve, reject) => {
        this.pendingResolver = { resolve, reject };
        this.actionTimer = setTimeout(() => {
          this.pendingResolver = null;
          this.markPendingForRetry(pendingAction);
          this.reportTransportError(
            "TRANSPORT_TIMEOUT",
            "The action acknowledgement timed out. Reconnect to check its receipt.",
          );
          reject(new Error("Acceptance is unknown. Reconnect to check the saved action."));
        }, 12000);
        try {
          this.ws.send(JSON.stringify({ type: "action", envelope }));
        } catch (err) {
          this.pendingResolver = null;
          this.markPendingForRetry(pendingAction);
          this.reportTransportError(
            "TRANSPORT_NETWORK",
            err instanceof Error ? err.message : "The action could not be sent.",
          );
          reject(err);
        }
      });
    }

    // HTTP POST fallback. Only an ActionResponse is a game reply; HTTP and
    // parsing failures keep the original pending action ID for receipt recovery.
    const url = `${this.options.baseUrl}/api/v1/matches/${encodeURIComponent(this.options.matchId)}/actions`;
    const abort = new AbortController();
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let response: Response | undefined;
    let reply: unknown;
    try {
      const requestAndReadBody = async () => {
        response = await this.options.fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Actor-Account": this.options.actorAccountId,
          },
          body: JSON.stringify(envelope),
          signal: abort.signal,
        });
        reply = await response.json();
      };
      await Promise.race([
        requestAndReadBody(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            abort.abort();
            reject(new Error("HTTP action timed out"));
          }, 12000);
        }),
      ]);
    } catch (error) {
      this.markPendingForRetry(pendingAction);
      this.reportTransportError(
        timedOut
          ? "TRANSPORT_TIMEOUT"
          : response
            ? "TRANSPORT_MALFORMED_JSON"
            : "TRANSPORT_NETWORK",
        timedOut
          ? "Action response timed out. Its result is unknown; reconnect to check the saved action."
          : response
            ? "The server response could not be read. Its result is unknown; reconnect to check the saved action."
            : "Action could not reach the server. Its result is unknown; reconnect to check the saved action.",
        response?.status,
      );
      if (timedOut) throw new Error("Action response timed out; acceptance is unknown.");
      if (response) throw new Error("Malformed action response; acceptance is unknown.");
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const actionResponse = response!;
    const parsed = reply && typeof reply === "object" ? (reply as Record<string, unknown>) : {};
    if (!actionResponse.ok) {
      this.markPendingForRetry(pendingAction);
      const backendCode = typeof parsed.code === "string" ? parsed.code : undefined;
      this.reportTransportError(
        `TRANSPORT_HTTP_${actionResponse.status}`,
        typeof parsed.message === "string" || typeof parsed.error === "string"
          ? String(parsed.message ?? parsed.error)
          : `Server returned HTTP ${actionResponse.status}. Action acceptance is unknown; reconnect to check the saved action.`,
        actionResponse.status,
        backendCode,
      );
      throw new Error(`HTTP ${actionResponse.status}: action acceptance is unknown.`);
    }

    const acceptedView = parsed.view as Record<string, unknown> | null;
    const acceptedController = acceptedView?.controller as Record<string, unknown> | undefined;
    if (
      parsed.status === "accepted" &&
      parsed.actionId === pendingAction.actionId &&
      typeof parsed.eventId === "string" &&
      typeof parsed.acceptedVersion === "number" &&
      typeof parsed.serverTime === "number" &&
      acceptedView !== null &&
      typeof acceptedView === "object" &&
      typeof acceptedView.deliveryVersion === "number" &&
      typeof acceptedView.lifecycle === "string" &&
      acceptedController !== undefined &&
      typeof acceptedController.isController === "boolean" &&
      typeof acceptedController.controllerGeneration === "number" &&
      typeof acceptedController.controllingAccountId === "string"
    ) {
      this.handleAcceptedReply(parsed as unknown as AcceptedReply);
      return parsed as unknown as AcceptedReply;
    }
    if (
      parsed.status === "rejected" &&
      parsed.actionId === pendingAction.actionId &&
      typeof parsed.code === "string" &&
      typeof parsed.message === "string" &&
      typeof parsed.retryable === "boolean"
    ) {
      this.handleRejectedReply(parsed as unknown as RejectedReply);
      throw new Error(`[${parsed.code}] ${parsed.message}`);
    }

    this.markPendingForRetry(pendingAction);
    this.reportTransportError(
      "TRANSPORT_INVALID_RESPONSE",
      "The server response was not a valid game reply. Its result is unknown; reconnect to check the saved action.",
      actionResponse.status,
    );
    throw new Error("Invalid action response; acceptance is unknown.");
  }

  private reportTransportError(
    code: string,
    message: string,
    httpStatus?: number,
    backendCode?: string,
  ): void {
    const error: SessionError = {
      code,
      message,
      retryable: true,
      category: "transport",
      httpStatus,
      backendCode,
      timestamp: Date.now(),
    };
    this.updateState({ error });
    this.options.onError(error);
  }

  private markPendingForRetry(pendingAction: PendingAction): void {
    const updated: PendingAction = {
      ...pendingAction,
      status: "retrying",
      retryCount: pendingAction.retryCount + 1,
    };
    this.state = {
      ...this.state,
      pendingAction: updated,
    };
    this.savePendingActionToStorage(updated);
    this.updateState();
  }

  public async retryPendingAction(): Promise<AcceptedReply | null> {
    const pending = this.state.pendingAction;
    if (!pending) return null;
    if (pending.status === "in-flight" || pending.status === "reconciling")
      throw new Error("Wait while the saved action is being checked.");
    if (
      this.state.isOffline ||
      this.state.connectionState !== "connected" ||
      this.state.syncStatus === "reconciling"
    )
      throw new Error("Reconnect before checking the saved action.");

    if (pending.isSecret) {
      // Live secret retry is permitted until concealment, otherwise must reconcile via secret recovery
      if (this.state.secretChoiceMasked) {
        await this.reconcile();
        return null;
      }
    } else {
      // An action whose reply was lost may already be committed. Check its
      // receipt first; only an explicitly unknown receipt permits replay.
      const reconciling = { ...pending, status: "reconciling" as const };
      this.state = { ...this.state, pendingAction: reconciling };
      this.updateState({ syncStatus: "reconciling" });
      try {
        await this.reconcileNonsecretAction(pending);
      } finally {
        const currentPending = this.state.pendingAction;
        this.updateState({
          syncStatus: "idle",
          ...(currentPending?.actionId === pending.actionId
            ? { pendingAction: { ...currentPending, status: "retrying" } }
            : {}),
        });
      }
      if (this.state.pendingAction?.actionId !== pending.actionId) return null;
      if (
        this.state.isOffline ||
        this.state.connectionState !== "connected" ||
        (this.getState().syncStatus as MatchSessionState["syncStatus"]) === "reconciling"
      ) {
        throw new Error("Reconnect before retrying the unresolved action.");
      }
    }

    const retried: PendingAction = {
      ...pending,
      status: "in-flight",
      retryCount: pending.retryCount + 1,
    };
    this.state = {
      ...this.state,
      pendingAction: retried,
      error: null,
    };
    this.updateState();

    return this.dispatchAction(retried);
  }

  public async reconcile(): Promise<void> {
    if (this.isDisposed) return;
    this.reconciliationGeneration++;
    const currentGen = this.reconciliationGeneration;

    if (this.reconciliationPromise) {
      try {
        await this.reconciliationPromise;
      } catch {}
      if (currentGen < this.reconciliationGeneration) {
        return;
      }
    }

    this.reconciliationPromise = this.doReconcile(currentGen);
    try {
      await this.reconciliationPromise;
    } finally {
      if (this.reconciliationGeneration === currentGen) {
        this.reconciliationPromise = null;
      }
    }
  }

  private async doReconcile(generation: number): Promise<void> {
    if (this.isDisposed) return;

    if (this.state.pendingAction?.isSecret) this.state.pendingAction.payload = {} as any;
    // 1. Conceal unrevealed secret choices first
    this.updateState({
      secretChoiceMasked: true,
      syncStatus: "reconciling",
    });

    try {
      const pending = this.state.pendingAction;

      // 2. If an uncertain secret lock was in flight, call secret-recovery
      if (pending && pending.isSecret) {
        await this.recoverSecretLock(pending);
      } else if (pending && !pending.isSecret) {
        // 3. For nonsecret action, check receipt or snapshot
        await this.reconcileNonsecretAction(pending);
      } else {
        // 4. No pending action: fetch latest snapshot view
        await this.fetchSnapshot();
      }
    } finally {
      if (this.reconciliationGeneration === generation) {
        this.updateState({ syncStatus: "idle" });
      }
    }
  }

  private async recoverSecretLock(pending: PendingAction): Promise<void> {
    try {
      const url = `${this.options.baseUrl}/api/v1/matches/${encodeURIComponent(this.options.matchId)}/secret-recovery`;
      const res = await this.options.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Account": this.options.actorAccountId,
        },
        body: JSON.stringify({
          pendingActionId: pending.actionId,
          roundId: pending.roundId,
          controllerGeneration: pending.controllerGeneration,
        }),
      });

      if (res.ok) {
        const data: SecretRecoveryResponse = await res.json();
        this.clearPendingAction();

        const view = data.view
          ? this.preserveStartedSudokuDuelView(this.state.view, data.view)
          : null;
        if (view && view.deliveryVersion >= this.state.deliveryVersion) {
          this.updateState({
            view,
            deliveryVersion: view.deliveryVersion,
            controllerStatus: this.controllerStatusFor(view),
            pendingAction: null,
          });
        }
      } else {
        // Failed recovery request, fetch latest snapshot
        await this.fetchSnapshot();
      }
    } catch {
      await this.fetchSnapshot();
    }
  }

  private async reconcileNonsecretAction(pending: PendingAction): Promise<void> {
    try {
      const receiptUrl = `${this.options.baseUrl}/api/v1/matches/${encodeURIComponent(this.options.matchId)}/receipts/${encodeURIComponent(pending.actionId)}`;
      const res = await this.options.fetchFn(receiptUrl, {
        headers: { "X-Actor-Account": this.options.actorAccountId },
      });

      if (res.ok) {
        const receipt: ReceiptResponse = await res.json();
        if (receipt.status === "accepted") {
          this.clearPendingAction();
          const view = receipt.view
            ? this.preserveStartedSudokuDuelView(this.state.view, receipt.view)
            : null;
          if (view && view.deliveryVersion >= this.state.deliveryVersion) {
            this.updateState({
              view,
              deliveryVersion: view.deliveryVersion,
              controllerStatus: this.controllerStatusFor(view),
              pendingAction: null,
            });
          }
          return;
        } else if (receipt.status === "superseded") {
          this.clearPendingAction();
          const view = receipt.view
            ? this.preserveStartedSudokuDuelView(this.state.view, receipt.view)
            : null;
          if (view && view.deliveryVersion >= this.state.deliveryVersion) {
            this.updateState({
              view,
              deliveryVersion: view.deliveryVersion,
              controllerStatus: this.controllerStatusFor(view),
              pendingAction: null,
            });
          }
          return;
        }
      }
    } catch {
      // Fall through to snapshot check
    }

    // If receipt is unknown, check latest snapshot
    const latest = await this.fetchSnapshot();
    // An unrelated accepted move cannot settle this action's identity.
    if (latest) {
      const preserved: PendingAction = { ...pending, status: "retrying" };
      this.state = { ...this.state, pendingAction: preserved };
      this.savePendingActionToStorage(preserved);
      this.updateState();
    }
  }

  public async fetchSnapshot(): Promise<FilteredMatchView | null> {
    try {
      const url = `${this.options.baseUrl}/api/v1/matches/${encodeURIComponent(this.options.matchId)}`;
      const res = await this.options.fetchFn(url, {
        headers: { "X-Actor-Account": this.options.actorAccountId },
      });
      if (res.ok) {
        const view: FilteredMatchView = await res.json();
        this.handleSnapshotMessage({ view, serverTime: Date.now() });
        this.updateState({ connectionState: "connected" });
        return view;
      } else {
        this.updateState({
          connectionState: "disconnected",
          error: {
            code: "UNAVAILABLE",
            message: "Saved match unavailable. Check your connection and retry.",
            timestamp: Date.now(),
          },
        });
      }
    } catch {
      this.updateState({ connectionState: "disconnected" });
      // Snapshot fetch failed
    }
    return null;
  }

  public unmaskSecretChoice(): void {
    this.updateState({ secretChoiceMasked: false });
  }

  public dismissTakeoverNotice(): void {
    if (this.state.controllerStatus) {
      this.updateState({
        controllerStatus: {
          ...this.state.controllerStatus,
          takeoverNotice: false,
        },
      });
    }
  }

  public clearError(): void {
    this.updateState({ error: null });
  }

  private savePendingActionToStorage(pending: PendingAction): void {
    const storage = this.options.storage;
    if (!storage) return;

    try {
      const key = getStorageKey(this.options.actorAccountId, this.options.matchId);
      const meta: PendingActionMetadata = {
        actionId: pending.actionId,
        action: pending.action,
        expectedVersion: pending.expectedVersion,
        roundId: pending.roundId,
        turnId: pending.turnId,
        progressRevision: pending.progressRevision,
        controllerGeneration: pending.controllerGeneration,
        isSecret: pending.isSecret,
        submittedAt: pending.submittedAt,
        // CRITICAL RULE: NEVER store secret value/payload in sessionStorage!
        payload: pending.isSecret ? undefined : pending.payload,
      };
      storage.setItem(key, JSON.stringify(meta));
    } catch {
      // Ignore storage quota or permission errors
    }
  }

  private restorePendingActionFromStorage(): void {
    const storage = this.options.storage;
    if (!storage) return;

    try {
      const key = getStorageKey(this.options.actorAccountId, this.options.matchId);
      const raw = storage.getItem(key);
      if (!raw) return;

      const meta: PendingActionMetadata = JSON.parse(raw);
      if (meta && meta.actionId && meta.action) {
        const restored: PendingAction = {
          actionId: meta.actionId,
          action: meta.action as any,
          payload: (meta.payload ?? {}) as any,
          expectedVersion: meta.expectedVersion,
          roundId: meta.roundId,
          turnId: meta.turnId,
          progressRevision: meta.progressRevision,
          controllerGeneration: meta.controllerGeneration,
          isSecret: meta.isSecret,
          status: "retrying",
          submittedAt: meta.submittedAt,
          retryCount: 0,
        };
        this.state = {
          ...this.state,
          pendingAction: restored,
        };
      }
    } catch {
      // Ignore corrupted metadata
    }
  }

  private clearPendingAction(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    this.state = {
      ...this.state,
      pendingAction: null,
    };
    const storage = this.options.storage;
    if (storage) {
      try {
        const key = getStorageKey(this.options.actorAccountId, this.options.matchId);
        storage.removeItem(key);
      } catch {}
    }
    this.updateState();
  }

  private attachDomListeners(): void {
    if (typeof window === "undefined") return;

    const onOnline = () => {
      this.updateState({ isOffline: false });
      this.connect();
    };

    const onOffline = () => {
      this.stopHeartbeat();
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
      }
      this.updateState({
        isOffline: true,
        connectionState: "disconnected",
      });
    };

    const onVisibilityChange = () => {
      if (isDocumentVisible()) {
        this.reconcile();
        if (this.isUsingPolling) {
          this.scheduleNextPoll();
        }
      } else {
        this.updateState({ secretChoiceMasked: true });
        if (this.state.pendingAction?.isSecret) this.state.pendingAction.payload = {} as any;
        if (this.isUsingPolling) {
          this.stopPolling();
        }
      }
    };

    const onFocusOrPageshow = () => {
      this.reconcile();
    };

    const conceal = () => {
      if (this.state.pendingAction?.isSecret) this.state.pendingAction.payload = {} as any;
      this.updateState({ secretChoiceMasked: true });
    };
    window.addEventListener("blur", conceal);
    window.addEventListener("pagehide", conceal);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    window.addEventListener("pageshow", onFocusOrPageshow);
    window.addEventListener("focus", onFocusOrPageshow);

    this.cleanupFns.push(() => {
      window.removeEventListener("blur", conceal);
      window.removeEventListener("pagehide", conceal);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      window.removeEventListener("pageshow", onFocusOrPageshow);
      window.removeEventListener("focus", onFocusOrPageshow);
    });
  }

  public disconnect(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    this.isDisposed = true;
    this.stopHeartbeat();
    this.stopPolling();
    this.clearReconnectTimer();

    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch {}
    }
    this.cleanupFns = [];

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.pendingResolver) {
      this.pendingResolver.reject(new Error("MatchSession disconnected"));
      this.pendingResolver = null;
    }

    this.updateState({ connectionState: "disconnected" });
  }
}
