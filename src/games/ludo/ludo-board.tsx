/**
 * Private Arcade V1 — Ludo Board Component
 *
 * Server-authoritative visual representation of the 15x15 Ludo board.
 * Renders the 52-cell outer ring, player yards, safe squares, home lanes,
 * center goal, animated tokens, and tactile roll/token selection controls.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Seat } from "../../../shared/protocol/types";
import {
  LUDO_BOARD_SIZE,
  LUDO_RING_COORDINATES,
  LUDO_HOME_COORDINATES,
  LUDO_SAFE_SQUARES_SET,
  LUDO_START_SQUARES,
  LUDO_HOME_PROGRESS,
  LUDO_YARD_PROGRESS,
  LUDO_HOUSES,
  LUDO_DECORATIVE_LANES,
  LUDO_ENTRY_ARROWS,
  LUDO_COLOUR_PALETTE,
  type LudoView,
  type LudoEffect,
} from "../../../shared/games/ludo/types";
import { getBoardCoordinate } from "../../../shared/games/ludo/engine";
import { useAcceptedMotion } from "../../components/accepted-motion";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Dices, Shield, Sparkles } from "lucide-react";

interface LudoBoardProps {
  view: LudoView;
  canAct: boolean;
  onRoll: () => void;
  onSelectToken: (tokenId: number) => void;
  playerAName: string;
  playerBName: string;
  isSubmitting?: boolean;
  seatColours?: { A?: string; B?: string };
  acceptedEventId?: string | number | null;
  acceptedEffects?: readonly LudoEffect[];
  motionEnabled?: boolean;
}

// 4 Yard cell positions for each seat
const YARD_CELLS: Record<Seat, readonly [number, number][]> = {
  A: [
    [2, 2],
    [2, 4],
    [4, 2],
    [4, 4],
  ],
  B: [
    [11, 11],
    [11, 13],
    [13, 11],
    [13, 13],
  ],
};

function stackSlot(index: number, count: number): { x: number; y: number; size: number } {
  if (count === 1) return { x: 50, y: 50, size: 82 };
  if (count === 2) return { x: index === 0 ? 32 : 68, y: 50, size: 62 };
  if (count === 3)
    return [
      { x: 35, y: 35, size: 46 },
      { x: 65, y: 35, size: 46 },
      { x: 50, y: 65, size: 46 },
    ][index];
  if (count === 4)
    return [
      { x: 35, y: 35, size: 46 },
      { x: 65, y: 35, size: 46 },
      { x: 35, y: 65, size: 46 },
      { x: 65, y: 65, size: 46 },
    ][index];
  return { x: 17 + (index % 3) * 33, y: 17 + Math.floor(index / 3) * 33, size: 34 };
}

export const LudoBoard: React.FC<LudoBoardProps> = ({
  view,
  canAct,
  onRoll,
  onSelectToken,
  playerAName,
  playerBName,
  isSubmitting = false,
  seatColours,
  acceptedEventId,
  acceptedEffects,
  motionEnabled = true,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeAnimations = useRef<Animation[]>([]);
  const mounted = useRef(true);
  const [isTraveling, setIsTraveling] = useState(false);
  const colourA = seatColours?.A ?? LUDO_COLOUR_PALETTE[view.colours?.A ?? "blue"];
  const colourB = seatColours?.B ?? LUDO_COLOUR_PALETTE[view.colours?.B ?? "green"];
  const { tokens, activeSeat, phase, pendingRoll, legalTokenIds, consecutiveSixes, status } = view;
  const eventFeedback = useMemo(() => {
    if (acceptedEventId == null || !acceptedEffects?.length) return "";
    const messages = acceptedEffects
      .map((effect) => {
        if (effect.type === "dice-rolled") {
          const playerName = effect.seat === "A" ? playerAName : playerBName;
          return effect.ignored
            ? `${playerName} rolled ${effect.roll}. The third or later six was ignored; roll again, and earlier moves still count.`
            : `${playerName} rolled ${effect.roll}.`;
        }
        if (effect.type === "token-moved")
          return `Player ${effect.seat} moved Token ${effect.tokenId + 1}.`;
        if (effect.type === "token-captured")
          return `Player ${effect.bySeat} captured Player ${effect.capturedSeat} Token ${effect.capturedTokenId + 1}.`;
        if (effect.type === "token-entered-home")
          return `Player ${effect.seat} Token ${effect.tokenId + 1} reached home.`;
        if (effect.type === "turn-changed") return `Player ${effect.nextSeat} moves next.`;
        if (effect.type === "game-won") return `Player ${effect.winner} wins the match.`;
        return "";
      })
      .filter(Boolean);
    const movedToken = acceptedEffects.find((effect) => effect.type === "token-moved");
    if (
      movedToken?.type === "token-moved" &&
      view.status === "active" &&
      view.phase === "roll" &&
      view.activeSeat === movedToken.seat
    )
      messages.push("Bonus roll earned. Roll again.");
    const noMoveRoll = acceptedEffects.find((effect) => effect.type === "dice-rolled");
    if (noMoveRoll?.type === "dice-rolled" && view.lastRollNotice === "no-legal-move")
      messages.push(
        view.activeSeat === noMoveRoll.seat
          ? "No pawn could move. Roll again."
          : "No pawn could move.",
      );
    return messages.join(" ");
  }, [
    acceptedEventId,
    acceptedEffects,
    view.activeSeat,
    view.lastRollNotice,
    view.phase,
    view.status,
    playerAName,
    playerBName,
  ]);

  const settleTravel = useCallback(() => {
    activeAnimations.current.forEach((animation) => animation.cancel());
    activeAnimations.current = [];
    setIsTraveling(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeAnimations.current.forEach((animation) => animation.cancel());
      activeAnimations.current = [];
    };
  }, []);

  useEffect(() => {
    if ((acceptedEventId == null || !motionEnabled) && isTraveling) settleTravel();
  }, [acceptedEventId, isTraveling, motionEnabled, settleTravel]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const settleOnInterruption = () => settleTravel();
    const settleWhenHidden = () => {
      if (document.visibilityState !== "visible") settleTravel();
    };
    const settleOnReducedMotion = () => settleTravel();
    window.addEventListener("blur", settleOnInterruption);
    window.addEventListener("offline", settleOnInterruption);
    window.addEventListener("online", settleOnInterruption);
    window.addEventListener("pagehide", settleOnInterruption);
    document.addEventListener("visibilitychange", settleWhenHidden);
    media?.addEventListener?.("change", settleOnReducedMotion);
    return () => {
      window.removeEventListener("blur", settleOnInterruption);
      window.removeEventListener("offline", settleOnInterruption);
      window.removeEventListener("online", settleOnInterruption);
      window.removeEventListener("pagehide", settleOnInterruption);
      document.removeEventListener("visibilitychange", settleWhenHidden);
      media?.removeEventListener?.("change", settleOnReducedMotion);
    };
  }, [settleTravel]);

  useAcceptedMotion(
    acceptedEventId,
    acceptedEffects,
    (effects, reduceMotion) => {
      settleTravel();
      const board = boardRef.current;
      if (!board) return [];
      const cell = board.getBoundingClientRect().width / LUDO_BOARD_SIZE;
      const animations: Animation[] = [];
      const travelAnimations: Animation[] = [];
      let acceptedMoveDuration = 0;
      const captureInMove = effects.some((effect) => effect.type === "token-captured");
      for (const effect of effects) {
        if (effect.type === "dice-rolled") {
          const die = rootRef.current?.querySelector<HTMLElement>("[data-ludo-die]");
          if (die && !reduceMotion && typeof die.animate === "function")
            animations.push(
              die.animate(
                [{ transform: "rotate(-10deg) scale(.96)" }, { transform: "rotate(0) scale(1)" }],
                { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
              ),
            );
        }
        if (reduceMotion) continue;
        if (effect.type === "token-moved") {
          const token = board.querySelector<HTMLElement>(
            `[data-testid="ludo-token-${effect.seat}-${effect.tokenId}"]`,
          );
          const endpoint = getBoardCoordinate(effect.seat, effect.to);
          const yard = YARD_CELLS[effect.seat][effect.tokenId];
          const destination = endpoint ?? yard;
          if (!token) continue;
          const slot = stackSlot(
            Number(token.dataset.stackIndex ?? 0),
            Number(token.dataset.stackSize ?? 1),
          );
          const stackOffsetX = (slot.x / 100 - 0.5) * cell;
          const stackOffsetY = (slot.y / 100 - 0.5) * cell;
          const points: Array<readonly [number, number]> = [];
          for (let progress = effect.from; progress <= effect.to; progress++) {
            points.push(getBoardCoordinate(effect.seat, progress) ?? yard);
          }
          if (points.length < 2) continue;
          const keyframes = points.map(([row, col], index) => ({
            transform: `translate(${(col - destination[1]) * cell - stackOffsetX}px, ${(row - destination[0]) * cell - stackOffsetY}px) translate(-50%, -50%)`,
            offset: index / (points.length - 1),
          }));
          keyframes[keyframes.length - 1] = {
            transform: "translate(0, 0) translate(-50%, -50%)",
            offset: 1,
          };
          if (typeof token.animate === "function") {
            acceptedMoveDuration = Math.min(
              captureInMove ? 960 : 1200,
              Math.max(180, (effect.to - Math.max(effect.from, 0) + 1) * 120),
            );
            const animation = token.animate(keyframes, {
              duration: acceptedMoveDuration,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            });
            animations.push(animation);
            travelAnimations.push(animation);
          }
        }
        if (effect.type === "token-captured") {
          const captured = board.querySelector<HTMLElement>(
            `[data-testid="ludo-token-${effect.capturedSeat}-${effect.capturedTokenId}"]`,
          );
          if (!captured) continue;
          const from = LUDO_RING_COORDINATES[effect.ringIndex];
          const yard = YARD_CELLS[effect.capturedSeat][effect.capturedTokenId];
          if (typeof captured.animate === "function") {
            const animation = captured.animate(
              [
                {
                  transform: `translate(${(from[1] - yard[1]) * cell}px, ${(from[0] - yard[0]) * cell}px) translate(-50%, -50%)`,
                },
                { transform: "translate(0, 0) translate(-50%, -50%)" },
              ],
              {
                duration: 240,
                delay: acceptedMoveDuration,
                fill: "backwards",
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              },
            );
            animations.push(animation);
            travelAnimations.push(animation);
          }
        }
        if (effect.type === "game-won") {
          const goal = board.querySelector<HTMLElement>("[data-ludo-goal]");
          if (goal && typeof goal.animate === "function")
            animations.push(
              goal.animate(
                [
                  { opacity: 0.65, transform: "scale(.96)" },
                  { opacity: 1, transform: "scale(1.04)" },
                  { opacity: 1, transform: "scale(1)" },
                ],
                { duration: 680, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
              ),
            );
        }
      }
      activeAnimations.current = animations;
      if (travelAnimations.length > 0) {
        setIsTraveling(true);
        Promise.allSettled(travelAnimations.map((animation) => animation.finished)).then(() => {
          if (
            mounted.current &&
            travelAnimations.every((animation) => animation.playState === "finished")
          )
            setIsTraveling(false);
        });
      }
      return animations;
    },
    { enabled: motionEnabled },
  );

  // Map each token to its current board coordinates [row, col]
  const tokenCoordinates = useMemo(() => {
    const coords: Array<{
      seat: Seat;
      tokenId: number;
      row: number;
      col: number;
      isHome: boolean;
      inYard: boolean;
    }> = [];

    (["A", "B"] as Seat[]).forEach((seat) => {
      const seatTokens = tokens[seat];
      seatTokens.forEach((progress, tokenId) => {
        if (progress === LUDO_YARD_PROGRESS) {
          const [row, col] = YARD_CELLS[seat][tokenId];
          coords.push({ seat, tokenId, row, col, isHome: false, inYard: true });
        } else if (progress >= 0 && progress <= 50) {
          const ringIndex = seat === "A" ? progress : (progress + 26) % 52;
          const [row, col] = LUDO_RING_COORDINATES[ringIndex];
          coords.push({ seat, tokenId, row, col, isHome: false, inYard: false });
        } else if (progress >= 51 && progress <= LUDO_HOME_PROGRESS) {
          const homeIndex = Math.min(progress - 51, 5);
          const [row, col] = LUDO_HOME_COORDINATES[seat][homeIndex];
          coords.push({
            seat,
            tokenId,
            row,
            col,
            isHome: progress === LUDO_HOME_PROGRESS,
            inYard: false,
          });
        }
      });
    });

    return coords;
  }, [tokens]);

  // Index tokens by cell coordinate string "row,col"
  const tokensByCell = useMemo(() => {
    const map = new Map<string, typeof tokenCoordinates>();
    for (const t of tokenCoordinates) {
      const key = `${t.row},${t.col}`;
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    map.forEach((cellTokens) =>
      cellTokens.sort((left, right) =>
        left.seat === right.seat ? left.tokenId - right.tokenId : left.seat === "A" ? -1 : 1,
      ),
    );
    return map;
  }, [tokenCoordinates]);

  // Map ring coordinates to ring indices
  const ringIndexByCoord = useMemo(() => {
    const map = new Map<string, number>();
    LUDO_RING_COORDINATES.forEach(([r, c], idx) => {
      map.set(`${r},${c}`, idx);
    });
    return map;
  }, []);

  // Keep large mixed stacks understandable when their numbered board markers
  // become too small to distinguish on a phone. The selector below remains
  // the direct, full-size way to choose a pawn.
  const largeStackSummaries = useMemo(() => {
    return Array.from(tokensByCell.entries())
      .filter(([, cellTokens]) => cellTokens.length > 4)
      .map(([coord, cellTokens]) => {
        const [row, col] = coord.split(",").map(Number);
        const ringIndex = ringIndexByCoord.get(coord);
        const counts = cellTokens.reduce(
          (result, token) => {
            result[token.seat] += 1;
            return result;
          },
          { A: 0, B: 0 },
        );
        return {
          key: coord,
          location:
            ringIndex === undefined
              ? `board square ${row + 1}, ${col + 1}`
              : `ring square ${ringIndex + 1}`,
          counts,
          total: cellTokens.length,
        };
      });
  }, [ringIndexByCoord, tokensByCell]);

  // Home lane lookup
  const isHomeLaneA = useMemo(() => {
    const set = new Set<string>();
    LUDO_HOME_COORDINATES.A.forEach(([r, c]) => set.add(`${r},${c}`));
    return set;
  }, []);

  const isHomeLaneB = useMemo(() => {
    const set = new Set<string>();
    LUDO_HOME_COORDINATES.B.forEach(([r, c]) => set.add(`${r},${c}`));
    return set;
  }, []);

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
        data-ludo-die
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

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-md, 16px)",
        width: "100%",
        maxWidth: "min(100%, 680px)",
      }}
    >
      {/* 1. Ludo 15x15 Grid Board */}
      <Surface
        variant="card"
        padding="sm"
        radius="xl"
        style={{
          width: "100%",
          aspectRatio: "1/1",
          position: "relative",
          backgroundColor: "var(--color-surface, #0f172a)",
          border: "2px solid var(--color-border, #334155)",
          overflow: "hidden",
        }}
      >
        <div
          ref={boardRef}
          data-testid="ludo-board-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${LUDO_BOARD_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${LUDO_BOARD_SIZE}, 1fr)`,
            width: "100%",
            height: "100%",
            gap: "0",
            backgroundColor: "#fff",
          }}
        >
          {Array.from({ length: LUDO_BOARD_SIZE }).map((_, r) =>
            Array.from({ length: LUDO_BOARD_SIZE }).map((_, c) => {
              const coordKey = `${r},${c}`;
              const ringIdx = ringIndexByCoord.get(coordKey);
              const isSafe = ringIdx !== undefined && LUDO_SAFE_SQUARES_SET.has(ringIdx);
              const isStartA = ringIdx === LUDO_START_SQUARES.A;
              const isStartB = ringIdx === LUDO_START_SQUARES.B;
              const inHomeA = isHomeLaneA.has(coordKey);
              const inHomeB = isHomeLaneB.has(coordKey);

              // Large Yard zones: top-left (0..5, 0..5) is Yard A; bottom-right (9..14, 9..14) is Yard B
              const isYardA = r < 6 && c < 6;
              const isYardB = r >= 9 && c >= 9;
              const isYardYellow = r < 6 && c >= 9;
              const isYardRed = r >= 9 && c < 6;
              const isLaneYellow = LUDO_DECORATIVE_LANES.top.some(
                ([row, col]) => row === r && col === c,
              );
              const isLaneRed = LUDO_DECORATIVE_LANES.bottom.some(
                ([row, col]) => row === r && col === c,
              );
              const entryArrow = LUDO_ENTRY_ARROWS.find(
                (arrow) => arrow.row === r && arrow.col === c,
              );
              const isCenterGoal = r >= 6 && r <= 8 && c >= 6 && c <= 8;

              // Cell tokens
              const cellTokens = tokensByCell.get(coordKey) || [];

              // Background styling
              let cellBg = "#fff";
              if (isYardA) cellBg = colourA;
              if (isYardB) cellBg = colourB;
              if (isYardYellow) cellBg = LUDO_HOUSES.topRight.colour;
              if (isYardRed) cellBg = LUDO_HOUSES.bottomLeft.colour;
              const yardRow = r >= 9 ? r - 9 : r;
              const yardCol = c >= 9 ? c - 9 : c;
              const isYard = isYardA || isYardB || isYardYellow || isYardRed;
              if (isYard && yardRow >= 1 && yardRow <= 4 && yardCol >= 1 && yardCol <= 4)
                cellBg = "#fff";
              if (inHomeA || isStartA) cellBg = colourA;
              if (inHomeB || isStartB) cellBg = colourB;
              if (isLaneYellow) cellBg = LUDO_HOUSES.topRight.colour;
              if (isLaneRed) cellBg = LUDO_HOUSES.bottomLeft.colour;
              if (isCenterGoal) cellBg = "#fff";

              return (
                <div
                  key={coordKey}
                  data-testid={`cell-${r}-${c}`}
                  style={{
                    backgroundColor: cellBg,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "1px",
                    border: isYard ? "none" : "1px solid rgba(28, 38, 44, .22)",
                  }}
                >
                  {r === 6 && c === 6 && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "300%",
                        height: "300%",
                        zIndex: 1,
                        pointerEvents: "none",
                        background: `conic-gradient(from 45deg, ${colourB} 0deg 90deg, ${LUDO_HOUSES.bottomLeft.colour} 90deg 180deg, ${colourA} 180deg 270deg, ${LUDO_HOUSES.topRight.colour} 270deg 360deg)`,
                      }}
                    />
                  )}
                  {r === 7 && c === 7 && (
                    <span
                      data-ludo-goal="true"
                      data-testid="ludo-center-goal"
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        color: "var(--color-primary, #38bdf8)",
                        opacity: 0.72,
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    >
                      <Sparkles size={22} />
                    </span>
                  )}
                  {entryArrow && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        zIndex: 1,
                        color:
                          entryArrow.seat === "A"
                            ? colourA
                            : entryArrow.seat === "B"
                              ? colourB
                              : LUDO_HOUSES[entryArrow.seat].colour,
                        fontSize: "clamp(8px, 2vw, 18px)",
                        fontWeight: 800,
                      }}
                    >
                      {entryArrow.direction}
                    </span>
                  )}
                  {(isYardA || isYardB || isYardYellow || isYardRed) &&
                    r % 9 >= 1 &&
                    r % 9 <= 4 &&
                    c % 9 >= 1 &&
                    c % 9 <= 4 && (
                      <span
                        aria-hidden="true"
                        style={{ position: "absolute", inset: 0, background: "#fff" }}
                      />
                    )}
                  {(isYardA || isYardB || isYardYellow || isYardRed) &&
                    [2, 4].includes(r % 9) &&
                    [2, 4].includes(c % 9) && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          width: "74%",
                          aspectRatio: "1",
                          borderRadius: "50%",
                          background: isYardA
                            ? colourA
                            : isYardB
                              ? colourB
                              : isYardYellow
                                ? LUDO_HOUSES.topRight.colour
                                : LUDO_HOUSES.bottomLeft.colour,
                          boxShadow: "inset 0 1px 3px rgba(0,0,0,.3)",
                          zIndex: 1,
                        }}
                      />
                    )}
                  {/* Safe star / shield marker */}
                  {isSafe && !isCenterGoal && (
                    <Shield
                      size={14}
                      color="var(--color-primary, #38bdf8)"
                      style={{ opacity: 0.6, position: "absolute" }}
                    />
                  )}

                  {/* Center trophy */}
                  {/* Tokens on this cell */}
                  {cellTokens.length > 0 && (
                    <div
                      data-ludo-stack={`${r}-${c}`}
                      data-stack-size={cellTokens.length}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 3,
                        pointerEvents: "none",
                      }}
                    >
                      {cellTokens.map((tok, stackIndex) => {
                        const slot = stackSlot(stackIndex, cellTokens.length);
                        const isLegal =
                          tok.seat === activeSeat &&
                          phase === "choose-token" &&
                          legalTokenIds.includes(tok.tokenId);

                        const tokenColor = tok.seat === "A" ? colourA : colourB;

                        return (
                          <button
                            key={`${tok.seat}-${tok.tokenId}`}
                            data-testid={`ludo-token-${tok.seat}-${tok.tokenId}`}
                            disabled={!isLegal || !canAct || isSubmitting || isTraveling}
                            onClick={() => isLegal && !isTraveling && onSelectToken(tok.tokenId)}
                            aria-label={`Player ${tok.seat} Token ${tok.tokenId + 1}${
                              isLegal ? " (Select to move)" : ""
                            }`}
                            data-stack-index={stackIndex}
                            data-stack-size={cellTokens.length}
                            data-stack-x={slot.x}
                            data-stack-y={slot.y}
                            style={{
                              position: "absolute",
                              left: `${slot.x}%`,
                              top: `${slot.y}%`,
                              width: `${slot.size}%`,
                              height: `${slot.size}%`,
                              minHeight: 0,
                              aspectRatio: "1",
                              transform: "translate(-50%, -50%)",
                              boxSizing: "border-box",
                              borderRadius: "50%",
                              background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,.55), transparent 36%), linear-gradient(145deg, ${tokenColor}, color-mix(in srgb, ${tokenColor} 68%, #101820))`,
                              border: isLegal ? "1px solid #ffffff" : "1px solid rgba(0,0,0,0.55)",
                              boxShadow: isLegal
                                ? "0 0 0 1px rgba(255,255,255,.55), 0 1px 3px rgba(0,0,0,.55)"
                                : "inset 0 -1px 1px rgba(0,0,0,.25), 0 1px 2px rgba(0,0,0,.45)",
                              cursor: isLegal ? "pointer" : "default",
                              transition: "box-shadow 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                              zIndex: isLegal ? 5 : 2,
                              pointerEvents: "auto",
                              touchAction: "manipulation",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                              padding: 0,
                              fontSize:
                                cellTokens.length === 1
                                  ? "clamp(9px, 2vw, 14px)"
                                  : cellTokens.length === 2
                                    ? "clamp(8px, 1.9vw, 12px)"
                                    : cellTokens.length <= 4
                                      ? "clamp(7px, 1.7vw, 11px)"
                                      : "clamp(6px, 1.5vw, 10px)",
                              fontWeight: 800,
                              color:
                                (tok.seat === "A" ? view.colours?.A : view.colours?.B) === "yellow"
                                  ? "#1a2927"
                                  : "#ffffff",
                            }}
                          >
                            {tok.tokenId + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </Surface>

      {/* 2. Interactive Dice and Control Strip */}
      <Surface
        variant="card"
        padding="md"
        radius="lg"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm, 12px)",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Active Roll / Streak Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {pendingRoll ? (
              renderDieFace(pendingRoll)
            ) : (
              <div
                data-ludo-die
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

            <div>
              <div style={{ fontSize: "14px", fontWeight: 700 }}>
                {status === "completed"
                  ? "Match Finished"
                  : phase === "roll"
                    ? `${activeSeat === "A" ? playerAName : playerBName}'s Turn to Roll`
                    : `Rolled ${pendingRoll}! Select a token to move.`}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-muted-text, #94a3b8)" }}>
                {consecutiveSixes > 0 && consecutiveSixes < 2 && (
                  <span style={{ color: "var(--color-text, #F5F5F7)" }}>
                    <Sparkles size={12} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                    Bonus roll earned!
                  </span>
                )}
                {consecutiveSixes >= 2 && (
                  <span style={{ color: "var(--color-danger, #ef4444)" }}>
                    Third six ignored rule in effect!
                  </span>
                )}
                {consecutiveSixes === 0 &&
                  (phase === "roll"
                    ? "Roll a 6 to enter yard tokens"
                    : "Tap token on board or below")}
                {phase === "roll" && view.lastRollNotice === "no-legal-move" && (
                  <span role="status">
                    {" "}
                    No legal pawn could move. The turn passed unless you rolled a six.
                  </span>
                )}
                {phase === "roll" && view.lastRollNotice === "ignored-six" && (
                  <span role="status">
                    {" "}
                    Third or later six ignored. Roll again; earlier moves still count.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Roll Button */}
          {status !== "completed" && (
            <Button
              variant="primary"
              size="md"
              disabled={phase !== "roll" || !canAct || isSubmitting || isTraveling}
              onClick={onRoll}
              data-testid="ludo-roll-button"
              leftIcon={<Dices size={18} />}
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              Roll Dice
            </Button>
          )}
        </div>

        {isTraveling && (
          <Button
            variant="secondary"
            size="sm"
            onClick={settleTravel}
            data-testid="ludo-settle-button"
          >
            Settle movement
          </Button>
        )}

        {/* 3. Token Selector Buttons (for accessible direct tap) */}
        {phase === "choose-token" && status !== "completed" && (
          <div style={{ width: "100%", marginTop: "6px" }}>
            {largeStackSummaries.map((stack) => (
              <div
                key={stack.key}
                data-testid="ludo-large-stack-summary"
                role="status"
                style={{
                  marginBottom: "8px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "var(--color-surface-raised, rgba(148,163,184,.12))",
                  color: "var(--color-text, inherit)",
                  fontSize: "13px",
                  lineHeight: 1.4,
                }}
              >
                <strong>
                  Shared stack · {stack.location} · {stack.total} pawns
                </strong>
                <div>
                  {playerAName}: {stack.counts.A} pawns · {playerBName}: {stack.counts.B} pawns
                </div>
                <div>Choose by the numbered, named token controls below.</div>
              </div>
            ))}
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-muted-text)",
                marginBottom: "6px",
              }}
            >
              Choose Token to Move ({pendingRoll} steps):
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                width: "100%",
              }}
            >
              {[0, 1, 2, 3].map((tokenId) => {
                const isLegal = legalTokenIds.includes(tokenId);
                const progress = tokens[activeSeat][tokenId];
                const locationLabel =
                  progress === LUDO_YARD_PROGRESS
                    ? "In Yard"
                    : progress === LUDO_HOME_PROGRESS
                      ? "Home"
                      : progress >= 51
                        ? `Home lane · ${LUDO_HOME_PROGRESS - progress} to home`
                        : "On track";

                return (
                  <Button
                    key={tokenId}
                    variant={isLegal ? "primary" : "secondary"}
                    size="sm"
                    disabled={!isLegal || !canAct || isSubmitting || isTraveling}
                    onClick={() => !isTraveling && onSelectToken(tokenId)}
                    data-testid={`ludo-token-button-${tokenId}`}
                    style={{
                      flexDirection: "column",
                      padding: "8px 4px",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>Token {tokenId + 1}</span>
                    <span style={{ fontSize: "10px", opacity: 0.8 }}>{locationLabel}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Surface>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="ludo-motion-feedback"
        style={{ minHeight: "1.25em", width: "100%", fontSize: "14px" }}
      >
        {eventFeedback}
      </div>
    </div>
  );
};
