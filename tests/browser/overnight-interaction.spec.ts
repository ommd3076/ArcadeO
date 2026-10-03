import { expect, test, type Locator, type Page } from "@playwright/test";
import { action, create, login, origin, view, writeJsonWithRetry } from "./helpers";

const evidence = ".local/evidence/overnight-interaction";

async function reachable(control: Locator) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  const rect = await control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
      hit: hit === element || element.contains(hit),
    };
  });
  expect(rect.left).toBeGreaterThanOrEqual(-1);
  expect(rect.right).toBeLessThanOrEqual(rect.width + 1);
  expect(rect.top).toBeGreaterThanOrEqual(-1);
  expect(rect.bottom).toBeLessThanOrEqual(rect.height + 1);
  expect(rect.hit, JSON.stringify(rect)).toBe(true);
  return rect;
}

async function cleanup(page: Page, id: string) {
  const saved = await view(page, id);
  if (saved.lifecycle === "active")
    await action(
      page,
      id,
      saved.mode === "practice" ? "match.request-abandon" : "match.agree-abandon",
    );
}

test("UI02: a fresh document deep link uses Games instead of external browser history", async ({
  page,
}) => {
  await login(page, "A");
  const id = await create(page, "connect-four", "together");
  try {
    await page.goto("data:text/html,<title>External history fixture</title>");
    await page.goto(`${origin}/matches/${id}`);
    const back = page.getByRole("button", { name: "Go back", exact: true });
    await reachable(back);
    await back.click();
    await expect(page).toHaveURL(`${origin}/games`);
    expect((await view(page, id)).lifecycle).toBe("active");
    await page.goto("/unavailable-overnight-route");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Games", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/games`);
  } finally {
    await cleanup(page, id);
  }
});

test("UI10: changing reduced motion during accepted disc travel settles without another action", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    const records: Animation[] = [];
    Object.defineProperty(window, "__overnightLiveMotion", { value: records });
    Element.prototype.animate = function (frames, options) {
      const animation = original.call(this, frames, options);
      if (this instanceof HTMLElement && this.dataset.testid?.startsWith("c4-disc-")) {
        records.push(animation);
        animation.pause();
      }
      return animation;
    };
  });
  await login(page, "A");
  const id = await create(page, "connect-four", "together");
  try {
    await page.goto(`/matches/${id}`);
    const before = await view(page, id);
    await page.getByRole("button", { name: "Drop disc into column 1", exact: true }).click();
    await page.waitForFunction(
      () =>
        (window as unknown as { __overnightLiveMotion: Animation[] }).__overnightLiveMotion
          .length === 1,
    );
    const paused = await page.evaluate(
      () =>
        (window as unknown as { __overnightLiveMotion: Animation[] }).__overnightLiveMotion[0]
          .playState,
    );
    expect(paused).toBe("paused");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __overnightLiveMotion: Animation[] }).__overnightLiveMotion[0]
              .playState,
        ),
      )
      .toBe("idle");
    const disc = page.getByTestId("c4-disc-5-0");
    await expect(disc).toBeVisible();
    expect(await disc.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
    const accepted = await view(page, id);
    expect(accepted.deliveryVersion).toBe(before.deliveryVersion + 1);
    expect(accepted.gameState.board[5][0]).toBe(before.turnSeat);
    await expect(
      page.getByRole("button", { name: "Drop disc into column 2", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Drop disc into column 2", exact: true }),
    ).toBeEnabled();
    expect((await view(page, id)).deliveryVersion).toBe(accepted.deliveryVersion);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __overnightLiveMotion: Animation[] }).__overnightLiveMotion
            .length,
      ),
    ).toBe(1);
    await writeJsonWithRetry(`${evidence}/live-reduced-motion.json`, {
      acceptedVersion: accepted.deliveryVersion,
      animationBefore: paused,
      animationAfter: "idle",
      replayCount: 0,
      mediaChangedDuringTravel: true,
    });
  } finally {
    await cleanup(page, id);
  }
});

for (const game of ["dots-boxes", "sos"] as const) {
  test(`UI11: ${game} largest grid remains keyboard reachable in landscape with simulated safe insets and 200% text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await login(page, "A");
    const id = await create(page, game, "together", { gridSize: 9 });
    try {
      await page.goto(`/matches/${id}`);
      const target = page.getByTestId(game === "sos" ? "sos-cell-8-8" : "edge-h-8-7");
      await expect(target).toBeEnabled();
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--sat", "20px");
        document.documentElement.style.setProperty("--sab", "34px");
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(
            "h1,h2,h3,p,span,label,button,input,select,summary,legend",
          ),
        );
        const sizes = elements.map((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        );
        elements.forEach((element, index) => {
          element.style.fontSize = `${sizes[index] * 2}px`;
        });
      });
      const before = await view(page, id);
      const geometry = await reachable(target);
      await target.focus();
      await expect(target).toBeFocused();
      await page.keyboard.press("Enter");
      await expect
        .poll(async () => (await view(page, id)).deliveryVersion)
        .toBe(before.deliveryVersion + 1);
      const accepted = await view(page, id);
      let sosGeometry: unknown;
      if (game === "sos") {
        expect(accepted.gameState.board[8][8]).toBe("S");
        const measure = () =>
          page.getByTestId("sos-cell-0-0").evaluate((first) => {
            const cells = Array.from(first.parentElement!.children);
            const boxes = cells.map((cell) => cell.getBoundingClientRect());
            const occupied = cells.at(-1)!;
            const box = occupied.getBoundingClientRect();
            const glyph = occupied.querySelector("span")!.getBoundingClientRect();
            return {
              widthSpread:
                Math.max(...boxes.map((b) => b.width)) - Math.min(...boxes.map((b) => b.width)),
              heightSpread:
                Math.max(...boxes.map((b) => b.height)) - Math.min(...boxes.map((b) => b.height)),
              squareDifference: Math.abs(box.width - box.height),
              glyphFits:
                glyph.left >= box.left &&
                glyph.right <= box.right &&
                glyph.top >= box.top &&
                glyph.bottom <= box.bottom,
            };
          });
        const compact = await measure();
        expect(compact.widthSpread).toBeLessThan(1);
        expect(compact.heightSpread).toBeLessThan(1);
        expect(compact.squareDifference).toBeLessThan(1);
        await page.getByRole("button", { name: "Zoom board", exact: true }).click();
        const zoomed = await measure();
        expect(zoomed.widthSpread).toBeLessThan(1);
        expect(zoomed.heightSpread).toBeLessThan(1);
        expect(zoomed.squareDifference).toBeLessThan(1);
        expect(zoomed.glyphFits).toBe(true);
        await reachable(target);
        await page.evaluate(async () => {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          await document.fonts.ready;
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        });
        await page.screenshot({
          path: `${evidence}/sos-landscape-text200-zoom.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page.getByRole("button", { name: "Reset board zoom", exact: true }).click();
        sosGeometry = { compact, zoomed };
      } else await expect(target).toHaveAttribute("aria-label", /claimed by/);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(846);
      const back = page.getByRole("button", { name: "Go back", exact: true });
      await reachable(back);
      await writeJsonWithRetry(`${evidence}/${game}-landscape-text200.json`, {
        viewport: { width: 844, height: 390 },
        textScalePercent: 200,
        simulatedInsets: { top: 20, bottom: 34 },
        hardwareCertification: false,
        geometry,
        ...(sosGeometry ? { sosGeometry } : {}),
        acceptedVersion: accepted.deliveryVersion,
        documentWidth: width,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${evidence}/${game}-landscape-text200.png`,
        fullPage: true,
        animations: "disabled",
      });
    } finally {
      await cleanup(page, id);
    }
  });
}

test("UI12: an accepted update preserves sheet focus and one result/rematch", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.defineProperty(window, "__overnightResultEntrances", { value: events });
    document.addEventListener("animationstart", (event) => {
      if ((event.target as HTMLElement)?.classList?.contains("arcade-match-result"))
        events.push(event.animationName);
    });
  });
  await login(page, "A");
  const id = await create(page, "connect-four", "together");
  let rematchId: string | undefined;
  const peer = await context.newPage();
  try {
    await page.goto(`/matches/${id}`);
    await peer.goto(`/matches/${id}`);
    await page.bringToFront();
    const options = page.getByRole("button", { name: "Match Options", exact: true });
    await options.click();
    const leave = page.getByRole("button", { name: "Leave and save", exact: true });
    await leave.focus();
    await expect(leave).toBeFocused();
    await peer.getByRole("button", { name: "Drop disc into column 1", exact: true }).click();
    await expect(page.getByTestId("c4-disc-5-0")).toBeVisible();
    await expect(leave).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Match Options" })).toBeHidden();
    await expect(options).toBeFocused();
    for (const column of [2, 1, 2, 1, 2, 1]) {
      const before = await view(page, id);
      await page
        .getByRole("button", { name: `Drop disc into column ${column}`, exact: true })
        .click();
      await expect
        .poll(async () => (await view(page, id)).deliveryVersion)
        .toBe(before.deliveryVersion + 1);
    }
    await expect(page.locator(".arcade-match-result")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Wins!/ })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __overnightResultEntrances: string[] })
              .__overnightResultEntrances.length,
        ),
      )
      .toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Rematch", exact: true })).toBeEnabled();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __overnightResultEntrances: string[] }).__overnightResultEntrances
            .length,
      ),
    ).toBe(1);
    const terminalVersion = (await view(page, id)).deliveryVersion;
    await page.getByRole("button", { name: "Rematch", exact: true }).click();
    await expect(page).not.toHaveURL(`${origin}/matches/${id}`);
    await expect(page).toHaveURL(/\/matches\//);
    rematchId = page.url().split("/").at(-1)!;
    await expect(page.locator(".c4-disc")).toHaveCount(0);
    expect((await view(page, id)).deliveryVersion).toBe(terminalVersion);
    expect((await view(page, rematchId)).lifecycle).toBe("active");
    await writeJsonWithRetry(`${evidence}/sheet-focus-terminal-rematch.json`, {
      focusPreservedAcrossAcceptedUpdate: true,
      resultEntranceCount: 1,
      terminalVersion,
      rematchStartsEmpty: true,
      fixtureProgression: "UI only; API fixture creation/readback/cleanup",
    });
  } finally {
    await peer.close();
    await cleanup(page, id);
    if (rematchId) await cleanup(page, rematchId);
  }
});
