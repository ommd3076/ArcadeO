import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { leaveAndSaveDescription, MatchScreen } from "../../../src/screens/match";
import { createMockFilteredView } from "../../fixtures/matches";
import type { FilteredMatchView } from "../../../shared/protocol/types";
import type { SudokuView } from "../../../shared/games/sudoku/types";

function renderSavedSudoku(view: FilteredMatchView, actorAccountId: "A" | "B" = "A"): string {
  return renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/matches/saved-match"] },
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/matches/:matchId",
            element: React.createElement(MatchScreen, { actorAccountId, initialView: view }),
          }),
        ),
      ),
    ),
  ).replaceAll("<!-- -->", "");
}

function savedSudoku(mode: SudokuView["mode"], sudoku: Partial<SudokuView> = {}) {
  const state: SudokuView = {
    puzzleId: "easy-001",
    givens: "0".repeat(81),
    mode,
    hasStarted: true,
    self: {
      filledCount: 0,
      completed: false,
      elapsedMs: 10_000,
      paused: false,
      assisted: false,
      cells: Array(81).fill(0),
      notes: Array(81).fill(0),
      undoAvailable: false,
      progressRevision: 1,
    },
    ...sudoku,
  };
  return createMockFilteredView({
    gameId: "sudoku",
    mode,
    lifecycle: "saved",
    pauseId: "pause-1",
    resumeReadiness: { A: false, B: false },
    legalActions: ["match.resume", "match.resign"],
    gameState: state,
  });
}

describe("saved Sudoku resume copy", () => {
  it("identifies practice as one player's saved attempt", () => {
    const html = renderSavedSudoku(savedSudoku("practice"));
    expect(html).toContain("Your paused Sudoku practice is saved.");
    expect(html).toContain("Resume practice");
    expect(html).not.toContain("Both players must resume");
  });

  it("gives the unfinished unpublished sender attempt its own resume action", () => {
    const html = renderSavedSudoku(
      savedSudoku("challenge", { challenge: { published: false, accepted: false } }),
    );
    expect(html).toContain("Your unpublished Sudoku sender attempt is saved.");
    expect(html).toContain("Resume challenge attempt");
    expect(html).not.toContain("Both players must resume");
  });

  it("lets an accepted challenge receiver resume their own saved attempt", () => {
    const html = renderSavedSudoku(
      savedSudoku("challenge", { challenge: { published: true, accepted: true } }),
      "B",
    );
    expect(html).toContain("Your accepted Sudoku challenge is saved.");
    expect(html).toContain("Resume challenge attempt");
    expect(html).not.toContain("Both players must resume");
  });

  it("keeps a completed challenge sender in history without a misleading Resume button", () => {
    const view = savedSudoku("challenge", {
      self: {
        filledCount: 81,
        completed: true,
        elapsedMs: 60_000,
        paused: false,
        assisted: false,
        cells: Array(81).fill(1),
        notes: Array(81).fill(0),
        undoAvailable: false,
        progressRevision: 2,
      },
      challenge: { published: false, accepted: false },
    });
    const html = renderSavedSudoku(view);
    expect(html).toContain("Your completed sender attempt is saved in history.");
    expect(html).toContain("Resume is not needed");
    expect(html).not.toContain("Resume challenge attempt");
    expect(html).not.toContain("Resume saved match");
  });

  it("retains both-player resume copy for a saved live Duel", () => {
    const html = renderSavedSudoku(savedSudoku("duel"));
    expect(html).toContain("Both players must resume this Duel.");
    expect(html).toContain("Resume saved match");
  });

  it("reserves the history-only warning for deliberate Sudoku Duel save", () => {
    expect(leaveAndSaveDescription(savedSudoku("duel"))).toContain(
      "history-only. It will not count toward competitive wins, streaks, or best times.",
    );
    expect(leaveAndSaveDescription(savedSudoku("practice"))).toBe(
      "The accepted match state will be saved. You can resume it later from Home or this game’s setup.",
    );
    expect(leaveAndSaveDescription(createMockFilteredView({ gameId: "connect-four" }))).toBe(
      "The accepted match state will be saved. You can resume it later from Home or this game’s setup.",
    );
  });
});
