import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SudokuBoard } from "../../../src/games/sudoku/sudoku-board";
import { SudokuListScreen } from "../../../src/screens/sudoku-list";
import { MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SudokuView } from "../../../shared/games/sudoku/types";

describe("Sudoku Screen & Board Integration (Task S03)", () => {
  const sampleGivens =
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

  const practiceView: SudokuView = {
    puzzleId: "sudoku-easy-001",
    givens: sampleGivens,
    mode: "practice",
    hasStarted: true,
    self: {
      filledCount: 30,
      completed: false,
      elapsedMs: 45000,
      paused: false,
      assisted: false,
      cells: sampleGivens.split("").map((c) => parseInt(c, 10)),
      notes: Array(81).fill(0),
      undoAvailable: true,
    },
  };

  it("renders SudokuListScreen with mode selector and difficulty buckets", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ThemeProvider, null, React.createElement(SudokuListScreen)),
      ),
    );

    expect(html).toContain("Choose your Sudoku");
    expect(html).toContain("Practice");
    expect(html).toContain("Duel");
    expect(html).toContain("Challenge");
    expect(html).toContain("easy");
    expect(html).toContain("expert");
    expect(html).toContain("Start puzzle");
  });

  it("renders SudokuBoard with 9x9 grid, givens, number pad, and practice controls", () => {
    const onEdit = vi.fn();
    const onUndo = vi.fn();
    const onCheck = vi.fn();
    const onPause = vi.fn();

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SudokuBoard, {
          view: practiceView,
          canAct: true,
          onEditCell: onEdit,
          onUndo,
          onCheck,
          onPause,
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
        }),
      ),
    );

    // Board and touch keypad must retain different column layouts.
    expect(html).toContain(
      "grid-template-columns:repeat(9, 1fr);grid-template-rows:repeat(9, 1fr)",
    );
    expect(html).toContain("grid-template-columns:repeat(3, minmax(44px, 1fr))");

    // 9x9 cells
    expect(html).toContain('data-testid="sudoku-cell-0-0"');
    expect(html).toContain('data-testid="sudoku-cell-8-8"');

    // Givens
    expect(html).toContain("5");

    // Action buttons
    expect(html).toContain("Notes");
    expect(html).toContain("Erase");
    expect(html).toContain("Undo");
    expect(html).toContain("Check");
    expect(html).toContain("Pause");

    // Number pad (1..9)
    expect(html).toContain('data-testid="sudoku-pad-1"');
    expect(html).toContain('data-testid="sudoku-pad-9"');
  });

  it("renders duel mode with opponent filled count HUD", () => {
    const duelView: SudokuView = {
      ...practiceView,
      mode: "duel",
      opponent: {
        filledCount: 42,
        completed: false,
        elapsedMs: 44000,
        paused: false,
        assisted: false,
      },
    };

    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SudokuBoard, {
          view: duelView,
          canAct: true,
          onEditCell: vi.fn(),
          onUndo: vi.fn(),
          playerAName: "Alice",
          playerBName: "Bob",
          localSeat: "A",
        }),
      ),
    );

    expect(html).toContain("Live Duel");
    expect(html).toContain("Opponent:");
    expect(html).toContain("42");
    expect(html).toContain("/81");
  });

  it("renders SudokuBoard dynamically inside MatchScreen when gameId is sudoku", () => {
    const mockView = createMockFilteredView({
      matchId: "match-sudoku-001",
      gameId: "sudoku",
      mode: "practice",
      turnSeat: "A",
      gameState: practiceView,
      participants: {
        A: { accountId: "A", displayName: "Alice", ready: true },
        B: { accountId: "B", displayName: "Bob", ready: true },
      },
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/matches/match-sudoku-001"] },
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

    expect(html).toContain('data-testid="sudoku-cell-0-0"');
    expect(html).toContain('data-testid="sudoku-pad-1"');
  });
});
