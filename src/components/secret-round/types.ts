import type { ReactNode } from "react";
import type { Seat, AccentFamily } from "@shared/protocol/types";

export type SecretRoundGameType = "rps" | "cricket" | "custom";

export interface SecretChoiceOption<T = string | number> {
  id: T;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

export interface SecretOutcomeDisplay {
  title: string;
  subtitle?: string;
  winnerSeat?: Seat | "draw" | null;
  winnerLabel?: string;
  seatAChoiceLabel?: string;
  seatBChoiceLabel?: string;
  seatAChoiceNode?: ReactNode;
  seatBChoiceNode?: ReactNode;
  detailsNode?: ReactNode;
}

export type TogetherHandoffStep =
  | "ready-seat-1"
  | "choosing-seat-1"
  | "curtain-pass-to-2"
  | "ready-seat-2"
  | "choosing-seat-2"
  | "both-locked-reveal"
  | "revealed-outcome";

export type RemoteHandoffStep = "choosing" | "locked-waiting" | "revealed-outcome";

export interface SecretHandoffProps<T = string | number> {
  mode: "together" | "remote";
  roundNumber?: number;
  gameTitle?: string;

  // Players info
  seatA: {
    name: string;
    accent?: AccentFamily;
    role?: string;
  };
  seatB: {
    name: string;
    accent?: AccentFamily;
    role?: string;
  };

  // Turn alternation for together mode
  firstChooserSeat?: Seat; // Default 'A'
  localSeat?: Seat; // Required for remote mode, e.g. 'A' or 'B'

  // Choice configuration
  options: SecretChoiceOption<T>[];
  selectionPrompt?: string; // e.g. "Choose your move" or "Pick a delivery number"

  // Server state / lock status
  isSeatALocked?: boolean;
  isSeatBLocked?: boolean;
  isResolved?: boolean;
  isRevealed?: boolean;

  // Outcome data (populated when resolved/revealed)
  outcome?: SecretOutcomeDisplay | null;

  // Actions
  onLockChoice: (choice: T, seat: Seat) => Promise<void> | void;
  onReveal?: () => Promise<void> | void;
  onNextRound: () => Promise<void> | void;

  // Loading/submitting states
  isSubmittingLock?: boolean;
  isSubmittingReveal?: boolean;
  isSubmittingNext?: boolean;

  // Privacy / concealment overrides
  forceMasked?: boolean;
  onMaskChange?: (isMasked: boolean) => void;

  className?: string;
}
