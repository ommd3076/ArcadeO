import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { login, create, view, action, captureScreenshot, writeJsonWithRetry } from "./helpers";

const evidence = path.resolve(".local/evidence/owner-corrections");
const games = [
  "ludo",
  "snakes-and-ladders",
  "dots-boxes",
  "sos",
  "connect-four",
  "rock-paper-scissors",
  "hand-cricket",
  "sudoku",
] as const;
const appearances = [
  { family: "Standard", mode: "Dark", tag: "standard-dark" },
  { family: "Standard", mode: "Light", tag: "standard-light" },
  { family: "Romantic", mode: "Dark", tag: "romantic-dark" },
  { family: "Romantic", mode: "Light", tag: "romantic-light" },
] as const;
const sizes = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
] as const;

const scenarios = [
  ...games.map((game) => ({
    game,
    gridSize: undefined as number | undefined,
    tag: game as string,
  })),
  ...(["dots-boxes", "sos"] as const).flatMap((game) =>
    [7, 9].map((gridSize) => ({ game, gridSize, tag: `${game}-${gridSize}` })),
  ),
  { game: "hand-cricket" as const, gridSize: undefined, tag: "hand-cricket-play" },
];

async function chooseAppearance(page: Page, family: string, mode: string) {
  await page.goto("/us");
  await page.getByRole("button", { name: new RegExp(`^${family}\\b`, "i") }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-family", family.toLowerCase());
  await page.getByRole("button", { name: new RegExp(`^${mode}$`, "i") }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", mode.toLowerCase());
}

async function waitForBoard(page: Page, game: string, tag = game) {
  const testId: Record<string, string> = {
    ludo: "ludo-roll-button",
    "snakes-and-ladders": "snl-cell-100",
    "dots-boxes": "dot-0-0",
    sos: "sos-cell-0-0",
    sudoku: "sudoku-cell-0-0",
    "hand-cricket": "cricket-choose-bat",
  };
  if (tag === "hand-cricket-play") {
    const snapshot = await view(page, page.url().split("/").at(-1)!);
    expect(snapshot.gameState.phase).toBe("first_innings");
    const batterName = snapshot.participants[snapshot.gameState.roles.bat].displayName;
    await expect(
      page.getByText(`${batterName} batting • Ball #${snapshot.gameState.deliveryId}`, {
        exact: true,
      }),
    ).toBeVisible();
  } else if (testId[game]) await expect(page.getByTestId(testId[game])).toBeVisible();
  else
    await expect(
      page.getByRole("region", {
        name: game === "connect-four" ? "Connect Four Game Board" : "Rock Paper Scissors Game",
        exact: true,
      }),
    ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (game === "rock-paper-scissors" || tag === "hand-cricket-play") {
    const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await unmask.isVisible()) await unmask.click();
    const ready = page.getByRole("button", { name: /I am .*\(Ready\)/ });
    if (await ready.isVisible()) await ready.click();
    await expect(
      page.getByRole("radio", {
        name: game === "rock-paper-scissors" ? "Rock" : "1 Run",
        exact: true,
      }),
    ).toBeVisible();
  }
}

async function cleanup(page: Page, id: string) {
  const saved = await view(page, id);
  if (saved.lifecycle !== "active") return;
  await action(
    page,
    id,
    saved.mode === "practice" ? "match.request-abandon" : "match.agree-abandon",
  );
  expect((await view(page, id)).lifecycle).toBe("abandoned");
}

test.describe("owner visual matrix on real Worker", () => {
  test.setTimeout(300_000);
  for (const { game, gridSize, tag } of scenarios) {
    test(`${tag}: four appearances at phone and laptop widths`, async ({ page }) => {
      fs.mkdirSync(evidence, { recursive: true });
      await login(page, "A");
      const initialFamily =
        (await page.locator("html").getAttribute("data-theme-family")) ?? "standard";
      const initialMode = (await page.locator("html").getAttribute("data-theme-mode")) ?? "dark";
      const id = await create(
        page,
        game,
        game === "sudoku" ? "practice" : "together",
        game === "sudoku" ? { puzzleId: "easy-002" } : gridSize ? { gridSize } : {},
      );
      const observations: unknown[] = [];
      if (tag === "hand-cricket-play")
        await action(page, id, "cricket.choose-role", { role: "bat" });
      try {
        for (const appearance of appearances) {
          await chooseAppearance(page, appearance.family, appearance.mode);
          await page.goto(`/matches/${id}`);
          await waitForBoard(page, game, tag);
          for (const size of sizes) {
            await page.setViewportSize(size);
            await captureScreenshot(
              page,
              path.join(evidence, `${tag}-${appearance.tag}-${size.width}.png`),
            );
            const layout = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              mainText: document.querySelector("main")?.textContent?.slice(0, 160),
            }));
            expect(
              layout.scrollWidth,
              `${game} ${appearance.tag} ${size.width}px horizontal overflow`,
            ).toBeLessThanOrEqual(size.width + 2);
            observations.push({ appearance: appearance.tag, width: size.width, ...layout });
          }
        }
        await page.setViewportSize({ width: 320, height: 700 });
        await page.goto(`/matches/${id}`);
        await waitForBoard(page, game, tag);
        if (["dots-boxes", "sos", "connect-four"].includes(game)) {
          await page.getByRole("button", { name: "Focus", exact: true }).click();
          await expect(page.getByRole("button", { name: "Exit focus" })).toBeVisible();
          await captureScreenshot(page, path.join(evidence, `${tag}-focus-320.png`));
          await page.getByRole("button", { name: "Exit focus" }).click();
        }
        if (["dots-boxes", "sos"].includes(game)) {
          await page.getByRole("button", { name: "Zoom board" }).click();
          await expect(page.getByRole("button", { name: "Reset board zoom" })).toBeVisible();
          await captureScreenshot(page, path.join(evidence, `${tag}-zoom-320.png`));
          await page.getByRole("button", { name: "Reset board zoom" }).click();
        }
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
        const originalFontSizes = await page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll<HTMLElement>(
              "h1,h2,h3,p,span,label,button,input,select,summary,legend",
            ),
          );
          const originals = elements.map((element) => element.style.fontSize);
          const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
          elements.forEach((element, index) => {
            element.style.fontSize = `${sizes[index] * 2}px`;
          });
          return originals;
        });
        await captureScreenshot(page, path.join(evidence, `${tag}-text200-320.png`));
        const scaledWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scaledWidth, `${game} text scaling horizontal overflow`).toBeLessThanOrEqual(322);
        observations.push({ textScale: 200, scrollWidth: scaledWidth });
        await page.evaluate((originals) => {
          Array.from(
            document.querySelectorAll<HTMLElement>(
              "h1,h2,h3,p,span,label,button,input,select,summary,legend",
            ),
          ).forEach((element, index) => {
            element.style.fontSize = originals[index];
          });
        }, originalFontSizes);
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect(
          await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        ).toBe(true);
        await captureScreenshot(page, path.join(evidence, `${tag}-reduced-motion-320.png`));
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await writeJsonWithRetry(path.join(evidence, `${tag}-matrix.json`), observations);
      } finally {
        await cleanup(page, id);
        await chooseAppearance(page, initialFamily, initialMode);
      }
    });
  }
});

test("accepted action motion video and live Animation observations", async ({ browser }) => {
  test.setTimeout(180000);
  fs.mkdirSync(evidence, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: evidence, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await login(page, "A");
  const motionGames = ["ludo", "snakes-and-ladders", "connect-four", "dots-boxes", "sos"] as const;
  const results: Array<{
    game: string;
    animationSamples: number;
    targets: string[];
    savedVersion: number;
    refreshRunning: number;
  }> = [];
  try {
    for (const game of motionGames) {
      let id = await create(page, game, "together");
      try {
        await page.goto(`/matches/${id}`);
        await waitForBoard(page, game);
        const before = await view(page, id);
        const samples = page.evaluate(async () => {
          let count = 0;
          const targets = new Set<string>();
          const until = performance.now() + 2500;
          while (performance.now() < until) {
            for (const animation of document.getAnimations()) {
              if (animation.playState === "running" && !(animation instanceof CSSTransition)) {
                count++;
                const target = (animation.effect as KeyframeEffect | null)
                  ?.target as Element | null;
                if (target)
                  targets.add(target.getAttribute("data-testid") ?? target.tagName.toLowerCase());
              }
            }
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          return { count, targets: [...targets] };
        });
        const control =
          game === "ludo"
            ? page.getByTestId("ludo-roll-button")
            : game === "snakes-and-ladders"
              ? page.getByTestId("snl-roll-button")
              : game === "connect-four"
                ? page.getByRole("button", { name: "Drop disc into column 1", exact: true })
                : game === "dots-boxes"
                  ? page.getByTestId("edge-h-0-0")
                  : page.getByTestId("sos-cell-0-0");
        await expect(control).toBeEnabled();
        await control.click();
        await expect
          .poll(async () => (await view(page, id)).deliveryVersion)
          .toBeGreaterThan(before.deliveryVersion);
        const observed = await samples;
        expect(observed.count, `${game} accepted motion not observed`).toBeGreaterThan(0);
        if (game === "ludo") {
          let saved = await view(page, id);
          for (let rolls = 0; saved.gameState.phase !== "choose-token" && rolls < 80; rolls++) {
            await expect(page.getByTestId("ludo-roll-button")).toBeEnabled();
            await page.getByTestId("ludo-roll-button").click();
            await expect
              .poll(async () => (await view(page, id)).deliveryVersion)
              .toBeGreaterThan(saved.deliveryVersion);
            saved = await view(page, id);
          }
          expect(saved.gameState.phase).toBe("choose-token");
          await page.getByTestId(`ludo-token-button-${saved.gameState.legalTokenIds[0]}`).click();
          await expect
            .poll(async () => (await view(page, id)).deliveryVersion)
            .toBeGreaterThan(saved.deliveryVersion);
          await page.waitForTimeout(400);
        }
        if (game === "snakes-and-ladders") {
          let saved = await view(page, id);
          let climbed = false,
            bitten = false;
          for (let rolls = 0; rolls < 120 && !(climbed && bitten); rolls++) {
            if (saved.lifecycle !== "active") {
              await cleanup(page, id);
              id = await create(page, game, "together");
              await page.goto(`/matches/${id}`);
              await waitForBoard(page, game);
              saved = await view(page, id);
            }
            const previous = saved;
            await expect(page.getByTestId("snl-roll-button")).toBeEnabled();
            await page.getByTestId("snl-roll-button").click();
            await expect
              .poll(async () => (await view(page, id)).deliveryVersion)
              .toBeGreaterThan(previous.deliveryVersion);
            saved = await view(page, id);
            const seat = previous.gameState.activeSeat as "A" | "B";
            const landing = previous.gameState.positions[seat] + saved.gameState.lastRoll;
            if (landing <= 100) {
              climbed ||= saved.gameState.positions[seat] > landing;
              bitten ||= saved.gameState.positions[seat] < landing;
            }
            await page.waitForTimeout(700);
          }
          expect(climbed, "SNL ladder observed through accepted UI rolls").toBe(true);
          expect(bitten, "SNL snake observed through accepted UI rolls").toBe(true);
          if (saved.lifecycle !== "active") {
            await cleanup(page, id);
            id = await create(page, game, "together");
            await page.goto(`/matches/${id}`);
            await waitForBoard(page, game);
          }
        }
        if (game === "dots-boxes") {
          for (const edge of ["edge-h-1-0", "edge-v-0-0", "edge-v-0-1"]) {
            const version = (await view(page, id)).deliveryVersion;
            await page.getByTestId(edge).click();
            await expect
              .poll(async () => (await view(page, id)).deliveryVersion)
              .toBeGreaterThan(version);
            await page.waitForTimeout(320);
          }
          await expect(page.getByTestId("dots-score-B")).toHaveText("1");
        }
        if (game === "sos") {
          for (const [letter, col] of [
            ["O", 1],
            ["S", 2],
          ] as const) {
            await page.getByRole("button", { name: letter, exact: true }).click();
            const version = (await view(page, id)).deliveryVersion;
            await page.getByTestId(`sos-cell-0-${col}`).click();
            await expect
              .poll(async () => (await view(page, id)).deliveryVersion)
              .toBeGreaterThan(version);
            await page.waitForTimeout(360);
          }
          await expect(page.getByTestId("sos-score-A")).toHaveText("1");
        }
        await page.reload();
        await waitForBoard(page, game);
        const refreshRunning = await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.playState === "running" && !(animation instanceof CSSTransition),
              ).length,
        );
        expect(refreshRunning, `${game} refresh must settle`).toBe(0);
        results.push({
          game,
          animationSamples: observed.count,
          targets: observed.targets,
          savedVersion: (await view(page, id)).deliveryVersion,
          refreshRunning,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const reducedBefore = (await view(page, id)).deliveryVersion;
        if (game === "connect-four")
          await page.getByRole("button", { name: "Drop disc into column 2", exact: true }).click();
        else if (game === "dots-boxes") await page.getByTestId("edge-h-0-1").click();
        else if (game === "sos") await page.getByTestId("sos-cell-0-3").click();
        else
          await page.getByTestId(game === "ludo" ? "ludo-roll-button" : "snl-roll-button").click();
        await expect
          .poll(async () => (await view(page, id)).deliveryVersion)
          .toBeGreaterThan(reducedBefore);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        expect(
          await page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.playState === "running" && !(animation instanceof CSSTransition),
                ).length,
          ),
          `${game} reduced motion must settle`,
        ).toBe(0);
        await page.emulateMedia({ reducedMotion: "no-preference" });
      } finally {
        await cleanup(page, id);
      }
    }
  } finally {
    await context.close();
    await writeJsonWithRetry(path.join(evidence, "accepted-motion-observations.json"), results);
  }
  const video = page.video();
  if (video) {
    const videoPath = path.join(evidence, "accepted-motion.webm");
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await video.saveAs(videoPath);
        break;
      } catch (err: unknown) {
        if (attempt === 10) throw err;
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
});
