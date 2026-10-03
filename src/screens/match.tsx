import { apiFetch } from "../app/auth";
import { generateUuid } from "../../shared/utils/uuid";
import { useTheme, resolvePlayerAccent } from "../theme";
import { lazy, Suspense, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  GameHeader,
  FocusModeToggle,
  ColourPicker,
  InlineNotice,
  ResultPanel,
} from "../components/game-primitives";
import { ConnectionStatus } from "../components/connection-status";
import { TurnStrip } from "../components/turn-strip";
import { Surface } from "../components/surface";
import { Button } from "../components/button";
import { IconButton } from "../components/icon-button";
import { retainSheetHistoryForReplaceNavigation, Sheet } from "../components/sheet";
import {
  MoreVertical,
  RotateCcw,
  AlertTriangle,
  Trophy,
  Home,
  CheckCircle2,
  History,
} from "lucide-react";
import { useMatchSession } from "../sync/use-match-session";
import "./match.css";
const ConnectFourBoard = lazy(() =>
  import("../games/connect-four/connect-four-board").then((module) => ({
    default: module.ConnectFourBoard,
  })),
);
const RPSBoard = lazy(() =>
  import("../games/rps/rps-board").then((module) => ({ default: module.RPSBoard })),
);
const LudoBoard = lazy(() =>
  import("../games/ludo/ludo-board").then((module) => ({ default: module.LudoBoard })),
);
const SnakesLaddersBoard = lazy(() =>
  import("../games/snakes-ladders/snakes-ladders-board").then((module) => ({
    default: module.SnakesLaddersBoard,
  })),
);
const DotsBoxesBoard = lazy(() =>
  import("../games/dots-boxes/dots-boxes-board").then((module) => ({
    default: module.DotsBoxesBoard,
  })),
);
const SOSBoard = lazy(() =>
  import("../games/sos/sos-board").then((module) => ({ default: module.SOSBoard })),
);
const HandCricketBoard = lazy(() =>
  import("../games/hand-cricket/hand-cricket-board").then((module) => ({
    default: module.HandCricketBoard,
  })),
);
const SudokuBoard = lazy(() =>
  import("../games/sudoku/sudoku-board").then((module) => ({ default: module.SudokuBoard })),
);
import type {
  Seat,
  AccountId,
  FilteredMatchView,
  ActionPayloadMap,
  ActionType,
  TerminalResult,
} from "../../shared/protocol/types";
import type {
  ConnectFourView,
  ConnectFourCell,
  ConnectFourEffect,
} from "../../shared/games/connect-four/types";
import type { RPSView, RPSChoice } from "../../shared/games/rps/types";
import type { LudoView, LudoEffect } from "../../shared/games/ludo/types";
import type {
  SnakesAndLaddersView,
  SnakesAndLaddersEffect,
} from "../../shared/games/snakes-and-ladders/types";
import type {
  DotsBoxesView,
  DotsBoxesEdge,
  DotsBoxesEffect,
} from "../../shared/games/dots-boxes/types";
import type { SOSView, SOSLetter, SOSEffect } from "../../shared/games/sos/types";
import type { CricketView } from "../../shared/games/hand-cricket/types";
import type { SudokuView, SudokuOperation, SudokuEffect } from "../../shared/games/sudoku/types";
import { CONNECT_FOUR_ROWS, CONNECT_FOUR_COLS } from "../../shared/games/connect-four/types";
import { LUDO_COLOUR_PALETTE, type LudoColourId } from "../../shared/games/ludo/types";

const GAME_TITLES: Record<string, string> = {
  "connect-four": "Connect Four",
  "rock-paper-scissors": "Rock Paper Scissors",
  ludo: "Ludo",
  "snakes-and-ladders": "Snakes & Ladders",
  "dots-boxes": "Dots & Boxes",
  sos: "SOS",
  "hand-cricket": "Hand Cricket",
  sudoku: "Sudoku",
};

export interface MatchScreenProps {
  actorAccountId?: AccountId;
  initialView?: FilteredMatchView | null;
}

export function matchNeedsExclusiveControl(view: FilteredMatchView | null): boolean {
  return view?.mode === "together" || view?.gameId === "sudoku";
}

export function isHistoryOnlySudokuDuel(
  view: FilteredMatchView | null,
  result?: TerminalResult | null,
): boolean {
  const gameState = view?.gameState as { mode?: string; interrupted?: boolean } | undefined;
  return (
    view?.gameId === "sudoku" &&
    gameState?.mode === "duel" &&
    (gameState.interrupted === true || result?.details?.interrupted === true)
  );
}

export function leaveAndSaveDescription(view: FilteredMatchView | null): string {
  const sudoku = view?.gameId === "sudoku" ? (view.gameState as SudokuView) : null;
  return sudoku?.mode === "duel"
    ? "Saving this Duel makes it history-only. It will not count toward competitive wins, streaks, or best times."
    : "The accepted match state will be saved. You can resume it later from Home or this game’s setup.";
}

export function canUseMatchAction({
  view,
  action,
  activeOnly = false,
  lifecycle,
  connected,
  offline,
  inputPaused,
  pending,
  syncing,
  requiresExclusiveControl,
  hasExclusiveControl,
}: {
  view: FilteredMatchView | null;
  action: ActionType;
  activeOnly?: boolean;
  lifecycle: string;
  connected: boolean;
  offline: boolean;
  inputPaused: boolean;
  pending: boolean;
  syncing: boolean;
  requiresExclusiveControl: boolean;
  hasExclusiveControl: boolean;
}): boolean {
  return (
    !!view &&
    view.legalActions.includes(action) &&
    (!activeOnly || lifecycle === "active") &&
    connected &&
    !offline &&
    !inputPaused &&
    !pending &&
    !syncing &&
    (!requiresExclusiveControl || hasExclusiveControl)
  );
}

export function MatchScreen({ actorAccountId = "A", initialView = null }: MatchScreenProps) {
  const { matchId = "demo-match" } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isAbandonSheetOpen, setIsAbandonSheetOpen] = useState(false);
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);
  const [isTakingControl, setIsTakingControl] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [colourSeat, setColourSeat] = useState<Seat>("A");
  const [isResignSheetOpen, setIsResignSheetOpen] = useState(false);
  const [resigningSeat, setResigningSeat] = useState<Seat>("A");
  const rematchRequests = useRef(
    new Map<
      string,
      {
        creationId: string;
        payload: { gameId: string; gameOptions: Record<string, unknown>; mode: string };
      }
    >(),
  );
  const challengeRequests = useRef(
    new Map<string, { creationId: string; senderAttemptId: string }>(),
  );

  // Initialize match session
  const {
    session: _session,
    state,
    sendAction,
    reconcile,
    dismissTakeoverNotice,
    retryPendingAction,
    unmaskSecretChoice,
    clearError,
  } = useMatchSession({
    matchId,
    actorAccountId,
    initialView,
  });

  const { resolvedMode } = useTheme();
  const view = state.view;
  const isTogether = view?.mode === "together";
  const lifecycle = view?.lifecycle ?? "waiting";
  const isTerminal =
    lifecycle === "completed" ||
    lifecycle === "resigned" ||
    lifecycle === "abandoned" ||
    lifecycle === "cancelled";

  // Derive participants
  const participantA = view?.participants?.A;
  const participantB = view?.participants?.B;
  const playerAName = participantA?.displayName ?? "Player A";
  const playerBName = participantB?.displayName ?? "Player B";
  const displayedColourSeat: Seat = isTogether
    ? colourSeat
    : participantB?.accountId === actorAccountId
      ? "B"
      : "A";
  const playerAAccent =
    participantA?.accentFamily ?? (participantA?.accountId === "B" ? "violet" : "teal");
  const playerBAccent =
    participantB?.accentFamily ?? (participantB?.accountId === "A" ? "teal" : "violet");
  const accentA = resolvePlayerAccent(playerAAccent, resolvedMode);
  const accentB = resolvePlayerAccent(playerBAccent, resolvedMode);
  const isAReady = view?.readiness?.A ?? participantA?.ready ?? false;
  const isBReady = view?.readiness?.B ?? participantB?.ready ?? false;

  // Active seat / Turn state
  const mySeat: Seat =
    participantA?.accountId === actorAccountId
      ? "A"
      : participantB?.accountId === actorAccountId
        ? "B"
        : actorAccountId === "B"
          ? "B"
          : "A";
  const sudokuView = view?.gameId === "sudoku" ? (view.gameState as SudokuView) : null;
  const completedSudokuChallengeSender =
    sudokuView?.mode === "challenge" && mySeat === "A" && sudokuView.self.completed;
  const canResumeSavedSudoku =
    !completedSudokuChallengeSender &&
    !(sudokuView?.mode === "challenge" && mySeat === "A" && sudokuView.challenge?.accepted);
  const turnSeat: Seat = view?.turnSeat ?? "A";
  const isMyTurn = isTogether || mySeat === turnSeat;

  // Game state extraction
  const c4State = view?.gameState as Partial<ConnectFourView> | undefined;
  const emptyBoard: ConnectFourCell[][] = useMemo(
    () => Array.from({ length: CONNECT_FOUR_ROWS }, () => Array(CONNECT_FOUR_COLS).fill(null)),
    [],
  );
  const board: ConnectFourCell[][] = c4State?.board ?? emptyBoard;
  const winningCells = c4State?.winningCells ?? [];

  // Terminal Winner determination
  const terminalResult = view?.result ?? c4State?.terminalResult;
  const rawWinnerSeat: Seat | null =
    c4State?.winner !== undefined ? c4State.winner : terminalResult ? terminalResult.winner : null;
  const sudokuInterrupted = isHistoryOnlySudokuDuel(view, terminalResult);
  const winnerSeat = rawWinnerSeat;

  // Readiness status
  const isWaitingForReady = lifecycle === "waiting";
  const myReady = mySeat === "A" ? isAReady : isBReady;
  const invitationAccepted = view?.invitationAccepted ?? false;
  const abandonAction: ActionType | null = view?.legalActions.includes("match.agree-abandon")
    ? "match.agree-abandon"
    : view?.legalActions.includes("match.request-abandon")
      ? "match.request-abandon"
      : null;
  const hasExclusiveControl =
    state.controllerStatus?.isController ?? view?.controller.isController ?? false;
  const requiresExclusiveControl = matchNeedsExclusiveControl(view);
  const canSubmit = (action: ActionType, activeOnly = false) =>
    canUseMatchAction({
      view,
      action,
      activeOnly,
      lifecycle,
      connected: state.connectionState === "connected",
      offline: state.isOffline,
      inputPaused: state.isInputPaused,
      pending: state.pendingAction !== null,
      syncing: state.syncStatus !== "idle",
      requiresExclusiveControl,
      hasExclusiveControl,
    });
  const boardUnavailable =
    !view ||
    lifecycle !== "active" ||
    state.connectionState !== "connected" ||
    state.isOffline ||
    state.isInputPaused ||
    state.pendingAction !== null ||
    state.syncStatus !== "idle" ||
    (requiresExclusiveControl && !hasExclusiveControl);
  const motionEvent = state.acceptedEvent;
  const acceptedEventId = motionEvent?.eventId ?? null;
  const motionEnabled =
    state.connectionState === "connected" && !state.isOffline && state.syncStatus === "idle";
  const submitAction = async <T extends ActionType>(
    action: T,
    payload: ActionPayloadMap[T],
    options?: Parameters<typeof sendAction>[2],
  ) => {
    try {
      const reply = await sendAction(action, payload, options);
      setActionError(null);
      clearError();
      return reply;
    } catch (error) {
      setActionError((error as Error).message);
      throw error;
    }
  };
  const cricketView = view?.gameId === "hand-cricket" ? (view.gameState as CricketView) : undefined;
  const cricketChoosing =
    !!cricketView?.roles && !cricketView.lastDelivery && cricketView.lockedSeats.length < 2;
  const displayedTurnSeat: Seat = cricketView
    ? isTerminal && winnerSeat
      ? winnerSeat
      : cricketView.roles
        ? cricketChoosing
          ? isTogether
            ? (cricketView.expectedChooser ?? cricketView.roles.bat)
            : mySeat
          : cricketView.roles.bat
        : cricketView.tossWinner
    : turnSeat;
  const cricketRole = cricketView?.roles
    ? cricketView.roles.bat === displayedTurnSeat
      ? "Batting"
      : "Bowling"
    : undefined;
  const cricketStatus =
    cricketView?.roles && !isTerminal && lifecycle === "active"
      ? cricketView.lastDelivery
        ? cricketView.lastDelivery.outcome === "out"
          ? "Out · Switch batting"
          : `${cricketView.roles.bat === "A" ? playerAName : playerBName} keeps batting`
        : cricketView.lockedSeats.length === 2
          ? "Both numbers locked · Reveal ball"
          : !isTogether && cricketView.lockedSeats.includes(mySeat)
            ? "Number locked · Waiting for the other player"
            : `${cricketRole} · Choose your number`
      : undefined;

  // Handle Ready action
  const handleReady = async () => {
    if (!canSubmit("match.ready")) return;
    try {
      await submitAction("match.ready", {});
    } catch (err) {
      console.error("Failed to signal ready:", err);
    }
  };

  // Handle Column Drop
  const handleDrop = async (columnIndex: number) => {
    if (!isMyTurn || !canSubmit("connect-four.drop", true)) return;

    try {
      await submitAction("connect-four.drop", { column: columnIndex });
    } catch (err) {
      console.error("Failed to drop disc:", err);
    }
  };

  // Handle Resign
  const handleResign = async () => {
    if (!canSubmit("match.resign")) return;
    try {
      await submitAction("match.resign", isTogether ? { resigningSeat } : {});
      setIsResignSheetOpen(false);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Failed to resign match:", err);
    }
  };

  const handleRPSLock = async (choice: RPSChoice, _seat: Seat) => {
    if (!canSubmit("secret.lock", true)) return;
    try {
      const rpsState = view?.gameState as RPSView | undefined;
      await submitAction("secret.lock", { choice }, { roundId: rpsState?.roundId });
    } catch (err) {
      setActionError((err as Error).message);
      throw err;
    }
  };

  const handleRPSReveal = async () => {
    if (!canSubmit("secret.reveal", true)) return;
    try {
      await submitAction("secret.reveal", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to reveal RPS outcome:", err);
      throw err;
    }
  };

  const handleRPSNext = async () => {
    if (!canSubmit("secret.next", true)) return;
    try {
      await submitAction("secret.next", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to advance RPS round:", err);
      throw err;
    }
  };

  const handleLudoRoll = async () => {
    if (!canSubmit("dice.roll", true)) return;
    try {
      await submitAction("dice.roll", {});
    } catch (err) {
      console.error("Failed to roll Ludo dice:", err);
    }
  };

  const handleLudoSelectToken = async (tokenId: number) => {
    if (!canSubmit("ludo.move", true)) return;
    try {
      await submitAction("ludo.move", { tokenId });
    } catch (err) {
      console.error("Failed to move Ludo token:", err);
    }
  };

  const handleSnakesLaddersRoll = async () => {
    if (!canSubmit("dice.roll", true)) return;
    try {
      await submitAction("dice.roll", {});
    } catch (err) {
      console.error("Failed to roll Snakes & Ladders dice:", err);
    }
  };

  const handleDotsBoxesEdge = async (edge: DotsBoxesEdge) => {
    if (!canSubmit("dots-boxes.edge", true)) return;
    try {
      await submitAction("dots-boxes.edge", edge);
    } catch (err) {
      console.error("Failed to place Dots & Boxes edge:", err);
    }
  };

  const handleSOSPlace = async (row: number, col: number, letter: SOSLetter) => {
    if (!canSubmit("sos.place", true)) return;
    try {
      await submitAction("sos.place", { row, col, letter });
    } catch (err) {
      console.error("Failed to place SOS letter:", err);
    }
  };

  const handleCricketChooseRole = async (role: "bat" | "bowl") => {
    if (!canSubmit("cricket.choose-role", true)) return;
    try {
      await submitAction("cricket.choose-role", { role });
    } catch (err) {
      console.error("Failed to choose cricket role:", err);
    }
  };

  const handleCricketLock = async (value: number, _seat: Seat) => {
    if (!canSubmit("secret.lock", true)) return;
    try {
      const cricketState = view?.gameState as CricketView | undefined;
      await submitAction("secret.lock", { value }, { roundId: cricketState?.deliveryId });
    } catch (err) {
      setActionError((err as Error).message);
      throw err;
    }
  };

  const handleCricketReveal = async () => {
    if (!canSubmit("secret.reveal", true)) return;
    try {
      await submitAction("secret.reveal", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to reveal cricket delivery:", err);
      throw err;
    }
  };

  const handleCricketNext = async () => {
    if (!canSubmit("secret.next", true)) return;
    try {
      await submitAction("secret.next", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to advance cricket delivery:", err);
      throw err;
    }
  };

  const handleSudokuEdit = async (
    row: number,
    col: number,
    operation: SudokuOperation,
    value?: number,
  ) => {
    if (!canSubmit("sudoku.edit", true)) return;
    try {
      await submitAction("sudoku.edit", { row, col, operation, value });
    } catch (err) {
      console.error("Failed to edit Sudoku cell:", err);
    }
  };

  const handleSudokuUndo = async () => {
    if (!canSubmit("sudoku.undo", true)) return;
    try {
      await submitAction("sudoku.undo", {});
    } catch (err) {
      console.error("Failed to undo Sudoku move:", err);
    }
  };

  const handleSudokuCheck = async () => {
    if (!canSubmit("sudoku.check", true)) return;
    try {
      await submitAction("sudoku.check", {});
    } catch (err) {
      console.error("Failed to check Sudoku puzzle:", err);
    }
  };

  const handleSudokuPause = async () => {
    if (!canSubmit("sudoku.pause", true)) return;
    try {
      await submitAction("sudoku.pause", {});
    } catch (err) {
      console.error("Failed to pause Sudoku puzzle:", err);
    }
  };

  const handleSudokuResume = async () => {
    if (!canSubmit("sudoku.resume", true)) return;
    try {
      await submitAction("sudoku.resume", {});
    } catch (err) {
      console.error("Failed to resume Sudoku puzzle:", err);
    }
  };

  // Rematch or Return Home
  const handleRematch = async () => {
    try {
      let request = rematchRequests.current.get(matchId);
      if (!request) {
        let gameOptions: Record<string, unknown> = {};
        if (view?.gameId === "sudoku") {
          gameOptions = { puzzleId: (view.gameState as SudokuView)?.puzzleId };
        } else if (view?.gameId === "rock-paper-scissors") {
          gameOptions = {
            format: `best-of-${((view.gameState as RPSView)?.targetWins ?? 2) * 2 - 1}`,
          };
        } else if (view?.gameId === "dots-boxes") {
          gameOptions = { gridSize: (view.gameState as DotsBoxesView)?.gridSize ?? 5 };
        } else if (view?.gameId === "sos") {
          gameOptions = { gridSize: (view.gameState as SOSView)?.gridSize ?? 5 };
        } else if (view?.gameId === "snakes-and-ladders") {
          gameOptions = {
            boardVersion: (view.gameState as SnakesAndLaddersView)?.boardVersion ?? 2,
          };
        } else if (view?.gameId === "ludo") {
          gameOptions = { colours: (view.gameState as LudoView)?.colours };
        } else if (view?.gameId === "hand-cricket") {
          gameOptions = { rulesVersion: (view.gameState as CricketView)?.rulesVersion ?? 2 };
        }
        request = {
          creationId: generateUuid(),
          payload: {
            gameId: view?.gameId ?? "connect-four",
            gameOptions,
            mode: view?.mode ?? "together",
          },
        };
        rematchRequests.current.set(matchId, request);
      }

      const res = await apiFetch("/api/v1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationId: request.creationId,
          ...request.payload,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { matchId?: string; view?: { matchId?: string } };
        const nextId = data.matchId || data.view?.matchId;
        if (nextId) {
          rematchRequests.current.delete(matchId);
          setActionError(null);
          clearError();
          navigate(`/matches/${nextId}`);
          return;
        }
      } else if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { existingMatchId?: string } | null;
        if (data?.existingMatchId) {
          rematchRequests.current.delete(matchId);
          setActionError(null);
          clearError();
          navigate(`/matches/${data.existingMatchId}`);
          return;
        }
      }
    } catch (err) {
      console.warn("Rematch creation error:", err);
    }
    setActionError("Rematch could not be saved. Please retry.");
  };

  return (
    <div
      className={`arcade-match-page ${focusMode ? "arcade-match-page--focused" : ""}`.trim()}
      style={{
        ["--player-a-accent" as string]: accentA.foreground,
        ["--player-b-accent" as string]: accentB.foreground,
        ["--player-a-on" as string]: accentA.onAccent,
        ["--player-b-on" as string]: accentB.onAccent,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* 1. Header: Back preserves match */}
      <GameHeader
        className="arcade-match-header"
        title={view?.gameId ? (GAME_TITLES[view.gameId] ?? view.gameId) : "Match"}
        subtitle={
          sudokuView?.mode === "practice"
            ? "Practice"
            : sudokuView?.mode === "duel"
              ? "Duel"
              : sudokuView?.mode === "challenge"
                ? "Async Challenge"
                : isTogether
                  ? "Together"
                  : "Remote"
        }
        fallbackTo="/games"
        rightAction={
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {["dots-boxes", "sos", "connect-four"].includes(view?.gameId ?? "") && (
              <FocusModeToggle focused={focusMode} onChange={setFocusMode} />
            )}
            <IconButton
              aria-label="Match Options"
              icon={<MoreVertical size={20} />}
              variant="ghost"
              onClick={() => setIsMenuOpen(true)}
            />
          </div>
        }
      />

      <div
        className={`arcade-match-main ${["dots-boxes", "sos", "connect-four"].includes(view?.gameId ?? "") ? "arcade-match-main--wide" : ""}`.trim()}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          boxSizing: "border-box",
        }}
      >
        {/* 2. Connection Status */}
        {(!focusMode ||
          state.isOffline ||
          state.connectionState !== "connected" ||
          state.controllerStatus?.takeoverNotice) && (
          <ConnectionStatus
            connectionState={state.connectionState}
            syncStatus={state.syncStatus}
            isOffline={state.isOffline}
            controllerStatus={state.controllerStatus}
            onDismissTakeover={dismissTakeoverNotice}
            onRetry={reconcile}
          />
        )}

        {(actionError || state.error) && (
          <InlineNotice tone="error">{actionError || state.error?.message}</InlineNotice>
        )}
        {state.pendingAction && (
          <Button
            disabled={
              state.connectionState !== "connected" ||
              state.isOffline ||
              state.pendingAction.status === "in-flight" ||
              state.pendingAction.status === "reconciling" ||
              state.syncStatus !== "idle"
            }
            aria-busy={state.pendingAction.status === "reconciling"}
            onClick={() => void retryPendingAction().catch((err) => setActionError(err.message))}
          >
            {state.pendingAction.status === "reconciling"
              ? "Checking whether your action was saved…"
              : state.pendingAction.status === "in-flight"
                ? "Saving your action…"
                : "Check saved action and retry"}
          </Button>
        )}
        {(isTogether || view?.gameId === "sudoku") &&
          state.controllerStatus &&
          !state.controllerStatus.isController && (
            <Button
              disabled={
                isTakingControl ||
                state.pendingAction !== null ||
                state.connectionState !== "connected" ||
                state.isOffline ||
                state.syncStatus !== "idle"
              }
              onClick={async () => {
                setIsTakingControl(true);
                setActionError(null);
                try {
                  const response = await apiFetch(
                    "/api/v1/matches/" + encodeURIComponent(matchId) + "/controller",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        expectedControllerGeneration: state.controllerStatus?.controllerGeneration,
                      }),
                    },
                  );
                  const result = (await response.json().catch(() => null)) as {
                    code?: string;
                    message?: string;
                  } | null;
                  if (!response.ok)
                    throw new Error(
                      result?.message ||
                        `Control request failed (${result?.code || response.status}). Reconcile and try again.`,
                    );
                  await reconcile();
                } catch (err) {
                  setActionError((err as Error).message);
                } finally {
                  setIsTakingControl(false);
                }
              }}
            >
              {isTakingControl ? "Taking control…" : "Continue on this device"}
            </Button>
          )}
        {view?.gameId === "sudoku" &&
          (view.gameState as SudokuView)?.mode === "challenge" &&
          (view.gameState as SudokuView)?.self.completed &&
          !(view.gameState as SudokuView)?.challenge?.published && (
            <Button
              disabled={!canSubmit("challenge.publish")}
              onClick={async () => {
                if (!canSubmit("challenge.publish")) return;
                try {
                  let request = challengeRequests.current.get(matchId);
                  if (!request) {
                    request = { creationId: generateUuid(), senderAttemptId: matchId };
                    challengeRequests.current.set(matchId, request);
                  }
                  const response = await apiFetch("/api/v1/challenges", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(request),
                  });
                  const data = (await response.json()) as {
                    matchId?: string;
                    challengeId?: string;
                    error?: string;
                  };
                  if (!response.ok)
                    throw new Error(data.error || "Unable to publish challenge. Retry.");
                  const publishedId = data.matchId || data.challengeId;
                  setActionError(null);
                  clearError();
                  if (publishedId) {
                    challengeRequests.current.delete(matchId);
                    navigate("/matches/" + publishedId);
                  } else await reconcile();
                } catch (err) {
                  setActionError((err as Error).message);
                }
              }}
            >
              Send this challenge
            </Button>
          )}
        {/* 3. Turn Strip / Match Status */}
        {!["dots-boxes", "sos"].includes(view?.gameId ?? "") && (
          <TurnStrip
            className="arcade-match-turn-strip"
            activePlayerName={displayedTurnSeat === "A" ? playerAName : playerBName}
            activeSeat={displayedTurnSeat}
            activeAccent={displayedTurnSeat === "A" ? playerAAccent : playerBAccent}
            isYourTurn={
              cricketView
                ? cricketChoosing &&
                  !isTerminal &&
                  !isWaitingForReady &&
                  !state.isInputPaused &&
                  (isTogether || !cricketView.lockedSeats.includes(mySeat))
                : isMyTurn && !isTerminal && !isWaitingForReady
            }
            role={
              cricketRole ??
              (isTogether ? `Seat ${turnSeat}` : displayedTurnSeat === mySeat ? "You" : "Opponent")
            }
            statusText={
              cricketStatus ??
              (isTerminal
                ? sudokuInterrupted
                  ? "Duel completed · history only"
                  : winnerSeat
                    ? `${winnerSeat === "A" ? playerAName : playerBName} won the match!`
                    : view?.gameId === "sudoku" && (view.gameState as SudokuView)?.mode !== "duel"
                      ? "Attempt completed"
                      : "Match ended in a draw!"
                : lifecycle === "saved"
                  ? "Paused match · resume to continue"
                  : isWaitingForReady
                    ? isTogether
                      ? "Confirm readiness to start"
                      : !invitationAccepted
                        ? mySeat === "A"
                          ? `Invitation sent to ${playerBName}`
                          : "Accept the invitation to continue"
                        : myReady
                          ? "Waiting for opponent..."
                          : "Ready to play?"
                    : isMyTurn
                      ? "Your turn"
                      : `Waiting for ${turnSeat === "A" ? playerAName : playerBName}...`)
            }
            scoreText={
              terminalResult?.scores
                ? `${terminalResult.scores.A ?? 0} - ${terminalResult.scores.B ?? 0}`
                : undefined
            }
          />
        )}

        {view?.legalActions
          .filter((action) => ["match.accept", "match.decline", "match.cancel"].includes(action))
          .map((action) => (
            <Button
              key={action}
              disabled={!canSubmit(action)}
              onClick={() =>
                void submitAction(action, {}).catch((err) => setActionError(err.message))
              }
            >
              {action === "match.accept"
                ? "Accept invitation"
                : action === "match.decline"
                  ? "Decline invitation"
                  : "Cancel invitation"}
            </Button>
          ))}
        {view?.gameId === "ludo" &&
          view.legalActions.includes("ludo.set-colour") &&
          !isTerminal && (
            <details>
              <summary>Pawn colours</summary>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 0",
                }}
              >
                {isTogether && (
                  <div
                    role="group"
                    aria-label="Choose which player’s pawn colour to change"
                    style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%" }}
                  >
                    {(["A", "B"] as const).map((seat) => (
                      <Button
                        key={seat}
                        size="sm"
                        variant={colourSeat === seat ? "primary" : "secondary"}
                        aria-pressed={colourSeat === seat}
                        onClick={() => setColourSeat(seat)}
                        style={{ minHeight: 44 }}
                      >
                        {seat === "A" ? playerAName : playerBName}
                      </Button>
                    ))}
                  </div>
                )}
                <ColourPicker<LudoColourId>
                  label={`${displayedColourSeat === "A" ? playerAName : playerBName} pawn colour`}
                  value={
                    ((view.gameState as LudoView)?.colours?.[displayedColourSeat] ??
                      (displayedColourSeat === "A" ? "blue" : "green")) as LudoColourId
                  }
                  colours={(Object.entries(LUDO_COLOUR_PALETTE) as [LudoColourId, string][]).map(
                    ([id, color]) => ({
                      id,
                      color,
                      name: id[0].toUpperCase() + id.slice(1),
                    }),
                  )}
                  disabled={!canSubmit("ludo.set-colour", true)}
                  disabledIds={(() => {
                    const colours = (view.gameState as LudoView)?.colours;
                    const otherSeat: Seat = displayedColourSeat === "A" ? "B" : "A";
                    const conflicting = colours?.[otherSeat];
                    const similar: Partial<Record<LudoColourId, LudoColourId>> = {
                      blue: "cyan",
                      cyan: "blue",
                      red: "pink",
                      pink: "red",
                      yellow: "orange",
                      orange: "yellow",
                    };
                    return conflicting
                      ? [conflicting, ...(similar[conflicting] ? [similar[conflicting]!] : [])]
                      : [];
                  })()}
                  disabledDescriptions={(() => {
                    const colours = (view.gameState as LudoView)?.colours;
                    const otherSeat: Seat = displayedColourSeat === "A" ? "B" : "A";
                    const conflicting = colours?.[otherSeat];
                    return conflicting
                      ? Object.fromEntries(
                          (Object.keys(LUDO_COLOUR_PALETTE) as LudoColourId[]).flatMap((id) => {
                            if (id === conflicting)
                              return [
                                [
                                  id,
                                  `Already used by ${otherSeat === "A" ? playerAName : playerBName}.`,
                                ],
                              ];
                            const similar =
                              (id === "blue" && conflicting === "cyan") ||
                              (id === "cyan" && conflicting === "blue") ||
                              (id === "red" && conflicting === "pink") ||
                              (id === "pink" && conflicting === "red") ||
                              (id === "yellow" && conflicting === "orange") ||
                              (id === "orange" && conflicting === "yellow");
                            return similar
                              ? [
                                  [
                                    id,
                                    `Too similar to ${otherSeat === "A" ? playerAName : playerBName}’s ${conflicting} pawns.`,
                                  ],
                                ]
                              : [];
                          }),
                        )
                      : {};
                  })()}
                  onChange={(colourId) => {
                    if (!canSubmit("ludo.set-colour", true)) return;
                    void submitAction("ludo.set-colour", {
                      colourId,
                      ...(isTogether ? { seat: colourSeat } : {}),
                    }).catch((error) => setActionError((error as Error).message));
                  }}
                />
              </div>
            </details>
          )}
        {/* 4. Readiness Prompt Banner (if waiting) */}
        {view && isWaitingForReady && (
          <Surface variant="card" padding="lg" radius="lg" style={{ textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700 }}>
              {isTogether ? "Start Local Match" : "Match Ready Check"}
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-muted-text)",
                margin: "0 0 var(--space-md) 0",
              }}
            >
              {isTogether
                ? "Both players are ready to take turns on this device."
                : !invitationAccepted
                  ? mySeat === "B"
                    ? "Accept the invitation before you mark yourself ready."
                    : `Invitation sent to ${playerBName}. They must accept before either player can get ready.`
                  : `${playerAName}: ${isAReady ? "Ready" : "Not ready"} · ${playerBName}: ${isBReady ? "Ready" : "Not ready"}. ${myReady ? "You are ready; waiting for the other player." : "Mark yourself ready when you are set."}`}
            </p>
            {view?.legalActions.includes("match.ready") && (
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={!canSubmit("match.ready")}
                onClick={handleReady}
                leftIcon={<CheckCircle2 size={18} />}
              >
                {isTogether ? "We are both here" : "I am ready"}
              </Button>
            )}
          </Surface>
        )}

        {view && lifecycle === "saved" && (
          <Surface variant="card" padding="lg" radius="lg" style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Match paused and saved</h2>
            <p style={{ margin: "0 0 var(--space-md)", color: "var(--color-muted-text)" }}>
              {isTogether
                ? "Resume this match on this shared device."
                : sudokuView?.mode === "practice"
                  ? "Your paused Sudoku practice is saved. Resume it when you are ready."
                  : sudokuView?.mode === "challenge" && completedSudokuChallengeSender
                    ? sudokuView.challenge?.published
                      ? "Your completed sender attempt is saved in history. The receiver continues the accepted challenge."
                      : "Your completed sender attempt is saved in history. Resume is not needed; publish it when you are ready."
                    : sudokuView?.mode === "challenge" && sudokuView.challenge?.published
                      ? sudokuView.challenge.accepted
                        ? "Your accepted Sudoku challenge is saved. Resume your attempt when you are ready."
                        : "Your published Sudoku challenge is saved and waiting for the receiver."
                      : sudokuView?.mode === "challenge"
                        ? "Your unpublished Sudoku sender attempt is saved. Resume it to continue the puzzle."
                        : view.gameId === "sudoku" && sudokuView?.mode === "duel"
                          ? `${playerAName}: ${view.resumeReadiness?.A ? "Ready to resume" : "Not ready"} · ${playerBName}: ${view.resumeReadiness?.B ? "Ready to resume" : "Not ready"}. Both players must resume this Duel.`
                          : `${playerAName}: ${view.resumeReadiness?.A ? "Ready to resume" : "Not ready"} · ${playerBName}: ${view.resumeReadiness?.B ? "Ready to resume" : "Not ready"}. Both players must resume this match.`}
            </p>
            {view.legalActions.includes("match.resume") &&
              view.pauseId &&
              (view.gameId !== "sudoku" || canResumeSavedSudoku) && (
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!canSubmit("match.resume") || !!view.resumeReadiness?.[mySeat]}
                  onClick={() =>
                    void submitAction("match.resume", { pauseId: view.pauseId! }).catch((error) =>
                      setActionError((error as Error).message),
                    )
                  }
                >
                  {view.gameId === "sudoku" && sudokuView?.mode === "practice"
                    ? "Resume practice"
                    : view.gameId === "sudoku" && sudokuView?.mode === "challenge"
                      ? "Resume challenge attempt"
                      : view.resumeReadiness?.[mySeat]
                        ? "Resume request sent · waiting for the other player"
                        : "Resume saved match"}
                </Button>
              )}
          </Surface>
        )}

        {/* 5. Terminal Result Card */}
        {isTerminal && (
          <div className="arcade-match-result">
            <ResultPanel
              title={
                sudokuInterrupted
                  ? "Duel completed · history only"
                  : winnerSeat
                    ? `${winnerSeat === "A" ? playerAName : playerBName} Wins!`
                    : view?.gameId === "sudoku" && (view.gameState as SudokuView)?.mode !== "duel"
                      ? "Attempt completed"
                      : terminalResult?.reason === "abandonment"
                        ? "Match abandoned"
                        : terminalResult?.reason === "cancelled" ||
                            terminalResult?.reason === "declined"
                          ? "Invitation closed"
                          : "Match Drawn"
              }
            >
              <div
                style={{
                  display: "inline-flex",
                  padding: "12px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: sudokuInterrupted
                    ? "var(--color-raised)"
                    : "var(--color-emphasis-yellow-bg, #FDE047)",
                  marginBottom: "8px",
                }}
              >
                {sudokuInterrupted ? (
                  <History size={32} color="var(--color-focus)" aria-hidden="true" />
                ) : (
                  <Trophy
                    size={32}
                    color="var(--color-emphasis-yellow-ink, #30290D)"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-muted-text)",
                  margin: "0 0 var(--space-lg) 0",
                }}
              >
                {sudokuInterrupted
                  ? `${winnerSeat ? `${winnerSeat === "A" ? playerAName : playerBName} is recorded as the result winner.` : "The saved result is recorded as a draw."} Deliberately saved and resumed duels stay in history, but do not count toward competitive wins, streaks, or best times.`
                  : terminalResult?.reason === "resignation"
                    ? `Resignation by ${terminalResult.resignedBy === "A" ? playerAName : playerBName}.`
                    : winnerSeat
                      ? view?.gameId === "connect-four"
                        ? "Four discs connected in a row!"
                        : "Saved match result."
                      : terminalResult?.reason === "abandonment"
                        ? "Abandoned without a score."
                        : terminalResult?.reason === "declined"
                          ? "Invitation declined."
                          : terminalResult?.reason === "cancelled"
                            ? "Invitation cancelled."
                            : "Saved draw."}
              </p>

              {view?.gameId === "sudoku" && (view.gameState as SudokuView)?.mode === "practice" && (
                <Button
                  onClick={async () => {
                    try {
                      const response = await apiFetch("/api/v1/records/summary");
                      if (!response.ok) throw new Error("Unable to load completed puzzles. Retry.");
                      const data = (await response.json()) as { ownCompletedPuzzleIds?: string[] };
                      const bucket = (view.gameState as SudokuView).puzzleId.split("-")[0];
                      const next =
                        Array.from({ length: 250 }, (_, i) => i + 1).find(
                          (number) =>
                            !data.ownCompletedPuzzleIds?.includes(
                              bucket + "-" + String(number).padStart(3, "0"),
                            ),
                        ) ?? 1;
                      sessionStorage.setItem(
                        "pa_sudoku_selection",
                        JSON.stringify({ bucket, number: next, page: Math.floor((next - 1) / 50) }),
                      );
                      navigate("/games/sudoku");
                    } catch (err) {
                      setActionError((err as Error).message);
                    }
                  }}
                >
                  Choose next puzzle
                </Button>
              )}
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleRematch}
                  leftIcon={<RotateCcw size={16} />}
                >
                  {sudokuInterrupted ? "Start a new duel" : "Rematch"}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => navigate("/")}
                  leftIcon={<Home size={16} />}
                >
                  Return Home
                </Button>
              </div>
            </ResultPanel>
          </div>
        )}

        {/* 6. Centered Game Board Surface */}
        <div
          className="arcade-match-board-stage"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            minWidth: 0,
            width: "100%",
          }}
        >
          <Suspense fallback={<p role="status">Loading the selected game board…</p>}>
            {!view ? (
              <p role="status">Loading the saved match…</p>
            ) : view.gameId === "rock-paper-scissors" ? (
              <RPSBoard
                acceptedEventId={acceptedEventId}
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as RPSView) ?? {
                    targetWins: 2,
                    scores: { A: 0, B: 0 },
                    roundId: 1,
                    phase: "locking",
                    lockedSeats: [],
                    roundResult: null,
                    revealed: false,
                    readiness: { A: false, B: false },
                  }
                }
                mode={isTogether ? "together" : "remote"}
                playerAName={playerAName}
                playerBName={playerBName}
                localSeat={mySeat}
                firstChooserSeat={((view.gameState as RPSView)?.roundId ?? 1) % 2 === 1 ? "A" : "B"}
                forceMasked={state.secretChoiceMasked}
                onMaskChange={(masked) => {
                  if (!masked) unmaskSecretChoice();
                }}
                playerAAccent={playerAAccent}
                playerBAccent={playerBAccent}
                onLockChoice={handleRPSLock}
                onReveal={handleRPSReveal}
                onNextRound={handleRPSNext}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "ludo" ? (
              <LudoBoard
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled ? (motionEvent?.effects as LudoEffect[] | undefined) : undefined
                }
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as LudoView) ?? {
                    tokens: { A: [-1, -1, -1, -1], B: [-1, -1, -1, -1] },
                    activeSeat: "A",
                    phase: "roll",
                    consecutiveSixes: 0,
                    pendingRoll: null,
                    legalTokenIds: [],
                    status: "active",
                    winner: null,
                  }
                }
                canAct={isMyTurn && (canSubmit("ludo.move", true) || canSubmit("dice.roll", true))}
                onRoll={handleLudoRoll}
                onSelectToken={handleLudoSelectToken}
                playerAName={playerAName}
                playerBName={playerBName}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "snakes-and-ladders" ? (
              <SnakesLaddersBoard
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled
                    ? (motionEvent?.effects as SnakesAndLaddersEffect[] | undefined)
                    : undefined
                }
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as SnakesAndLaddersView) ?? {
                    positions: { A: 0, B: 0 },
                    activeSeat: "A",
                    status: "active",
                    winner: null,
                    lastRoll: null,
                  }
                }
                canAct={isMyTurn && canSubmit("dice.roll", true)}
                onRoll={handleSnakesLaddersRoll}
                playerAName={playerAName}
                playerBName={playerBName}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "dots-boxes" ? (
              <DotsBoxesBoard
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled
                    ? (motionEvent?.effects as DotsBoxesEffect[] | undefined)
                    : undefined
                }
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as DotsBoxesView) ?? {
                    edges: [],
                    boxes: [
                      [null, null, null, null],
                      [null, null, null, null],
                      [null, null, null, null],
                      [null, null, null, null],
                    ],
                    scores: { A: 0, B: 0 },
                    activeSeat: "A",
                    status: "active",
                    winner: null,
                  }
                }
                canAct={isMyTurn && canSubmit("dots-boxes.edge", true)}
                onPlaceEdge={handleDotsBoxesEdge}
                playerAName={playerAName}
                playerBName={playerBName}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "sos" ? (
              <SOSBoard
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled ? (motionEvent?.effects as SOSEffect[] | undefined) : undefined
                }
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as SOSView) ?? {
                    board: Array.from({ length: 5 }, () => Array(5).fill(null)),
                    lines: [],
                    scores: { A: 0, B: 0 },
                    activeSeat: "A",
                    status: "active",
                    winner: null,
                  }
                }
                canAct={isMyTurn && canSubmit("sos.place", true)}
                onPlaceLetter={handleSOSPlace}
                playerAName={playerAName}
                playerBName={playerBName}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "hand-cricket" ? (
              <HandCricketBoard
                acceptedEventId={acceptedEventId}
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as CricketView) ?? {
                    phase: "toss",
                    innings: 1,
                    tossWinner: "A",
                    roles: null,
                    firstInningsRuns: 0,
                    secondInningsRuns: 0,
                    target: null,
                    deliveryId: 1,
                    lockedSeats: [],
                    lastDelivery: null,
                    readiness: { A: false, B: false },
                  }
                }
                mode={isTogether ? "together" : "remote"}
                playerAName={playerAName}
                playerBName={playerBName}
                localSeat={mySeat ?? "A"}
                onChooseRole={handleCricketChooseRole}
                forceMasked={state.secretChoiceMasked}
                onMaskChange={(masked) => {
                  if (!masked) unmaskSecretChoice();
                }}
                playerAAccent={playerAAccent}
                playerBAccent={playerBAccent}
                onLockNumber={handleCricketLock}
                onReveal={handleCricketReveal}
                onNextDelivery={handleCricketNext}
                isSubmitting={boardUnavailable}
              />
            ) : view?.gameId === "sudoku" ? (
              <SudokuBoard
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled ? (motionEvent?.effects as SudokuEffect[] | undefined) : undefined
                }
                motionEnabled={motionEnabled}
                view={
                  (view.gameState as SudokuView) ?? {
                    puzzleId: "sudoku-easy-001",
                    givens: "0".repeat(81),
                    mode: "practice",
                    hasStarted: true,
                    self: {
                      filledCount: 0,
                      completed: false,
                      elapsedMs: 0,
                      paused: false,
                      assisted: false,
                      cells: Array(81).fill(0),
                      notes: Array(81).fill(0),
                      undoAvailable: false,
                    },
                  }
                }
                canAct={canSubmit("sudoku.edit", true)}
                onEditCell={handleSudokuEdit}
                onUndo={handleSudokuUndo}
                onCheck={handleSudokuCheck}
                onPause={handleSudokuPause}
                onResume={handleSudokuResume}
                playerAName={playerAName}
                playerBName={playerBName}
                localSeat={mySeat ?? "A"}
                isSubmitting={boardUnavailable}
              />
            ) : (
              <ConnectFourBoard
                board={board}
                activeSeat={turnSeat}
                canDrop={isMyTurn && canSubmit("connect-four.drop", true)}
                winningCells={winningCells}
                acceptedEventId={acceptedEventId}
                acceptedEffects={
                  motionEnabled
                    ? (motionEvent?.effects as ConnectFourEffect[] | undefined)
                    : undefined
                }
                motionEnabled={motionEnabled}
                onDropColumn={handleDrop}
                playerAName={playerAName}
                playerBName={playerBName}
                isTerminal={isTerminal}
              />
            )}
          </Suspense>
        </div>
      </div>

      {/* Match Options Sheet */}
      <Sheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Match Options"
        description="Settings and actions for this game session."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {view?.legalActions.includes("match.leave-save") && (
            <Button
              variant="secondary"
              disabled={!canSubmit("match.leave-save", true)}
              onClick={() => {
                setIsMenuOpen(false);
                setIsSaveSheetOpen(true);
              }}
            >
              Leave and save
            </Button>
          )}
          {view?.legalActions.some(
            (action) => action === "match.request-abandon" || action === "match.agree-abandon",
          ) && (
            <Button
              variant="secondary"
              onClick={() => {
                setIsMenuOpen(false);
                setIsAbandonSheetOpen(true);
              }}
            >
              Abandon without a score
            </Button>
          )}
          {view?.legalActions.includes("match.resign") && (
            <Button
              variant="danger"
              size="md"
              fullWidth
              disabled={!canSubmit("match.resign")}
              leftIcon={<AlertTriangle size={18} />}
              onClick={() => {
                setIsMenuOpen(false);
                setIsResignSheetOpen(true);
              }}
            >
              Resign Match
            </Button>
          )}
          <Button variant="secondary" size="md" fullWidth onClick={() => setIsMenuOpen(false)}>
            Close Menu
          </Button>
        </div>
      </Sheet>

      <Sheet
        isOpen={isSaveSheetOpen}
        onClose={() => setIsSaveSheetOpen(false)}
        title="Leave and save this match?"
        description={leaveAndSaveDescription(view)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Button
            disabled={!canSubmit("match.leave-save", true) || isSavingAndLeaving}
            onClick={async () => {
              setIsSavingAndLeaving(true);
              setActionError(null);
              try {
                await submitAction("match.leave-save", {});
                retainSheetHistoryForReplaceNavigation();
                setIsSaveSheetOpen(false);
                navigate("/games", { replace: true });
              } catch (err) {
                setActionError((err as Error).message);
              } finally {
                setIsSavingAndLeaving(false);
              }
            }}
          >
            {isSavingAndLeaving ? "Saving match…" : "Confirm leave and save"}
          </Button>
          <Button variant="secondary" onClick={() => setIsSaveSheetOpen(false)}>
            Keep playing
          </Button>
        </div>
      </Sheet>

      <Sheet
        isOpen={isAbandonSheetOpen}
        onClose={() => setIsAbandonSheetOpen(false)}
        title="Abandon without a score?"
        description={
          isTogether
            ? "Both players agree to end this match without a win or loss."
            : view?.legalActions.includes("match.agree-abandon")
              ? "The other player requested abandonment. Agree to end without a win or loss."
              : "Ask the other player to end this match without a win or loss. Their agreement is required."
        }
      >
        <Button
          disabled={!abandonAction || !canSubmit(abandonAction)}
          onClick={async () => {
            try {
              if (!abandonAction) return;
              await submitAction(abandonAction, {});
              setIsAbandonSheetOpen(false);
            } catch (err) {
              setActionError((err as Error).message);
            }
          }}
        >
          Confirm unscored abandonment
        </Button>
      </Sheet>
      {/* Resign Confirmation Sheet */}
      <Sheet
        isOpen={isResignSheetOpen}
        onClose={() => setIsResignSheetOpen(false)}
        title="Resign Match?"
        description={
          isTogether
            ? "Choose which player is conceding this match. Conceding counts as an immediate loss."
            : "Conceding will immediately award the win to your opponent."
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {isTogether && (
            <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "8px" }}>
              <Button
                variant={resigningSeat === "A" ? "danger" : "secondary"}
                size="sm"
                fullWidth
                onClick={() => setResigningSeat("A")}
              >
                Concede as {playerAName} (A)
              </Button>
              <Button
                variant={resigningSeat === "B" ? "danger" : "secondary"}
                size="sm"
                fullWidth
                onClick={() => setResigningSeat("B")}
              >
                Concede as {playerBName} (B)
              </Button>
            </div>
          )}

          <Button
            variant="danger"
            size="md"
            fullWidth
            onClick={handleResign}
            disabled={!canSubmit("match.resign")}
            leftIcon={<AlertTriangle size={18} />}
          >
            Confirm Resignation
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => setIsResignSheetOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
