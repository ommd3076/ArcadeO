import { useState, useEffect, useMemo } from "react";
import type { Seat } from "@shared/protocol/types";
import { resolvePlayerAccent } from "../../theme/tokens";
import { useTheme } from "../../theme/theme-context";
import { Button } from "../button";
import { Surface } from "../surface";
import {
  ShieldAlert,
  Lock,
  Eye,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  RotateCw,
} from "lucide-react";
import type { SecretHandoffProps, TogetherHandoffStep, RemoteHandoffStep } from "./types";
import { useSecretConcealment } from "./use-secret-concealment";

export function SecretHandoff<T = string | number>({
  mode,
  roundNumber,
  roundLabel = "Round",
  nextRoundLabel = "Next Round",
  revealLabel = "Reveal Outcome",
  gameTitle: _gameTitle,
  seatA,
  seatB,
  firstChooserSeat = "A",
  localSeat = "A",
  options,
  selectionPrompt = "Select your choice",
  isSeatALocked = false,
  isSeatBLocked = false,
  isResolved = false,
  isRevealed = false,
  readiness,
  outcome = null,
  onLockChoice,
  onReveal,
  onNextRound,
  isSubmittingLock = false,
  isSubmittingReveal = false,
  isSubmittingNext = false,
  forceMasked = false,
  onMaskChange,
  className = "",
}: SecretHandoffProps<T>) {
  const { resolvedMode } = useTheme();

  const secondChooserSeat: Seat = firstChooserSeat === "A" ? "B" : "A";

  // Current chooser in together mode
  const [currentChooserSeat, setCurrentChooserSeat] = useState<Seat>(() =>
    (firstChooserSeat === "A" ? isSeatALocked : isSeatBLocked)
      ? secondChooserSeat
      : firstChooserSeat,
  );

  // Transient choice before lock confirmation
  const [selectedChoice, setSelectedChoice] = useState<T | null>(null);

  // Handoff steps
  const [togetherStep, setTogetherStep] = useState<TogetherHandoffStep>(() => {
    if (isRevealed || (isResolved && isRevealed)) return "revealed-outcome";
    if (isSeatALocked && isSeatBLocked) return "both-locked-reveal";
    const firstLocked = firstChooserSeat === "A" ? isSeatALocked : isSeatBLocked;
    const secondLocked = secondChooserSeat === "A" ? isSeatALocked : isSeatBLocked;
    if (firstLocked && !secondLocked) return "curtain-pass-to-2";
    return "ready-seat-1";
  });

  const [remoteStep, setRemoteStep] = useState<RemoteHandoffStep>(() => {
    if (isRevealed || isResolved) return "revealed-outcome";
    const myLock = localSeat === "A" ? isSeatALocked : isSeatBLocked;
    if (myLock) return "locked-waiting";
    return "choosing";
  });

  // Concealment hook (handles window blur, document hidden, pagehide)
  const {
    isMasked: internalMasked,
    mask: _triggerConceal,
    unmask: triggerUnmask,
  } = useSecretConcealment({
    onConceal: () => {
      // Clear any unconfirmed selection preview immediately
      setSelectedChoice(null);
      onMaskChange?.(true);
    },
  });

  const isMasked = forceMasked || internalMasked;

  useEffect(() => {
    if (forceMasked) setSelectedChoice(null);
  }, [forceMasked, roundNumber]);

  // React to external server state updates
  useEffect(() => {
    if (mode === "together") {
      if (isRevealed) {
        setTogetherStep("revealed-outcome");
      } else if (isSeatALocked && isSeatBLocked) {
        setTogetherStep("both-locked-reveal");
      } else {
        const firstLocked = firstChooserSeat === "A" ? isSeatALocked : isSeatBLocked;
        const secondLocked = secondChooserSeat === "A" ? isSeatALocked : isSeatBLocked;
        if (firstLocked && !secondLocked) {
          if (togetherStep === "choosing-seat-1" || togetherStep === "ready-seat-1") {
            setTogetherStep("curtain-pass-to-2");
            setCurrentChooserSeat(secondChooserSeat);
            setSelectedChoice(null);
          }
        } else if (!firstLocked && !secondLocked) {
          if (togetherStep === "revealed-outcome") {
            // New round reset
            setTogetherStep("ready-seat-1");
            setCurrentChooserSeat(firstChooserSeat);
            setSelectedChoice(null);
          }
        }
      }
    } else {
      // Remote mode
      if (isRevealed || isResolved) {
        // Server-resolved outcomes appear immediately; visuals never gate Next.
        setRemoteStep("revealed-outcome");
      } else {
        const myLock = localSeat === "A" ? isSeatALocked : isSeatBLocked;
        setRemoteStep(myLock ? "locked-waiting" : "choosing");
        if (!myLock) setSelectedChoice(null);
      }
    }
  }, [
    mode,
    isSeatALocked,
    isSeatBLocked,
    isResolved,
    isRevealed,
    firstChooserSeat,
    secondChooserSeat,
    localSeat,
    roundNumber,
    togetherStep,
  ]);

  // Resolve player accents and display data
  const playerAInfo = useMemo(() => {
    const accentToken = resolvePlayerAccent(seatA.accent ?? "teal", resolvedMode);
    return { ...seatA, accentToken };
  }, [seatA, resolvedMode]);

  const playerBInfo = useMemo(() => {
    const accentToken = resolvePlayerAccent(seatB.accent ?? "violet", resolvedMode);
    return { ...seatB, accentToken };
  }, [seatB, resolvedMode]);

  const currentChooserInfo = currentChooserSeat === "A" ? playerAInfo : playerBInfo;
  const otherSeat: Seat = currentChooserSeat === "A" ? "B" : "A";
  const otherPlayerInfo = otherSeat === "A" ? playerAInfo : playerBInfo;

  // Handlers
  const handleLockTogether = async () => {
    if (selectedChoice === null) return;
    const choice = selectedChoice;
    // Wipe local selection immediately to prevent screen peering
    setSelectedChoice(null);

    try {
      await onLockChoice(choice, currentChooserSeat);
    } catch {
      return;
    }

    if (currentChooserSeat === firstChooserSeat) {
      // Step 3: Screen IMMEDIATELY conceals Player A's choice and displays pass screen
      setTogetherStep("curtain-pass-to-2");
      setCurrentChooserSeat(secondChooserSeat);
    } else {
      // Step 6: Both choices locked
      setTogetherStep("both-locked-reveal");
    }
  };

  const handleLockRemote = async () => {
    if (selectedChoice === null) return;
    const choice = selectedChoice;
    setSelectedChoice(null);
    try {
      await onLockChoice(choice, localSeat);
      setRemoteStep("locked-waiting");
    } catch {
      setRemoteStep("choosing");
    }
  };

  const handleTogetherRevealClick = async () => {
    try {
      if (onReveal) await onReveal();
      setTogetherStep("revealed-outcome");
    } catch {
      return;
    }
  };

  const handleNextRoundClick = async () => {
    setSelectedChoice(null);
    await onNextRound();
  };

  // 1. BLUR / PRIVACY MASK CURTAIN OVERLAY
  if (isMasked) {
    return (
      <Surface
        variant="elevated"
        padding="xl"
        radius="xl"
        className={`arcade-secret-handoff arcade-secret-handoff--masked ${className}`.trim()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "360px",
          gap: "var(--space-lg)",
          backgroundColor: "var(--color-surface)",
          border: "2px solid var(--color-interactive-line)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-focus)",
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <div>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "8px",
            }}
          >
            Screen Concealed for Privacy
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-muted-text)",
              maxWidth: "320px",
              margin: "0 auto",
            }}
          >
            Window lost focus or was minimized. Unconfirmed choices have been cleared to protect
            your move.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          pill
          onClick={() => {
            triggerUnmask();
            onMaskChange?.(false);
          }}
          disabled={isSubmittingLock}
          leftIcon={<Eye size={18} />}
          style={{ minHeight: "44px", minWidth: "160px" }}
        >
          Resume & Unmask
        </Button>
      </Surface>
    );
  }

  // 2. OUTCOME DISPLAY (Revealed result + Next Round button)
  // Mount the accepted outcome in this commit so its motion can find the panel.
  // A new-round view also removes it immediately, before transient steps catch up.
  const isOutcomeShown = isRevealed || (mode === "remote" && isResolved);

  if (isOutcomeShown && outcome) {
    return (
      <Surface
        variant="card"
        padding="xl"
        radius="xl"
        className={`arcade-secret-handoff arcade-secret-handoff--outcome ${className}`.trim()}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-lg)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--color-muted-text)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            {roundNumber ? `${roundLabel} ${roundNumber} Outcome` : `${roundLabel} Outcome`}
          </div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            {outcome.title}
          </h2>
          {outcome.subtitle && (
            <p style={{ fontSize: "14px", color: "var(--color-muted-text)", marginTop: "4px" }}>
              {outcome.subtitle}
            </p>
          )}
        </div>

        {/* Revealed Choices Comparison */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "var(--space-md)",
            padding: "var(--space-md)",
            backgroundColor: "var(--color-raised)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Seat A Box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: playerAInfo.accentToken.foreground,
              }}
            >
              {playerAInfo.name}
            </div>
            {outcome.seatAChoiceNode ? (
              outcome.seatAChoiceNode
            ) : (
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                }}
              >
                {outcome.seatAChoiceLabel ?? "—"}
              </div>
            )}
          </div>

          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--color-muted-text)",
            }}
          >
            VS
          </div>

          {/* Seat B Box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: playerBInfo.accentToken.foreground,
              }}
            >
              {playerBInfo.name}
            </div>
            {outcome.seatBChoiceNode ? (
              outcome.seatBChoiceNode
            ) : (
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                }}
              >
                {outcome.seatBChoiceLabel ?? "—"}
              </div>
            )}
          </div>
        </div>

        {outcome.detailsNode && <div style={{ marginTop: "4px" }}>{outcome.detailsNode}</div>}

        <div style={{ marginTop: "var(--space-md)" }}>
          {mode === "remote" && localSeat && readiness?.[localSeat] ? (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              pill
              disabled={true}
              leftIcon={<CheckCircle2 size={18} />}
              style={{ minHeight: "48px" }}
            >
              You&apos;re ready · Waiting for{" "}
              {localSeat === "A" ? playerBInfo.name : playerAInfo.name}...
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              pill
              onClick={handleNextRoundClick}
              disabled={isSubmittingNext}
              rightIcon={
                isSubmittingNext ? (
                  <RotateCw className="arcade-spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )
              }
              style={{ minHeight: "48px" }}
            >
              {isSubmittingNext ? "Advancing..." : nextRoundLabel}
            </Button>
          )}
        </div>
      </Surface>
    );
  }

  // ==========================================
  // TOGETHER MODE FLOW
  // ==========================================
  if (mode === "together") {
    // Step 1: Active prompt for Seat 1 (Ready curtain)
    if (togetherStep === "ready-seat-1") {
      const chooser = currentChooserSeat === "A" ? playerAInfo : playerBInfo;
      return (
        <Surface
          variant="elevated"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--ready ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "360px",
            gap: "var(--space-lg)",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "var(--radius-full)",
              backgroundColor: chooser.accentToken.fill,
              color: chooser.accentToken.foreground,
              border: `2px solid ${chooser.accentToken.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-heading)",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            {currentChooserSeat}
          </div>

          <div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 6px 0",
              }}
            >
              {chooser.name}, make your choice
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "var(--color-muted-text)",
                maxWidth: "280px",
                margin: "0 auto",
              }}
            >
              Tap Ready below to show your choices. Make sure {otherPlayerInfo.name} is looking away
              before continuing.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            pill
            onClick={() => setTogetherStep("choosing-seat-1")}
            rightIcon={<ArrowRight size={18} />}
            style={{ minHeight: "46px", minWidth: "200px" }}
          >
            I am {chooser.name} (Ready)
          </Button>
        </Surface>
      );
    }

    // Step 2: Player A selects choice and taps "Lock Choice"
    if (togetherStep === "choosing-seat-1") {
      return (
        <Surface
          variant="card"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--choosing ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "var(--space-sm)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: currentChooserInfo.accentToken.fill,
                  color: currentChooserInfo.accentToken.foreground,
                  border: `1px solid ${currentChooserInfo.accentToken.border}`,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {currentChooserSeat}
              </span>
              <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                {currentChooserInfo.name}
              </span>
            </div>

            <span
              style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted-text)",
              }}
            >
              Step 1 of 2
            </span>
          </div>

          <div style={{ textAlign: "center" }}>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 4px 0",
              }}
            >
              {selectionPrompt}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-muted-text)", margin: 0 }}>
              Your choice will be immediately concealed upon locking.
            </p>
          </div>

          {/* Options Grid */}
          <div
            role="radiogroup"
            aria-label={selectionPrompt}
            style={{
              width: "100%",
              minWidth: 0,
              display: "grid",
              gridTemplateColumns:
                options.length === 10
                  ? "repeat(5, minmax(0, 1fr))"
                  : options.length <= 3
                    ? `repeat(${options.length}, minmax(0, 1fr))`
                    : "repeat(3, minmax(0, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {options.map((opt) => {
              const isSelected = selectedChoice === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={opt.ariaLabel ?? opt.label}
                  onClick={() => setSelectedChoice(opt.id)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "var(--space-md)",
                    minWidth: 0,
                    minHeight: "56px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: isSelected ? "var(--color-raised)" : "var(--color-surface)",
                    border: isSelected
                      ? `2px solid var(--color-primary-fill)`
                      : "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 0 0 2px var(--color-focus)" : "none",
                    transition: "all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                >
                  {opt.icon && <span style={{ fontSize: "24px" }}>{opt.icon}</span>}
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{opt.label}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            pill
            disabled={selectedChoice === null || isSubmittingLock}
            onClick={handleLockTogether}
            leftIcon={
              isSubmittingLock ? <RotateCw className="arcade-spin" size={18} /> : <Lock size={18} />
            }
            style={{ minHeight: "48px" }}
          >
            {isSubmittingLock ? "Locking..." : "Lock Choice"}
          </Button>
        </Surface>
      );
    }

    // Step 3: Privacy Curtain ("Pass phone to Player B")
    if (togetherStep === "curtain-pass-to-2") {
      const targetChooser = secondChooserSeat === "A" ? playerAInfo : playerBInfo;
      return (
        <Surface
          variant="elevated"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--curtain ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "380px",
            gap: "var(--space-xl)",
            backgroundColor: "var(--color-surface)",
            border: "2px solid var(--color-border)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-raised)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-focus)",
            }}
          >
            <Smartphone size={32} />
          </div>

          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-raised)",
                fontSize: "12px",
                color: "var(--color-success)",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              <CheckCircle2 size={14} />
              Choice 1 Concealed & Locked
            </div>

            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 8px 0",
              }}
            >
              Pass phone to {targetChooser.name}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "var(--color-muted-text)",
                maxWidth: "280px",
                margin: "0 auto",
              }}
            >
              The screen is masked. Only hand over the device once the other player is holding it.
            </p>
          </div>

          <Button
            variant="mint"
            size="lg"
            pill
            onClick={() => {
              setCurrentChooserSeat(secondChooserSeat);
              setTogetherStep("choosing-seat-2");
            }}
            rightIcon={<ArrowRight size={18} />}
            style={{ minHeight: "48px", minWidth: "220px" }}
          >
            I am {targetChooser.name} (Ready)
          </Button>
        </Surface>
      );
    }

    // Step 4 & 5: Player B selects and locks choice
    if (togetherStep === "choosing-seat-2") {
      const chooser = secondChooserSeat === "A" ? playerAInfo : playerBInfo;
      return (
        <Surface
          variant="card"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--choosing ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "var(--space-sm)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: chooser.accentToken.fill,
                  color: chooser.accentToken.foreground,
                  border: `1px solid ${chooser.accentToken.border}`,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {secondChooserSeat}
              </span>
              <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                {chooser.name}
              </span>
            </div>

            <span
              style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted-text)",
              }}
            >
              Step 2 of 2
            </span>
          </div>

          <div style={{ textAlign: "center" }}>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 4px 0",
              }}
            >
              {selectionPrompt}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-muted-text)", margin: 0 }}>
              {playerAInfo.name}&apos;s choice remains safely locked & masked.
            </p>
          </div>

          {/* Options Grid */}
          <div
            role="radiogroup"
            aria-label={selectionPrompt}
            style={{
              width: "100%",
              minWidth: 0,
              display: "grid",
              gridTemplateColumns:
                options.length === 10
                  ? "repeat(5, minmax(0, 1fr))"
                  : options.length <= 3
                    ? `repeat(${options.length}, minmax(0, 1fr))`
                    : "repeat(3, minmax(0, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {options.map((opt) => {
              const isSelected = selectedChoice === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={opt.ariaLabel ?? opt.label}
                  onClick={() => setSelectedChoice(opt.id)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "var(--space-md)",
                    minWidth: 0,
                    minHeight: "56px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: isSelected ? "var(--color-raised)" : "var(--color-surface)",
                    border: isSelected
                      ? `2px solid var(--color-primary-fill)`
                      : "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 0 0 2px var(--color-focus)" : "none",
                    transition: "all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                >
                  {opt.icon && <span style={{ fontSize: "24px" }}>{opt.icon}</span>}
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{opt.label}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            pill
            disabled={selectedChoice === null || isSubmittingLock}
            onClick={handleLockTogether}
            leftIcon={
              isSubmittingLock ? <RotateCw className="arcade-spin" size={18} /> : <Lock size={18} />
            }
            style={{ minHeight: "48px" }}
          >
            {isSubmittingLock ? "Locking..." : "Lock Choice"}
          </Button>
        </Surface>
      );
    }

    // Step 6: Both choices locked with "Reveal Outcome"
    if (togetherStep === "both-locked-reveal") {
      return (
        <Surface
          variant="elevated"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--reveal-ready ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "360px",
            gap: "var(--space-lg)",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-raised)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-success)",
              border: "1px solid var(--color-border)",
            }}
          >
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 6px 0",
              }}
            >
              Both choices locked!
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "var(--color-muted-text)",
                maxWidth: "280px",
                margin: "0 auto",
              }}
            >
              Both players can now look at the screen together to see the result.
            </p>
          </div>

          <Button
            variant="cyan"
            size="lg"
            pill
            disabled={isSubmittingReveal}
            onClick={handleTogetherRevealClick}
            leftIcon={
              isSubmittingReveal ? (
                <RotateCw className="arcade-spin" size={18} />
              ) : (
                <Eye size={18} />
              )
            }
            style={{ minHeight: "48px", minWidth: "220px" }}
          >
            {isSubmittingReveal ? "Revealing..." : revealLabel}
          </Button>
        </Surface>
      );
    }
  }

  // ==========================================
  // REMOTE MODE FLOW
  // ==========================================
  if (mode === "remote") {
    const isLocked =
      remoteStep === "locked-waiting" || (localSeat === "A" ? isSeatALocked : isSeatBLocked);
    const opponentInfo = localSeat === "A" ? playerBInfo : playerAInfo;
    const myInfo = localSeat === "A" ? playerAInfo : playerBInfo;

    // Sub-mode A: Local player choosing
    if (!isLocked && remoteStep === "choosing") {
      return (
        <Surface
          variant="card"
          padding="xl"
          radius="xl"
          className={`arcade-secret-handoff arcade-secret-handoff--remote-choosing ${className}`.trim()}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "var(--space-sm)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: myInfo.accentToken.fill,
                  color: myInfo.accentToken.foreground,
                  border: `1px solid ${myInfo.accentToken.border}`,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {localSeat}
              </span>
              <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                {myInfo.name} (You)
              </span>
            </div>

            {roundNumber && (
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted-text)",
                }}
              >
                {roundLabel} {roundNumber}
              </span>
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "0 0 4px 0",
              }}
            >
              {selectionPrompt}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-muted-text)", margin: 0 }}>
              Lock your secret move. It remains masked to your opponent until both lock.
            </p>
          </div>

          {/* Options Grid */}
          <div
            role="radiogroup"
            aria-label={selectionPrompt}
            style={{
              width: "100%",
              minWidth: 0,
              display: "grid",
              gridTemplateColumns:
                options.length === 10
                  ? "repeat(5, minmax(0, 1fr))"
                  : options.length <= 3
                    ? `repeat(${options.length}, minmax(0, 1fr))`
                    : "repeat(3, minmax(0, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {options.map((opt) => {
              const isSelected = selectedChoice === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={opt.ariaLabel ?? opt.label}
                  onClick={() => setSelectedChoice(opt.id)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "var(--space-md)",
                    minWidth: 0,
                    minHeight: "56px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: isSelected ? "var(--color-raised)" : "var(--color-surface)",
                    border: isSelected
                      ? `2px solid var(--color-primary-fill)`
                      : "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 0 0 2px var(--color-focus)" : "none",
                    transition: "all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                >
                  {opt.icon && <span style={{ fontSize: "24px" }}>{opt.icon}</span>}
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{opt.label}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            pill
            disabled={selectedChoice === null || isSubmittingLock}
            onClick={handleLockRemote}
            leftIcon={
              isSubmittingLock ? <RotateCw className="arcade-spin" size={18} /> : <Lock size={18} />
            }
            style={{ minHeight: "48px" }}
          >
            {isSubmittingLock ? "Locking..." : "Lock Choice"}
          </Button>
        </Surface>
      );
    }

    // Sub-mode B: Choice Locked, waiting for opponent
    return (
      <Surface
        variant="elevated"
        padding="xl"
        radius="xl"
        className={`arcade-secret-handoff arcade-secret-handoff--waiting ${className}`.trim()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "360px",
          gap: "var(--space-lg)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-success)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Lock size={26} />
        </div>

        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-raised)",
              color: "var(--color-success)",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            <CheckCircle2 size={16} />
            Choice Locked
          </div>

          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--color-text)",
              margin: "0 0 8px 0",
            }}
          >
            Waiting for {opponentInfo.name}...
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-muted-text)",
              maxWidth: "280px",
              margin: "0 auto",
            }}
          >
            Your move is safely stored on the server. The round will reveal automatically once{" "}
            {opponentInfo.name} locks their move.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--color-muted-text)",
            fontSize: "13px",
          }}
        >
          <RotateCw className="arcade-spin" size={16} />
          <span>Syncing with match server...</span>
        </div>
      </Surface>
    );
  }

  return null;
}
