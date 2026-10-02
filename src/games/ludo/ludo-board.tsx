/**
 * Private Arcade V1 — Ludo Board Component
 *
 * Server-authoritative visual representation of the 15x15 Ludo board.
 * Renders the 52-cell outer ring, player yards, safe squares, home lanes,
 * center goal, animated tokens, and tactile roll/token selection controls.
 */

import React, { useMemo, useRef } from "react";
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
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const colourA = seatColours?.A ?? LUDO_COLOUR_PALETTE[view.colours?.A ?? "blue"];
  const colourB = seatColours?.B ?? LUDO_COLOUR_PALETTE[view.colours?.B ?? "green"];
  const { tokens, activeSeat, phase, pendingRoll, legalTokenIds, consecutiveSixes, status } = view;

  useAcceptedMotion(acceptedEventId, acceptedEffects, (effects, reduceMotion) => {
    const board = boardRef.current;
    if (!board) return [];
    const cell = board.getBoundingClientRect().width / LUDO_BOARD_SIZE;
    const animations: Animation[] = [];
    for (const effect of effects) {
      if (effect.type === "dice-rolled") {
        const die = rootRef.current?.querySelector<HTMLElement>("[data-ludo-die]");
        if (die && !reduceMotion)
          animations.push(
            die.animate(
              [{ transform: "rotate(-12deg) scale(.94)" }, { transform: "rotate(0) scale(1)" }],
              { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
            ),
          );
      }
      if (effect.type !== "token-moved" || reduceMotion) continue;
      const token = board.querySelector<HTMLElement>(
        `[data-testid="ludo-token-${effect.seat}-${effect.tokenId}"]`,
      );
      const target = getBoardCoordinate(effect.seat, effect.to);
      const yard = YARD_CELLS[effect.seat][effect.tokenId];
      const endpoint = target ?? yard;
      if (!token) continue;
      const points: Array<readonly [number, number]> = [];
      for (let progress = effect.from; progress <= effect.to; progress++) {
        const coord = getBoardCoordinate(effect.seat, progress) ?? yard;
        points.push(coord);
      }
      if (points.length < 2) continue;
      animations.push(
        token.animate(
          points.map(([row, col], index) => ({
            transform: `translate(${(col - endpoint[1]) * cell}px, ${(row - endpoint[0]) * cell}px)`,
            offset: index / (points.length - 1),
          })),
          { duration: 280, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
        ),
      );
    }
    return animations;
  });

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
                  {cellTokens.map((tok) => {
                    const isLegal =
                      tok.seat === activeSeat &&
                      phase === "choose-token" &&
                      legalTokenIds.includes(tok.tokenId);

                    const tokenColor = tok.seat === "A" ? colourA : colourB;

                    return (
                      <button
                        key={`${tok.seat}-${tok.tokenId}`}
                        data-testid={`ludo-token-${tok.seat}-${tok.tokenId}`}
                        disabled={!isLegal || !canAct || isSubmitting}
                        onClick={() => isLegal && onSelectToken(tok.tokenId)}
                        aria-label={`Player ${tok.seat} Token ${tok.tokenId + 1}${
                          isLegal ? " (Click to move)" : ""
                        }`}
                        style={{
                          width: cellTokens.length > 1 ? "75%" : "85%",
                          height: cellTokens.length > 1 ? "75%" : "85%",
                          borderRadius: "50%",
                          backgroundColor: tokenColor,
                          border: isLegal ? "2px solid #ffffff" : "1px solid rgba(0,0,0,0.4)",
                          boxShadow: isLegal
                            ? "0 0 8px #ffffff, 0 2px 4px rgba(0,0,0,0.5)"
                            : "0 1px 3px rgba(0,0,0,0.4)",
                          cursor: isLegal ? "pointer" : "default",
                          transform: isLegal ? "scale(1.15)" : "scale(1)",
                          transition: "transform 200ms ease, box-shadow 200ms ease",
                          zIndex: isLegal ? 10 : 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          fontSize: "8px",
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
          data-ludo-die
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
                  <span style={{ color: "var(--color-emphasis-yellow-ink, #f59e0b)" }}>
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
              disabled={phase !== "roll" || !canAct || isSubmitting}
              onClick={onRoll}
              data-testid="ludo-roll-button"
              leftIcon={<Dices size={18} />}
            >
              Roll Dice
            </Button>
          )}
        </div>

        {/* 3. Token Selector Buttons (for accessible direct tap) */}
        {phase === "choose-token" && status !== "completed" && (
          <div style={{ width: "100%", marginTop: "6px" }}>
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
                      : `Prog: ${progress}`;

                return (
                  <Button
                    key={tokenId}
                    variant={isLegal ? "primary" : "secondary"}
                    size="sm"
                    disabled={!isLegal || !canAct || isSubmitting}
                    onClick={() => onSelectToken(tokenId)}
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
    </div>
  );
};
