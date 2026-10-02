import { useId, type KeyboardEvent } from "react";
import type { Seat } from "@shared/protocol/types";
import type {
  ConnectFourCell,
  ConnectFourCoordinate,
  ConnectFourEffect,
} from "@shared/games/connect-four/types";
import { CONNECT_FOUR_COLS, CONNECT_FOUR_ROWS } from "@shared/games/connect-four/types";
import { ChevronDown } from "lucide-react";
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
  onDropColumn,
  playerAName = "Player A",
  playerBName = "Player B",
  isTerminal = false,
}: ConnectFourBoardProps) {
  const boardId = useId();

  // Create a quick lookup set for winning cells: "row,col"
  const winningSet = new Set(winningCells.map(([r, c]) => `${r},${c}`));
  const acceptedDrop = acceptedEventId
    ? acceptedEffects.find((effect) => effect.type === "disc-dropped")
    : undefined;

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
                const isJustDropped =
                  acceptedDrop?.type === "disc-dropped" &&
                  acceptedDrop.row === rowIdx &&
                  acceptedDrop.col === colIdx &&
                  acceptedDrop.seat === cellValue;

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
                        className={`c4-disc c4-disc--${cellValue.toLowerCase()} ${
                          isWinning ? "c4-disc--winning" : ""
                        } ${isJustDropped ? `c4-disc--dropping-r${rowIdx}` : ""}`}
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
