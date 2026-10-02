import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { renderToHtml } from "../../fixtures/render-stream";
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

  it("keeps a solo pawn large and renders the center win-feedback target", () => {
    const soloPawnView: LudoView = {
      ...initialLudoView,
      tokens: { A: [12, -1, -1, -1], B: [-1, -1, -1, -1] },
    };
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: soloPawnView,
          canAct: false,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    expect(html).toContain('data-stack-size="1"');
    expect(html).toContain('data-stack-x="50"');
    expect(html).toContain("width:82%");
    expect(html).toContain('data-ludo-goal="true"');
    expect(html).toContain('data-testid="ludo-center-goal"');
  });

  it("keeps an eight-pawn mixed stack numbered and individually named", () => {
    const mixedStack: LudoView = {
      ...initialLudoView,
      tokens: {
        A: [0, 0, 0, 0],
        B: [26, 26, 26, 26],
      },
      phase: "choose-token",
      pendingRoll: 1,
      legalTokenIds: [0],
    };
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: mixedStack,
          canAct: true,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
        }),
      ),
    );

    expect(html).toContain('data-ludo-stack="6-1" data-stack-size="8"');
    expect(html).toContain('data-testid="ludo-large-stack-summary"');
    expect(html).toMatch(
      /Player A(?:<!-- -->)*: (?:<!-- -->)*4(?:<!-- -->)* pawns · (?:<!-- -->)*Player B(?:<!-- -->)*: (?:<!-- -->)*4(?:<!-- -->)* pawns/,
    );
    expect(html).toContain("Choose by the numbered, named token controls below.");
    for (const seat of ["A", "B"] as const) {
      for (const tokenId of [1, 2, 3, 4]) {
        expect(html).toContain(`aria-label="Player ${seat} Token ${tokenId}`);
      }
    }
  });

  it("announces accepted capture and turn effects without depending on animation", () => {
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: initialLudoView,
          canAct: true,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Player A",
          playerBName: "Player B",
          acceptedEventId: "accepted-17",
          acceptedEffects: [
            { type: "token-moved", seat: "A", tokenId: 0, from: 8, to: 10 },
            {
              type: "token-captured",
              bySeat: "A",
              byTokenId: 0,
              capturedSeat: "B",
              capturedTokenId: 1,
              ringIndex: 10,
            },
          ],
        }),
      ),
    );

    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html).toContain("Player A moved Token 1.");
    expect(html).toContain("Player A captured Player B Token 2.");
  });

  it("announces the accepted player and roll when no pawn can move", () => {
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: {
            ...initialLudoView,
            activeSeat: "B",
            lastRollNotice: "no-legal-move",
          },
          canAct: false,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Aisha",
          playerBName: "Ben",
          acceptedEventId: "accepted-roll-no-move",
          acceptedEffects: [
            { type: "dice-rolled", seat: "A", roll: 4 },
            { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
          ],
        }),
      ),
    );

    expect(html).toContain("Aisha rolled 4.");
    expect(html).toContain("No pawn could move.");
    expect(html.match(/Player B moves next\./g)).toHaveLength(1);
  });

  it("announces the player and face of an ignored third six", () => {
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(LudoBoard, {
          view: { ...initialLudoView, lastRollNotice: "ignored-six" },
          canAct: true,
          onRoll: vi.fn(),
          onSelectToken: vi.fn(),
          playerAName: "Aisha",
          playerBName: "Ben",
          acceptedEventId: "accepted-ignored-six",
          acceptedEffects: [{ type: "dice-rolled", seat: "A", roll: 6, ignored: true }],
        }),
      ),
    );

    expect(html).toContain("Aisha rolled 6.");
    expect(html).toContain(
      "The third or later six was ignored; roll again, and earlier moves still count.",
    );
  });

  it("renders LudoBoard dynamically within MatchScreen when gameId is ludo", async () => {
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

    const html = await renderToHtml(
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
