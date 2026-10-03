/**
 * ArcadeO V1 — Snakes & Ladders Board Component
 *
 * 10x10 serpentine grid with positions 1 to 100, off-board starting zone,
 * SVG paths from the saved board version, player tokens,
 * and prominent tactile dice rolling controls.
 */

import React, { useMemo, useRef } from "react";
import {
  SNAKES_AND_LADDERS_BOARD_SIZE,
  boardMapFor,
  type SnakesAndLaddersView,
  type SnakesAndLaddersEffect,
} from "../../../shared/games/snakes-and-ladders/types";
import { useAcceptedMotion } from "../../components/accepted-motion";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Dices, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface SnakesLaddersBoardProps {
  view: SnakesAndLaddersView;
  canAct: boolean;
  onRoll: () => void;
  playerAName: string;
  playerBName: string;
  isSubmitting?: boolean;
  acceptedEventId?: string | number | null;
  acceptedEffects?: readonly SnakesAndLaddersEffect[];
  motionEnabled?: boolean;
}

/**
 * Calculates board percentage coordinates { x, y } (0..100) for position 1..100.
 */
function getCellCenterPercent(pos: number): { x: number; y: number } {
  if (pos <= 0) return { x: 5, y: 105 };
  if (pos > 100) return { x: 5, y: 5 };
  const zeroBased = pos - 1;
  const rowFromBottom = Math.floor(zeroBased / 10); // 0 (bottom) to 9 (top)
  const colInRow = zeroBased % 10;
  const col = rowFromBottom % 2 === 0 ? colInRow : 9 - colInRow; // serpentine

  // In SVG/CSS: (0,0) is top-left
  const gridRowFromTop = 9 - rowFromBottom;
  const x = (col + 0.5) * 10; // 5% .. 95%
  const y = (gridRowFromTop + 0.5) * 10; // 5% .. 95%
  return { x, y };
}

function snakeArtwork(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(12, Math.max(5, length * 0.25));
  const nx = -dy / length;
  const ny = dx / length;
  const c1 = { x: start.x + dx * 0.22 + nx * bend, y: start.y + dy * 0.22 + ny * bend };
  const c2 = { x: start.x + dx * 0.7 - nx * bend, y: start.y + dy * 0.7 - ny * bend };
  const point = (t: number) => {
    const m = 1 - t;
    return {
      x: m ** 3 * start.x + 3 * m ** 2 * t * c1.x + 3 * m * t ** 2 * c2.x + t ** 3 * end.x,
      y: m ** 3 * start.y + 3 * m ** 2 * t * c1.y + 3 * m * t ** 2 * c2.y + t ** 3 * end.y,
    };
  };
  const widthAt = (t: number) => (1.6 + Math.sin(Math.PI * t) * 1.1) * Math.pow(1 - t, 0.6);
  const left: string[] = [];
  const right: string[] = [];
  for (let index = 0; index <= 28; index++) {
    const t = index / 28;
    const p = point(t);
    const before = point(Math.max(0, t - 0.002));
    const after = point(Math.min(1, t + 0.002));
    const tangent = Math.hypot(after.x - before.x, after.y - before.y);
    const sideX = -(after.y - before.y) / tangent;
    const sideY = (after.x - before.x) / tangent;
    const width = widthAt(t);
    left.push(`${(p.x + sideX * width).toFixed(2)} ${(p.y + sideY * width).toFixed(2)}`);
    right.push(`${(p.x - sideX * width).toFixed(2)} ${(p.y - sideY * width).toFixed(2)}`);
  }
  return {
    body: `M ${left.join(" L ")} L ${right.reverse().join(" L ")} Z`,
    spots: [0.13, 0.25, 0.38, 0.51, 0.64, 0.76, 0.87].map((t) => ({
      ...point(t),
      radius: Math.max(0.25, widthAt(t) * 0.35),
    })),
    headAngle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export const SnakesLaddersBoard: React.FC<SnakesLaddersBoardProps> = ({
  view,
  canAct,
  onRoll,
  playerAName,
  playerBName,
  isSubmitting = false,
  acceptedEventId,
  acceptedEffects,
  motionEnabled = true,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { positions, activeSeat, lastRoll, status } = view;
  const { ladders, snakes } = boardMapFor(view.boardVersion);

  useAcceptedMotion(
    acceptedEventId,
    acceptedEffects,
    (effects, reduceMotion) => {
      const board = boardRef.current;
      if (!board) return [];
      const animations: Animation[] = [];
      if (effects.some((effect) => effect.type === "dice-rolled") && !reduceMotion) {
        const die = rootRef.current?.querySelector<HTMLElement>("[data-snl-die]");
        if (die)
          animations.push(
            die.animate(
              [{ transform: "rotate(-12deg) scale(.94)" }, { transform: "rotate(0) scale(1)" }],
              { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
            ),
          );
      }
      const advance = effects.find((effect) => effect.type === "token-advanced");
      if (!advance || advance.type !== "token-advanced" || reduceMotion) return animations;
      const transition = effects.find(
        (effect) => effect.type === "ladder-climbed" || effect.type === "snake-bitten",
      );
      const destination =
        transition && (transition.type === "ladder-climbed" || transition.type === "snake-bitten")
          ? transition.to
          : advance.to;
      const token = board.querySelector<HTMLElement>(`[data-testid="snl-token-${advance.seat}"]`);
      if (!token || advance.from === destination) return animations;
      const boardWidth = board.getBoundingClientRect().width;
      const final = getCellCenterPercent(destination);
      const positionsToShow = Array.from({ length: advance.to - advance.from + 1 }, (_, index) =>
        Math.max(1, advance.from + index),
      );
      const points = positionsToShow.map(getCellCenterPercent);
      if (
        transition &&
        (transition.type === "ladder-climbed" || transition.type === "snake-bitten")
      ) {
        const start = getCellCenterPercent(transition.from);
        const end = getCellCenterPercent(transition.to);
        if (transition.type === "snake-bitten") {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.hypot(dx, dy);
          const bend = Math.min(12, Math.max(5, length * 0.25));
          const nx = (-dy / length) * bend;
          const ny = (dx / length) * bend;
          for (const t of [0.2, 0.4, 0.6, 0.8]) {
            const mt = 1 - t;
            points.push({
              x:
                mt ** 3 * start.x +
                3 * mt ** 2 * t * (start.x + dx * 0.22 + nx) +
                3 * mt * t ** 2 * (start.x + dx * 0.7 - nx) +
                t ** 3 * end.x,
              y:
                mt ** 3 * start.y +
                3 * mt ** 2 * t * (start.y + dy * 0.22 + ny) +
                3 * mt * t ** 2 * (start.y + dy * 0.7 - ny) +
                t ** 3 * end.y,
            });
          }
        }
        points.push(end);
      }
      animations.push(
        token.animate(
          points.map((point, index) => ({
            transform: `translate(${((point.x - final.x) * boardWidth) / 100}px, ${((point.y - final.y) * boardWidth) / 100}px)`,
            offset: index / (points.length - 1),
          })),
          { duration: transition ? 640 : 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        ),
      );
      return animations;
    },
    { enabled: motionEnabled },
  );

  // Render a single die face visually
  const renderDieFace = (num: number) => {
    const dots: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activeDots = dots[num] || [];

    return (
      <div
        style={{
          width: "48px",
          height: "48px",
          backgroundColor: "var(--color-raised, #1e293b)",
          border: "2px solid var(--color-border-bold, #3b82f6)",
          borderRadius: "10px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          padding: "6px",
          gap: "2px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {activeDots.includes(i) && (
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary, #38bdf8)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Build grid cell mapping (from top to bottom: row 9 down to 0)
  const gridCells = useMemo(() => {
    const cells: Array<{
      pos: number;
      gridRow: number;
      gridCol: number;
      isSnakeHead: boolean;
      snakeTail?: number;
      isLadderBottom: boolean;
      ladderTop?: number;
    }> = [];

    for (let r = 9; r >= 0; r--) {
      for (let c = 0; c < 10; c++) {
        const rowFromBottom = r;
        const colInRow = rowFromBottom % 2 === 0 ? c : 9 - c;
        const pos = rowFromBottom * 10 + colInRow + 1;

        const isSnakeHead = pos in snakes;
        const snakeTail = snakes[pos];
        const isLadderBottom = pos in ladders;
        const ladderTop = ladders[pos];

        cells.push({
          pos,
          gridRow: 9 - r,
          gridCol: c,
          isSnakeHead,
          snakeTail,
          isLadderBottom,
          ladderTop,
        });
      }
    }
    return cells;
  }, [ladders, snakes]);

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-md, 16px)",
        width: "100%",
        maxWidth: "520px",
      }}
    >
      {/* 1. 10x10 Board with SVG Overlay */}
      <Surface
        variant="card"
        padding="none"
        radius="md"
        style={{
          width: "100%",
          aspectRatio: "1/1",
          position: "relative",
          backgroundColor: "var(--color-surface, #0f172a)",
          border: "2px solid var(--color-border, #334155)",
          overflow: "hidden",
        }}
      >
        {/* The 100 Grid Cells */}
        <div
          ref={boardRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SNAKES_AND_LADDERS_BOARD_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${SNAKES_AND_LADDERS_BOARD_SIZE}, 1fr)`,
            width: "100%",
            height: "100%",
            gap: "1px",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          {gridCells.map((cell) => {
            const hasPlayerA = positions.A === cell.pos;
            const hasPlayerB = positions.B === cell.pos;

            const tilePalette = ["#f9f8f2", "#f1d84e", "#e75350", "#2d85b4", "#249d72"];
            const bg =
              cell.pos === 100
                ? "#e75350"
                : tilePalette[(cell.pos * 7 + cell.gridRow * 3) % tilePalette.length];

            return (
              <div
                key={cell.pos}
                data-testid={`snl-cell-${cell.pos}`}
                style={{
                  backgroundColor: bg,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "2px",
                }}
              >
                {/* Cell Number */}
                <span
                  style={{
                    alignSelf: "center",
                    padding: "2px",
                    position: "relative",
                    zIndex: 6,
                    background: "rgba(255,255,255,.72)",
                    borderRadius: "2px",
                    fontSize: "clamp(10px, 1.8vw, 13px)",
                    fontWeight: 500,
                    color: "#171717",
                    lineHeight: 1,
                  }}
                >
                  {cell.pos}
                </span>

                {/* Special Icons */}
                {cell.pos === 100 && (
                  <Trophy size={14} color="var(--color-emphasis-yellow-ink, #f59e0b)" />
                )}
                {cell.isLadderBottom && (
                  <ArrowUpRight size={10} color="var(--color-success, #10b981)" />
                )}
                {cell.isSnakeHead && (
                  <ArrowDownRight size={10} color="var(--color-danger, #ef4444)" />
                )}

                {/* Token Markers */}
                <div style={{ display: "flex", gap: "2px", zIndex: 10 }}>
                  {hasPlayerA && (
                    <div
                      data-testid="snl-token-A"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "var(--player-a-accent, #10b981)",
                        border: "1.5px solid #ffffff",
                        boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                        fontSize: "7px",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                      }}
                    >
                      A
                    </div>
                  )}
                  {hasPlayerB && (
                    <div
                      data-testid="snl-token-B"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "var(--player-b-accent, #a855f7)",
                        border: "1.5px solid #ffffff",
                        boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                        fontSize: "7px",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                      }}
                    >
                      B
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Original editable artwork, drawn from the same endpoint table as the reducer. */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 5,
          }}
          viewBox="0 0 100 100"
        >
          {/* Ladders */}
          {Object.entries(ladders).map(([startStr, end]) => {
            const start = Number(startStr);
            const p1 = getCellCenterPercent(start);
            const p2 = getCellCenterPercent(end);
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.hypot(dx, dy);
            const nx = (-dy / length) * 1.25;
            const ny = (dx / length) * 1.25;
            const rungCount = Math.max(3, Math.floor(length / 5));
            return (
              <g
                key={`ladder-${start}-${end}`}
                stroke="#2b2830"
                strokeWidth="0.85"
                strokeLinecap="round"
              >
                <line x1={p1.x + nx} y1={p1.y + ny} x2={p2.x + nx} y2={p2.y + ny} />
                <line x1={p1.x - nx} y1={p1.y - ny} x2={p2.x - nx} y2={p2.y - ny} />
                {Array.from({ length: rungCount }, (_, index) => {
                  const t = (index + 0.5) / rungCount;
                  const x = p1.x + dx * t;
                  const y = p1.y + dy * t;
                  return <line key={index} x1={x - nx} y1={y - ny} x2={x + nx} y2={y + ny} />;
                })}
              </g>
            );
          })}

          {/* Snakes */}
          {Object.entries(snakes).map(([startStr, end], index) => {
            const start = Number(startStr);
            const p1 = getCellCenterPercent(start);
            const p2 = getCellCenterPercent(end);
            const art = snakeArtwork(p1, p2);
            const hue = ["#edc755", "#e98d65", "#93c97b", "#b996d4"][index % 4];
            return (
              <g key={`snake-${start}-${end}`}>
                <path
                  d={art.body}
                  fill={hue}
                  stroke="#4c332e"
                  strokeWidth=".5"
                  strokeLinejoin="round"
                />
                {art.spots.map((spot, spotIndex) => (
                  <ellipse
                    key={spotIndex}
                    cx={spot.x}
                    cy={spot.y}
                    rx={spot.radius}
                    ry={spot.radius * 0.65}
                    fill="#4f6a48"
                    opacity=".72"
                  />
                ))}
                <g transform={`translate(${p1.x} ${p1.y}) rotate(${art.headAngle})`}>
                  <path
                    d="M 2 0 C 1 -2.1 -1.3 -2.5 -3.2 -1.15 Q -4.4 -1 -4.7 0 Q -4.4 1 -3.2 1.15 C -1.3 2.5 1 2.1 2 0 Z"
                    fill={hue}
                    stroke="#4c332e"
                    strokeWidth=".5"
                  />
                  <ellipse cx="-3.6" cy="-.35" rx=".36" ry=".22" fill="#67433d" />
                  <circle cx="-1.65" cy="-1.13" r=".44" fill="#fff" />
                  <circle cx="-1.7" cy="-1.17" r=".23" fill="#211b1c" />
                  <circle cx="-1.65" cy="1.13" r=".44" fill="#fff" />
                  <circle cx="-1.7" cy="1.17" r=".23" fill="#211b1c" />
                  <path
                    d="M -4.6 0 L -6 0 M -6 0 L -6.8 -.55 M -6 0 L -6.8 .55"
                    fill="none"
                    stroke="#c43954"
                    strokeWidth=".32"
                    strokeLinecap="round"
                  />
                </g>
              </g>
            );
          })}
        </svg>
      </Surface>

      {/* 2. Off-board Status Zone (if any player at position 0) */}
      {(positions.A === 0 || positions.B === 0) && (
        <Surface
          variant="inset"
          padding="sm"
          radius="md"
          style={{
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
          }}
        >
          <span style={{ color: "var(--color-muted-text)" }}>Off-board (Position 0):</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {positions.A === 0 && (
              <span style={{ color: "var(--player-a-accent, #10b981)", fontWeight: 700 }}>
                {playerAName} (Waiting to enter)
              </span>
            )}
            {positions.B === 0 && (
              <span style={{ color: "var(--player-b-accent, #a855f7)", fontWeight: 700 }}>
                {playerBName} (Waiting to enter)
              </span>
            )}
          </div>
        </Surface>
      )}

      {/* 3. Interactive Dice Roll Control Strip */}
      <Surface
        variant="card"
        padding="md"
        radius="lg"
        style={{
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span data-snl-die style={{ display: "inline-flex" }}>
            {lastRoll ? (
              renderDieFace(lastRoll)
            ) : (
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--color-surface, #0f172a)",
                  border: "1px dashed var(--color-border, #475569)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Dices size={24} color="var(--color-muted-text, #94a3b8)" />
              </div>
            )}
          </span>

          <div>
            <div style={{ fontSize: "14px", fontWeight: 700 }}>
              {status === "completed"
                ? "Match Finished"
                : `${activeSeat === "A" ? playerAName : playerBName}'s Turn`}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text, #94a3b8)" }}>
              {status === "completed"
                ? `Winner reached position 100!`
                : lastRoll
                  ? `Rolled ${lastRoll}. A: ${positions.A} | B: ${positions.B}`
                  : `First to reach cell 100 wins!`}
            </div>
          </div>
        </div>

        {status !== "completed" && (
          <Button
            variant="primary"
            size="md"
            disabled={!canAct || isSubmitting}
            onClick={onRoll}
            data-testid="snl-roll-button"
            leftIcon={<Dices size={18} />}
          >
            Roll Dice
          </Button>
        )}
      </Surface>
    </div>
  );
};
