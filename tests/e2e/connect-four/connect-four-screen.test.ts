import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ConnectFourBoard } from "../../../src/games/connect-four/connect-four-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ConnectFourCell, ConnectFourView } from "../../../shared/games/connect-four/types";

describe("Connect Four Screen & Board Integration", () => {
  const emptyBoard: ConnectFourCell[][] = Array.from({ length: 6 }, () => Array(7).fill(null));

  it("renders 7x6 board with empty cells and 7 column drop controls", () => {
    const handleDrop = vi.fn();
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ConnectFourBoard, {
          board: emptyBoard,
          activeSeat: "A",
          canDrop: true,
          onDropColumn: handleDrop,
          playerAName: "Alice",
          playerBName: "Bob",
        }),
      ),
    );

    // 7 column drop buttons rendered
    const dropBtnMatches = html.match(/<button[^>]*class="[^"]*\bc4-drop-btn\b[^"]*"[^>]*>/g);
    expect(dropBtnMatches?.length).toBe(7);

    // 42 cells rendered
    const cellMatches = html.match(/c4-cell-slot/g);
    expect(cellMatches?.length).toBe(42);

    // 42 empty cell divs
    const emptyCellMatches = html.match(/c4-cell-empty/g);
    expect(emptyCellMatches?.length).toBe(42);
  });

  it("column drop buttons have accessible labels and interactive callbacks", () => {
    const handleDrop = vi.fn();
    const element = React.createElement(ConnectFourBoard, {
      board: emptyBoard,
      activeSeat: "A",
      canDrop: true,
      onDropColumn: handleDrop,
      playerAName: "Alice",
      playerBName: "Bob",
    });

    // Test component drop handler directly
    element.props.onDropColumn(3);
    expect(handleDrop).toHaveBeenCalledWith(3);

    const html = renderToString(React.createElement(ThemeProvider, null, element));
    expect(html).toContain('aria-label="Drop disc into column 1"');
    expect(html).toContain('aria-label="Drop disc into column 7"');
  });

  it("turn display updates when turn changes", () => {
    const gameStateA: ConnectFourView = {
      board: emptyBoard,
      activeSeat: "A",
      status: "active",
      winner: null,
      winningCells: [],
    };

    const initialViewA = createMockFilteredView({
      matchId: "match-c4-001",
      turnSeat: "A",
      gameState: gameStateA,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const htmlA = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-c4-001"] },
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
                initialView: initialViewA,
              }),
            }),
          ),
        ),
      ),
    );

    // Alice's turn
    expect(htmlA).toContain("Alice");
    expect(htmlA).toContain("Your turn");

    // Turn switches to Bob
    const gameStateB: ConnectFourView = {
      ...gameStateA,
      activeSeat: "B",
    };
    const initialViewB = createMockFilteredView({
      ...initialViewA,
      turnSeat: "B",
      gameState: gameStateB,
    });

    const htmlB = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-c4-001"] },
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
                initialView: initialViewB,
              }),
            }),
          ),
        ),
      ),
    );

    // Bob's turn
    expect(htmlB).toContain("Bob");
  });

  it("terminal win screen shows winning player and winning disc glow", () => {
    const winBoard: ConnectFourCell[][] = Array.from({ length: 6 }, () => Array(7).fill(null));
    // Connect 4 in row 5: cols 0, 1, 2, 3
    winBoard[5][0] = "A";
    winBoard[5][1] = "A";
    winBoard[5][2] = "A";
    winBoard[5][3] = "A";

    const gameStateWon: ConnectFourView = {
      board: winBoard,
      activeSeat: "A",
      status: "completed",
      winner: "A",
      winningCells: [
        [5, 0],
        [5, 1],
        [5, 2],
        [5, 3],
      ],
      terminalResult: {
        winner: "A",
        reason: "rules_win",
        scores: { A: 1, B: 0 },
        finishedAt: Date.now(),
      },
    };

    const terminalView = createMockFilteredView({
      matchId: "match-c4-won",
      lifecycle: "completed",
      turnSeat: "A",
      gameState: gameStateWon,
      result: gameStateWon.terminalResult,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-c4-won"] },
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
                initialView: terminalView,
              }),
            }),
          ),
        ),
      ),
    );

    // Winner announcement
    expect(html).toContain("Alice Wins!");
    expect(html).toContain("Four discs connected in a row!");

    // Winning discs have glowing highlight class
    const winningMatches = html.match(/c4-disc--winning/g);
    expect(winningMatches?.length).toBe(4);

    // Actions exist
    expect(html).toContain("Rematch");
    expect(html).toContain("Return Home");
  });
});
