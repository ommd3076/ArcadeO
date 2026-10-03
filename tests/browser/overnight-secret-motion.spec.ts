import { mkdir } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { action, login, uiCreate, view } from "./helpers";
import { getBoardCoordinate as getLudoBoardCoordinate } from "../../shared/games/ludo/engine";
import { getBoardCoordinate as getSnakesBoardCoordinate } from "../../shared/games/snakes-and-ladders/engine";

const screenshotDir = ".local/browser-results/overnight-secret-motion";

async function cleanup(page: Page, matchId?: string) {
  if (!matchId) return;
  const snapshot = await view(page, matchId).catch(() => null);
  if (snapshot?.lifecycle === "active") {
    const payload = snapshot.mode === "together" ? { resigningSeat: "A" } : {};
    await action(page, matchId, "match.resign", payload).catch(() => {});
  } else if (snapshot?.lifecycle === "waiting" && snapshot.legalActions?.includes("match.cancel")) {
    await action(page, matchId, "match.cancel").catch(() => {});
  }
}

async function createTogetherFixture(page: Page, gameId: string) {
  await page.goto(`/games/${gameId}`);
  await page.getByRole("button", { name: /together side-by-side/i }).click();
  const abandon = page.getByRole("button", { name: "Abandon & start fresh", exact: true });
  if (await abandon.isVisible()) {
    page.once("dialog", (dialog) => dialog.accept());
    await abandon.click();
    await expect(abandon).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page).toHaveURL(/\/matches\/[a-z0-9-]+/);
  const id = page.url().split("/").at(-1)!;
  const snapshot = await view(page, id);
  expect(snapshot.gameId).toBe(gameId);
  expect(snapshot.mode).toBe("together");
  return id;
}

async function captureMasked(page: Page, filename: string) {
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lock Choice", exact: true })).toHaveCount(0);
  await expect(
    page.locator(".arcade-secret-handoff--masked, .arcade-secret-handoff--curtain").first(),
  ).toBeVisible();
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/${filename}`, fullPage: true });
}

// Test-only WAAPI control: pause only accepted board effects so an interruption
// can be delivered deterministically. The app's visibility/offline/navigation
// handlers still cancel them; this helper does not advance game state.
async function pauseBoardEffects(page: Page) {
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    const records: Array<{ target: string; animation: Animation }> = [];
    Object.defineProperty(window, "__qaAcceptedEffects", { value: records, configurable: true });
    Element.prototype.animate = function (keyframes, options) {
      const animation = originalAnimate.call(this, keyframes, options);
      const owner = this.closest<HTMLElement>("[data-testid], [data-ludo-die], [data-snl-die]");
      const target =
        owner?.dataset.testid ||
        (owner?.hasAttribute("data-ludo-die") ? "ludo-die" : "") ||
        (owner?.hasAttribute("data-snl-die") ? "snl-die" : "");
      if (target && this.closest(".arcade-match-main")) {
        records.push({ target, animation });
        animation.pause();
      }
      return animation;
    };
  });
}

async function effectCount(page: Page, target: string) {
  return page.evaluate((key) => {
    const records =
      (window as Window & { __qaAcceptedEffects?: Array<{ target: string }> })
        .__qaAcceptedEffects ?? [];
    return records.filter((record) => record.target === key).length;
  }, target);
}

async function expectEffectsSettled(page: Page, target: string, count: number) {
  await expect.poll(() => effectCount(page, target)).toBe(count);
  const states = await page.evaluate((key) => {
    const records =
      (
        window as Window & {
          __qaAcceptedEffects?: Array<{ target: string; animation: Animation }>;
        }
      ).__qaAcceptedEffects ?? [];
    return records
      .filter((record) => record.target === key)
      .map((record) => record.animation.playState);
  }, target);
  expect(states.length).toBeGreaterThan(0);
  expect(states.every((state) => state === "idle")).toBe(true);
}

async function createRemote(browser: Browser, game: string) {
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.browserType().launch();
  const phone = await contextB.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const a = await contextA.newPage();
  const b = await phone.newPage();
  await login(a, "A");
  await login(b, "B");
  await a.goto(`/games/${game}`);
  await a.getByRole("button", { name: /^Remote/ }).click();
  await a.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(a).toHaveURL(/\/matches\//);
  const id = a.url().split("/").at(-1)!;
  await b.goto(a.url());
  await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await a.getByRole("button", { name: "I am ready", exact: true }).click();
  await b.getByRole("button", { name: "I am ready", exact: true }).click();
  return { a, b, id, contextA, phone, browserB: contextB };
}

test("REC-05 Together control transfers explicitly and leaves exactly one device active", async ({
  browser,
}) => {
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  let id: string | undefined;
  try {
    await login(a, "A");
    id = await uiCreate(a, "connect-four");
    await login(b, "B");
    await b.goto(`/matches/${id}`);
    const oldControllerMove = a.getByRole("button", {
      name: "Drop disc into column 1",
      exact: true,
    });
    const newControllerMove = b.getByRole("button", {
      name: "Drop disc into column 1",
      exact: true,
    });
    await expect(oldControllerMove).toBeEnabled();
    await expect(newControllerMove).toBeDisabled();
    const oldGeneration = (await view(a, id)).controller.controllerGeneration;
    await b.getByRole("button", { name: "Continue on this device", exact: true }).click();
    await expect(newControllerMove).toBeEnabled();
    await expect(oldControllerMove).toBeDisabled();
    expect((await view(a, id)).controller.isController).toBe(false);
    expect((await view(b, id)).controller.isController).toBe(true);
    const nextA = await view(a, id);
    const nextB = await view(b, id);
    expect(nextA.controller.controllerGeneration).toBeGreaterThan(oldGeneration);
    expect(nextB.controller.controllerGeneration).toBe(nextA.controller.controllerGeneration);
  } finally {
    await cleanup(b, id);
    await contextA.close();
    await contextB.close();
  }
});

for (const game of ["rock-paper-scissors", "hand-cricket"] as const) {
  test(`UI-06 ${game} masks locked, refreshed, and blurred secret choices in pixels and accessibility`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, "A");
    const id = await uiCreate(page, game);
    try {
      if (game === "hand-cricket") {
        const snapshot = await view(page, id);
        const tossWinner = snapshot.gameState.tossWinner;
        await page
          .getByRole("button", {
            name: tossWinner === "A" ? "Bat First" : "Bowl First",
            exact: true,
          })
          .click();
      }
      const initial = await view(page, id);
      const firstSeat = game === "hand-cricket" ? initial.gameState.roles.bat : initial.turnSeat;
      const firstName = initial.participants[firstSeat].displayName;
      const readyFirst = page.getByRole("button", {
        name: `I am ${firstName} (Ready)`,
        exact: true,
      });
      const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      await page.bringToFront();
      await expect(unmask).toBeVisible();
      await unmask.click();
      await expect(
        page.locator(".arcade-secret-handoff--curtain, .arcade-secret-handoff--masked"),
      ).toHaveCount(0);
      await expect(readyFirst).toBeVisible();
      await readyFirst.click();
      const radios = page.getByRole("radio");
      await expect(radios.first()).toBeVisible();
      await radios.first().click();
      await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await captureMasked(page, `${game}-locked.png`);

      await page.reload();
      await expect(
        page.getByRole("button", { name: "Resume & Unmask", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Resume & Unmask", exact: true }).click();
      await captureMasked(page, `${game}-refreshed-curtain.png`);

      const secondSeat = firstSeat === "A" ? "B" : "A";
      const secondName = initial.participants[secondSeat].displayName;
      const resume = page.getByRole("button", {
        name: `I am ${secondName} (Ready)`,
        exact: true,
      });
      if (await resume.isVisible()) await resume.click();
      await expect(page.getByRole("radio").first()).toBeVisible();
      await page.getByRole("radio").first().click();
      const blurredFrame = await page.evaluate(
        () =>
          new Promise<{ masked: boolean; radios: number }>((resolve) => {
            window.dispatchEvent(new Event("blur"));
            requestAnimationFrame(() =>
              resolve({
                masked: !!document.querySelector(".arcade-secret-handoff--masked"),
                radios: document.querySelectorAll('[role="radio"]').length,
              }),
            );
          }),
      );
      expect(blurredFrame).toEqual({ masked: true, radios: 0 });
      await captureMasked(page, `${game}-blurred.png`);
    } finally {
      await cleanup(page, id);
    }
  });
}

test("UI-07 Remote RPS advances during a paused outcome exit without stranding Round 1", async ({
  browser,
}) => {
  const fixture = await createRemote(browser, "rock-paper-scissors");
  try {
    const pages = [fixture.a, fixture.b];
    for (const page of pages) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() => {
        const originalAnimate = Element.prototype.animate;
        const records: Animation[] = [];
        const calls: Array<{ target: string; inMatch: boolean; inOutcome: boolean }> = [];
        Object.defineProperty(window, "__qaOutcomeExit", { value: records, configurable: true });
        Object.defineProperty(window, "__qaAnimateCalls", { value: calls, configurable: true });
        Element.prototype.animate = function (keyframes, options) {
          const animation = originalAnimate.call(this, keyframes, options);
          const inMatch = this instanceof Element && Boolean(this.closest(".arcade-match-main"));
          const inOutcome =
            this instanceof Element && Boolean(this.closest(".arcade-secret-handoff--outcome"));
          calls.push({
            target: this instanceof HTMLElement ? this.className.toString() : "other",
            inMatch,
            inOutcome,
          });
          if (inMatch && inOutcome) {
            records.push(animation);
            animation.pause();
          }
          return animation;
        };
      });
    }
    for (const page of pages) {
      await expect(page.locator(".arcade-secret-handoff")).toBeVisible();
      const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      if (await unmask.isVisible()) await unmask.click();
      await expect(page.getByRole("radio").first()).toBeVisible();
    }
    await fixture.a.getByRole("radio", { name: "Rock", exact: true }).click();
    await fixture.b.getByRole("radio", { name: "Paper", exact: true }).click();
    await Promise.all(
      pages.map((page) => page.getByRole("button", { name: "Lock Choice", exact: true }).click()),
    );
    await expect
      .poll(async () => (await view(fixture.a, fixture.id)).gameState.lockedSeats)
      .toHaveLength(2);
    await expect(fixture.a.getByText("Round 1 Result", { exact: true })).toBeVisible();
    await expect(fixture.b.getByText("Round 1 Result", { exact: true })).toBeVisible();
    try {
      await expect
        .poll(async () =>
          Promise.all(
            pages.map((page) =>
              page.evaluate(
                () =>
                  (window as Window & { __qaOutcomeExit?: Animation[] }).__qaOutcomeExit?.length ??
                  0,
              ),
            ),
          ).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
        )
        .toBeGreaterThan(0);
    } catch (error) {
      const diagnostic = await Promise.all(
        pages.map((page) =>
          page.evaluate(() => ({
            hidden: document.hidden,
            reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
            animateCalls:
              (
                window as Window & {
                  __qaAnimateCalls?: Array<{
                    target: string;
                    inMatch: boolean;
                    inOutcome: boolean;
                  }>;
                }
              ).__qaAnimateCalls ?? [],
          })),
        ),
      );
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nMotion diagnostics: ${JSON.stringify(diagnostic)}`,
      );
    }

    await fixture.a.getByRole("button", { name: "Next Round", exact: true }).click();
    await expect(fixture.a.getByRole("button", { name: "Next Round", exact: true })).toBeVisible();
    await fixture.b.getByRole("button", { name: "Next Round", exact: true }).click();
    for (const page of pages) {
      const nextUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      if (await nextUnmask.isVisible()) await nextUnmask.click();
      await expect(page.getByRole("radio").first()).toBeVisible();
    }
    await expect(fixture.a.getByText("Round 1 Result", { exact: true })).toHaveCount(0);
    const states = (
      await Promise.all(
        pages.map((page) =>
          page.evaluate(
            () =>
              (window as Window & { __qaOutcomeExit?: Animation[] }).__qaOutcomeExit?.map(
                (animation) => animation.playState,
              ) ?? [],
          ),
        ),
      )
    ).flat();
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state === "idle")).toBe(true);
  } finally {
    await cleanup(fixture.a, fixture.id);
    await fixture.contextA.close();
    await fixture.phone.close();
    await fixture.browserB.close();
  }
});

test("UI-09 Ludo accepted pawn travel settles to the accepted token coordinate after offline", async ({
  page,
}) => {
  await pauseBoardEffects(page);
  await login(page, "A");
  const id = await createTogetherFixture(page, "ludo");
  try {
    let state = await view(page, id);
    for (let roll = 0; roll < 80 && state.gameState.phase !== "choose-token"; roll++) {
      const before = state.deliveryVersion;
      await expect(page.getByTestId("ludo-roll-button")).toBeEnabled();
      await page.getByTestId("ludo-roll-button").click();
      await expect.poll(async () => (await view(page, id)).deliveryVersion).toBeGreaterThan(before);
      state = await view(page, id);
    }
    expect(state.gameState.phase).toBe("choose-token");
    const seat = state.gameState.activeSeat as "A" | "B";
    const tokenId = state.gameState.legalTokenIds[0] as number;
    const priorPosition = state.gameState.tokens[seat][tokenId];
    const beforeMove = state.deliveryVersion;
    await page.getByTestId(`ludo-token-button-${tokenId}`).click();
    await expect
      .poll(async () => (await view(page, id)).deliveryVersion)
      .toBeGreaterThan(beforeMove);
    const accepted = await view(page, id);
    expect(accepted.gameState.tokens[seat][tokenId]).not.toBe(priorPosition);
    const expectedCoordinate = getLudoBoardCoordinate(
      seat,
      accepted.gameState.tokens[seat][tokenId],
    );
    expect(
      expectedCoordinate,
      "accepted token position is on the visible Ludo board",
    ).not.toBeNull();
    const target = `ludo-token-${seat}-${tokenId}`;
    await expect.poll(() => effectCount(page, target)).toBeGreaterThan(0);
    const count = await effectCount(page, target);
    const acceptedLocation = await page.getByTestId(target).evaluate((token) => {
      const cell = token.closest<HTMLElement>("[data-testid^='cell-']");
      return {
        cell: cell?.dataset.testid,
        stackX: token.getAttribute("data-stack-x"),
        stackY: token.getAttribute("data-stack-y"),
      };
    });
    expect(acceptedLocation.cell).toBe(`cell-${expectedCoordinate![0]}-${expectedCoordinate![1]}`);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expectEffectsSettled(page, target, count);
    await expect
      .poll(() =>
        page.getByTestId(target).evaluate((token) => {
          const cell = token.closest<HTMLElement>("[data-testid^='cell-']");
          return {
            cell: cell?.dataset.testid,
            stackX: token.getAttribute("data-stack-x"),
            stackY: token.getAttribute("data-stack-y"),
          };
        }),
      )
      .toEqual(acceptedLocation);
    expect((await view(page, id)).gameState.tokens[seat][tokenId]).toBe(
      accepted.gameState.tokens[seat][tokenId],
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => effectCount(page, target)).toBe(count);
  } finally {
    await cleanup(page, id);
  }
});

const movingCases = [
  { game: "snakes-and-ladders", target: "snl-die", interrupt: "background" },
  { game: "connect-four", target: "c4-disc-5-0", interrupt: "navigation" },
  { game: "dots-boxes", target: "edge-h-0-0", interrupt: "offline" },
  { game: "sos", target: "sos-cell-0-0", interrupt: "blur" },
] as const;

for (const scenario of movingCases) {
  test(`UI-09 ${scenario.game} accepted presentation settles to its accepted target after ${scenario.interrupt}`, async ({
    page,
  }) => {
    await pauseBoardEffects(page);
    await login(page, "A");
    const id = await createTogetherFixture(page, scenario.game);
    try {
      const before = (await view(page, id)).deliveryVersion;
      if (scenario.game === "snakes-and-ladders") await page.getByTestId("snl-roll-button").click();
      if (scenario.game === "connect-four")
        await page.getByRole("button", { name: "Drop disc into column 1", exact: true }).click();
      if (scenario.game === "dots-boxes") await page.getByTestId("edge-h-0-0").click();
      if (scenario.game === "sos") {
        await page.getByTestId("sos-select-s").click();
        await page.getByTestId("sos-cell-0-0").click();
      }
      await expect.poll(async () => (await view(page, id)).deliveryVersion).toBeGreaterThan(before);

      if (scenario.game === "connect-four")
        await expect(page.getByTestId("c4-disc-5-0")).toBeVisible();
      if (scenario.game === "dots-boxes")
        await expect(page.getByTestId("edge-h-0-0")).toHaveAttribute("aria-label", /claimed by/);
      if (scenario.game === "sos") await expect(page.getByTestId("sos-cell-0-0")).toHaveText("S");
      const target = scenario.game === "snakes-and-ladders" ? "snl-die" : scenario.target;
      await expect.poll(() => effectCount(page, target)).toBeGreaterThan(0);
      const count = await effectCount(page, target);

      if (scenario.interrupt === "offline")
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      if (scenario.interrupt === "background") {
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, value: true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
      }
      if (scenario.interrupt === "blur")
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      if (scenario.interrupt === "navigation") {
        await page.getByRole("button", { name: "Go back", exact: true }).click();
        await expect(page).toHaveURL(/\/games\/connect-four$/);
        await page.goForward();
        await expect(page).toHaveURL(new RegExp(`/matches/${id}$`));
        await expect(page.getByTestId("c4-disc-5-0")).toBeVisible();
      }
      await expectEffectsSettled(page, target, count);

      if (scenario.game === "snakes-and-ladders") {
        const accepted = await view(page, id);
        const position = accepted.gameState.positions.A as number;
        const expectedCoordinate = getSnakesBoardCoordinate(position);
        expect(expectedCoordinate, "accepted die position is on the Snakes board").not.toBeNull();
        const acceptedCell = page.getByTestId(`snl-cell-${position}`);
        const actualCoordinate = await acceptedCell.evaluate((cell) => {
          const board = cell.parentElement!;
          const boardRect = board.getBoundingClientRect();
          const cellRect = cell.getBoundingClientRect();
          return [
            Math.round(((cellRect.top - boardRect.top) / boardRect.height) * 10),
            Math.round(((cellRect.left - boardRect.left) / boardRect.width) * 10),
          ];
        });
        expect(actualCoordinate).toEqual(expectedCoordinate);
        await expect(acceptedCell).toContainText("A");
      }
      if (scenario.game === "connect-four")
        await expect(page.getByTestId("c4-disc-5-0")).toBeVisible();
      if (scenario.game === "dots-boxes")
        await expect(page.getByTestId("edge-h-0-0")).toHaveAttribute("aria-label", /claimed by/);
      if (scenario.game === "sos") await expect(page.getByTestId("sos-cell-0-0")).toHaveText("S");

      if (scenario.interrupt === "offline") {
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await expect.poll(() => effectCount(page, target)).toBe(count);
      }
      if (scenario.interrupt === "background") {
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, value: false });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await expect.poll(() => effectCount(page, target)).toBe(count);
      }
    } finally {
      await cleanup(page, id);
    }
  });
}
