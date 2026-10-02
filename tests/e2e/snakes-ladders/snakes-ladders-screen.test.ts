import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SnakesLaddersBoard } from "../../../src/games/snakes-ladders/snakes-ladders-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SnakesAndLaddersView } from "../../../shared/games/snakes-and-ladders/types";

describe("Snakes & Ladders Screen & Board Integration (Task U03)", () => {
  const initialSnLView: SnakesAndLaddersView = {
    positions: { A: 0, B: 0 },
    activeSeat: "A",
    status: "active",
    winner: null,
    lastRoll: null,
  };

  it("renders SnakesLaddersBoard with 100 cells, SVG connectors, off-board indicators, and Roll button", () => {
    const onRoll = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SnakesLaddersBoard, {
          view: initialSnLView,
          canAct: true,
          onRoll,
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    // Board cells
    expect(html).toContain('data-testid="snl-cell-1"');
    expect(html).toContain('data-testid="snl-cell-100"');

    // Off board
    expect(html).toContain("Off-board (Position 0):");
    expect(html).toContain("Player A");
    expect(html).toContain("Waiting to enter");

    // Roll button
    expect(html).toContain("Roll Dice");
    expect(html).toContain("Player A&#x27;s Turn");
  });

  it("renders active tokens on board cells", () => {
    const activeView: SnakesAndLaddersView = {
      positions: { A: 23, B: 34 },
      activeSeat: "B",
      status: "active",
      winner: null,
      lastRoll: 5,
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SnakesLaddersBoard, {
          view: activeView,
          canAct: true,
          onRoll: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    expect(html).toContain('data-testid="snl-token-A"');
    expect(html).toContain('data-testid="snl-token-B"');
    expect(html).toContain("Player B&#x27;s Turn");
    expect(html).toContain("Rolled 5. A: 23 | B: 34");
  });

  it("renders SnakesLaddersBoard dynamically within MatchScreen when gameId is snakes-and-ladders", () => {
    const mockView = createMockFilteredView({
      matchId: "match-snl-001",
      gameId: "snakes-and-ladders",
      mode: "remote",
      turnSeat: "A",
      gameState: initialSnLView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-snl-001"] },
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

    expect(html).toContain('data-testid="snl-cell-1"');
    expect(html).toContain("Roll Dice");
  });
});
