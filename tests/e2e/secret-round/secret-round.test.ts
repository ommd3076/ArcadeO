import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SecretHandoff } from "../../../src/components/secret-round/secret-handoff";
import { ThemeProvider } from "../../../src/theme/theme-context";

describe("Secret Handoff Component (Task C02)", () => {
  const rpsOptions = [
    { id: "rock", label: "Rock", icon: "✊" },
    { id: "paper", label: "Paper", icon: "✋" },
    { id: "scissors", label: "Scissors", icon: "✌️" },
  ];

  const seatA = { name: "Alice", accent: "teal" as const };
  const seatB = { name: "Bob", accent: "violet" as const };

  it("renders together mode initial choosing state for Seat A", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "together",
          roundNumber: 1,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: false,
          isSeatBLocked: false,
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    // Prompt for Alice readiness barrier
    expect(html).toContain("Alice");
    expect(html).toContain("make your choice");
    expect(html).toContain("is looking away before continuing");
    expect(html).toContain("I am <!-- -->Alice<!-- --> (Ready)");
  });

  it("renders together mode pass-to-player-B curtain when Seat A is locked and Seat B is unlocked", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "together",
          roundNumber: 1,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: true,
          isSeatBLocked: false,
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    // Handoff curtain
    expect(html).toContain("Pass phone to");
    expect(html).toContain("Bob");
    expect(html).toContain("Choice 1 Concealed &amp; Locked");
    expect(html).toContain("I am <!-- -->Bob<!-- --> (Ready)");
  });

  it("renders together mode both-locked reveal prompt when both seats have locked", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "together",
          roundNumber: 1,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: true,
          isSeatBLocked: true,
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    // Both locked state
    expect(html).toContain("Both choices locked!");
    expect(html).toContain("Reveal Outcome");
  });

  it("renders revealed outcome with next round action", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "together",
          roundNumber: 1,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: true,
          isSeatBLocked: true,
          isResolved: true,
          isRevealed: true,
          outcome: {
            title: "Round 1 Result",
            subtitle: "Alice wins this round!",
            winnerSeat: "A",
          },
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    expect(html).toContain("Round 1 Result");
    expect(html).toContain("Alice wins this round!");
    expect(html).toContain("Next Round");
  });

  it("renders remote mode locked-waiting state for local player", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "remote",
          roundNumber: 2,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: true,
          isSeatBLocked: false,
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    // Remote locked waiting indicator
    expect(html).toContain("Choice Locked");
    expect(html).toContain("Waiting for");
    expect(html).toContain("Bob");
  });

  it("renders blur/privacy curtain when forceMasked is true", () => {
    const onLock = vi.fn();
    const onReveal = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SecretHandoff, {
          mode: "together",
          roundNumber: 1,
          seatA,
          seatB,
          firstChooserSeat: "A",
          localSeat: "A",
          options: rpsOptions,
          isSeatALocked: false,
          isSeatBLocked: false,
          forceMasked: true,
          onLockChoice: onLock,
          onReveal: onReveal,
          onNextRound: onNext,
        }),
      ),
    );

    // Concealment curtain
    expect(html).toContain("Screen Concealed for Privacy");
    expect(html).toContain("Window lost focus or was minimized");
    expect(html).toContain("Resume &amp; Unmask");
  });
});
