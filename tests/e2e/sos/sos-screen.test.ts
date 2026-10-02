import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { renderToHtml } from "../../fixtures/render-stream";
import { SOSBoard } from "../../../src/games/sos/sos-board";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SOSView } from "../../../shared/games/sos/types";

describe("SOS Screen & Board Integration (Task U04)", () => {
  const initialSOSView: SOSView = {
    board: Array.from({ length: 5 }, () => Array(5).fill(null)),
    lines: [],
    scores: { A: 0, B: 0 },
    activeSeat: "A",
    status: "active",
    winner: null,
  };

  it("renders SOSBoard with 5x5 cells, S/O selector buttons, and scores", () => {
    const onPlaceLetter = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SOSBoard, {
          view: initialSOSView,
          canAct: true,
          onPlaceLetter,
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    // Score counters
    expect(html).toContain('data-testid="sos-score-A"');
    expect(html).toContain('data-testid="sos-score-B"');

    // Cells
    expect(html).toContain('data-testid="sos-cell-0-0"');
    expect(html).toContain('data-testid="sos-cell-4-4"');

    // S / O selector buttons
    expect(html).toContain('data-testid="sos-select-s"');
    expect(html).toContain('data-testid="sos-select-o"');
  });

  it("renders placed letters and formed SOS strike lines", () => {
    const boardWithLetters: (("S" | "O") | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    );
    boardWithLetters[0][0] = "S";
    boardWithLetters[0][1] = "O";
    boardWithLetters[0][2] = "S";

    const activeView: SOSView = {
      board: boardWithLetters,
      lines: [
        {
          id: "0,0-0,2",
          from: [0, 0],
          to: [0, 2],
          claimedBy: "A",
        },
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
        React.createElement(SOSBoard, {
          view: activeView,
          canAct: true,
          onPlaceLetter: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    expect(html).toContain('data-testid="sos-line-0,0-0,2"');
    expect(html).toContain(">1<"); // Score A is 1
  });

  it("renders SOSBoard dynamically within MatchScreen when gameId is sos", async () => {
    const mockView = createMockFilteredView({
      matchId: "match-sos-001",
      gameId: "sos",
      mode: "together",
      turnSeat: "A",
      gameState: initialSOSView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = await renderToHtml(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-sos-001"] },
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

    expect(html).toContain('data-testid="sos-score-A"');
    expect(html).toContain('data-testid="sos-cell-0-0"');
  });
});
