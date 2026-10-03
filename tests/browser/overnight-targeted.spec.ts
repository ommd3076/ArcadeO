import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { action, create, login, origin, request, view } from "./helpers";

async function closeContexts(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

async function enterDigit(page: Page, index: number, digit: number) {
  const cell = page.getByTestId(`sudoku-cell-${Math.floor(index / 9)}-${index % 9}`);
  await expect(cell).toBeEnabled();
  await cell.click();
  const pad = page.getByTestId(`sudoku-pad-${digit}`);
  await expect(pad).toBeEnabled();
  await pad.click();
}

async function clearSyntheticPracticeSlot(page: Page) {
  const { body } = await request(page, "/api/v1/matches");
  const practiceMatches = (body.matches ?? []).filter(
    (match: { gameId: string; mode: string; lifecycle: string }) =>
      match.gameId === "sudoku" &&
      match.mode === "practice" &&
      ["waiting", "active", "saved"].includes(match.lifecycle),
  ) as Array<{ matchId: string }>;
  for (const match of practiceMatches) {
    let snapshot = await view(page, match.matchId);
    if (!snapshot.controller?.isController) {
      const takeover = await request(page, `/api/v1/matches/${match.matchId}/controller`, "POST", {
        expectedControllerGeneration: snapshot.controller?.controllerGeneration,
      });
      expect(takeover.r.status()).toBe(200);
      snapshot = await view(page, match.matchId);
    }
    if (snapshot.legalActions?.includes("match.request-abandon")) {
      const abandoned = await action(page, match.matchId, "match.request-abandon");
      expect(abandoned.lifecycle).toBe("abandoned");
    } else if (snapshot.legalActions?.includes("match.cancel")) {
      const cancelled = await action(page, match.matchId, "match.cancel");
      expect(cancelled.lifecycle).toBe("cancelled");
    } else {
      throw new Error("Synthetic Practice slot could not be cleared by its current controller");
    }
  }
}

test("SEC01: independent accounts receive distinct browser session cookies and cannot read a private match", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  let matchId: string | undefined;
  try {
    await login(a, "A");
    await login(b, "B");
    const [cookiesA, cookiesB] = await Promise.all([
      contextA.cookies(origin),
      contextB.cookies(origin),
    ]);
    const sessionA = cookiesA.find((cookie) => cookie.name === "arcade-session")?.value;
    const sessionB = cookiesB.find((cookie) => cookie.name === "arcade-session")?.value;
    expect(sessionA).toBeTruthy();
    expect(sessionB).toBeTruthy();
    expect(sessionA).not.toBe(sessionB);

    matchId = await create(a, "sudoku", "practice", { puzzleId: "easy-001" });
    const response = await b.request.get(`/api/v1/matches/${matchId}`);
    expect([403, 404]).toContain(response.status());
    const body = await response.json();
    expect(body.view).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("easy-001");
  } finally {
    await closeContexts([contextA, contextB]);
  }
});

test("SEC08: stale account preference write is rejected in the UI without replacing the saved family", async ({
  browser,
}) => {
  const firstContext = await browser.newContext({ serviceWorkers: "block" });
  const secondContext = await browser.newContext({ serviceWorkers: "block" });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  try {
    await login(first, "A");
    await first.goto("/us");
    // Reproduce the non-default starting family left by earlier full-suite cases.
    await expect(first.getByLabel("Display name")).toBeVisible();
    await first.getByRole("button", { name: "Romantic", exact: true }).click();
    await expect(first.getByRole("status")).toContainText("Account preferences saved.");
    await login(second, "A");
    await second.goto("/us");
    await expect(first.getByLabel("Display name")).toBeVisible();
    await expect(second.getByLabel("Display name")).toBeVisible();

    const initialProfile = await request(first, "/api/v1/profile");
    expect(initialProfile.r.status()).toBe(200);
    const initialFamily = initialProfile.body.profile.paletteFamily;
    expect(["standard", "romantic"]).toContain(initialFamily);
    const initialLabel = initialFamily === "standard" ? "Standard" : "Romantic";
    const targetFamily = initialFamily === "standard" ? "romantic" : "standard";
    const targetLabel = targetFamily === "romantic" ? "Romantic" : "Standard";
    await expect(second.getByRole("button", { name: initialLabel, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await first.getByRole("button", { name: targetLabel, exact: true }).click();
    await expect(first.getByRole("status")).toContainText("Account preferences saved.");
    await second.getByRole("button", { name: targetLabel, exact: true }).click();
    await expect(second.getByRole("status")).toContainText(
      "Preferences changed on another device. Reload your account settings and retry.",
    );
    const savedProfile = await request(first, "/api/v1/profile");
    expect(savedProfile.r.status()).toBe(200);
    expect(savedProfile.body.profile.paletteFamily).toBe(targetFamily);
    await expect(second.getByRole("button", { name: initialLabel, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } finally {
    await closeContexts([firstContext, secondContext]);
  }
});

test("REC03: Sudoku Duel A takeover preserves B control while the old A session loses edits", async ({
  browser,
}) => {
  const contextA1 = await browser.newContext({ serviceWorkers: "block" });
  const contextA2 = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a1 = await contextA1.newPage();
  const a2 = await contextA2.newPage();
  const b = await contextB.newPage();
  let matchId: string | undefined;
  try {
    await login(a1, "A");
    const puzzleId = "easy-001";
    matchId = await create(a1, "sudoku", "duel", { puzzleId });
    await a1.goto(`/matches/${matchId}`);
    await login(b, "B");
    await b.goto(`/matches/${matchId}`);
    await a1.bringToFront();
    await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await a1.bringToFront();
    await a1.getByRole("button", { name: "I am ready", exact: true }).click();
    await b.bringToFront();
    await b.getByRole("button", { name: "I am ready", exact: true }).click();
    await a1.bringToFront();
    await expect.poll(async () => (await view(a1, matchId!)).gameState.hasStarted).toBe(true);
    await expect.poll(async () => (await view(a1, matchId!)).lifecycle).toBe("active");
    expect((await view(a1, matchId)).controller.isController).toBe(true);
    expect((await view(b, matchId)).controller.isController).toBe(true);
    const stateA1 = (await view(a1, matchId)).gameState;
    expect(stateA1.self.paused).toBe(false);
    const indexA = stateA1.givens.split("").findIndex((digit: string) => digit === "0");
    expect(indexA).toBeGreaterThanOrEqual(0);
    const cellA1 = a1.getByTestId(`sudoku-cell-${Math.floor(indexA / 9)}-${indexA % 9}`);
    await expect(
      cellA1,
      JSON.stringify({
        lifecycle: (await view(a1, matchId)).lifecycle,
        controller: (await view(a1, matchId)).controller,
        game: stateA1,
        actions: (await view(a1, matchId)).legalActions,
        turn: await a1.locator(".arcade-turn-strip").innerText(),
        status: await a1
          .locator(".arcade-connection-status")
          .textContent()
          .catch(() => null),
      }),
    ).toBeEnabled();
    await expect(
      b.getByTestId(`sudoku-cell-${Math.floor(indexA / 9)}-${indexA % 9}`),
    ).toBeEnabled();

    await login(a2, "A");
    await a2.goto(`/matches/${matchId}`);
    await a2.bringToFront();
    await a2.getByRole("button", { name: "Continue on this device", exact: true }).click();
    await expect.poll(() => a2.getByTestId("sudoku-pad-1").isEnabled()).toBe(true);
    await expect(a2.getByTestId("sudoku-pad-1")).toBeEnabled();
    await expect(a1.getByTestId("sudoku-pad-1")).toBeDisabled();
    await b.bringToFront();
    await expect(b.getByTestId("sudoku-pad-1")).toBeEnabled();

    const solutions = JSON.parse(
      await (await import("node:fs/promises")).readFile("content/sudoku/solutions.json", "utf8"),
    ) as Record<string, string>;
    const stateA2 = (await view(a2, matchId)).gameState;
    const emptyForA = stateA2.givens.split("").findIndex((digit: string) => digit === "0");
    const stateB = (await view(b, matchId)).gameState;
    const indexB = stateB.givens.split("").findIndex((digit: string) => digit === "0");
    expect(emptyForA).toBeGreaterThanOrEqual(0);
    expect(indexB).toBeGreaterThanOrEqual(0);
    await a2.bringToFront();
    await enterDigit(a2, emptyForA, Number(solutions[puzzleId][emptyForA]));
    await expect
      .poll(async () => (await view(a2, matchId!)).gameState.self.cells[emptyForA])
      .toBe(Number(solutions[puzzleId][emptyForA]));
    await b.bringToFront();
    await enterDigit(b, indexB, Number(solutions[puzzleId][indexB]));
    await expect
      .poll(async () => (await view(b, matchId!)).gameState.self.cells[indexB])
      .toBe(Number(solutions[puzzleId][indexB]));
    await a1.bringToFront();
    await expect(
      a1.getByTestId(`sudoku-cell-${Math.floor(emptyForA / 9)}-${emptyForA % 9}`),
    ).toBeDisabled();
  } finally {
    if (matchId) {
      try {
        const snapshot = await view(a2, matchId);
        if (snapshot.lifecycle === "active")
          await action(a2, matchId, "match.resign", { resigningSeat: "A" });
      } catch {
        // Cleanup is best-effort; retain the primary browser assertion if it failed.
      }
    }
    await closeContexts([contextA1, contextA2, contextB]);
  }
});

test("REC03: Sudoku Duel B takeover leaves A editable and revokes the prior B session", async ({
  browser,
}) => {
  const contextB1 = await browser.newContext({ serviceWorkers: "block" });
  const contextB2 = await browser.newContext({ serviceWorkers: "block" });
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const b1 = await contextB1.newPage();
  const b2 = await contextB2.newPage();
  const a = await contextA.newPage();
  let matchId: string | undefined;
  try {
    await login(b1, "B");
    matchId = await create(b1, "sudoku", "duel", { puzzleId: "easy-001" });
    await b1.goto(`/matches/${matchId}`);
    await login(a, "A");
    await a.goto(`/matches/${matchId}`);
    await a.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await b1.bringToFront();
    await b1.getByRole("button", { name: "I am ready", exact: true }).click();
    await a.bringToFront();
    await a.getByRole("button", { name: "I am ready", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).gameState.hasStarted).toBe(true);
    await expect.poll(async () => (await view(a, matchId!)).lifecycle).toBe("active");

    await login(b2, "B");
    await b2.goto(`/matches/${matchId}`);
    await b2.bringToFront();
    await b2.getByRole("button", { name: "Continue on this device", exact: true }).click();
    await expect.poll(() => b2.getByTestId("sudoku-pad-1").isEnabled()).toBe(true);
    await expect(b1.getByTestId("sudoku-pad-1")).toBeDisabled();
    await expect(a.getByTestId("sudoku-pad-1")).toBeEnabled();

    const solutions = JSON.parse(
      await (await import("node:fs/promises")).readFile("content/sudoku/solutions.json", "utf8"),
    ) as Record<string, string>;
    const stateA = (await view(a, matchId)).gameState;
    const indexA = stateA.givens.split("").findIndex((digit: string) => digit === "0");
    expect(indexA).toBeGreaterThanOrEqual(0);
    await a.bringToFront();
    await enterDigit(a, indexA, Number(solutions["easy-001"][indexA]));
    await expect
      .poll(async () => (await view(a, matchId!)).gameState.self.cells[indexA])
      .toBe(Number(solutions["easy-001"][indexA]));
    await expect(b1.getByTestId("sudoku-pad-1")).toBeDisabled();
    expect((await view(b2, matchId)).controller.isController).toBe(true);
  } finally {
    if (matchId) {
      try {
        const snapshot = await view(b2, matchId);
        if (snapshot.lifecycle === "active")
          await action(b2, matchId, "match.resign", { resigningSeat: "B" });
      } catch {
        // Keep cleanup isolated to synthetic test data.
      }
    }
    await closeContexts([contextB1, contextB2, contextA]);
  }
});

test("REC07: Sudoku Practice A keeps a UI-entered digit through save, reload, and resume", async ({
  page,
}) => {
  await login(page, "A");
  await clearSyntheticPracticeSlot(page);
  const puzzleId = "easy-001";
  const matchId = await create(page, "sudoku", "practice", { puzzleId });
  const solutions = JSON.parse(
    await (await import("node:fs/promises")).readFile("content/sudoku/solutions.json", "utf8"),
  ) as Record<string, string>;
  try {
    await page.goto(`/matches/${matchId}`);
    const state = (await view(page, matchId)).gameState;
    const initialFilledCount = state.self.filledCount;
    const index = state.givens.split("").findIndex((digit: string) => digit === "0");
    expect(index).toBeGreaterThanOrEqual(0);
    const answer = Number(solutions[puzzleId][index]);
    await enterDigit(page, index, answer);
    await expect
      .poll(async () => (await view(page, matchId)).gameState.self.cells[index])
      .toBe(answer);

    await page.getByRole("button", { name: "Match Options", exact: true }).click();
    await page.getByRole("button", { name: "Leave and save", exact: true }).click();
    await page.getByRole("button", { name: "Confirm leave and save", exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await page.goto(`/matches/${matchId}`);
    await expect(page.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    const savedView = await view(page, matchId);
    expect(savedView.gameState.self.filledCount).toBe(initialFilledCount + 1);
    expect(savedView.gameState.self.cells).toBeUndefined();
    await page.getByRole("button", { name: "Resume practice", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).lifecycle).toBe("active");
    await expect(
      page.getByTestId(`sudoku-cell-${Math.floor(index / 9)}-${index % 9}`),
    ).toContainText(String(answer));
    await expect(page.getByTestId("sudoku-pad-1")).toBeEnabled();
  } finally {
    try {
      const snapshot = await view(page, matchId);
      if (snapshot.lifecycle === "active" || snapshot.lifecycle === "saved")
        await action(page, matchId, "match.request-abandon");
    } catch {
      // Isolated synthetic fixture only; keep the original test failure visible.
    }
  }
});

test("REC12: a Together secret handoff survives save and resume without exposing the locked choice", async ({
  page,
}) => {
  await login(page, "A");
  const matchId = await create(page, "rock-paper-scissors", "together");
  try {
    await page.goto(`/matches/${matchId}`);
    await expect(page.locator(".arcade-secret-handoff")).toBeVisible();
    const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await unmask.isVisible()) await unmask.click();
    await page.getByRole("button", { name: /I am .*\(Ready\)/ }).click();
    await page.getByRole("radio", { name: "Rock", exact: true }).click();
    await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).gameState.lockedSeats).toContain("A");
    await page.getByRole("button", { name: "Match Options", exact: true }).click();
    await page.getByRole("button", { name: "Leave and save", exact: true }).click();
    await page.getByRole("button", { name: "Confirm leave and save", exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await page.goto(`/matches/${matchId}`);
    await expect(page.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    expect((await view(page, matchId)).lifecycle).toBe("saved");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await page.getByRole("button", { name: "Resume saved match", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).lifecycle).toBe("active");
    await expect(page.locator(".arcade-secret-handoff")).toBeVisible();
    const resumedUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await resumedUnmask.isVisible()) await resumedUnmask.click();
    await expect(page.getByRole("button", { name: /I am .*\(Ready\)/ })).toBeVisible();
    await page.getByRole("button", { name: /I am .*\(Ready\)/ }).click();
    const paper = page.getByRole("radio", { name: "Paper", exact: true });
    await expect(paper).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("heading", { name: "Round 1 Result" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reveal Outcome", exact: true })).toHaveCount(0);
  } finally {
    try {
      const snapshot = await view(page, matchId);
      if (snapshot.lifecycle === "active") await action(page, matchId, "match.agree-abandon");
    } catch {
      // Fixture cleanup must not hide the original failure.
    }
  }
});

test("REC11: saved Remote secret round resumes only after both participants acknowledge, without revealing the locked choice", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  let matchId: string | undefined;
  try {
    await login(a, "A");
    matchId = await create(a, "rock-paper-scissors", "remote");
    await a.goto(`/matches/${matchId}`);
    await login(b, "B");
    await b.goto(`/matches/${matchId}`);
    await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await a.bringToFront();
    await a.getByRole("button", { name: "I am ready", exact: true }).click();
    await b.bringToFront();
    await b.getByRole("button", { name: "I am ready", exact: true }).click();

    await a.bringToFront();
    await expect(a.locator(".arcade-secret-handoff")).toBeVisible();
    const unmaskA = a.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await unmaskA.isVisible()) await unmaskA.click();
    await a.getByRole("radio", { name: "Rock", exact: true }).click();
    await a.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).gameState.lockedSeats).toContain("A");
    await expect(b.getByRole("heading", { name: "Round 1 Result" })).toHaveCount(0);

    await a.getByRole("button", { name: "Match Options", exact: true }).click();
    await a.getByRole("button", { name: "Leave and save", exact: true }).click();
    await a.getByRole("button", { name: "Confirm leave and save", exact: true }).click();
    await expect(a).toHaveURL(/\/games$/);
    await expect.poll(async () => (await view(b, matchId!)).lifecycle).toBe("saved");
    const hiddenChoice = JSON.stringify(await view(b, matchId));
    expect(hiddenChoice).not.toContain('"rock"');
    await b.reload();
    await expect(b.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await expect(b.getByText(/Both players must resume this match\./)).toBeVisible();

    await a.goto(`/matches/${matchId}`);
    await expect(a.getByRole("heading", { name: "Match paused and saved" })).toBeVisible();
    await a.getByRole("button", { name: "Resume saved match", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).resumeReadiness.A).toBe(true);
    expect((await view(a, matchId)).lifecycle).toBe("saved");
    await expect(a.getByRole("button", { name: /Resume request sent/ })).toBeDisabled();
    await b.getByRole("button", { name: "Resume saved match", exact: true }).click();
    await expect.poll(async () => (await view(a, matchId!)).lifecycle).toBe("active");
    const resumedA = await view(a, matchId);
    const resumedB = await view(b, matchId);
    expect(resumedA.gameState.lockedSeats).toContain("A");
    expect(resumedB.gameState.lockedSeats).toContain("A");
    expect(JSON.stringify(resumedB)).not.toContain('"rock"');
    await expect(b.getByRole("heading", { name: "Round 1 Result" })).toHaveCount(0);
    await expect(b.getByRole("button", { name: "Reveal Outcome", exact: true })).toHaveCount(0);
  } finally {
    if (matchId) {
      try {
        const snapshot = await view(a, matchId);
        if (snapshot.lifecycle === "active" || snapshot.lifecycle === "saved")
          await action(a, matchId, "match.request-abandon");
      } catch {
        // Fixture cleanup is best-effort and must not mask the primary assertion.
      }
    }
    await closeContexts([contextA, contextB]);
  }
});

test("REC06: forced socket outage falls back to HTTP, submits through UI, and stops hidden polling", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  let socketAttempts = 0;
  let peerSocketOpened = false;
  const matchReads: number[] = [];
  await contextA.addInitScript(() => {
    let hidden = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    Object.defineProperty(window, "__qaSetHidden", {
      configurable: true,
      value: (value: boolean) => {
        hidden = value;
        document.dispatchEvent(new Event("visibilitychange"));
      },
    });
  });
  await contextA.routeWebSocket(/\/api\/v1\/matches\/[^/]+\/socket$/, (socket) => {
    socketAttempts++;
    void socket.close({ code: 1011, reason: "injected transport outage" });
  });
  pageB.on("websocket", (socket) => {
    if (/\/api\/v1\/matches\/.+\/socket$/.test(socket.url())) peerSocketOpened = true;
  });
  let matchId: string | undefined;
  try {
    await login(pageA, "A");
    matchId = await create(pageA, "connect-four", "remote");
    pageA.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "GET" && url.pathname === `/api/v1/matches/${matchId}`)
        matchReads.push(Date.now());
    });
    await pageA.goto(`/matches/${matchId}`);
    await login(pageB, "B");
    await pageB.goto(`/matches/${matchId}`);
    await pageB.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await pageA.bringToFront();
    await pageA.getByRole("button", { name: "I am ready", exact: true }).click();
    await pageB.bringToFront();
    await pageB.getByRole("button", { name: "I am ready", exact: true }).click();
    await pageA.bringToFront();
    await expect(
      pageA.getByRole("region", { name: "Connect Four Game Board", exact: true }),
    ).toBeVisible();
    await expect.poll(() => socketAttempts).toBeGreaterThanOrEqual(4);
    await expect.poll(() => peerSocketOpened).toBe(true);
    await expect.poll(() => matchReads.length).toBeGreaterThanOrEqual(2);
    const drop = pageA.getByRole("button", { name: "Drop disc into column 1", exact: true });
    await expect(drop).toBeEnabled();
    const before = (await view(pageA, matchId)).deliveryVersion;
    await drop.click();
    await expect
      .poll(async () => (await view(pageA, matchId!)).deliveryVersion)
      .toBeGreaterThan(before);
    await expect(pageA.locator(".c4-disc")).toHaveCount(1);
    await expect(pageB.locator(".c4-disc")).toHaveCount(1);

    const hiddenBaseline = matchReads.length;
    await pageA.evaluate(() =>
      (window as unknown as Window & { __qaSetHidden: (hidden: boolean) => void }).__qaSetHidden(
        true,
      ),
    );
    await pageA.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 3300)));
    expect(
      matchReads.length,
      "hidden fallback polling stays stopped for a full poll interval",
    ).toBe(hiddenBaseline);

    await pageA.evaluate(() =>
      (window as unknown as Window & { __qaSetHidden: (hidden: boolean) => void }).__qaSetHidden(
        false,
      ),
    );
    await expect.poll(() => matchReads.length).toBeGreaterThan(hiddenBaseline);
    await expect(
      pageB.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
    await expect(drop).toBeDisabled();
  } finally {
    if (matchId) {
      try {
        const snapshot = await view(pageA, matchId);
        if (snapshot.lifecycle === "active") await action(pageA, matchId, "match.resign");
      } catch {
        // Keep the failure report focused on the transport case.
      }
    }
    await closeContexts([contextA, contextB]);
  }
});
