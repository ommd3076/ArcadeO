import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { renderToHtml } from "../../fixtures/render-stream";
import { RPSBoard } from "../../../src/games/rps/rps-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RPSView } from "../../../shared/games/rps/types";

describe("RPS Screen & Board Integration (Task U02)", () => {
  const initialRPSView: RPSView = {
    targetWins: 2,
    scores: { A: 0, B: 0 },
    roundId: 1,
    phase: "locking",
    lockedSeats: [],
    roundResult: null,
    revealed: false,
    readiness: { A: false, B: false },
  };

  it("renders RPSBoard with target wins banner and choice buttons", () => {
    const onLock = vi.fn();
    const onNext = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(RPSBoard, {
          view: initialRPSView,
          mode: "together",
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
          onLockChoice: onLock,
          onNextRound: onNext,
        }),
      ),
    );

    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("First to <!-- -->2<!-- --> wins");
    expect(html).toContain("Rock Paper Scissors");
  });

  it("renders RPS within MatchScreen dynamically when gameId is rock-paper-scissors", async () => {
    const mockView = createMockFilteredView({
      matchId: "match-rps-001",
      gameId: "rock-paper-scissors",
      mode: "together",
      turnSeat: "A",
      gameState: initialRPSView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = await renderToHtml(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-rps-001"] },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/matches/:matchId",
              element: React.createElement(MatchScreen, {
                actorAccountId: "A",
                initialView: mockView,
              }),
            }),
          ),
        ),
      ),
    );

    // Turn strip rendered
    expect(html).toContain("Alice");
    // Target wins score strip
    expect(html).toContain("First to <!-- -->2<!-- --> wins");
    // RPS choice options
    expect(html).toContain("Rock Paper Scissors");
  });

  it("renders revealed round outcome with scores in RPSBoard", () => {
    const onLock = vi.fn();
    const onNext = vi.fn();

    const resolvedView: RPSView = {
      targetWins: 2,
      scores: { A: 1, B: 0 },
      roundId: 1,
      phase: "resolved",
      lockedSeats: ["A", "B"],
      roundResult: {
        roundId: 1,
        choices: { A: "rock", B: "scissors" },
        winner: "A",
      },
      revealed: true,
      readiness: { A: false, B: false },
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(RPSBoard, {
          view: resolvedView,
          mode: "together",
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
          onLockChoice: onLock,
          onNextRound: onNext,
        }),
      ),
    );

    expect(html).toContain("Alice<!-- -->: <strong>1</strong>");
    expect(html).toContain("Alice wins this round!");
    expect(html).toContain("Next Round");
  });
});
