import { AuthProvider } from "../../../src/app/auth";
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/theme/theme-context";
import { HomePage } from "../../../src/app/pages/home-page";
import { GamesPage } from "../../../src/app/pages/games-page";
import { UsPage } from "../../../src/app/pages/us-page";
import { GameDetailScreen } from "../../../src/screens/game-detail";
import { SudokuListScreen } from "../../../src/screens/sudoku-list";

describe("Product Navigation and Shell Screens (Task U06)", () => {
  it("renders HomePage with welcome greeting, weekly momentum and quick play grid", () => {
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

    expect(html).toContain("Welcome Back");
    expect(html).toContain("Weekly shared momentum");
    expect(html).toContain("Quick Play");
    expect(html).toContain("All 8 Games");
    expect(html).toContain("Connect Four");
    expect(html).toContain("Sudoku");
    expect(html).toContain("Ludo");
    expect(html).toContain("RPS");
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

  it("renders UsPage with head-to-head records, theme palettes, modes and accents", () => {
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

    expect(html).toContain("Us &amp; Appearance");
    expect(html).toContain("Head-to-Head");
    expect(html).toContain("Palette Family");
    expect(html).toContain("Standard");
    expect(html).toContain("Romantic");
    expect(html).toContain("Color Mode (Dark Default)");
    expect(html).toContain("Dark");
    expect(html).toContain("Light");
    expect(html).toContain("System");
    expect(html).toContain("Player Accent");
    expect(html).toContain("Teal");
    expect(html).toContain("Violet");
    expect(html).toContain("Sign Out");
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

    expect(html).toContain("Sudoku Vault");
    expect(html).toContain("Practice");
    expect(html).toContain("Duel");
    expect(html).toContain("Challenge");
  });
});
