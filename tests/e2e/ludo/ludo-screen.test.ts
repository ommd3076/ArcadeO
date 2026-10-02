import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { LudoBoard } from "../../../src/games/ludo/ludo-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { LudoView } from "../../../shared/games/ludo/types";

describe("Ludo Screen & Board Integration (Task U03)", () => {
  const initialLudoView: LudoView = {
    tokens: {
      A: [-1, -1, -1, -1],
      B: [-1, -1, -1, -1],
    },
    activeSeat: "A",
    phase: "roll",
    consecutiveSixes: 0,
    pendingRoll: null,
    legalTokenIds: [],
    status: "active",
    winner: null,
  };

  it("renders LudoBoard with 15x15 grid, yard zones, and tactile Roll Dice button", () => {
    const onRoll = vi.fn();
    const onSelectToken = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: initialLudoView,
          canAct: true,
          onRoll,
          onSelectToken,
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    // Board cells
    expect(html).toContain('data-testid="cell-0-0"');
    expect(html).toContain('data-testid="cell-7-7"');
    expect(html).toContain('data-testid="cell-14-14"');

    // Roll button
    expect(html).toContain("Roll Dice");
    expect(html).toContain("Player A&#x27;s Turn to Roll");
  });

  it("renders choose-token phase with token selector buttons", () => {
    const tokenView: LudoView = {
      tokens: {
        A: [0, -1, -1, -1],
        B: [-1, -1, -1, -1],
      },
      activeSeat: "A",
      phase: "choose-token",
      consecutiveSixes: 0,
      pendingRoll: 4,
      legalTokenIds: [0],
      status: "active",
      winner: null,
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: tokenView,
          canAct: true,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    expect(html).toContain("Rolled 4! Select a token to move.");
    expect(html).toContain("Choose Token to Move");
    expect(html).toContain('data-testid="ludo-token-button-0"');
    expect(html).toContain('data-testid="ludo-token-button-1"');
  });

  it("renders LudoBoard dynamically within MatchScreen when gameId is ludo", () => {
    const mockView = createMockFilteredView({
      matchId: "match-ludo-001",
      gameId: "ludo",
      mode: "together",
      turnSeat: "A",
      gameState: initialLudoView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-ludo-001"] },
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

    expect(html).toContain('data-testid="cell-0-0"');
    expect(html).toContain("Roll Dice");
  });
});
