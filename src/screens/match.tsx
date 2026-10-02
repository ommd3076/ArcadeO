import { apiFetch } from "../app/auth";
import { generateUuid } from "../../shared/utils/uuid";
import { useTheme, resolvePlayerAccent } from "../theme";
import { useState, useMemo } from "react";
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
import { Sheet } from "../components/sheet";
import { MoreVertical, RotateCcw, AlertTriangle, Trophy, Home, CheckCircle2 } from "lucide-react";
import { useMatchSession } from "../sync/use-match-session";
import { ConnectFourBoard } from "../games/connect-four/connect-four-board";
import { RPSBoard } from "../games/rps/rps-board";
import { LudoBoard } from "../games/ludo/ludo-board";
import { SnakesLaddersBoard } from "../games/snakes-ladders/snakes-ladders-board";
import { DotsBoxesBoard } from "../games/dots-boxes/dots-boxes-board";
import { SOSBoard } from "../games/sos/sos-board";
import { HandCricketBoard } from "../games/hand-cricket/hand-cricket-board";
import { SudokuBoard } from "../games/sudoku/sudoku-board";
import type { Seat, AccountId, FilteredMatchView } from "../../shared/protocol/types";
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
import type { SudokuView, SudokuOperation } from "../../shared/games/sudoku/types";
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

export function MatchScreen({ actorAccountId = "A", initialView = null }: MatchScreenProps) {
  const { matchId = "demo-match" } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isAbandonSheetOpen, setIsAbandonSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [colourSeat, setColourSeat] = useState<Seat>("A");
  const [isResignSheetOpen, setIsResignSheetOpen] = useState(false);
  const [resigningSeat, setResigningSeat] = useState<Seat>("A");

  // Initialize match session
  const {
    session: _session,
    state,
    sendAction,
    reconcile,
    dismissTakeoverNotice,
    retryPendingAction,
    unmaskSecretChoice,
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
  const isAReady = participantA?.ready ?? false;
  const isBReady = participantB?.ready ?? false;

  // Active seat / Turn state
  const mySeat: Seat =
    participantA?.accountId === actorAccountId
      ? "A"
      : participantB?.accountId === actorAccountId
        ? "B"
        : actorAccountId === "B"
          ? "B"
          : "A";
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
  const winnerSeat: Seat | null =
    c4State?.winner !== undefined ? c4State.winner : terminalResult ? terminalResult.winner : null;

  // Readiness status
  const isWaitingForReady = lifecycle === "waiting";
  const myReady = mySeat === "A" ? isAReady : isBReady;

  // Handle Ready action
  const handleReady = async () => {
    try {
      await sendAction("match.ready", {});
    } catch (err) {
      console.error("Failed to signal ready:", err);
    }
  };

  // Handle Column Drop
  const handleDrop = async (columnIndex: number) => {
    if (!isMyTurn || isTerminal || isWaitingForReady || state.isInputPaused) return;

    try {
      await sendAction("connect-four.drop", { column: columnIndex });
    } catch (err) {
      console.error("Failed to drop disc:", err);
    }
  };

  // Handle Resign
  const handleResign = async () => {
    try {
      await sendAction("match.resign", isTogether ? { resigningSeat } : {});
      setIsResignSheetOpen(false);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Failed to resign match:", err);
    }
  };

  const handleRPSLock = async (choice: RPSChoice, _seat: Seat) => {
    try {
      const rpsState = view?.gameState as RPSView | undefined;
      await sendAction("secret.lock", { choice }, { roundId: rpsState?.roundId });
    } catch (err) {
      setActionError((err as Error).message);
      throw err;
    }
  };

  const handleRPSReveal = async () => {
    try {
      await sendAction("secret.reveal", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to reveal RPS outcome:", err);
      throw err;
    }
  };

  const handleRPSNext = async () => {
    try {
      await sendAction("secret.next", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to advance RPS round:", err);
      throw err;
    }
  };

  const handleLudoRoll = async () => {
    try {
      await sendAction("dice.roll", {});
    } catch (err) {
      console.error("Failed to roll Ludo dice:", err);
    }
  };

  const handleLudoSelectToken = async (tokenId: number) => {
    try {
      await sendAction("ludo.move", { tokenId });
    } catch (err) {
      console.error("Failed to move Ludo token:", err);
    }
  };

  const handleSnakesLaddersRoll = async () => {
    try {
      await sendAction("dice.roll", {});
    } catch (err) {
      console.error("Failed to roll Snakes & Ladders dice:", err);
    }
  };

  const handleDotsBoxesEdge = async (edge: DotsBoxesEdge) => {
    try {
      await sendAction("dots-boxes.edge", edge);
    } catch (err) {
      console.error("Failed to place Dots & Boxes edge:", err);
    }
  };

  const handleSOSPlace = async (row: number, col: number, letter: SOSLetter) => {
    try {
      await sendAction("sos.place", { row, col, letter });
    } catch (err) {
      console.error("Failed to place SOS letter:", err);
    }
  };

  const handleCricketChooseRole = async (role: "bat" | "bowl") => {
    try {
      await sendAction("cricket.choose-role", { role });
    } catch (err) {
      console.error("Failed to choose cricket role:", err);
    }
  };

  const handleCricketLock = async (value: number, _seat: Seat) => {
    try {
      const cricketState = view?.gameState as CricketView | undefined;
      await sendAction("secret.lock", { value }, { roundId: cricketState?.deliveryId });
    } catch (err) {
      setActionError((err as Error).message);
      throw err;
    }
  };

  const handleCricketReveal = async () => {
    try {
      await sendAction("secret.reveal", {});
    } catch (err) {
      setActionError((err as Error).message);
      console.error("Failed to reveal cricket delivery:", err);
      throw err;
    }
  };

  const handleCricketNext = async () => {
    try {
      await sendAction("secret.next", {});
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
    try {
      await sendAction("sudoku.edit", { row, col, operation, value });
    } catch (err) {
      console.error("Failed to edit Sudoku cell:", err);
    }
  };

  const handleSudokuUndo = async () => {
    try {
      await sendAction("sudoku.undo", {});
    } catch (err) {
      console.error("Failed to undo Sudoku move:", err);
    }
  };

  const handleSudokuCheck = async () => {
    try {
      await sendAction("sudoku.check", {});
    } catch (err) {
      console.error("Failed to check Sudoku puzzle:", err);
    }
  };

  const handleSudokuPause = async () => {
    try {
      await sendAction("sudoku.pause", {});
    } catch (err) {
      console.error("Failed to pause Sudoku puzzle:", err);
    }
  };

  const handleSudokuResume = async () => {
    try {
      await sendAction("sudoku.resume", {});
    } catch (err) {
      console.error("Failed to resume Sudoku puzzle:", err);
    }
  };

  // Rematch or Return Home
  const handleRematch = async () => {
    try {
      const creationId = generateUuid();
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
        gameOptions = { boardVersion: (view.gameState as SnakesAndLaddersView)?.boardVersion ?? 2 };
      } else if (view?.gameId === "ludo") {
        gameOptions = { colours: (view.gameState as LudoView)?.colours };
      } else if (view?.gameId === "hand-cricket") {
        gameOptions = { rulesVersion: (view.gameState as CricketView)?.rulesVersion ?? 2 };
      }

      const res = await apiFetch("/api/v1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationId,
          gameId: view?.gameId ?? "connect-four",
          gameOptions,
          mode: view?.mode ?? "together",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { matchId?: string; view?: { matchId?: string } };
        const nextId = data.matchId || data.view?.matchId;
        if (nextId) {
          navigate(`/matches/${nextId}`);
          return;
        }
      } else if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { existingMatchId?: string } | null;
        if (data?.existingMatchId) {
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
        title={view?.gameId ? (GAME_TITLES[view.gameId] ?? view.gameId) : "Match"}
        subtitle={isTogether ? "Together" : "Remote"}
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

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--space-md) var(--space-lg) calc(var(--space-xl) + var(--sab))",
          maxWidth: ["dots-boxes", "sos", "connect-four"].includes(view?.gameId ?? "")
            ? "960px"
            : "680px",
          margin: "0 auto",
          width: "100%",
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
        {state.pendingAction?.status === "retrying" && (
          <Button
            onClick={() => void retryPendingAction().catch((err) => setActionError(err.message))}
          >
            Check saved action and retry
          </Button>
        )}
        {(isTogether || view?.gameId === "sudoku") &&
          state.controllerStatus &&
          !state.controllerStatus.isController && (
            <Button
              onClick={async () => {
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
                  if (!response.ok) throw new Error("Unable to take control. Refresh and retry.");
                  await reconcile();
                } catch (err) {
                  setActionError((err as Error).message);
                }
              }}
            >
              Continue on this device
            </Button>
          )}
        {view?.gameId === "sudoku" &&
          (view.gameState as SudokuView)?.mode === "challenge" &&
          (view.gameState as SudokuView)?.self.completed &&
          !(view.gameState as SudokuView)?.challenge?.published && (
            <Button
              onClick={async () => {
                try {
                  const response = await apiFetch("/api/v1/challenges", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      creationId: crypto.randomUUID(),
                      senderAttemptId: matchId,
                    }),
                  });
                  const data = (await response.json()) as {
                    matchId?: string;
                    challengeId?: string;
                    error?: string;
                  };
                  if (!response.ok)
                    throw new Error(data.error || "Unable to publish challenge. Retry.");
                  const publishedId = data.matchId || data.challengeId;
                  if (publishedId) navigate("/matches/" + publishedId);
                  else await reconcile();
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
            activePlayerName={turnSeat === "A" ? playerAName : playerBName}
            activeSeat={turnSeat}
            activeAccent={turnSeat === "A" ? playerAAccent : playerBAccent}
            isYourTurn={isMyTurn && !isTerminal && !isWaitingForReady}
            role={isTogether ? `Seat ${turnSeat}` : mySeat === "A" ? "Host" : "Guest"}
            statusText={
              isTerminal
                ? winnerSeat
                  ? `${winnerSeat === "A" ? playerAName : playerBName} won the match!`
                  : view?.gameId === "sudoku" && (view.gameState as SudokuView)?.mode !== "duel"
                    ? "Attempt completed"
                    : "Match ended in a draw!"
                : isWaitingForReady
                  ? isTogether
                    ? "Confirm readiness to start"
                    : myReady
                      ? "Waiting for opponent..."
                      : "Ready to play?"
                  : isMyTurn
                    ? "Your turn"
                    : `Waiting for ${turnSeat === "A" ? playerAName : playerBName}...`
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
              disabled={state.isInputPaused}
              onClick={() =>
                void sendAction(action, {}).catch((err) => setActionError(err.message))
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
                  <select
                    aria-label="Player whose colour to change"
                    value={colourSeat}
                    onChange={(event) => setColourSeat(event.target.value as Seat)}
                  >
                    <option value="A">{playerAName}</option>
                    <option value="B">{playerBName}</option>
                  </select>
                )}
                <ColourPicker<LudoColourId>
                  label={`${displayedColourSeat === "A" ? playerAName : playerBName} pawn colour`}
                  value={
                    ((view.gameState as LudoView)?.colours?.[displayedColourSeat] ??
                      (displayedColourSeat === "A" ? "blue" : "green")) as LudoColourId
                  }
                  colours={(Object.entries(LUDO_COLOUR_PALETTE) as [LudoColourId, string][]).map(
                    ([id, color]) => ({ id, color, name: id }),
                  )}
                  disabled={state.isInputPaused || state.pendingAction !== null}
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
                  onChange={(colourId) =>
                    void sendAction("ludo.set-colour", {
                      colourId,
                      ...(isTogether ? { seat: colourSeat } : {}),
                    }).catch((error) => setActionError((error as Error).message))
                  }
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
                : myReady
                  ? "You are ready! Waiting for your opponent to join and confirm..."
                  : "Confirm when you are ready to begin the match."}
            </p>
            {view?.legalActions.includes("match.ready") && (
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={state.isInputPaused}
                onClick={handleReady}
                leftIcon={<CheckCircle2 size={18} />}
              >
                {isTogether ? "We are both here" : "I am ready"}
              </Button>
            )}
          </Surface>
        )}

        {/* 5. Terminal Result Card */}
        {isTerminal && (
          <ResultPanel
            title={
              winnerSeat
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
                backgroundColor: "var(--color-raised)",
                marginBottom: "8px",
              }}
            >
              <Trophy size={32} color="var(--color-emphasis-yellow-ink, #FDE047)" />
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-muted-text)",
                margin: "0 0 var(--space-lg) 0",
              }}
            >
              {terminalResult?.reason === "resignation"
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
                Rematch
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => navigate("/games")}
                leftIcon={<Home size={16} />}
              >
                Return Home
              </Button>
            </div>
          </ResultPanel>
        )}

        {/* 6. Centered Game Board Surface */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            minWidth: 0,
            width: "100%",
          }}
        >
          {!view ? (
            <p role="status">Loading the saved match…</p>
          ) : view.gameId === "rock-paper-scissors" ? (
            <RPSBoard
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
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "ludo" ? (
            <LudoBoard
              acceptedEventId={state.acceptedEvent?.eventId}
              acceptedEffects={state.acceptedEvent?.effects as LudoEffect[] | undefined}
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
              canAct={isMyTurn && !isTerminal && !isWaitingForReady && !state.isInputPaused}
              onRoll={handleLudoRoll}
              onSelectToken={handleLudoSelectToken}
              playerAName={playerAName}
              playerBName={playerBName}
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "snakes-and-ladders" ? (
            <SnakesLaddersBoard
              acceptedEventId={state.acceptedEvent?.eventId}
              acceptedEffects={state.acceptedEvent?.effects as SnakesAndLaddersEffect[] | undefined}
              view={
                (view.gameState as SnakesAndLaddersView) ?? {
                  positions: { A: 0, B: 0 },
                  activeSeat: "A",
                  status: "active",
                  winner: null,
                  lastRoll: null,
                }
              }
              canAct={isMyTurn && !isTerminal && !isWaitingForReady && !state.isInputPaused}
              onRoll={handleSnakesLaddersRoll}
              playerAName={playerAName}
              playerBName={playerBName}
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "dots-boxes" ? (
            <DotsBoxesBoard
              acceptedEventId={state.acceptedEvent?.eventId}
              acceptedEffects={state.acceptedEvent?.effects as DotsBoxesEffect[] | undefined}
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
              canAct={isMyTurn && !isTerminal && !isWaitingForReady && !state.isInputPaused}
              onPlaceEdge={handleDotsBoxesEdge}
              playerAName={playerAName}
              playerBName={playerBName}
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "sos" ? (
            <SOSBoard
              acceptedEventId={state.acceptedEvent?.eventId}
              acceptedEffects={state.acceptedEvent?.effects as SOSEffect[] | undefined}
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
              canAct={isMyTurn && !isTerminal && !isWaitingForReady && !state.isInputPaused}
              onPlaceLetter={handleSOSPlace}
              playerAName={playerAName}
              playerBName={playerBName}
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "hand-cricket" ? (
            <HandCricketBoard
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
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : view?.gameId === "sudoku" ? (
            <SudokuBoard
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
              canAct={!isTerminal && !state.isInputPaused}
              onEditCell={handleSudokuEdit}
              onUndo={handleSudokuUndo}
              onCheck={handleSudokuCheck}
              onPause={handleSudokuPause}
              onResume={handleSudokuResume}
              playerAName={playerAName}
              playerBName={playerBName}
              localSeat={mySeat ?? "A"}
              isSubmitting={state.isInputPaused || state.pendingAction !== null}
            />
          ) : (
            <ConnectFourBoard
              board={board}
              activeSeat={turnSeat}
              canDrop={isMyTurn && !isTerminal && !isWaitingForReady && !state.isInputPaused}
              winningCells={winningCells}
              acceptedEventId={state.acceptedEvent?.eventId}
              acceptedEffects={state.acceptedEvent?.effects as ConnectFourEffect[] | undefined}
              onDropColumn={handleDrop}
              playerAName={playerAName}
              playerBName={playerBName}
              isTerminal={isTerminal}
            />
          )}
        </div>
      </main>

      {/* Match Options Sheet */}
      <Sheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Match Options"
        description="Settings and actions for this game session."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
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
          {!isTerminal && (
            <Button
              variant="danger"
              size="md"
              fullWidth
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
          disabled={state.isInputPaused}
          onClick={async () => {
            try {
              await sendAction(
                view?.legalActions.includes("match.agree-abandon")
                  ? "match.agree-abandon"
                  : "match.request-abandon",
                {},
              );
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
