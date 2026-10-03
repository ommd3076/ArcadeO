/**
 * ArcadeO V1 — SOS Board Component
 *
 * 5x5 cell grid with tactile letter placement, S/O selector toggle,
 * animated SVG strike-through lines for formed SOS sequences,
 * and live score display.
 */

import React, { useRef, useState } from "react";
import { type SOSView, type SOSLetter, type SOSEffect } from "../../../shared/games/sos/types";
import { Surface } from "../../components/surface";
import { PlayerScoreStrip, BoardViewport } from "../../components/game-primitives";
import { Button } from "../../components/button";
import { useAcceptedMotion } from "../../components/accepted-motion";
import "./sos.css";

interface SOSBoardProps {
  view: SOSView;
  canAct: boolean;
  onPlaceLetter: (row: number, col: number, letter: SOSLetter) => void;
  playerAName: string;
  playerBName: string;
  isSubmitting?: boolean;
  acceptedEventId?: string | null;
  acceptedEffects?: readonly SOSEffect[];
  motionEnabled?: boolean;
}

export const SOSBoard: React.FC<SOSBoardProps> = ({
  view,
  canAct,
  onPlaceLetter,
  playerAName,
  playerBName,
  isSubmitting = false,
  acceptedEventId,
  acceptedEffects = [],
  motionEnabled = true,
}) => {
  const { board, lines = [], scores, activeSeat, status } = view;
  const size = view.gridSize ?? board.length ?? 5;
  const motionRootRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);

  // Selected letter for placement ("S" or "O")
  const [selectedLetter, setSelectedLetter] = useState<SOSLetter>("S");
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  useAcceptedMotion(
    acceptedEventId,
    acceptedEffects,
    (effects, reduceMotion) => {
      const animations: Animation[] = [];
      const placed = effects.find((effect) => effect.type === "letter-placed");
      if (placed?.type === "letter-placed") {
        const letter = motionRootRef.current?.querySelector<HTMLElement>(
          `[data-testid="sos-cell-${placed.row}-${placed.col}"] span`,
        );
        if (letter?.animate)
          animations.push(
            letter.animate(
              reduceMotion
                ? [{ opacity: 0.65 }, { opacity: 1 }]
                : [
                    { opacity: 0.25, transform: "scale(.82)" },
                    { opacity: 1, transform: "scale(1)" },
                  ],
              { duration: reduceMotion ? 100 : 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            ),
          );
      }
      const formedLines = effects.flatMap((effect) =>
        effect.type === "lines-formed" ? effect.lines : [],
      );
      for (const line of formedLines) {
        const target = Array.from(
          motionRootRef.current?.querySelectorAll<SVGLineElement>(`[data-testid^="sos-line-"]`) ??
            [],
        ).find((candidate) => candidate.dataset.testid === `sos-line-${line.id}`);
        if (target?.animate)
          animations.push(
            target.animate(
              reduceMotion
                ? [{ opacity: 0.65 }, { opacity: 0.85 }]
                : [{ opacity: 0.2 }, { opacity: 0.85 }],
              { duration: reduceMotion ? 100 : 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            ),
          );
      }
      return animations;
    },
    { enabled: motionEnabled },
  );

  const handleCellClick = (r: number, c: number) => {
    if (!canAct || isSubmitting || status === "completed") return;
    if (board[r][c] !== null) return; // Already occupied

    onPlaceLetter(r, c, selectedLetter);
  };

  return (
    <div
      ref={motionRootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-md, 16px)",
        width: "100%",
        maxWidth: "min(100%, 760px)",
      }}
    >
      <PlayerScoreStrip
        names={{ A: playerAName, B: playerBName }}
        scores={scores}
        activeSeat={activeSeat}
        completed={status === "completed"}
        testIdPrefix="sos"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setZoom((value) => !value)}
        aria-label={zoom ? "Reset board zoom" : "Zoom board"}
      >
        {zoom ? "Reset zoom" : "Zoom board"}
      </Button>
      {/* 2. SOS Grid with SVG Strike Lines */}
      <BoardViewport zoom={zoom} label="sos board">
        <Surface
          variant="card"
          padding="md"
          radius="xl"
          style={{
            width: zoom ? `max(100%, ${size * 64 + 64}px)` : "100%",
            maxWidth: zoom ? "none" : "min(100%, 76vh, 760px)",
            aspectRatio: "1/1",
            position: "relative",
            backgroundColor: "var(--color-surface, #0f172a)",
            border: "2px solid var(--color-border, #334155)",
            overflow: "hidden",
          }}
        >
          {/* Cell Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
              width: "100%",
              height: "100%",
              gap: "4px",
            }}
          >
            {Array.from({ length: size }).map((_, r) =>
              Array.from({ length: size }).map((_, c) => {
                const cellValue = board[r][c];
                const isEmpty = cellValue === null;

                return (
                  <button
                    key={`cell-${r}-${c}`}
                    data-testid={`sos-cell-${r}-${c}`}
                    aria-label={`Cell row ${r + 1}, column ${c + 1}: ${cellValue ?? "empty"}`}
                    disabled={!isEmpty || !canAct || isSubmitting || status === "completed"}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      backgroundColor: "var(--color-raised, #1e293b)",
                      border: "1px solid var(--color-border, #334155)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      lineHeight: 1,
                      minWidth: 0,
                      minHeight: 0,
                      overflow: "hidden",
                      fontWeight: 800,
                      color: "var(--color-text, #ffffff)",
                      cursor: isEmpty && canAct && status !== "completed" ? "pointer" : "default",
                      position: "relative",
                      padding: 0,
                      transition: "transform 150ms ease, background-color 150ms ease",
                    }}
                  >
                    {cellValue && <span>{cellValue}</span>}
                  </button>
                );
              }),
            )}
          </div>

          {/* SVG Strike Lines for Completed SOS Sequences */}
          <svg
            style={{
              position: "absolute",
              top: "var(--space-md)",
              left: "var(--space-md)",
              width: "calc(100% - var(--space-md) * 2)",
              height: "calc(100% - var(--space-md) * 2)",
              pointerEvents: "none",
              zIndex: 10,
            }}
            viewBox="0 0 100 100"
          >
            {lines.map((line) => {
              // Convert row/col to center coordinates in percentage (0..100)
              const [r1, c1] = line.from;
              const [r2, c2] = line.to;

              const x1 = ((c1 + 0.5) * 100) / size;
              const y1 = ((r1 + 0.5) * 100) / size;
              const x2 = ((c2 + 0.5) * 100) / size;
              const y2 = ((r2 + 0.5) * 100) / size;

              const lineColor =
                line.claimedBy === "A"
                  ? "var(--player-a-accent, #10b981)"
                  : "var(--player-b-accent, #a855f7)";

              return (
                <line
                  key={line.id}
                  data-testid={`sos-line-${line.id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={lineColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}
          </svg>
        </Surface>
      </BoardViewport>

      <details style={{ width: "100%" }}>
        <summary>Choose a cell by row and column</summary>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}
        >
          <label>
            Row{" "}
            <select
              value={selectedRow}
              onChange={(event) => setSelectedRow(Number(event.target.value))}
            >
              {Array.from({ length: size }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Column{" "}
            <select
              value={selectedCol}
              onChange={(event) => setSelectedCol(Number(event.target.value))}
            >
              {Array.from({ length: size }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            disabled={!canAct || isSubmitting || board[selectedRow]?.[selectedCol] !== null}
            onClick={() => handleCellClick(selectedRow, selectedCol)}
          >
            Place {selectedLetter}
          </Button>
        </div>
      </details>

      {/* 3. Letter Selector Toggle Strip */}
      <Surface
        variant="card"
        padding="sm"
        radius="lg"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-muted-text)" }}>
          Letter to Place:
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant={selectedLetter === "S" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedLetter("S")}
            data-testid="sos-select-s"
            style={{ width: "48px", fontWeight: 800, fontSize: "16px" }}
          >
            S
          </Button>
          <Button
            variant={selectedLetter === "O" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedLetter("O")}
            data-testid="sos-select-o"
            style={{ width: "48px", fontWeight: 800, fontSize: "16px" }}
          >
            O
          </Button>
        </div>
      </Surface>
    </div>
  );
};
