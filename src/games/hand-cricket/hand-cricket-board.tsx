/**
 * Private Arcade V1 — Hand Cricket Board Component
 *
 * Implements the complete Hand Cricket gameplay:
 * - Toss winner role selection (Bat / Bowl)
 * - Live scoreboard with innings, batter/bowler identities, runs, target, and chase status
 * - Reusable SecretHandoff integration for 1..6 secret delivery locking,
 *   Pass & Play privacy curtain, and synchronized reveal
 * - Real delivery resolution presentation (WICKET / runs scored)
 */

import React, { useMemo } from "react";
import type { Seat, AccentFamily } from "../../../shared/protocol/types";
import type { CricketView } from "../../../shared/games/hand-cricket/types";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { SecretHandoff } from "../../components/secret-round/secret-handoff";
import type { SecretChoiceOption, SecretOutcomeDisplay } from "../../components/secret-round/types";
import { Award, Shield, Target, Flame } from "lucide-react";

interface HandCricketBoardProps {
  view: CricketView;
  mode: "remote" | "together";
  playerAAccent?: AccentFamily;
  playerBAccent?: AccentFamily;
  playerAName: string;
  playerBName: string;
  localSeat: Seat;
  onChooseRole: (role: "bat" | "bowl") => void;
  onLockNumber: (value: number, seat: Seat) => void;
  onReveal: () => void;
  onNextDelivery: () => void;
  isSubmitting?: boolean;
  forceMasked?: boolean;
  onMaskChange?: (masked: boolean) => void;
}

const CRICKET_NUMBER_OPTIONS: SecretChoiceOption<number>[] = [
  { id: 1, label: "1 Run", icon: "1" },
  { id: 2, label: "2 Runs", icon: "2" },
  { id: 3, label: "3 Runs", icon: "3" },
  { id: 4, label: "4 Runs", icon: "4" },
  { id: 5, label: "5 Runs", icon: "5" },
  { id: 6, label: "6 Runs", icon: "6" },
];

export const HandCricketBoard: React.FC<HandCricketBoardProps> = ({
  view,
  mode,
  playerAAccent = "teal",
  playerBAccent = "violet",
  playerAName,
  playerBName,
  localSeat,
  onChooseRole,
  onLockNumber,
  onReveal,
  onNextDelivery,
  isSubmitting = false,
  forceMasked = false,
  onMaskChange,
}) => {
  const {
    phase,
    innings,
    tossWinner,
    roles,
    firstInningsRuns,
    secondInningsRuns,
    target,
    deliveryId,
    lockedSeats,
    lastDelivery,
  } = view;

  // Toss Winner Selection Phase
  if (phase === "toss") {
    const isTossWinner = localSeat === tossWinner || mode === "together";
    const winnerName = tossWinner === "A" ? playerAName : playerBName;

    return (
      <Surface
        variant="card"
        padding="lg"
        radius="xl"
        style={{
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-md, 16px)",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
          }}
        >
          <Award size={36} color="var(--color-emphasis-yellow-ink, #f59e0b)" />
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 800 }}>
            Toss Won by {winnerName}!
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-muted-text)",
              margin: 0,
            }}
          >
            {isTossWinner
              ? "Choose whether to bat first or bowl first."
              : `Waiting for ${winnerName} to choose their role...`}
          </p>
        </div>

        {isTossWinner && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              width: "100%",
              marginTop: "8px",
            }}
          >
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              onClick={() => onChooseRole("bat")}
              data-testid="cricket-choose-bat"
              leftIcon={<Flame size={18} />}
            >
              Bat First
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              onClick={() => onChooseRole("bowl")}
              data-testid="cricket-choose-bowl"
              leftIcon={<Shield size={18} />}
            >
              Bowl First
            </Button>
          </div>
        )}
      </Surface>
    );
  }

  // Delivery Outcome derivation
  const outcome: SecretOutcomeDisplay | null = useMemo(() => {
    if (!lastDelivery || !roles) return null;

    const batterSeat = roles.bat;
    const bowlerSeat = roles.bowl;

    const seatAChoice = batterSeat === "A" ? lastDelivery.runs.bat : lastDelivery.runs.bowl;
    const seatBChoice = batterSeat === "B" ? lastDelivery.runs.bat : lastDelivery.runs.bowl;

    const isOut = lastDelivery.outcome === "out";

    return {
      title: isOut
        ? `WICKET! ${batterSeat === "A" ? playerAName : playerBName} is OUT on ${seatAChoice}!`
        : `+${lastDelivery.scoredRuns} Runs Scored!`,
      subtitle: `Batter played ${lastDelivery.runs.bat}, Bowler played ${lastDelivery.runs.bowl}`,
      winnerSeat: isOut ? bowlerSeat : "draw",
      seatAChoiceLabel: `${roles.bat === "A" ? "Bat: " : "Bowl: "}${seatAChoice}`,
      seatBChoiceLabel: `${roles.bat === "B" ? "Bat: " : "Bowl: "}${seatBChoice}`,
    };
  }, [lastDelivery, roles, playerAName, playerBName]);

  const currentBatter = roles ? (roles.bat === "A" ? playerAName : playerBName) : "";
  const currentBowler = roles ? (roles.bowl === "A" ? playerAName : playerBName) : "";

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
      {/* 1. Live Scoreboard Strip */}
      <Surface
        variant="card"
        padding="md"
        radius="xl"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          border: "2px solid var(--color-border, #334155)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "var(--color-muted-text)",
          }}
        >
          <span
            style={{
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-primary, #38bdf8)",
            }}
          >
            {innings === 1 ? "1st Innings" : "2nd Innings (Chase)"} • Ball #{deliveryId}
          </span>
          {target !== null && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--color-emphasis-yellow-ink, #f59e0b)",
                fontWeight: 700,
              }}
            >
              <Target size={13} /> Target: {target}
            </span>
          )}
        </div>

        {/* Big Score Display */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1.1 }}>
              {innings === 1 ? firstInningsRuns : secondInningsRuns}
              <span style={{ fontSize: "16px", color: "var(--color-muted-text)" }}> runs</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)", marginTop: "2px" }}>
              Batter: <strong style={{ color: "var(--color-text)" }}>{currentBatter}</strong> •
              Bowler: {currentBowler}
            </div>
          </div>

          {innings === 2 && target !== null && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "var(--color-primary, #38bdf8)",
                }}
              >
                Needs {Math.max(0, target - secondInningsRuns)} runs
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                1st Innings: {firstInningsRuns}
              </div>
            </div>
          )}
        </div>
      </Surface>

      {/* 2. Reusable Secret Handoff for Delivery Numbers (1..6) */}
      <div style={{ width: "100%" }}>
        <SecretHandoff<number>
          forceMasked={forceMasked}
          onMaskChange={onMaskChange}
          mode={mode}
          roundNumber={deliveryId}
          gameTitle="Hand Cricket"
          seatA={{ name: playerAName, accent: playerAAccent }}
          seatB={{ name: playerBName, accent: playerBAccent }}
          firstChooserSeat={deliveryId % 2 === 1 ? "A" : "B"}
          localSeat={localSeat}
          options={CRICKET_NUMBER_OPTIONS}
          selectionPrompt={
            roles?.bat === localSeat
              ? "Select runs to score (1..6)"
              : "Select delivery number (1..6)"
          }
          isSeatALocked={lockedSeats.includes("A")}
          isSeatBLocked={lockedSeats.includes("B")}
          isResolved={lockedSeats.length === 2 || lastDelivery !== null}
          isRevealed={view.revealed ?? (mode === "remote" && lastDelivery !== null)}
          outcome={outcome}
          onLockChoice={(choice, seat) => onLockNumber(choice, seat)}
          onReveal={onReveal}
          onNextRound={onNextDelivery}
          isSubmittingLock={isSubmitting}
          isSubmittingReveal={isSubmitting}
          isSubmittingNext={isSubmitting}
        />
      </div>
    </div>
  );
};
