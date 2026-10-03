import fs from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { action, create, login, request, solve, view } from "./helpers";

type SudokuView = {
  puzzleId: string;
  givens: string;
  mode: "practice" | "duel" | "challenge";
  self: {
    cells?: number[];
    filledCount: number;
    elapsedMs: number;
    completed: boolean;
  };
  challenge?: { published: boolean; accepted: boolean; targetElapsedMs?: number };
};

async function solutions(): Promise<Record<string, string>> {
  return JSON.parse(await fs.readFile("content/sudoku/solutions.json", "utf8")) as Record<
    string,
    string
  >;
}

async function enterCorrectDigit(page: Page, matchId: string) {
  const state = (await view(page, matchId)).gameState as SudokuView;
  const index = state.givens.split("").findIndex((digit) => digit === "0");
  expect(index, "fixture puzzle includes an editable cell").toBeGreaterThanOrEqual(0);
  const answer = Number((await solutions())[state.puzzleId][index]);
  const row = Math.floor(index / 9);
  const col = index % 9;
  await page.getByTestId(`sudoku-cell-${row}-${col}`).click();
  await page.getByTestId(`sudoku-pad-${answer}`).click();
  await expect
    .poll(async () => (await view(page, matchId)).gameState.self.cells?.[index])
    .toBe(answer);
  return { index, answer, row, col };
}

async function leaveAndSaveFromUi(page: Page) {
  await page.getByRole("button", { name: "Match Options", exact: true }).click();
  await page.getByRole("button", { name: "Leave and save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leave and save this match?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm leave and save", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
}

async function resumeFromSudokuSetup(page: Page, mode: "challenge" | "duel") {
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,|Welcome/ })).toBeVisible();
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await page.getByRole("link", { name: /Sudoku\./ }).click();
  await page.getByTestId(`mode-${mode}`).click();
  await expect(page.getByText(`Paused ${mode} attempt`, { exact: true })).toBeVisible();
  const pausedAttempt = page.getByText(`Paused ${mode} attempt`, { exact: true }).locator("..");
  await pausedAttempt.getByRole("button", { name: "Resume saved attempt", exact: true }).click();
}

async function openVaultSavedSudoku(page: Page, modeLabel: string) {
  if (!page.url().endsWith("/us"))
    await page.getByRole("link", { name: "Us", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved matches" })).toBeVisible();
  const row = page
    .locator(".saved-match-row")
    .filter({ has: page.getByRole("heading", { name: "Sudoku" }) });
  await expect(row).toContainText(`${modeLabel} · Paused`);
  await row.getByRole("link", { name: "Resume paused Sudoku match", exact: true }).click();
}

async function clearPracticeSlot(page: Page) {
  const { body } = await request(page, "/api/v1/matches");
  const practiceMatches = (body.matches ?? []).filter(
    (match: { gameId: string; mode: string; lifecycle: string }) =>
      match.gameId === "sudoku" &&
      match.mode === "practice" &&
      ["waiting", "active", "saved"].includes(match.lifecycle),
  ) as Array<{ matchId: string }>;
  for (const match of practiceMatches) {
    const snapshot = await view(page, match.matchId);
    if (snapshot.legalActions?.includes("match.request-abandon"))
      await action(page, match.matchId, "match.request-abandon");
  }
}

async function requestAndAgreeAbandon(a: Page, b: Page, matchId: string) {
  let state = await view(a, matchId);
  if (["completed", "resigned", "abandoned", "cancelled"].includes(state.lifecycle)) return;

  if (state.lifecycle === "saved") {
    if (state.mode === "duel") {
      await action(a, matchId, "match.resume", { pauseId: state.pauseId });
      state = await view(a, matchId);
      if (state.lifecycle === "saved")
        await action(b, matchId, "match.resume", { pauseId: state.pauseId });
    } else if (state.mode === "challenge" && (state.gameState as SudokuView).challenge?.accepted) {
      // A is the completed sender; only B, the active receiver, can resume.
      await action(b, matchId, "match.resume", { pauseId: state.pauseId });
    } else {
      // An unpublished sender Challenge is a sole-participant attempt.
      await action(a, matchId, "match.request-abandon");
      return;
    }
  }

  state = await view(a, matchId);
  if (state.lifecycle === "active") {
    await action(a, matchId, "match.request-abandon");
    await action(b, matchId, "match.agree-abandon");
  }
}

async function choosePuzzleNotCompletedByA(page: Page) {
  const records = (await request(page, "/api/v1/records/summary")).body as {
    ownCompletedPuzzleIds: string[];
  };
  const catalog = JSON.parse(await fs.readFile("content/sudoku/catalog.json", "utf8")) as Array<{
    puzzleId: string;
    bucket: string;
  }>;
  const candidate = catalog.find(
    (puzzle) =>
      puzzle.bucket === "easy" && !records.ownCompletedPuzzleIds.includes(puzzle.puzzleId),
  );
  expect(candidate, "synthetic A account has an uncompleted easy Sudoku puzzle").toBeTruthy();
  return candidate!.puzzleId;
}

test("REC08: unpublished Async sender saves, reloads, and resumes alone through the UI", async ({
  page,
}) => {
  await login(page, "A");
  const matchId = await create(page, "sudoku", "challenge", { bucket: "easy" });
  try {
    await page.goto(`/matches/${matchId}`);
    const initial = (await view(page, matchId)).gameState as SudokuView;
    expect(initial.mode).toBe("challenge");
    expect(initial.challenge).toMatchObject({ published: false, accepted: false });
    const entered = await enterCorrectDigit(page, matchId);

    await leaveAndSaveFromUi(page);
    await page.reload();
    await resumeFromSudokuSetup(page, "challenge");
    await expect(page.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await expect(
      page.getByText(
        "Your unpublished Sudoku sender attempt is saved. Resume it to continue the puzzle.",
      ),
    ).toBeVisible();
    const saved = await view(page, matchId);
    expect(saved.lifecycle).toBe("saved");
    expect((saved.gameState as SudokuView).self.filledCount).toBe(initial.self.filledCount + 1);

    const elapsedWhileSaved = (saved.gameState as SudokuView).self.elapsedMs;
    await page.waitForTimeout(1100);
    await page.reload();
    await page.getByRole("button", { name: "Resume challenge attempt", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).lifecycle).toBe("active");
    const resumed = (await view(page, matchId)).gameState as SudokuView;
    expect(resumed.self.cells?.[entered.index]).toBe(entered.answer);
    expect(resumed.self.elapsedMs).toBeGreaterThanOrEqual(elapsedWhileSaved + 900);
    await expect(page.getByTestId(`sudoku-cell-${entered.row}-${entered.col}`)).toContainText(
      String(entered.answer),
    );
  } finally {
    try {
      const snapshot = await view(page, matchId);
      if (snapshot.lifecycle === "active" || snapshot.lifecycle === "saved")
        await action(page, matchId, "match.request-abandon");
    } catch {
      // Restrict cleanup to this synthetic sender attempt.
    }
  }
});

test("REC07B/UI05: B's Practice saves through Home and resumes with its own digit", async ({
  page,
}) => {
  await login(page, "B");
  await clearPracticeSlot(page);
  const puzzleId = "easy-001";
  const matchId = await create(page, "sudoku", "practice", { puzzleId });
  try {
    await page.goto(`/matches/${matchId}`);
    const state = (await view(page, matchId)).gameState as SudokuView;
    const index = state.givens.split("").findIndex((digit) => digit === "0");
    expect(index, "B's practice puzzle has an editable cell").toBeGreaterThanOrEqual(0);
    const answer = Number((await solutions())[puzzleId][index]);
    const row = Math.floor(index / 9);
    const col = index % 9;
    await page.getByTestId(`sudoku-cell-${row}-${col}`).click();
    await page.getByTestId(`sudoku-pad-${answer}`).click();
    await expect
      .poll(async () => (await view(page, matchId)).gameState.self.cells?.[index])
      .toBe(answer);

    await leaveAndSaveFromUi(page);
    await page.reload();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.getByText("Saved match", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sudoku", exact: true })).toBeVisible();
    await expect(page.locator(".home-continue__context")).toHaveText("Practice");
    await page.getByRole("link", { name: "Resume Sudoku", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    const saved = await view(page, matchId);
    expect(saved.lifecycle).toBe("saved");
    expect((saved.gameState as SudokuView).mode).toBe("practice");
    await page.getByRole("button", { name: "Resume practice", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).lifecycle).toBe("active");
    await expect(page.getByTestId(`sudoku-cell-${row}-${col}`)).toContainText(String(answer));
  } finally {
    try {
      const snapshot = await view(page, matchId);
      if (snapshot.lifecycle === "active" || snapshot.lifecycle === "saved")
        await action(page, matchId, "match.request-abandon");
    } catch {
      // Cleanup is limited to this synthetic B Practice attempt.
    }
  }
});

test("REC09: accepted Async receiver resumes alone while the completed sender stays in history", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  let matchId: string | undefined;
  try {
    await login(a, "A");
    await login(b, "B");
    // Setup only: the normal sender completion uses the existing API solver.
    const senderAttemptId = await create(a, "sudoku", "challenge", { bucket: "medium" });
    await solve(a, senderAttemptId);
    await a.goto(`/matches/${senderAttemptId}`);
    await a.getByRole("button", { name: "Send this challenge", exact: true }).click();
    await expect.poll(() => a.url().split("/").at(-1)).not.toBe(senderAttemptId);
    matchId = a.url().split("/").at(-1)!;
    expect(matchId).not.toBe(senderAttemptId);

    // The receiver's Accept, cell edit, Save, reload and sole Resume are real UI actions.
    await b.goto(`/matches/${matchId}`);
    await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await expect.poll(async () => (await view(b, matchId!)).lifecycle).toBe("active");
    expect(((await view(b, matchId)).gameState as SudokuView).challenge).toMatchObject({
      published: true,
      accepted: true,
    });
    const entered = await enterCorrectDigit(b, matchId);
    await leaveAndSaveFromUi(b);
    await openVaultSavedSudoku(b, "challenge");
    await expect(b.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await expect(
      b.getByText(
        "Your accepted Sudoku challenge is saved. Resume your attempt when you are ready.",
      ),
    ).toBeVisible();

    await a.goto(`/matches/${matchId}`);
    await expect(
      a.getByText(
        "Your completed sender attempt is saved in history. The receiver continues the accepted challenge.",
      ),
    ).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Resume challenge attempt", exact: true }),
    ).toHaveCount(0);

    const elapsedWhileSaved = ((await view(b, matchId)).gameState as SudokuView).self.elapsedMs;
    await b.waitForTimeout(1100);
    await b.reload();
    await b.getByRole("button", { name: "Resume challenge attempt", exact: true }).click();
    await expect.poll(async () => (await view(b, matchId!)).lifecycle).toBe("active");
    const resumed = await view(b, matchId);
    expect(((resumed.gameState as SudokuView).self.cells ?? [])[entered.index]).toBe(
      entered.answer,
    );
    expect((resumed.gameState as SudokuView).self.elapsedMs).toBeGreaterThanOrEqual(
      elapsedWhileSaved + 900,
    );
    // The sender did not acknowledge: the receiver's single click restored Active.
    expect(resumed.lifecycle).toBe("active");
    expect((resumed.gameState as SudokuView).challenge?.targetElapsedMs).toBeGreaterThan(0);
  } finally {
    if (matchId) {
      try {
        await requestAndAgreeAbandon(a, b, matchId);
      } catch {
        // Only the synthetic published Challenge created by this test is touched.
      }
    }
    await Promise.all([contextA.close(), contextB.close()]);
  }
});

test("REC04/REC10: simultaneous private Duel edits, two UI resume acknowledgments, and history-only completion", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  let matchId: string | undefined;
  try {
    await login(a, "A");
    await login(b, "B");
    const recordsBefore = (await request(a, "/api/v1/records/summary")).body as {
      ownCompletedPuzzleIds: string[];
      summary: unknown;
      byGame: Record<string, unknown>;
      sudokuBestTimes: Record<string, unknown>;
    };
    const puzzleId = await choosePuzzleNotCompletedByA(a);
    matchId = await create(a, "sudoku", "duel", { puzzleId });
    await a.goto(`/matches/${matchId}`);
    await b.goto(`/matches/${matchId}`);
    await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await a.bringToFront();
    await a.getByRole("button", { name: "I am ready", exact: true }).click();
    await b.bringToFront();
    await b.getByRole("button", { name: "I am ready", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).gameState.hasStarted).toBe(true);
    await expect.poll(async () => (await view(a, matchId!)).lifecycle).toBe("active");

    const [firstDigit, secondDigit] = await Promise.all([
      enterCorrectDigit(a, matchId),
      enterCorrectDigit(b, matchId),
    ]);
    expect(secondDigit.index).toBe(firstDigit.index);
    expect(secondDigit.answer).toBe(firstDigit.answer);
    const [editedA, editedB] = await Promise.all([view(a, matchId), view(b, matchId)]);
    expect(editedA.gameState.self.cells[firstDigit.index]).toBe(firstDigit.answer);
    expect(editedB.gameState.self.cells[secondDigit.index]).toBe(secondDigit.answer);
    expect(editedA.gameState.opponent.cells).toBeUndefined();
    expect(editedB.gameState.opponent.cells).toBeUndefined();

    await a.bringToFront();
    await leaveAndSaveFromUi(a);
    await expect(b.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await resumeFromSudokuSetup(a, "duel");
    await b.reload();
    await b.goto("/us");
    await openVaultSavedSudoku(b, "duel");
    await expect(a.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    const paused = await view(a, matchId);
    expect(paused.lifecycle).toBe("saved");
    expect(paused.resumeReadiness).toMatchObject({ A: false, B: false });

    await a.getByRole("button", { name: "Resume saved match", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).resumeReadiness.A).toBe(true);
    expect((await view(a, matchId)).lifecycle).toBe("saved");
    await expect(a.getByRole("button", { name: /Resume request sent/ })).toBeDisabled();

    await b.getByRole("button", { name: "Resume saved match", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).lifecycle).toBe("active");
    const resumedA = await view(a, matchId);
    const resumedB = await view(b, matchId);
    expect(resumedA.gameState.self.cells[firstDigit.index]).toBe(firstDigit.answer);
    expect(resumedB.gameState.self.cells[secondDigit.index]).toBe(secondDigit.answer);
    expect(resumedA.gameState.opponent.cells).toBeUndefined();
    expect(resumedB.gameState.opponent.cells).toBeUndefined();

    // Finish via the standard API solver only after UI-owned save and two-seat resume.
    const terminal = await solve(a, matchId);
    expect(terminal.lifecycle).toBe("completed");
    expect(terminal.result.details.interrupted).toBe(true);
    await a.reload();
    await expect(
      a.locator(".arcade-match-result").getByText("Duel completed · history only", { exact: true }),
    ).toBeVisible();
    await expect(
      a
        .locator(".arcade-match-result")
        .getByText(
          /Deliberately saved and resumed duels stay in history, but do not count toward competitive wins, streaks, or best times\./,
        ),
    ).toBeVisible();

    await expect
      .poll(async () => {
        const recent = (await request(a, "/api/v1/records/recent")).body.recentMatches as Array<{
          matchId: string;
          interrupted: boolean;
        }>;
        return recent.find((entry) => entry.matchId === matchId)?.interrupted ?? false;
      })
      .toBe(true);
    const recordsAfter = (await request(a, "/api/v1/records/summary")).body as {
      ownCompletedPuzzleIds: string[];
      summary: unknown;
      byGame: Record<string, unknown>;
      sudokuBestTimes: Record<string, unknown>;
    };
    expect(recordsAfter.summary).toEqual(recordsBefore.summary);
    expect(recordsAfter.byGame.sudoku ?? null).toEqual(recordsBefore.byGame.sudoku ?? null);
    expect(recordsAfter.sudokuBestTimes[puzzleId]).toBeUndefined();
    expect(recordsAfter.ownCompletedPuzzleIds).toContain(puzzleId);
  } finally {
    if (matchId) {
      try {
        await requestAndAgreeAbandon(a, b, matchId);
      } catch {
        // Preserve the focused recovery assertion; cleanup targets this synthetic Duel only.
      }
    }
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
