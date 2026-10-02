import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { renderToHtml } from "../../fixtures/render-stream";
import { HandCricketBoard } from "../../../src/games/hand-cricket/hand-cricket-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CricketView } from "../../../shared/games/hand-cricket/types";

describe("Hand Cricket Screen & Board Integration (Task U05)", () => {
  const tossView: CricketView = {
    phase: "toss",
    innings: 1,
    tossWinner: "A",
    roles: null,
    firstInningsRuns: 0,
    secondInningsRuns: 0,
    target: null,
    deliveryId: 1,
    lockedSeats: [],
    lastDelivery: null,
    readiness: { A: false, B: false },
  };

  it("renders toss phase with toss winner and role choice buttons", () => {
    const onChooseRole = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(HandCricketBoard, {
          view: tossView,
          mode: "together",
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
          onChooseRole,
          onLockNumber: vi.fn(),
          onReveal: vi.fn(),
          onNextDelivery: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("Toss Won by");
    expect(html).toContain("Alice");
    expect(html).toContain("Bat First");
    expect(html).toContain("Bowl First");
  });

  it("renders live scoreboard and secret handoff options during first innings", () => {
    const inningsView: CricketView = {
      phase: "first_innings",
      innings: 1,
      tossWinner: "A",
      roles: { bat: "A", bowl: "B" },
      firstInningsRuns: 24,
      secondInningsRuns: 0,
      target: null,
      deliveryId: 6,
      lockedSeats: [],
      lastDelivery: null,
      readiness: { A: false, B: false },
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(HandCricketBoard, {
          view: inningsView,
          mode: "remote",
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
          onChooseRole: vi.fn(),
          onLockNumber: vi.fn(),
          onReveal: vi.fn(),
          onNextDelivery: vi.fn(),
        }),
      ),
    );

    // Scoreboard
    expect(html).toContain("1st Innings");
    expect(html).toContain("Ball #<!-- -->6");
    expect(html).toContain("24");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");

    // Number options (1..6)
    expect(html).toContain("1 Run");
    expect(html).toContain("6 Runs");
  });

  it("renders delivery outcome when delivery is resolved", () => {
    const resolvedView: CricketView = {
      revealed: true,
      phase: "first_innings",
      innings: 1,
      tossWinner: "A",
      roles: { bat: "A", bowl: "B" },
      firstInningsRuns: 30,
      secondInningsRuns: 0,
      target: null,
      deliveryId: 7,
      lockedSeats: ["A", "B"],
      lastDelivery: {
        innings: 1,
        deliveryId: 6,
        runs: { bat: 6, bowl: 4 },
        outcome: "runs",
        scoredRuns: 6,
        batterRunsAfter: 30,
      },
      readiness: { A: false, B: false },
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(HandCricketBoard, {
          view: resolvedView,
          mode: "together",
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
          onChooseRole: vi.fn(),
          onLockNumber: vi.fn(),
          onReveal: vi.fn(),
          onNextDelivery: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("+6 Runs Scored!");
  });

  it("renders HandCricketBoard dynamically within MatchScreen when gameId is hand-cricket", async () => {
    const mockView = createMockFilteredView({
      matchId: "match-cricket-001",
      gameId: "hand-cricket",
      mode: "together",
      turnSeat: "A",
      gameState: tossView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = await renderToHtml(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-cricket-001"] },
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

    expect(html).toContain("Toss Won by");
    expect(html).toContain("Alice");
  });
});
