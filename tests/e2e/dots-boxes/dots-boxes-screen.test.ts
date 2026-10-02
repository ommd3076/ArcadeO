import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { DotsBoxesBoard } from "../../../src/games/dots-boxes/dots-boxes-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DotsBoxesView } from "../../../shared/games/dots-boxes/types";

describe("Dots & Boxes Screen & Board Integration (Task U04)", () => {
  const initialDotsView: DotsBoxesView = {
    edges: [],
    boxes: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    scores: { A: 0, B: 0 },
    activeSeat: "A",
    status: "active",
    winner: null,
  };

  it("renders DotsBoxesBoard with 5x5 dots, edges, and scores", () => {
    const onPlaceEdge = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(DotsBoxesBoard, {
          view: initialDotsView,
          canAct: true,
          onPlaceEdge,
          playerAName: "Alice",
          playerBName: "Bob",
        }),
      ),
    );

    // Score counters
    expect(html).toContain('data-testid="dots-score-A"');
    expect(html).toContain('data-testid="dots-score-B"');

    // Dots & Edges
    expect(html).toContain('data-testid="dot-0-0"');
    expect(html).toContain('data-testid="dot-4-4"');
    expect(html).toContain('data-testid="edge-h-0-0"');
    expect(html).toContain('data-testid="edge-v-0-0"');

    // Instructions
    expect(html).toContain("Tap an edge directly, or tap two adjacent dots to connect them.");
  });

  it("renders claimed boxes and placed edges", () => {
    const activeView: DotsBoxesView = {
      edges: [
        { r1: 0, c1: 0, r2: 0, c2: 1, claimedBy: "A" },
        { r1: 1, c1: 0, r2: 1, c2: 1, claimedBy: "A" },
        { r1: 0, c1: 0, r2: 1, c2: 0, claimedBy: "A" },
        { r1: 0, c1: 1, r2: 1, c2: 1, claimedBy: "A" },
      ],
      boxes: [
        ["A", null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      scores: { A: 1, B: 0 },
      activeSeat: "A",
      status: "active",
      winner: null,
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(DotsBoxesBoard, {
          view: activeView,
          canAct: true,
          onPlaceEdge: vi.fn(),
          playerAName: "Alice",
          playerBName: "Bob",
        }),
      ),
    );

    expect(html).toContain('data-testid="box-0-0"');
    expect(html).toContain(">1<"); // Score A is 1
  });

  it("renders DotsBoxesBoard dynamically within MatchScreen when gameId is dots-boxes", () => {
    const mockView = createMockFilteredView({
      matchId: "match-db-001",
      gameId: "dots-boxes",
      mode: "together",
      turnSeat: "A",
      gameState: initialDotsView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-db-001"] },
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

    expect(html).toContain('data-testid="dots-score-A"');
    expect(html).toContain('data-testid="dot-0-0"');
  });
});
