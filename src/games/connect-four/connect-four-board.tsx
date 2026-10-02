import { useId, useRef, type KeyboardEvent } from "react";
import type { Seat } from "@shared/protocol/types";
import type {
  ConnectFourCell,
  ConnectFourCoordinate,
  ConnectFourEffect,
} from "@shared/games/connect-four/types";
import { CONNECT_FOUR_COLS, CONNECT_FOUR_ROWS } from "@shared/games/connect-four/types";
import { ChevronDown } from "lucide-react";
import { useAcceptedMotion } from "../../components/accepted-motion";
import "./connect-four.css";

export interface ConnectFourBoardProps {
  board: ConnectFourCell[][];
  activeSeat: Seat;
  canDrop: boolean;
  disabledColumns?: number[];
  winningCells?: ConnectFourCoordinate[];
  lastDrop?: { row: number; col: number; seat: Seat } | null;
  acceptedEventId?: string | null;
  acceptedEffects?: readonly ConnectFourEffect[];
  motionEnabled?: boolean;
  onDropColumn: (columnIndex: number) => void;
  playerAName?: string;
  playerBName?: string;
  playerAAccent?: "teal" | "violet" | "cyan" | "mint" | "pink" | "yellow";
  playerBAccent?: "teal" | "violet" | "cyan" | "mint" | "pink" | "yellow";
  isTerminal?: boolean;
}

export function ConnectFourBoard({
  board,
  activeSeat: _activeSeat,
  canDrop,
  disabledColumns = [],
  winningCells = [],
  acceptedEventId,
  acceptedEffects = [],
  motionEnabled = true,
  onDropColumn,
  playerAName = "Player A",
  playerBName = "Player B",
  isTerminal = false,
}: ConnectFourBoardProps) {
  const boardId = useId();
  const boardRef = useRef<HTMLDivElement>(null);

  // Create a quick lookup set for winning cells: "row,col"
  const winningSet = new Set(winningCells.map(([r, c]) => `${r},${c}`));
  useAcceptedMotion(
    acceptedEventId,
    acceptedEffects,
    (effects, reduceMotion) => {
      const animations: Animation[] = [];
      const drop = effects.find((effect) => effect.type === "disc-dropped");
      if (drop?.type === "disc-dropped") {
        const disc = boardRef.current?.querySelector<HTMLElement>(
          `[data-testid="c4-disc-${drop.row}-${drop.col}"]`,
        );
        if (disc && typeof disc.animate === "function") {
          const boardHeight = boardRef.current?.getBoundingClientRect().height ?? 0;
          const travel = Math.min(600, Math.max(120, boardHeight * ((drop.row + 1) / 6)));
          animations.push(
            disc.animate(
              reduceMotion
                ? [{ opacity: 0.45 }, { opacity: 1 }]
                : [
                    { transform: `translateY(-${travel}px)`, opacity: 0.35 },
                    { transform: "translateY(0)", opacity: 1 },
                  ],
              {
                duration: reduceMotion ? 120 : travel,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              },
            ),
          );
        }
      }
      if (effects.some((effect) => effect.type === "game-won")) {
        for (const cell of winningCells) {
          const disc = boardRef.current?.querySelector<HTMLElement>(
            `[data-testid="c4-disc-${cell[0]}-${cell[1]}"]`,
          );
          if (disc && typeof disc.animate === "function")
            animations.push(
              disc.animate(
                reduceMotion
                  ? [{ opacity: 0.7 }, { opacity: 1 }]
                  : [
                      { transform: "scale(1)" },
                      { transform: "scale(1.04)" },
                      { transform: "scale(1)" },
                    ],
                { duration: reduceMotion ? 100 : 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
              ),
            );
        }
      }
      return animations;
    },
    { enabled: motionEnabled },
  );

  // Check if a column is full (row 0 is occupied)
  const isColumnFull = (colIdx: number): boolean => {
    return board[0]?.[colIdx] !== null && board[0]?.[colIdx] !== undefined;
  };

  const handleColumnClick = (colIdx: number) => {
    if (!canDrop || isTerminal || disabledColumns.includes(colIdx) || isColumnFull(colIdx)) {
      return;
    }
    onDropColumn(colIdx);
  };

  const handleKeyDown = (e: KeyboardEvent, colIdx: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleColumnClick(colIdx);
    }
  };

  return (
    <div className="c4-container" role="region" aria-label="Connect Four Game Board">
      {/* 1. Tactile Column Drop Buttons row (>= 44x44px target) */}
      <div className="c4-drop-controls" role="group" aria-label="Drop disc into column">
        {Array.from({ length: CONNECT_FOUR_COLS }).map((_, colIdx) => {
          const full = isColumnFull(colIdx);
          const isDisabled = !canDrop || isTerminal || full || disabledColumns.includes(colIdx);
          return (
            <button
              key={`drop-btn-${colIdx}`}
              type="button"
              className={`c4-drop-btn ${isDisabled ? "c4-drop-btn--disabled" : ""}`}
              onClick={() => handleColumnClick(colIdx)}
              disabled={isDisabled}
              aria-label={
                full ? `Column ${colIdx + 1} full` : `Drop disc into column ${colIdx + 1}`
              }
              title={full ? "Column full" : `Drop column ${colIdx + 1}`}
            >
              <span className="c4-drop-number">{colIdx + 1}</span>
              <ChevronDown size={22} aria-hidden="true" className="c4-drop-btn-arrow" />
            </button>
          );
        })}
      </div>

      {/* 2. Board Grid Surface with tactile columns and holes */}
      <div
        ref={boardRef}
        className="c4-board-surface"
        role="grid"
        aria-readonly="true"
        aria-multiselectable="false"
        aria-label="7 columns by 6 rows Connect Four grid"
        id={boardId}
      >
        {/* Render columns as direct interactive hit areas */}
        {Array.from({ length: CONNECT_FOUR_COLS }).map((_, colIdx) => {
          const full = isColumnFull(colIdx);
          const columnDisabled = !canDrop || isTerminal || full || disabledColumns.includes(colIdx);

          return (
            <div
              key={`col-${colIdx}`}
              className={`c4-column ${columnDisabled ? "c4-column--disabled" : ""}`}
              role="presentation"
              onClick={() => handleColumnClick(colIdx)}
              onKeyDown={(e) => handleKeyDown(e, colIdx)}
              tabIndex={columnDisabled ? -1 : 0}
              aria-label={`Column ${colIdx + 1}${full ? " (full)" : ""}`}
            >
              {Array.from({ length: CONNECT_FOUR_ROWS }).map((_, rowIdx) => {
                const cellValue = board[rowIdx]?.[colIdx] ?? null;
                const isWinning = winningSet.has(`${rowIdx},${colIdx}`);
                return (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    role="gridcell"
                    aria-label={`Row ${rowIdx + 1}, Column ${colIdx + 1}: ${
                      cellValue === "A"
                        ? `${playerAName} (Teal)`
                        : cellValue === "B"
                          ? `${playerBName} (Violet)`
                          : "Empty"
                    }${isWinning ? " — winning disc" : ""}`}
                    className="c4-cell-slot"
                  >
                    {/* The Disc if present */}
                    {cellValue ? (
                      <div
                        data-testid={`c4-disc-${rowIdx}-${colIdx}`}
                        className={`c4-disc c4-disc--${cellValue.toLowerCase()} ${
                          isWinning ? "c4-disc--winning" : ""
                        }`}
                        data-seat={cellValue}
                      >
                        <span className="c4-disc-mark" aria-hidden="true">
                          {cellValue}
                        </span>
                      </div>
                    ) : (
                      <div className="c4-cell-empty" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
