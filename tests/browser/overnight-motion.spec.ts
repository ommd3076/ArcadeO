import { expect, test } from "@playwright/test";
import { action, login, uiCreate, view, writeJsonWithRetry } from "./helpers";

let activeMatchId: string | undefined;

test.afterEach(async ({ page }) => {
  if (!activeMatchId) return;
  const id = activeMatchId;
  activeMatchId = undefined;
  const saved = await view(page, id);
  if (saved.lifecycle === "active") await action(page, id, "match.agree-abandon");
});

test("accepted disc travel has sampled movement and a settled laptop frame", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    const samples: Array<{ elapsed: number; transform: string; opacity: string }> = [];
    Object.defineProperty(window, "__arcadeDiscFrames", { value: samples, configurable: true });
    Element.prototype.animate = function (keyframes, options) {
      const animation = originalAnimate.call(this, keyframes, options);
      if (this instanceof HTMLElement && this.dataset.testid?.startsWith("c4-disc-")) {
        const started = performance.now();
        const sample = () => {
          const style = getComputedStyle(this);
          samples.push({
            elapsed: performance.now() - started,
            transform: style.transform,
            opacity: style.opacity,
          });
          if (animation.playState === "running") requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
      return animation;
    };
  });
  await login(page, "A");
  const id = await uiCreate(page, "connect-four");
  activeMatchId = id;
  await page.getByRole("button", { name: "Drop disc into column 4", exact: true }).click();
  await page.waitForFunction(() => {
    const frames = (
      window as unknown as {
        __arcadeDiscFrames?: Array<{ elapsed: number }>;
      }
    ).__arcadeDiscFrames;
    return !!frames && frames.length > 2;
  });
  await expect(page.getByTestId("c4-disc-5-3")).toBeVisible();
  await expect.poll(async () => (await view(page, id)).deliveryVersion).toBeGreaterThan(1);
  await page.waitForTimeout(650);
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          __arcadeDiscFrames: Array<{ elapsed: number; transform: string; opacity: string }>;
        }
      ).__arcadeDiscFrames,
  );
  expect(frames.length).toBeGreaterThan(2);
  expect(new Set(frames.map((frame) => frame.transform)).size).toBeGreaterThan(1);
  expect(frames.at(-1)?.transform).toBe("none");
  const sampleStride = Math.max(1, Math.floor(frames.length / 40));
  await writeJsonWithRetry(
    ".local/browser-results/overnight-motion/c4-laptop-sampled-frames.json",
    {
      viewport: { width: 1280, height: 800 },
      sampleCount: frames.length,
      sampledFrames: frames.filter(
        (_, index) => index % sampleStride === 0 || index === frames.length - 1,
      ),
    },
  );
  await page.screenshot({
    path: ".local/browser-results/overnight-motion/c4-laptop-settled.png",
    fullPage: true,
  });
});

test("Connect Four accepted motion runs once, stays under 600ms and settles offline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    const records: Array<{ target: string | null; animation: Animation }> = [];
    Object.defineProperty(window, "__arcadeMotionRecords", { value: records, configurable: true });
    Element.prototype.animate = function (keyframes, options) {
      const animation = originalAnimate.call(this, keyframes, options);
      const target = this instanceof HTMLElement ? (this.dataset.testid ?? null) : null;
      records.push({ target, animation });
      if (target?.startsWith("c4-disc-")) animation.pause();
      return animation;
    };
  });

  await login(page, "A");
  const id = await uiCreate(page, "connect-four");
  activeMatchId = id;
  const main = await page.locator(".arcade-match-main").boundingBox();
  expect(main).not.toBeNull();
  expect(main!.width).toBeLessThanOrEqual(981);
  expect(Math.abs(main!.x + main!.width / 2 - 640)).toBeLessThanOrEqual(1);

  const drop = page.getByRole("button", { name: "Drop disc into column 4", exact: true });
  await expect(drop).toBeEnabled();
  await Promise.all([
    page.waitForFunction(() => {
      const records = (
        window as unknown as { __arcadeMotionRecords?: Array<{ target: string | null }> }
      ).__arcadeMotionRecords;
      return records?.some((record) => record.target === "c4-disc-5-3") ?? false;
    }),
    drop.click(),
  ]);
  const timing = await page.evaluate(() => {
    const records = (
      window as unknown as {
        __arcadeMotionRecords: Array<{ target: string | null; animation: Animation }>;
      }
    ).__arcadeMotionRecords;
    return records
      .filter((record) => record.target === "c4-disc-5-3")
      .map(({ animation }) => ({
        duration: animation.effect?.getComputedTiming().duration,
        state: animation.playState,
      }));
  });
  expect(timing).toHaveLength(1);
  expect(timing[0].duration).toBeLessThanOrEqual(600);
  expect(timing[0].state).toBe("paused");

  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = (
          window as unknown as {
            __arcadeMotionRecords: Array<{ target: string | null; animation: Animation }>;
          }
        ).__arcadeMotionRecords;
        return records.find((record) => record.target === "c4-disc-5-3")?.animation.playState;
      }),
    )
    .toBe("idle");
  await expect(page.getByTestId("c4-disc-5-3")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(drop).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = (
          window as unknown as { __arcadeMotionRecords: Array<{ target: string | null }> }
        ).__arcadeMotionRecords;
        return records.filter((record) => record.target === "c4-disc-5-3").length;
      }),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = (
          window as unknown as { __arcadeMotionRecords: Array<{ target: string | null }> }
        ).__arcadeMotionRecords;
        return records.filter((record) => record.target === "c4-disc-5-2").length;
      }),
    )
    .toBe(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedBaseline = (await view(page, id)).deliveryVersion;
  await page.getByRole("button", { name: "Drop disc into column 3", exact: true }).click();
  await expect(page.getByTestId("c4-disc-5-2")).toBeVisible();
  await expect
    .poll(() => view(page, id).then((snapshot) => snapshot.deliveryVersion))
    .toBeGreaterThan(reducedBaseline);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = (
          window as unknown as { __arcadeMotionRecords: Array<{ target: string | null }> }
        ).__arcadeMotionRecords;
        return records.filter((record) => record.target === "c4-disc-5-2").length;
      }),
    )
    .toBe(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
  });
  const hiddenBaseline = (await view(page, id)).deliveryVersion;
  await page.getByRole("button", { name: "Drop disc into column 2", exact: true }).click();
  await expect(page.getByTestId("c4-disc-5-1")).toBeVisible();
  await expect
    .poll(() => view(page, id).then((snapshot) => snapshot.deliveryVersion > hiddenBaseline))
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = (
          window as unknown as { __arcadeMotionRecords: Array<{ target: string | null }> }
        ).__arcadeMotionRecords;
        return records.filter((record) => record.target === "c4-disc-5-1").length;
      }),
    )
    .toBe(0);
});

test("match option sheet consumes browser Back before leaving the match and restores focus", async ({
  page,
}) => {
  await login(page, "A");
  const id = await uiCreate(page, "connect-four");
  activeMatchId = id;
  const matchUrl = page.url();
  const trigger = page.getByRole("button", { name: "Match Options", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Match Options" });
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(matchUrl);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/games\/connect-four$/);
});

test("Ludo accepted roll and board fit a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "A");
  const id = await uiCreate(page, "ludo");
  activeMatchId = id;

  const beforeRoll = await view(page, id);
  await page.getByTestId("ludo-roll-button").click();
  await expect
    .poll(() => view(page, id).then((latest) => latest.deliveryVersion))
    .toBeGreaterThan(beforeRoll.deliveryVersion);
  const snapshot = await view(page, id);
  expect(snapshot.gameState.phase === "roll" || snapshot.gameState.phase === "choose-token").toBe(
    true,
  );
  const feedback = page.getByTestId("ludo-motion-feedback");
  await expect(feedback).toContainText(/rolled [1-6]\./);
  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  const gridGeometry = await page.getByTestId("ludo-board-grid").evaluate((grid) => {
    const board = grid.getBoundingClientRect();
    const surface = grid.parentElement!.getBoundingClientRect();
    const surfaceStyle = getComputedStyle(grid.parentElement!);
    const contentTop =
      surface.top +
      Number.parseFloat(surfaceStyle.borderTopWidth) +
      Number.parseFloat(surfaceStyle.paddingTop);
    const contentBottom =
      surface.bottom -
      Number.parseFloat(surfaceStyle.borderBottomWidth) -
      Number.parseFloat(surfaceStyle.paddingBottom);
    const rows = Array.from({ length: 15 }, (_, row) => {
      const cell = document.querySelector(`[data-testid="cell-${row}-0"]`)!;
      const rect = cell.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    return {
      board: { top: board.top, bottom: board.bottom, width: board.width, height: board.height },
      surface: {
        top: surface.top,
        bottom: surface.bottom,
        contentTop,
        contentBottom,
        width: surface.width,
        height: surface.height,
      },
      rows,
    };
  });
  expect(
    Math.abs(gridGeometry.board.width - gridGeometry.board.height),
    JSON.stringify(gridGeometry),
  ).toBeLessThanOrEqual(1);
  expect(gridGeometry.board.width, JSON.stringify(gridGeometry)).toBeLessThanOrEqual(370);
  expect(gridGeometry.board.top, JSON.stringify(gridGeometry)).toBeGreaterThanOrEqual(
    gridGeometry.surface.contentTop,
  );
  expect(gridGeometry.board.bottom, JSON.stringify(gridGeometry)).toBeLessThanOrEqual(
    gridGeometry.surface.contentBottom,
  );
  expect(gridGeometry.rows).toHaveLength(15);
  expect(
    gridGeometry.rows.every(
      (row) =>
        row.height > 0 &&
        row.top >= gridGeometry.board.top &&
        row.bottom <= gridGeometry.board.bottom,
    ),
    JSON.stringify(gridGeometry),
  ).toBe(true);
  const rollButton = await page.getByTestId("ludo-roll-button").boundingBox();
  expect(rollButton).not.toBeNull();
  expect(rollButton!.width).toBeGreaterThanOrEqual(110);
  expect(rollButton!.height).toBeLessThanOrEqual(64);
  await writeJsonWithRetry(".local/browser-results/overnight-motion/ludo-phone-geometry.json", {
    viewport: { width: 390, height: 844 },
    ...geometry,
    ...gridGeometry,
  });
  await page.screenshot({
    path: ".local/browser-results/overnight-motion/ludo-phone-accepted-roll.png",
    fullPage: true,
  });
});
