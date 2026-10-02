/**
 * Private Arcade V1 — Sudoku Board & Interactive Controls
 *
 * Server-authoritative 9x9 Sudoku interface with:
 * - 9x9 cell grid with 3x3 block borders
 * - Immutable givens vs editable user entries
 * - 3x3 mini-grid pencil notes per cell
 * - Cell selection, peer highlighting, and matching digit highlights
 * - Number pad (1..9), Notes toggle, Erase, and Undo
 * - Practice controls: Pause/Resume, Check Solution, Assisted badge
 * - Duel / Challenge opponent filled count HUD
 */

import React, { useState, useEffect, useMemo } from "react";
import type { Seat } from "../../../shared/protocol/types";
import type { SudokuView, SudokuOperation } from "../../../shared/games/sudoku/types";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Pause, Play, RotateCcw, CheckCircle, PenTool, Eraser, Clock } from "lucide-react";

interface SudokuBoardProps {
  view: SudokuView;
  canAct: boolean;
  onEditCell: (row: number, col: number, operation: SudokuOperation, value?: number) => void;
  onUndo: () => void;
  onCheck?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  playerAName: string;
  playerBName: string;
  localSeat: Seat;
  isSubmitting?: boolean;
}

export const SudokuBoard: React.FC<SudokuBoardProps> = ({
  view,
  canAct,
  onEditCell,
  onUndo,
  onCheck,
  onPause,
  onResume,
  playerAName: _playerAName,
  playerBName: _playerBName,
  localSeat: _localSeat,
  isSubmitting = false,
}) => {
  const {
    puzzleId,
    givens,
    mode,
    scheduledStartTime: _scheduledStartTime,
    hasStarted,
    self,
    opponent,
    terminalResult,
  } = view;

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isNotesMode, setIsNotesMode] = useState(false);

  // Parse 81 givens
  const givensArray = useMemo(() => {
    return givens ? givens.split("").map((c) => parseInt(c, 10)) : Array(81).fill(0);
  }, [givens]);

  // Own cells and notes
  const userCells = self?.cells ?? givensArray;
  const userNotes = self?.notes ?? Array(81).fill(0);
  const incorrectSet = useMemo(() => new Set(self?.incorrectCells ?? []), [self?.incorrectCells]);

  // Selected cell value for matching highlights
  const selectedValue = useMemo(() => {
    if (!selectedCell) return 0;
    const idx = selectedCell.row * 9 + selectedCell.col;
    return userCells[idx] || 0;
  }, [selectedCell, userCells]);

  // Local continuous timer display
  const [displaySeconds, setDisplaySeconds] = useState(Math.floor((self?.elapsedMs ?? 0) / 1000));

  useEffect(() => {
    if (terminalResult || self?.paused || !hasStarted) {
      setDisplaySeconds(Math.floor((self?.elapsedMs ?? 0) / 1000));
      return;
    }

    const elapsedAtSync = self?.elapsedMs ?? 0;
    const syncedAt = Date.now();
    const tick = () =>
      setDisplaySeconds(Math.floor((elapsedAtSync + Date.now() - syncedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [self?.elapsedMs, self?.paused, terminalResult, hasStarted]);

  // Format time mm:ss
  const formattedTime = useMemo(() => {
    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [displaySeconds]);

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (!canAct || isSubmitting || self?.paused) return;
    setSelectedCell({ row, col });
  };

  // Handle digit input (1..9)
  const handleDigitInput = (digit: number) => {
    if (!selectedCell || !canAct || isSubmitting || self.paused) return;
    const { row, col } = selectedCell;
    const idx = row * 9 + col;

    // Cannot edit givens
    if (givensArray[idx] !== 0) return;

    if (isNotesMode) {
      onEditCell(row, col, "toggle-note", digit);
    } else {
      // If cell already has this digit, erase it; else set it
      if (userCells[idx] === digit) {
        onEditCell(row, col, "erase");
      } else {
        onEditCell(row, col, "set", digit);
      }
    }
  };

  // Handle erase
  const handleErase = () => {
    if (!selectedCell || !canAct || isSubmitting || self.paused) return;
    const { row, col } = selectedCell;
    const idx = row * 9 + col;
    if (givensArray[idx] !== 0) return;
    onEditCell(row, col, "erase");
  };

  // Keyboard navigation & number entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || !canAct || isSubmitting || self.paused) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        handleDigitInput(num);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        handleErase();
        return;
      }

      if (e.key === "ArrowUp") {
        setSelectedCell((prev) =>
          prev ? { row: Math.max(0, prev.row - 1), col: prev.col } : null,
        );
      } else if (e.key === "ArrowDown") {
        setSelectedCell((prev) =>
          prev ? { row: Math.min(8, prev.row + 1), col: prev.col } : null,
        );
      } else if (e.key === "ArrowLeft") {
        setSelectedCell((prev) =>
          prev ? { row: prev.row, col: Math.max(0, prev.col - 1) } : null,
        );
      } else if (e.key === "ArrowRight") {
        setSelectedCell((prev) =>
          prev ? { row: prev.row, col: Math.min(8, prev.col + 1) } : null,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, canAct, isSubmitting, self?.paused, isNotesMode, userCells, givensArray]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-md, 16px)",
        width: "100%",
        maxWidth: "420px",
      }}
    >
      {/* 1. Sudoku Header Strip */}
      <Surface
        variant="card"
        padding="sm"
        radius="lg"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-primary, #38bdf8)",
            }}
          >
            {mode === "practice" ? "Solo Practice" : mode === "duel" ? "Live Duel" : "Challenge"}
          </span>
          <span style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>{puzzleId}</span>
        </div>

        {/* Live Timer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "15px",
            fontWeight: 800,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <Clock size={16} color="var(--color-muted-text)" />
          <span>{formattedTime}</span>
        </div>

        {/* Assisted Badge / Opponent Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {mode === "practice" && self?.assisted && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-warning, #f59e0b)",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              Assisted
            </span>
          )}

          {opponent && (
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-muted-text)",
              }}
            >
              Opponent:{" "}
              <strong style={{ color: "var(--color-text)" }}>{opponent.filledCount}</strong>/81
            </div>
          )}
        </div>
      </Surface>

      {/* 2. 9x9 Sudoku Grid Board */}
      <Surface
        variant="card"
        padding="none"
        radius="xl"
        style={{
          width: "100%",
          aspectRatio: "1/1",
          position: "relative",
          backgroundColor: "var(--color-surface, #0f172a)",
          border: "3px solid var(--color-border-bold, #475569)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "repeat(9, 1fr)",
          gridTemplateRows: "repeat(9, 1fr)",
        }}
      >
        {/* Paused Mask Overlay */}
        {self?.paused && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <Pause size={40} color="var(--color-primary, #38bdf8)" />
            <div style={{ fontSize: "16px", fontWeight: 700 }}>Puzzle Paused</div>
            {onResume && (
              <Button variant="primary" size="md" onClick={onResume} leftIcon={<Play size={16} />}>
                Resume Puzzle
              </Button>
            )}
          </div>
        )}

        {Array.from({ length: 9 }).map((_, r) =>
          Array.from({ length: 9 }).map((_, c) => {
            const idx = r * 9 + c;
            const isGiven = givensArray[idx] !== 0;
            const digit = userCells[idx];
            const notesMask = userNotes[idx];
            const isSelected = selectedCell?.row === r && selectedCell?.col === c;
            const isPeer =
              selectedCell !== null &&
              (selectedCell.row === r ||
                selectedCell.col === c ||
                (Math.floor(selectedCell.row / 3) === Math.floor(r / 3) &&
                  Math.floor(selectedCell.col / 3) === Math.floor(c / 3)));
            const isSameDigit = selectedValue > 0 && digit === selectedValue;
            const isIncorrect = incorrectSet.has(idx);

            // 3x3 block borders
            const borderRight =
              c === 2 || c === 5
                ? "2px solid var(--color-border-bold, #64748b)"
                : "1px solid var(--color-border, #334155)";
            const borderBottom =
              r === 2 || r === 5
                ? "2px solid var(--color-border-bold, #64748b)"
                : "1px solid var(--color-border, #334155)";

            // Cell background
            let cellBg = "transparent";
            if (isSelected) cellBg = "rgba(56, 189, 248, 0.28)";
            else if (isSameDigit) cellBg = "rgba(56, 189, 248, 0.18)";
            else if (isPeer) cellBg = "rgba(255, 255, 255, 0.04)";
            if (isGiven && !isSelected && !isSameDigit && !isPeer)
              cellBg = "rgba(255, 255, 255, 0.02)";

            return (
              <button
                key={`sudoku-cell-${r}-${c}`}
                data-testid={`sudoku-cell-${r}-${c}`}
                aria-label={`Row ${r + 1}, Col ${c + 1}${
                  isGiven ? `, Given ${digit}` : digit > 0 ? `, Digit ${digit}` : ""
                }`}
                disabled={!canAct || isSubmitting || self.paused}
                onClick={() => handleCellClick(r, c)}
                style={{
                  border: "none",
                  borderRight,
                  borderBottom,
                  backgroundColor: cellBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
              >
                {/* Digit Display */}
                {digit > 0 ? (
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: isGiven ? 900 : 700,
                      color: isIncorrect
                        ? "var(--color-danger, #ef4444)"
                        : isGiven
                          ? "var(--color-text, #ffffff)"
                          : "var(--color-primary, #38bdf8)",
                    }}
                  >
                    {digit}
                  </span>
                ) : notesMask > 0 ? (
                  /* 3x3 Notes Grid */
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gridTemplateRows: "repeat(3, 1fr)",
                      padding: "2px",
                      pointerEvents: "none",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                      const hasNote = (notesMask & (1 << n)) !== 0;
                      return (
                        <div
                          key={`note-${n}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "8px",
                            fontWeight: 600,
                            color: "var(--color-muted-text, #94a3b8)",
                            lineHeight: 1,
                          }}
                        >
                          {hasNote ? n : ""}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </button>
            );
          }),
        )}
      </Surface>

      {/* 3. Tactile Action Bar (Notes, Erase, Undo, Pause, Check) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          gap: "8px",
        }}
      >
        <Button
          variant={isNotesMode ? "primary" : "secondary"}
          size="md"
          onClick={() => setIsNotesMode((m) => !m)}
          data-testid="sudoku-toggle-notes"
          leftIcon={<PenTool size={16} />}
        >
          {isNotesMode ? "Notes ON" : "Notes"}
        </Button>

        <Button
          variant="secondary"
          size="md"
          disabled={
            !canAct ||
            isSubmitting ||
            !selectedCell ||
            givensArray[selectedCell.row * 9 + selectedCell.col] !== 0
          }
          onClick={handleErase}
          data-testid="sudoku-erase-btn"
          leftIcon={<Eraser size={16} />}
        >
          Erase
        </Button>

        <Button
          variant="secondary"
          size="md"
          disabled={!self?.undoAvailable || isSubmitting}
          onClick={onUndo}
          data-testid="sudoku-undo-btn"
          leftIcon={<RotateCcw size={16} />}
        >
          Undo
        </Button>

        {mode === "practice" && onCheck && (
          <Button
            variant="secondary"
            size="md"
            disabled={!canAct || isSubmitting}
            onClick={onCheck}
            data-testid="sudoku-check-btn"
            leftIcon={<CheckCircle size={16} />}
          >
            Check
          </Button>
        )}

        {mode === "practice" && onPause && !self?.paused && (
          <Button
            variant="secondary"
            size="md"
            disabled={!canAct || isSubmitting}
            onClick={onPause}
            data-testid="sudoku-pause-btn"
            leftIcon={<Pause size={16} />}
          >
            Pause
          </Button>
        )}
      </div>

      {/* 4. Large Tactile Number Pad (1..9) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(44px, 1fr))",
          gap: "6px",
          width: "100%",
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <Button
            key={`pad-${num}`}
            variant="secondary"
            size="md"
            data-testid={`sudoku-pad-${num}`}
            onClick={() => handleDigitInput(num)}
            disabled={!canAct || isSubmitting || self.paused}
            style={{
              padding: "10px 0",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            {num}
          </Button>
        ))}
      </div>
    </div>
  );
};
