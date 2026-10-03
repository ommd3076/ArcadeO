/**
 * ArcadeO V1 — Pure Sudoku Game Engine
 *
 * Server-authoritative, deterministic pure reducer for Sudoku.
 * Conforms to GAME-RULES.md, PRD.md, TDD.md, and DATA-MODEL.md.
 */

import { ActionType, Seat, TerminalResult } from "../../protocol/types";
import { AcceptedFacts, ReductionResult, SuppliedStartFacts } from "../registry";
import { ErrorCode, createError } from "../../protocol/errors";
import {
  PlayerPublicView,
  PlayerSudokuState,
  SudokuActionPayload,
  SudokuEditActionPayload,
  SudokuEffect,
  SudokuState,
  SudokuView,
  SudokuViewerContext,
} from "./types";

/**
 * Creates empty initial player state with givens populated into cells.
 */
export function createPlayerState(givens: string, serverTime: number): PlayerSudokuState {
  const cells: number[] = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    const char = givens[i];
    if (char && char >= "1" && char <= "9") {
      cells[i] = parseInt(char, 10);
    }
  }

  return {
    cells,
    notes: new Array(81).fill(0),
    undoStack: [],
    progressRevision: 1,
    assisted: false,
    paused: false,
    pausedAt: null,
    totalPausedMs: 0,
    startedAt: serverTime,
    completedAt: null,
    elapsedMs: 0,
  };
}

/**
 * Creates the initial Sudoku state from supplied facts.
 */
export function createInitialState(startFacts: SuppliedStartFacts): SudokuState {
  const config = startFacts.config || {};
  const puzzleId = config.puzzleId as string;
  const givens = config.givens as string;
  const solution = config.solution as string;
  if (
    !puzzleId ||
    !/^[0-9]{81}$/.test(givens) ||
    !/^[1-9]{81}$/.test(solution) ||
    [...givens].some((digit, index) => digit !== "0" && digit !== solution[index])
  ) {
    throw new Error("Sudoku requires a verified catalog puzzle and private solution");
  }
  const mode = (config.mode as "practice" | "duel" | "challenge") || "practice";
  const scheduledStartTime =
    typeof config.scheduledStartTime === "number" ? config.scheduledStartTime : undefined;
  const senderSeat = (config.senderSeat as Seat) || "A";
  const senderElapsedMs =
    typeof config.senderElapsedMs === "number" ? config.senderElapsedMs : undefined;

  const clockStart =
    mode === "duel" && scheduledStartTime !== undefined
      ? scheduledStartTime
      : startFacts.serverTime;
  const playerA = createPlayerState(givens, clockStart);
  const playerB = createPlayerState(givens, clockStart);
  if (mode === "challenge" && config.challengePublished && senderElapsedMs !== undefined) {
    const sender = senderSeat === "A" ? playerA : playerB;
    sender.cells = [...solution].map(Number);
    sender.completedAt = startFacts.serverTime;
    sender.elapsedMs = senderElapsedMs;
    sender.startedAt = startFacts.serverTime - senderElapsedMs;
  }

  return {
    puzzleId,
    givens,
    solution,
    replay: Boolean(config.replay),
    mode,
    players: {
      A: playerA,
      B: playerB,
    },
    scheduledStartTime,
    senderSeat,
    senderElapsedMs,
    challengePublished: Boolean(config.challengePublished),
    receiverAccepted: Boolean(config.receiverAccepted),
  };
}

/**
 * Calculates current elapsed time for a player.
 */
export function calculateElapsedMs(player: PlayerSudokuState, currentTime: number): number {
  if (player.completedAt !== null) {
    return player.elapsedMs;
  }
  if (player.paused && player.pausedAt !== null) {
    return Math.max(0, player.pausedAt - player.startedAt - player.totalPausedMs);
  }
  return Math.max(0, currentTime - player.startedAt - player.totalPausedMs);
}

/**
 * Checks if the player's 81 cells match the solution exactly.
 */
export function checkCompletion(cells: number[], solution: string): boolean {
  if (cells.length !== 81 || solution.length !== 81) return false;
  for (let i = 0; i < 81; i++) {
    if (cells[i] === 0) return false;
    if (cells[i] !== parseInt(solution[i], 10)) return false;
  }
  return true;
}

/**
 * Counts filled cells for a player.
 */
export function countFilledCells(cells: number[]): number {
  let count = 0;
  for (let i = 0; i < 81; i++) {
    if (cells[i] > 0) count++;
  }
  return count;
}

/**
 * Validates and reduces Sudoku actions.
 */
export function validateAndReduce(
  state: SudokuState,
  action: { action: ActionType; payload: SudokuActionPayload },
  acceptedFacts: AcceptedFacts,
): ReductionResult<SudokuState, SudokuEffect> {
  const actorSeat = acceptedFacts.actorSeat;
  const serverTime = acceptedFacts.serverTime;
  const player = state.players[actorSeat];

  if (!player) {
    return {
      success: false,
      error: createError(ErrorCode.FORBIDDEN, `Invalid actor seat: ${actorSeat}`),
    };
  }

  // If already terminal, reject further edits
  if (state.terminalResult) {
    return {
      success: false,
      error: createError(ErrorCode.MATCH_FINISHED, "Match has already finished"),
    };
  }

  // In duel mode, check if scheduled start time has passed
  if (
    state.mode === "challenge" &&
    actorSeat !== (state.senderSeat || "A") &&
    !state.receiverAccepted
  ) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, "Challenge has not been accepted"),
    };
  }
  if (state.mode === "duel" && state.scheduledStartTime === undefined) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, "Both players must be ready"),
    };
  }
  if (state.mode === "duel" && state.scheduledStartTime !== undefined) {
    if (serverTime < state.scheduledStartTime) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, "Duel has not started yet"),
      };
    }
  }

  // If this specific player has already completed, reject further changes
  if (player.completedAt !== null) {
    return {
      success: false,
      error: createError(ErrorCode.INVALID_ACTION, "Player has already completed the puzzle"),
    };
  }

  switch (action.action) {
    case "sudoku.edit": {
      const payload = action.payload as SudokuEditActionPayload;
      if (!payload || typeof payload !== "object") {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Invalid edit payload"),
        };
      }
      const { row, col, operation, value } = payload;
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(col) ||
        row < 0 ||
        row > 8 ||
        col < 0 ||
        col > 8
      ) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Coordinates must be integers 0..8"),
        };
      }

      // 1. Check paused state (practice mode only)
      if (player.paused) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Cannot make edits while paused"),
        };
      }

      const cellIndex = row * 9 + col;
      if (cellIndex < 0 || cellIndex >= 81) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Cell index out of bounds"),
        };
      }

      // 2. Givens are immutable
      const givenChar = state.givens[cellIndex];
      if (givenChar && givenChar >= "1" && givenChar <= "9") {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Givens cannot be modified"),
        };
      }

      // Clone player state
      const newCells = [...player.cells];
      const newNotes = [...player.notes];
      const newUndoStack = [...player.undoStack];

      const prevDigit = newCells[cellIndex];
      const prevNotes = newNotes[cellIndex];

      if (operation === "set") {
        if (!Number.isInteger(value) || !value || value < 1 || value > 9) {
          return {
            success: false,
            error: createError(ErrorCode.INVALID_ACTION, "Set operation requires value 1..9"),
          };
        }
        // Push onto undo stack
        newUndoStack.push({
          index: cellIndex,
          prevDigit,
          prevNotes,
        });

        // Setting a digit clears notes for that cell
        newCells[cellIndex] = value;
        newNotes[cellIndex] = 0;
      } else if (operation === "erase") {
        // Only push to undo if there was something to erase
        if (prevDigit === 0 && prevNotes === 0) {
          // No-op
          return {
            success: true,
            newState: state,
            effects: [],
          };
        }
        newUndoStack.push({
          index: cellIndex,
          prevDigit,
          prevNotes,
        });

        newCells[cellIndex] = 0;
        newNotes[cellIndex] = 0;
      } else if (operation === "toggle-note") {
        if (!Number.isInteger(value) || !value || value < 1 || value > 9) {
          return {
            success: false,
            error: createError(ErrorCode.INVALID_ACTION, "Toggle note requires value 1..9"),
          };
        }
        // If a digit is currently set in this cell, ignore or clear it? PRD: notes cannot be placed while digit is set, or toggle note works on empty/note cell.
        // If digit is set, setting note is invalid or clears digit. In classic Sudoku, notes apply to empty cells.
        if (prevDigit !== 0) {
          return {
            success: false,
            error: createError(
              ErrorCode.INVALID_ACTION,
              "Cannot add notes to a cell containing a digit",
            ),
          };
        }

        newUndoStack.push({
          index: cellIndex,
          prevDigit,
          prevNotes,
        });

        const noteBit = 1 << value;
        newNotes[cellIndex] = prevNotes ^ noteBit;
      } else {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, `Unsupported operation: ${operation}`),
        };
      }

      const elapsedMs = calculateElapsedMs(player, serverTime);
      const isComplete = checkCompletion(newCells, state.solution);

      let terminalResult: TerminalResult | undefined;
      const updatedPlayer: PlayerSudokuState = {
        ...player,
        cells: newCells,
        notes: newNotes,
        undoStack: newUndoStack,
        progressRevision: player.progressRevision + 1,
        elapsedMs: isComplete ? elapsedMs : player.elapsedMs,
        completedAt: isComplete ? serverTime : null,
        // Clear previous check highlight on valid placement
        incorrectCells: undefined,
      };

      const newPlayers = {
        ...state.players,
        [actorSeat]: updatedPlayer,
      };

      const effects: SudokuEffect[] = [
        {
          type: "sudoku-cell-edited",
          seat: actorSeat,
          row,
          col,
          index: cellIndex,
          operation,
          value,
          filledCount: countFilledCells(newCells),
        },
      ];

      // Handle Completion
      if (isComplete) {
        if (state.mode === "practice") {
          terminalResult = {
            winner: actorSeat,
            reason: "rules_win",
            scores: {
              A: actorSeat === "A" ? 1 : 0,
              B: actorSeat === "B" ? 1 : 0,
            },
            finishedAt: serverTime,
            details: {
              scored: false,
              replay: Boolean(state.replay),
              puzzleId: state.puzzleId,
              elapsedMs,
              assisted: updatedPlayer.assisted,
            },
          };
          effects.push({
            type: "sudoku-completed",
            seat: actorSeat,
            elapsedMs,
            winner: actorSeat,
          });
        } else if (state.mode === "duel") {
          // First verified completion wins duel!
          terminalResult = {
            winner: actorSeat,
            reason: "rules_win",
            scores: {
              A: actorSeat === "A" ? 1 : 0,
              B: actorSeat === "B" ? 1 : 0,
            },
            finishedAt: serverTime,
            details: {
              scored: !state.replay,
              replay: Boolean(state.replay),
              puzzleId: state.puzzleId,
              elapsedMs,
              interrupted: Boolean(state.interrupted),
              winner: actorSeat,
            },
          };
          effects.push({
            type: "sudoku-completed",
            seat: actorSeat,
            elapsedMs,
            winner: actorSeat,
          });
        } else if (state.mode === "challenge") {
          // Challenge mode:
          // If sender completed: sets senderElapsedMs and allows challenge publishing
          // If receiver completed: compares floor(senderElapsedMs / 1000) vs floor(receiverElapsedMs / 1000)
          const senderSeat = state.senderSeat || "A";
          if (actorSeat === senderSeat && !state.receiverAccepted) {
            terminalResult = {
              winner: null,
              reason: "rules_win",
              scores: { A: 0, B: 0 },
              finishedAt: serverTime,
              details: {
                scored: false,
                senderAttempt: true,
                puzzleId: state.puzzleId,
                elapsedMs,
                replay: Boolean(state.replay),
              },
            };
            // Sender completed solo run
            effects.push({
              type: "sudoku-completed",
              seat: actorSeat,
              elapsedMs,
              winner: null,
            });
            // The immutable sender attempt is complete; Publish creates a separate invitation.
          } else {
            // Receiver completed attempt! Compare times!
            const senderElapsed =
              state.senderElapsedMs ?? (state.players[senderSeat]?.elapsedMs || 0);
            const receiverElapsed = elapsedMs;
            const senderSecs = Math.floor(senderElapsed / 1000);
            const receiverSecs = Math.floor(receiverElapsed / 1000);

            let winner: Seat | null = null;
            let reason: "rules_win" | "rules_draw" = "rules_draw";

            if (senderSecs < receiverSecs) {
              winner = senderSeat;
              reason = "rules_win";
            } else if (receiverSecs < senderSecs) {
              winner = actorSeat;
              reason = "rules_win";
            } else {
              winner = null;
              reason = "rules_draw";
            }

            terminalResult = {
              winner,
              reason,
              scores: {
                A: winner === "A" ? 1 : 0,
                B: winner === "B" ? 1 : 0,
              },
              finishedAt: serverTime,
              details: {
                scored: !state.replay,
                replay: Boolean(state.replay),
                puzzleId: state.puzzleId,
                senderElapsedMs: senderElapsed,
                receiverElapsedMs: receiverElapsed,
                senderSecs,
                receiverSecs,
              },
            };

            effects.push({
              type: "sudoku-completed",
              seat: actorSeat,
              elapsedMs,
              winner,
            });
          }
        }
      }

      const newState: SudokuState = {
        ...state,
        players: newPlayers,
        ...(state.mode === "challenge" && actorSeat === (state.senderSeat || "A") && isComplete
          ? { senderElapsedMs: elapsedMs }
          : {}),
        terminalResult: terminalResult || state.terminalResult,
      };

      return {
        success: true,
        newState,
        effects,
        terminalResult,
      };
    }

    case "sudoku.undo": {
      if (player.paused) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Cannot undo while paused"),
        };
      }

      if (player.undoStack.length === 0) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Undo stack is empty"),
        };
      }

      const newUndoStack = [...player.undoStack];
      const lastOp = newUndoStack.pop()!;

      const newCells = [...player.cells];
      const newNotes = [...player.notes];

      newCells[lastOp.index] = lastOp.prevDigit;
      newNotes[lastOp.index] = lastOp.prevNotes;

      const updatedPlayer: PlayerSudokuState = {
        ...player,
        cells: newCells,
        notes: newNotes,
        undoStack: newUndoStack,
        progressRevision: player.progressRevision + 1,
        incorrectCells: undefined,
      };

      const newState: SudokuState = {
        ...state,
        players: {
          ...state.players,
          [actorSeat]: updatedPlayer,
        },
      };

      const effects: SudokuEffect[] = [
        {
          type: "sudoku-undone",
          seat: actorSeat,
          index: lastOp.index,
          filledCount: countFilledCells(newCells),
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    case "sudoku.check": {
      // Practice mode only!
      if (state.mode !== "practice") {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Check is only available in practice mode"),
        };
      }

      if (player.paused) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Cannot check while paused"),
        };
      }

      const incorrectIndices: number[] = [];
      for (let i = 0; i < 81; i++) {
        const val = player.cells[i];
        if (val !== 0) {
          const solutionVal = parseInt(state.solution[i], 10);
          if (val !== solutionVal) {
            incorrectIndices.push(i);
          }
        }
      }

      const updatedPlayer: PlayerSudokuState = {
        ...player,
        assisted: true, // permanently mark assisted
        incorrectCells: incorrectIndices,
        progressRevision: player.progressRevision + 1,
      };

      const newState: SudokuState = {
        ...state,
        players: {
          ...state.players,
          [actorSeat]: updatedPlayer,
        },
      };

      const effects: SudokuEffect[] = [
        {
          type: "sudoku-checked",
          seat: actorSeat,
          incorrectIndices,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    case "sudoku.pause": {
      // Practice mode only!
      if (state.mode !== "practice") {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Pause is only available in practice mode"),
        };
      }

      if (player.paused) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Already paused"),
        };
      }

      const updatedPlayer: PlayerSudokuState = {
        ...player,
        paused: true,
        pausedAt: serverTime,
        progressRevision: player.progressRevision + 1,
      };

      const newState: SudokuState = {
        ...state,
        players: {
          ...state.players,
          [actorSeat]: updatedPlayer,
        },
      };

      const effects: SudokuEffect[] = [
        {
          type: "sudoku-paused",
          seat: actorSeat,
          pausedAt: serverTime,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    case "sudoku.resume": {
      // Practice mode only!
      if (state.mode !== "practice") {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Resume is only available in practice mode"),
        };
      }

      if (!player.paused || player.pausedAt === null) {
        return {
          success: false,
          error: createError(ErrorCode.INVALID_ACTION, "Not paused"),
        };
      }

      const pausedDuration = Math.max(0, serverTime - player.pausedAt);
      const totalPausedMs = player.totalPausedMs + pausedDuration;
      const elapsedMs = Math.max(0, serverTime - player.startedAt - totalPausedMs);

      const updatedPlayer: PlayerSudokuState = {
        ...player,
        paused: false,
        pausedAt: null,
        totalPausedMs,
        elapsedMs,
        progressRevision: player.progressRevision + 1,
      };

      const newState: SudokuState = {
        ...state,
        players: {
          ...state.players,
          [actorSeat]: updatedPlayer,
        },
      };

      const effects: SudokuEffect[] = [
        {
          type: "sudoku-resumed",
          seat: actorSeat,
          resumedAt: serverTime,
          elapsedMs,
        },
      ];

      return {
        success: true,
        newState,
        effects,
      };
    }

    default:
      return {
        success: false,
        error: createError(ErrorCode.INVALID_ACTION, `Unsupported Sudoku action: ${action.action}`),
      };
  }
}

/**
 * Returns legal actions for a seat.
 */
export function legalActions(state: SudokuState, seat: Seat, serverTime?: number): ActionType[] {
  if (state.terminalResult) return [];

  const player = state.players[seat];
  if (!player || player.completedAt !== null) return [];

  if (state.mode === "challenge" && seat !== (state.senderSeat || "A") && !state.receiverAccepted)
    return [];
  if (
    state.mode === "duel" &&
    (state.scheduledStartTime === undefined ||
      (serverTime !== undefined && serverTime < state.scheduledStartTime))
  )
    return [];

  if (player.paused) {
    return ["sudoku.resume"];
  }

  const actions: ActionType[] = ["sudoku.edit"];
  if (player.undoStack.length > 0) {
    actions.push("sudoku.undo");
  }

  if (state.mode === "practice") {
    actions.push("sudoku.pause");
    actions.push("sudoku.check");
  }

  return actions;
}

/**
 * Generates filtered public view.
 *
 * Privacy Invariants:
 * 1. Own entries/notes visible to self only.
 * 2. Opponent view contains ONLY filledCount, elapsedMs, completed status, NEVER cell entries, correctness, or notes.
 * 3. Solution is NEVER delivered.
 * 4. Givens are masked in duel before scheduled start time (+3s).
 */
export function toPublicView(state: SudokuState, viewer: SudokuViewerContext): SudokuView {
  const viewerSeat: Seat = viewer.viewerSeat ?? (viewer.viewerAccountId === "B" ? "B" : "A");
  const opponentSeat: Seat = viewerSeat === "A" ? "B" : "A";

  const selfState = state.players[viewerSeat];
  const opponentState = state.players[opponentSeat];

  const now = viewer.serverTime ?? state.scheduledStartTime ?? selfState?.startedAt ?? 0;
  const hasStarted =
    (state.mode !== "duel" ||
      (state.scheduledStartTime !== undefined && now >= state.scheduledStartTime)) &&
    (state.mode !== "challenge" ||
      viewerSeat === (state.senderSeat || "A") ||
      Boolean(state.receiverAccepted));

  // Mask givens if duel has not started yet
  const boardVisible = hasStarted && !selfState?.paused;
  const givens = boardVisible ? state.givens : "0".repeat(81);

  const selfView: PlayerPublicView = {
    filledCount: selfState ? countFilledCells(selfState.cells) : 0,
    completed: selfState ? selfState.completedAt !== null : false,
    elapsedMs: selfState && hasStarted ? calculateElapsedMs(selfState, now) : 0,
    paused: selfState ? selfState.paused : false,
    assisted: selfState ? selfState.assisted : false,
    // Own private fields:
    cells: selfState && boardVisible ? [...selfState.cells] : undefined,
    notes: selfState && boardVisible ? [...selfState.notes] : undefined,
    undoAvailable: selfState ? selfState.undoStack.length > 0 : false,
    incorrectCells:
      boardVisible && selfState?.incorrectCells ? [...selfState.incorrectCells] : undefined,
    progressRevision: selfState?.progressRevision ?? 1,
  };

  let opponentView: PlayerPublicView | undefined;
  if (state.mode === "duel") {
    if (opponentState) {
      opponentView = {
        filledCount: countFilledCells(opponentState.cells),
        completed: opponentState.completedAt !== null,
        elapsedMs: calculateElapsedMs(opponentState, now),
        paused: opponentState.paused,
        assisted: opponentState.assisted,
        // STRICT PRIVACY: Opponent cells, notes, undo, incorrectCells are NEVER populated!
      };
    }
  }

  return {
    puzzleId: state.puzzleId,
    givens,
    mode: state.mode,
    replay: Boolean(state.replay),
    scheduledStartTime: state.scheduledStartTime,
    hasStarted,
    self: selfView,
    opponent: opponentView,
    ...(state.mode === "challenge"
      ? {
          challenge: {
            targetElapsedMs: state.senderElapsedMs,
            published: Boolean(state.challengePublished),
            accepted: Boolean(state.receiverAccepted),
          },
        }
      : {}),
    ...(state.terminalResult ? { terminalResult: { ...state.terminalResult } } : {}),
  };
}

/**
 * Checks if the state is terminal.
 */
export function isTerminal(state: SudokuState): TerminalResult | null {
  return state.terminalResult || null;
}

/** Lifecycle helpers called only by the authoritative match pipeline. */
export function activateDuel(state: SudokuState, serverTime: number): SudokuState {
  if (state.mode !== "duel" || state.scheduledStartTime !== undefined || state.terminalResult)
    return state;
  const scheduledStartTime = serverTime + 3000;
  return {
    ...state,
    scheduledStartTime,
    players: {
      A: { ...state.players.A, startedAt: scheduledStartTime },
      B: { ...state.players.B, startedAt: scheduledStartTime },
    },
  };
}
export function acceptChallenge(
  state: SudokuState,
  receiverSeat: Seat,
  serverTime: number,
  replay: boolean,
): SudokuState {
  if (
    state.mode !== "challenge" ||
    receiverSeat === (state.senderSeat || "A") ||
    state.receiverAccepted ||
    !state.challengePublished ||
    state.senderElapsedMs === undefined ||
    state.terminalResult
  )
    return state;
  return {
    ...state,
    receiverAccepted: true,
    replay: Boolean(state.replay || replay),
    players: {
      ...state.players,
      [receiverSeat]: { ...state.players[receiverSeat], startedAt: serverTime },
    },
  };
}
