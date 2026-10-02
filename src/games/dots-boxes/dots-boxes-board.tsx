/**
 * Private Arcade V1 — Dots & Boxes Board Component
 *
 * 5x5 dot grid with 4x4 claimable boxes.
 * Features generous edge hit areas, alternative dot-to-dot selection,
 * distinct seat coloring, box fill animations, and live score counter.
 */

import React, { useState, useMemo, useRef } from "react";
import type { Seat } from "../../../shared/protocol/types";
import {
  type DotsBoxesView,
  type DotsBoxesEdge,
  type DotsBoxesEffect,
} from "../../../shared/games/dots-boxes/types";
import {
  canonicalizeEdge,
  edgeKey,
  isOrthogonallyAdjacent,
} from "../../../shared/games/dots-boxes/engine";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { PlayerScoreStrip, BoardViewport } from "../../components/game-primitives";
import { Sparkles } from "lucide-react";
import { useAcceptedMotion } from "../../components/accepted-motion";
import "./dots-boxes.css";

interface DotsBoxesBoardProps {
  view: DotsBoxesView;
  canAct: boolean;
  onPlaceEdge: (edge: DotsBoxesEdge) => void;
  playerAName: string;
  playerBName: string;
  isSubmitting?: boolean;
  acceptedEventId?: string | null;
  acceptedEffects?: readonly DotsBoxesEffect[];
  motionEnabled?: boolean;
}

export const DotsBoxesBoard: React.FC<DotsBoxesBoardProps> = ({
  view,
  canAct,
  onPlaceEdge,
  playerAName,
  playerBName,
  isSubmitting = false,
  acceptedEventId,
  acceptedEffects = [],
  motionEnabled = true,
}) => {
  const { edges, boxes, scores, activeSeat, status } = view;
  const dotCount = view.gridSize ?? 5;
  const boxCount = dotCount - 1;
  const step = 100 / boxCount;
  const motionRootRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);

  // Selected dot for alternative dot-to-dot edge placement
  const [selectedDot, setSelectedDot] = useState<{ r: number; c: number } | null>(null);
  const [coordinateRow, setCoordinateRow] = useState(0);
  const [coordinateCol, setCoordinateCol] = useState(0);

  // Map placed edges by canonical key
  const placedEdgesMap = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const e of edges) {
      map.set(edgeKey(e), e.claimedBy);
    }
    return map;
  }, [edges]);
  useAcceptedMotion(
    acceptedEventId,
    acceptedEffects,
    (effects, reduceMotion) => {
      const animations: Animation[] = [];
      const placed = effects.find((effect) => effect.type === "edge-placed");
      if (placed?.type === "edge-placed") {
        const horizontal = placed.edge.r1 === placed.edge.r2;
        const selector = horizontal
          ? `[data-testid="edge-h-${placed.edge.r1}-${Math.min(placed.edge.c1, placed.edge.c2)}"] > div`
          : `[data-testid="edge-v-${Math.min(placed.edge.r1, placed.edge.r2)}-${placed.edge.c1}"] > div`;
        const edge = motionRootRef.current?.querySelector<HTMLElement>(selector);
        if (edge?.animate)
          animations.push(
            edge.animate(
              reduceMotion
                ? [{ opacity: 0.65 }, { opacity: 1 }]
                : [
                    { opacity: 0.35, transform: "scale(.78)" },
                    { opacity: 1, transform: "scale(1)" },
                  ],
              { duration: reduceMotion ? 100 : 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            ),
          );
      }
      for (const effect of effects) {
        if (effect.type !== "boxes-claimed") continue;
        for (const box of effect.boxes) {
          const marker = motionRootRef.current?.querySelector<HTMLElement>(
            `[data-testid="box-${box.row}-${box.col}"] span`,
          );
          if (marker?.animate)
            animations.push(
              marker.animate(
                reduceMotion
                  ? [{ opacity: 0.65 }, { opacity: 1 }]
                  : [
                      { opacity: 0.45, transform: "scale(.9)" },
                      { opacity: 1, transform: "scale(1)" },
                    ],
                { duration: reduceMotion ? 100 : 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
              ),
            );
        }
      }
      return animations;
    },
    { enabled: motionEnabled },
  );

  // Handle direct edge tap
  const handleEdgeClick = (r1: number, c1: number, r2: number, c2: number) => {
    if (!canAct || isSubmitting || status === "completed") return;
    const canonical = canonicalizeEdge(r1, c1, r2, c2);
    if (placedEdgesMap.has(edgeKey(canonical))) return; // Already placed

    setSelectedDot(null);
    onPlaceEdge(canonical);
  };

  // Handle dot tap (alternative accessible input)
  const handleDotClick = (r: number, c: number) => {
    if (!canAct || isSubmitting || status === "completed") return;

    if (!selectedDot) {
      setSelectedDot({ r, c });
    } else {
      // If clicking same dot, deselect
      if (selectedDot.r === r && selectedDot.c === c) {
        setSelectedDot(null);
        return;
      }

      // If orthogonally adjacent, place edge
      if (isOrthogonallyAdjacent(selectedDot.r, selectedDot.c, r, c)) {
        handleEdgeClick(selectedDot.r, selectedDot.c, r, c);
      } else {
        // Change selection to new dot
        setSelectedDot({ r, c });
      }
    }
  };

  // Blank box taps choose the closest edge. Ties resolve top/bottom before left/right.
  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(boxCount, ((event.clientX - rect.left) / rect.width) * boxCount),
    );
    const y = Math.max(
      0,
      Math.min(boxCount, ((event.clientY - rect.top) / rect.height) * boxCount),
    );
    const col = Math.min(boxCount - 1, Math.floor(x));
    const row = Math.min(boxCount - 1, Math.floor(y));
    const candidates = [
      { distance: y - row, edge: [row, col, row, col + 1] },
      { distance: row + 1 - y, edge: [row + 1, col, row + 1, col + 1] },
      { distance: x - col, edge: [row, col, row + 1, col] },
      { distance: col + 1 - x, edge: [row, col + 1, row + 1, col + 1] },
    ].sort((a, b) => a.distance - b.distance);
    const [r1, c1, r2, c2] = candidates[0].edge;
    handleEdgeClick(r1, c1, r2, c2);
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
        testIdPrefix="dots"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setZoom((value) => !value)}
        aria-label={zoom ? "Reset board zoom" : "Zoom board"}
      >
        {zoom ? "Reset zoom" : "Zoom board"}
      </Button>
      {/* 2. Dots & Boxes Interactive Grid Surface */}
      <BoardViewport zoom={zoom} label="dots-boxes board">
        <Surface
          variant="card"
          padding="md"
          radius="xl"
          style={{
            width: zoom ? "max(100%, 560px)" : "100%",
            maxWidth: zoom ? "none" : "min(100%, 76vh, 760px)",
            aspectRatio: "1/1",
            position: "relative",
            backgroundColor: "var(--color-surface, #0f172a)",
            border: "2px solid var(--color-border, #334155)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: `repeat(${boxCount}, 1fr)`,
              gridTemplateRows: `repeat(${boxCount}, 1fr)`,
              gap: "0px",
            }}
            onClick={handleBoardClick}
          >
            {/* Claimed Boxes Fill */}
            {Array.from({ length: boxCount }).map((_, br) =>
              Array.from({ length: boxCount }).map((_, bc) => {
                const claimedSeat = boxes[br]?.[bc];
                return (
                  <div
                    key={`box-${br}-${bc}`}
                    data-testid={`box-${br}-${bc}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: claimedSeat
                        ? claimedSeat === "A"
                          ? "rgba(16, 185, 129, 0.25)"
                          : "rgba(168, 85, 247, 0.25)"
                        : "transparent",
                      transition: "background-color 300ms ease",
                      position: "relative",
                    }}
                  >
                    {claimedSeat && (
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: 900,
                          color:
                            claimedSeat === "A"
                              ? "var(--player-a-accent, #10b981)"
                              : "var(--player-b-accent, #a855f7)",
                        }}
                      >
                        {claimedSeat}
                      </span>
                    )}
                  </div>
                );
              }),
            )}

            {/* Horizontal Edges */}
            {Array.from({ length: dotCount }).map((_, r) =>
              Array.from({ length: boxCount }).map((_, c) => {
                const key = `${r},${c}-${r},${c + 1}`;
                const claimedBy = placedEdgesMap.get(key);
                const isPlaced = claimedBy !== undefined;

                // Top percentage: r * step%, Left percentage: c * step%
                const top = `${r * step}%`;
                const left = `${c * step}%`;

                return (
                  <button
                    key={`h-${r}-${c}`}
                    data-testid={`edge-h-${r}-${c}`}
                    aria-label={`Horizontal edge (${r},${c}) to (${r},${c + 1})${
                      isPlaced ? ` claimed by ${claimedBy}` : ""
                    }`}
                    disabled={isPlaced || !canAct || isSubmitting}
                    onClick={() => handleEdgeClick(r, c, r, c + 1)}
                    style={{
                      position: "absolute",
                      top,
                      left,
                      width: `${step}%`,
                      height: "28px",
                      transform: "translateY(-50%)",
                      backgroundColor: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: isPlaced ? "default" : canAct ? "pointer" : "not-allowed",
                      zIndex: 5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "calc(100% - 12px)",
                        height: isPlaced ? "6px" : "3px",
                        borderRadius: "3px",
                        backgroundColor: isPlaced
                          ? claimedBy === "A"
                            ? "var(--player-a-accent, #10b981)"
                            : "var(--player-b-accent, #a855f7)"
                          : "var(--color-interactive-line, #898993)",
                        boxShadow: isPlaced
                          ? `0 0 6px ${claimedBy === "A" ? "#10b981" : "#a855f7"}`
                          : "none",
                      }}
                    />
                  </button>
                );
              }),
            )}

            {/* Vertical Edges */}
            {Array.from({ length: boxCount }).map((_, r) =>
              Array.from({ length: dotCount }).map((_, c) => {
                const key = `${r},${c}-${r + 1},${c}`;
                const claimedBy = placedEdgesMap.get(key);
                const isPlaced = claimedBy !== undefined;

                const top = `${r * step}%`;
                const left = `${c * step}%`;

                return (
                  <button
                    key={`v-${r}-${c}`}
                    data-testid={`edge-v-${r}-${c}`}
                    aria-label={`Vertical edge (${r},${c}) to (${r + 1},${c})${
                      isPlaced ? ` claimed by ${claimedBy}` : ""
                    }`}
                    disabled={isPlaced || !canAct || isSubmitting}
                    onClick={() => handleEdgeClick(r, c, r + 1, c)}
                    style={{
                      position: "absolute",
                      top,
                      left,
                      width: "28px",
                      height: `${step}%`,
                      transform: "translateX(-50%)",
                      backgroundColor: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: isPlaced ? "default" : canAct ? "pointer" : "not-allowed",
                      zIndex: 5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        height: "calc(100% - 12px)",
                        width: isPlaced ? "6px" : "3px",
                        borderRadius: "3px",
                        backgroundColor: isPlaced
                          ? claimedBy === "A"
                            ? "var(--player-a-accent, #10b981)"
                            : "var(--player-b-accent, #a855f7)"
                          : "var(--color-interactive-line, #898993)",
                        boxShadow: isPlaced
                          ? `0 0 6px ${claimedBy === "A" ? "#10b981" : "#a855f7"}`
                          : "none",
                      }}
                    />
                  </button>
                );
              }),
            )}

            {/* 5x5 Dots */}
            {Array.from({ length: dotCount }).map((_, r) =>
              Array.from({ length: dotCount }).map((_, c) => {
                const isSelected = selectedDot?.r === r && selectedDot?.c === c;
                const top = `${r * step}%`;
                const left = `${c * step}%`;

                return (
                  <button
                    key={`dot-${r}-${c}`}
                    data-testid={`dot-${r}-${c}`}
                    aria-label={`Dot (${r}, ${c})${isSelected ? " selected" : ""}`}
                    onClick={() => handleDotClick(r, c)}
                    disabled={!canAct || isSubmitting}
                    style={{
                      position: "absolute",
                      top,
                      left,
                      transform: "translate(-50%, -50%)",
                      width: "28px",
                      height: "28px",
                      backgroundColor: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: canAct ? "pointer" : "default",
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: isSelected ? "14px" : "10px",
                        height: isSelected ? "14px" : "10px",
                        borderRadius: "50%",
                        backgroundColor: isSelected
                          ? "var(--color-focus, #38bdf8)"
                          : "var(--color-text, #ffffff)",
                        border: isSelected ? "2px solid #ffffff" : "1px solid rgba(0,0,0,0.5)",
                        boxShadow: isSelected
                          ? "0 0 10px #38bdf8, 0 0 4px #ffffff"
                          : "0 1px 3px rgba(0,0,0,0.5)",
                        transition: "all 150ms ease",
                      }}
                    />
                  </button>
                );
              }),
            )}
          </div>
        </Surface>
      </BoardViewport>

      <details style={{ width: "100%" }}>
        <summary>Choose dots by row and column</summary>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}
        >
          <label>
            Row{" "}
            <select
              value={coordinateRow}
              onChange={(event) => setCoordinateRow(Number(event.target.value))}
            >
              {Array.from({ length: dotCount }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Column{" "}
            <select
              value={coordinateCol}
              onChange={(event) => setCoordinateCol(Number(event.target.value))}
            >
              {Array.from({ length: dotCount }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!canAct || isSubmitting}
            onClick={() => handleDotClick(coordinateRow, coordinateCol)}
          >
            Choose dot
          </button>
          {selectedDot && (
            <span>
              First dot: row {selectedDot.r + 1}, column {selectedDot.c + 1}
            </span>
          )}
        </div>
      </details>

      {/* 3. Instructions & Hint Strip */}
      <div
        style={{
          fontSize: "12px",
          color: "var(--color-muted-text)",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <Sparkles size={14} color="var(--color-emphasis-yellow-ink, #f59e0b)" />
        <span>Tap an edge directly, or tap two adjacent dots to connect them.</span>
      </div>
    </div>
  );
};
