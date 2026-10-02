import { useMemo, useRef } from "react";
import type { Seat, AccentFamily } from "@shared/protocol/types";
import type { RPSView, RPSChoice } from "@shared/games/rps/types";
import { SecretHandoff } from "../../components/secret-round/secret-handoff";
import { useAcceptedMotion } from "../../components/accepted-motion";
import type { SecretChoiceOption, SecretOutcomeDisplay } from "../../components/secret-round/types";
import { Surface } from "../../components/surface";
import "./rps.css";

export interface RPSBoardProps {
  view: RPSView;
  mode: "remote" | "together";
  playerAName?: string;
  playerBName?: string;
  playerAAccent?: AccentFamily;
  playerBAccent?: AccentFamily;
  localSeat?: Seat;
  firstChooserSeat?: Seat;
  onLockChoice: (choice: RPSChoice, seat: Seat) => Promise<void> | void;
  onReveal?: () => Promise<void> | void;
  onNextRound: () => Promise<void> | void;
  isSubmitting?: boolean;
  forceMasked?: boolean;
  onMaskChange?: (masked: boolean) => void;
  acceptedEventId?: string | null;
  motionEnabled?: boolean;
}

const RPS_CHOICE_OPTIONS: SecretChoiceOption<RPSChoice>[] = [
  { id: "rock", label: "Rock", icon: "✊", sublabel: "Beats Scissors" },
  { id: "paper", label: "Paper", icon: "✋", sublabel: "Beats Rock" },
  { id: "scissors", label: "Scissors", icon: "✌️", sublabel: "Beats Paper" },
];

const CHOICE_ICONS: Record<RPSChoice, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

export function RPSBoard({
  view,
  mode,
  playerAName = "Player A",
  playerBName = "Player B",
  playerAAccent = "teal",
  playerBAccent = "violet",
  localSeat = "A",
  firstChooserSeat = "A",
  onLockChoice,
  onReveal,
  onNextRound,
  isSubmitting = false,
  forceMasked = false,
  onMaskChange,
  acceptedEventId,
  motionEnabled = true,
}: RPSBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isSeatALocked = view.lockedSeats.includes("A");
  const isSeatBLocked = view.lockedSeats.includes("B");
  const isResolved = view.phase === "resolved" || view.phase === "terminal";
  const isRevealed = view.revealed;

  useAcceptedMotion(
    acceptedEventId,
    isRevealed ? [{ type: "revealed" as const }] : [],
    () => {
      const panel = rootRef.current?.querySelector<HTMLElement>(".arcade-secret-handoff--outcome");
      return panel?.animate
        ? [
            panel.animate(
              [
                { opacity: 0.55, transform: "scale(.98)" },
                { opacity: 1, transform: "scale(1)" },
              ],
              { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            ),
          ]
        : [];
    },
    { enabled: motionEnabled },
  );

  const outcome: SecretOutcomeDisplay | null = useMemo(() => {
    if (!view.roundResult || (!isRevealed && mode === "together")) {
      return null;
    }

    const { winner, choices, roundId } = view.roundResult;
    const choiceA = choices.A;
    const choiceB = choices.B;

    const title = `Round ${roundId} Result`;
    let subtitle = "";
    if (winner === "draw") {
      subtitle = "Both chose the same move — It's a draw!";
    } else if (winner === "A") {
      subtitle = `${playerAName} wins this round! (${choiceA} beats ${choiceB})`;
    } else {
      subtitle = `${playerBName} wins this round! (${choiceB} beats ${choiceA})`;
    }

    return {
      title,
      subtitle,
      winnerSeat: winner,
      seatAChoiceLabel: `${CHOICE_ICONS[choiceA]} ${choiceA.toUpperCase()}`,
      seatBChoiceLabel: `${CHOICE_ICONS[choiceB]} ${choiceB.toUpperCase()}`,
    };
  }, [view.roundResult, isRevealed, mode, playerAName, playerBName]);

  return (
    <div
      ref={rootRef}
      className="rps-container"
      role="region"
      aria-label="Rock Paper Scissors Game"
    >
      {/* Format and Target Banner */}
      <Surface variant="inset" padding="sm" radius="lg" className="rps-score-strip">
        <div className="rps-score-pill">
          <span className="rps-score-player" style={{ color: "var(--color-accent-fg)" }}>
            {playerAName}: <strong>{view.scores.A}</strong>
          </span>
          <span className="rps-score-target">First to {view.targetWins} wins</span>
          <span className="rps-score-player" style={{ color: "var(--color-focus)" }}>
            {playerBName}: <strong>{view.scores.B}</strong>
          </span>
        </div>
      </Surface>

      {/* Secret Handoff Interactive Controller */}
      <SecretHandoff<RPSChoice>
        forceMasked={forceMasked}
        onMaskChange={onMaskChange}
        mode={mode}
        roundNumber={view.roundId}
        gameTitle="Rock Paper Scissors"
        seatA={{ name: playerAName, accent: playerAAccent }}
        seatB={{ name: playerBName, accent: playerBAccent }}
        firstChooserSeat={firstChooserSeat}
        localSeat={localSeat}
        options={RPS_CHOICE_OPTIONS}
        selectionPrompt="Choose your hand"
        isSeatALocked={isSeatALocked}
        isSeatBLocked={isSeatBLocked}
        isResolved={isResolved}
        isRevealed={isRevealed}
        outcome={outcome}
        onLockChoice={(choice, seat) => onLockChoice(choice, seat)}
        onReveal={onReveal}
        onNextRound={onNextRound}
        isSubmittingLock={isSubmitting}
        isSubmittingReveal={isSubmitting}
        isSubmittingNext={isSubmitting}
      />
    </div>
  );
}
