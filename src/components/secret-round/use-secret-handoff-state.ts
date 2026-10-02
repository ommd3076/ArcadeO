import { useState, useCallback } from "react";
import type { Seat } from "@shared/protocol/types";
import type { TogetherHandoffStep, RemoteHandoffStep } from "./types";

export interface UseSecretHandoffStateOptions {
  mode: "together" | "remote";
  firstChooserSeat?: Seat;
  localSeat?: Seat;
  isSeatALocked?: boolean;
  isSeatBLocked?: boolean;
  isResolved?: boolean;
  isRevealed?: boolean;
}

export function useSecretHandoffState({
  mode: _mode,
  firstChooserSeat = "A",
  localSeat = "A",
  isSeatALocked = false,
  isSeatBLocked = false,
  isResolved = false,
  isRevealed = false,
}: UseSecretHandoffStateOptions) {
  const secondChooserSeat: Seat = firstChooserSeat === "A" ? "B" : "A";

  // Derive initial step for together mode based on lock/resolved states
  const getInitialTogetherStep = (): TogetherHandoffStep => {
    if (isRevealed || (isResolved && isRevealed)) {
      return "revealed-outcome";
    }
    if (isSeatALocked && isSeatBLocked) {
      return "both-locked-reveal";
    }
    const firstLocked = firstChooserSeat === "A" ? isSeatALocked : isSeatBLocked;
    const secondLocked = secondChooserSeat === "A" ? isSeatALocked : isSeatBLocked;

    if (firstLocked && !secondLocked) {
      return "curtain-pass-to-2";
    }
    return "ready-seat-1";
  };

  const getInitialRemoteStep = (): RemoteHandoffStep => {
    if (isRevealed || isResolved) {
      return "revealed-outcome";
    }
    const myLock = localSeat === "A" ? isSeatALocked : isSeatBLocked;
    if (myLock) {
      return "locked-waiting";
    }
    return "choosing";
  };

  const [togetherStep, setTogetherStep] = useState<TogetherHandoffStep>(getInitialTogetherStep);
  const [remoteStep, setRemoteStep] = useState<RemoteHandoffStep>(getInitialRemoteStep);

  // Ephemeral selection (not committed until locked)
  const [selectedChoice, setSelectedChoice] = useState<any>(null);

  const clearSelection = useCallback(() => {
    setSelectedChoice(null);
  }, []);

  return {
    togetherStep,
    setTogetherStep,
    remoteStep,
    setRemoteStep,
    selectedChoice,
    setSelectedChoice,
    clearSelection,
    firstChooserSeat,
    secondChooserSeat,
  };
}
