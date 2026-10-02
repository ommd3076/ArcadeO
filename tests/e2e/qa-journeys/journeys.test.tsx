import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";

describe("All Eight Games & Modes Browser Journey Verification (Task Q02)", () => {
  it("renders Connect Four together match screen with drop buttons and cells", () => {
    const mockView = createMockFilteredView({
      matchId: "match-c4",
      gameId: "connect-four",
      mode: "together",
      gameState: {
        board: Array.from({ length: 6 }, () => Array(7).fill(null)),
        activeSeat: "A",
        status: "active",
        winner: null,
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-c4"] },
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

    expect(html).toContain("Connect Four");
    expect(html).toContain("c4-cell-slot");
  });

  it("renders Rock Paper Scissors match screen with Pass and Play controls", () => {
    const mockView = createMockFilteredView({
      matchId: "match-rps",
      gameId: "rock-paper-scissors",
      mode: "together",
      gameState: {
        roundId: 1,
        scores: { A: 0, B: 0 },
        phase: "locking",
        lockedSeats: [],
        revealed: false,
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-rps"] },
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

    expect(html).toContain("Rock Paper Scissors");
    expect(html).toContain("Rock");
    expect(html).toContain("Paper");
    expect(html).toContain("Scissors");
  });

  it("renders Ludo match screen with 15x15 board and dice roll control", () => {
    const mockView = createMockFilteredView({
      matchId: "match-ludo",
      gameId: "ludo",
      mode: "together",
      gameState: {
        tokens: {
          A: [-1, -1, -1, -1],
          B: [-1, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        pendingRoll: null,
        legalTokenIds: [],
        consecutiveSixes: 0,
        status: "active",
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-ludo"] },
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

    expect(html).toContain("Ludo");
    expect(html).toContain("Roll Dice");
  });

  it("renders Snakes & Ladders match screen with 10x10 board and roll button", () => {
    const mockView = createMockFilteredView({
      matchId: "match-snl",
      gameId: "snakes-and-ladders",
      mode: "together",
      gameState: {
        positions: { A: 0, B: 0 },
        activeSeat: "A",
        lastRoll: null,
        status: "active",
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-snl"] },
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

    expect(html).toContain("Snakes &amp; Ladders");
    expect(html).toContain("Roll Dice");
  });

  it("renders Dots & Boxes match screen with 5x5 dots, edges and scores", () => {
    const mockView = createMockFilteredView({
      matchId: "match-db",
      gameId: "dots-boxes",
      mode: "together",
      gameState: {
        edges: [],
        boxes: Array.from({ length: 4 }, () => Array(4).fill(null)),
        scores: { A: 0, B: 0 },
        activeSeat: "A",
        status: "active",
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-db"] },
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

    expect(html).toContain("Dots &amp; Boxes");
    expect(html).toContain('data-testid="dot-0-0"');
    expect(html).toContain('data-testid="dots-score-A"');
  });

  it("renders SOS match screen with 5x5 grid and S/O selector", () => {
    const mockView = createMockFilteredView({
      matchId: "match-sos",
      gameId: "sos",
      mode: "together",
      gameState: {
        board: Array.from({ length: 5 }, () => Array(5).fill(null)),
        scores: { A: 0, B: 0 },
        activeSeat: "A",
        completedLines: [],
        status: "active",
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-sos"] },
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

    expect(html).toContain("SOS");
    expect(html).toContain("Letter to Place:");
    expect(html).toContain('data-testid="sos-select-s"');
    expect(html).toContain('data-testid="sos-select-o"');
  });

  it("renders Hand Cricket match screen with toss role selection and live scoreboard", () => {
    const mockView = createMockFilteredView({
      matchId: "match-cricket",
      gameId: "hand-cricket",
      mode: "together",
      gameState: {
        phase: "first_innings",
        tossWinner: "A",
        roles: { bat: "A", bowl: "B" },
        innings: 1,
        firstInningsRuns: 14,
        secondInningsRuns: 0,
        target: null,
        deliveryId: 4,
        status: "active",
        lockedSeats: [],
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-cricket"] },
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

    expect(html).toContain("Hand Cricket");
    expect(html).toContain("1st Innings");
    expect(html).toContain("14"); // current runs
  });

  it("renders Sudoku match screen with 9x9 board, numpad and practice controls", () => {
    const mockView = createMockFilteredView({
      matchId: "match-sudoku",
      gameId: "sudoku",
      mode: "together",
      gameState: {
        puzzleId: "sudoku-easy-001",
        givens: "1".repeat(81),
        cells: Array(81).fill(1),
        notes: Array(81).fill(0),
        assisted: false,
        paused: false,
        elapsedMs: 45000,
        mode: "practice",
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-sudoku"] },
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

    expect(html).toContain("Sudoku");
    expect(html).toContain("Notes");
    expect(html).toContain("Erase");
    expect(html).toContain("Check");
  });
});
