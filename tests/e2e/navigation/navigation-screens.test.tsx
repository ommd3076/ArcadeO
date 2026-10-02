import { AuthProvider } from "../../../src/app/auth";
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { HomePage } from "../../../src/app/pages/home-page";
import { GamesPage } from "../../../src/app/pages/games-page";
import { UsPage } from "../../../src/app/pages/us-page";
import { GameDetailScreen } from "../../../src/screens/game-detail";
import { SudokuListScreen } from "../../../src/screens/sudoku-list";

describe("Product Navigation and Shell Screens (Task U06)", () => {
  it("renders HomePage with a greeting, shared activity and all quick game links", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(AuthProvider, null, React.createElement(HomePage)),
        ),
      ),
    );

    expect(html).toContain("Welcome");
    expect(html).toContain("This week");
    expect(html).toContain("Play a game");
    expect(html).toContain("All eight games");
    expect(html).toContain("Connect Four");
    expect(html).toContain("Sudoku");
    expect(html).toContain("Ludo");
    expect(html).toContain("Rock Paper Scissors");
  });

  it("renders GamesPage with all eight distinct games and zero placeholder cards", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ThemeProvider, null, React.createElement(GamesPage)),
      ),
    );

    expect(html).toContain("Games");
    expect(html).toContain("Connect Four");
    expect(html).toContain("Rock Paper Scissors");
    expect(html).toContain("Ludo");
    expect(html).toContain("Snakes &amp; Ladders");
    expect(html).toContain("Dots &amp; Boxes");
    expect(html).toContain("SOS");
    expect(html).toContain("Hand Cricket");
    expect(html).toContain("Sudoku");
    expect(html).not.toContain("Coming Soon");
  });

  it("renders UsPage with shared records, appearance controls and piece identity", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(AuthProvider, null, React.createElement(UsPage)),
        ),
      ),
    );

    expect(html).toContain("Us &amp; appearance");
    expect(html).toContain("Shared records");
    expect(html).toContain("By game");
    expect(html).toContain("Theme family");
    expect(html).toContain("Standard");
    expect(html).toContain("Romantic");
    expect(html).toContain("Display mode");
    expect(html).toContain("Dark");
    expect(html).toContain("Light");
    expect(html).toContain("System");
    expect(html).toContain("Piece identity");
    expect(html).toContain("Teal");
    expect(html).toContain("Violet");
    expect(html).toContain("Sign out");
  });

  it("renders GameDetailScreen with mode selection and Start Match button", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/games/connect-four"] },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(AuthProvider, null, React.createElement(GameDetailScreen)),
        ),
      ),
    );

    expect(html).toContain("Choose Play Mode");
    expect(html).toContain("Remote");
    expect(html).toContain("Together");
    expect(html).toContain("Start Match");
  });

  it("renders an authored recovery state for an unknown game route", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/games/not-a-game"] },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/games/:gameId",
              element: React.createElement(GameDetailScreen),
            }),
          ),
        ),
      ),
    );

    expect(html).toContain("This game is unavailable");
    expect(html).toContain("Back to Games");
    expect(html).not.toContain("Start Match");
  });

  it("renders SudokuListScreen with vault mode selector and puzzle selection", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/games/sudoku"] },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(AuthProvider, null, React.createElement(SudokuListScreen)),
        ),
      ),
    );

    expect(html).toContain("Choose your Sudoku");
    expect(html).toContain("Practice");
    expect(html).toContain("Duel");
    expect(html).toContain("Challenge");
  });
});
