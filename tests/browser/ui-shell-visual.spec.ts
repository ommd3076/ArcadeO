import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { action, create, login, request, view, origin } from "./helpers";

const appearances = [
  { family: "Standard", mode: "Dark", key: "standard-dark" },
  { family: "Standard", mode: "Light", key: "standard-light" },
  { family: "Romantic", mode: "Dark", key: "romantic-dark" },
  { family: "Romantic", mode: "Light", key: "romantic-light" },
] as const;
const widths = [320, 390, 430, 1280] as const;
const output = path.resolve(".local/evidence/owner-corrections/ui-shell");
const blurPageFocus = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });

test("Home, Games and Us render across all appearances and responsive widths", async ({ page }) => {
  fs.mkdirSync(output, { recursive: true });
  await login(page, "A");

  const screens = [
    {
      key: "home",
      path: "/",
      heading: page.locator(".home-page__header h1"),
    },
    {
      key: "games",
      path: "/games",
      heading: page.locator(".games-page__header h1"),
    },
    {
      key: "us",
      path: "/us",
      heading: page.locator("header h1").first(),
    },
  ] as const;

  for (const appearance of appearances) {
    await page.goto("/us");
    await page.getByRole("button", { name: new RegExp("^" + appearance.family, "i") }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme-family",
      appearance.family.toLowerCase(),
    );
    await page.getByRole("button", { name: new RegExp("^" + appearance.mode + "$", "i") }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme-mode",
      appearance.mode.toLowerCase(),
    );

    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 740 });
      for (const screen of screens) {
        await page.goto(screen.path);
        await expect(screen.heading).toBeVisible();
        if (screen.key === "games") {
          await expect(page.getByRole("link", { name: /Connect Four/ })).toBeVisible();
          await expect(page.getByRole("link", { name: /Sudoku/ })).toBeVisible();
        }
        if (screen.key === "us") {
          await expect(
            page.getByRole("heading", { name: "Appearance", exact: true }),
          ).toBeVisible();
        }
        const layout = await page.evaluate(() => ({
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          layout.scrollWidth,
          screen.key + " " + appearance.key + " " + width,
        ).toBeLessThanOrEqual(layout.width + 2);
        await blurPageFocus(page);
        await page.screenshot({
          path: path.join(output, screen.key + "-" + appearance.key + "-" + width + ".png"),
          fullPage: true,
        });
      }
    }

    await page.setViewportSize({ width: 320, height: 740 });
    for (const screen of screens) {
      await page.goto(screen.path);
      await expect(screen.heading).toBeVisible();
      await page.evaluate(() => {
        const textNodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            "h1,h2,h3,p,span,label,button,input,select,summary,legend",
          ),
        ).map((element) => ({
          element,
          originalFontSize: parseFloat(getComputedStyle(element).fontSize),
        }));
        for (const { element, originalFontSize } of textNodes) {
          element.style.fontSize = originalFontSize * 2 + "px";
        }
      });
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clipped: Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,.arcade-btn"))
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.innerText.trim()),
      }));
      expect(layout.scrollWidth, screen.key + " 200% text").toBeLessThanOrEqual(layout.width + 2);
      expect(layout.clipped, screen.key + " clipped headings or actions at 200% text").toEqual([]);
      await blurPageFocus(page);
      await page.screenshot({
        path: path.join(output, screen.key + "-" + appearance.key + "-text200-320.png"),
        fullPage: true,
      });
    }
  }
});

test("Home renders accurate empty and multi-match states in all four appearances", async ({
  page,
}) => {
  const activeMatches: string[] = [];
  await login(page, "A");
  try {
    // Recovery cases intentionally retain matches. Establish this fixture's
    // empty state through legal actions in the isolated browser-test Worker.
    expect(new URL(page.url()).origin).toBe(origin);
    const existing = await request(page, "/api/v1/matches");
    expect(existing.r.ok()).toBe(true);
    for (const match of existing.body.matches ?? []) {
      if (!["waiting", "active", "saved"].includes(match.lifecycle)) continue;
      let snapshot = await view(page, match.matchId);
      if (!snapshot.controller.isController) {
        const takeover = await request(
          page,
          `/api/v1/matches/${match.matchId}/controller`,
          "POST",
          {
            expectedControllerGeneration: snapshot.controller.controllerGeneration,
          },
        );
        expect(takeover.r.ok()).toBe(true);
        snapshot = await view(page, match.matchId);
      }
      const lifecycleAction = [
        "match.agree-abandon",
        "match.resign",
        "match.request-abandon",
        "match.cancel",
        "match.decline",
      ].find((candidate) => snapshot.legalActions.includes(candidate));
      expect(lifecycleAction, "Synthetic fixture has a legal cleanup action").toBeTruthy();
      const closed = await action(
        page,
        match.matchId,
        lifecycleAction!,
        lifecycleAction === "match.resign" && snapshot.mode === "together"
          ? { resigningSeat: "A" }
          : {},
      );
      expect(["abandoned", "resigned", "cancelled"]).toContain(closed.lifecycle);
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pick a game to play" })).toBeVisible();

    activeMatches.push(await create(page, "connect-four", "together"));
    activeMatches.push(await create(page, "ludo", "together"));

    for (const appearance of appearances) {
      await page.goto("/us");
      await page.getByRole("button", { name: new RegExp("^" + appearance.family, "i") }).click();
      await page
        .getByRole("button", { name: new RegExp("^" + appearance.mode + "$", "i") })
        .click();
      await page.goto("/");
      await expect(
        page.getByRole("link", { name: /Resume Connect Four|Resume Ludo/ }).first(),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "More matches to resume" })).toBeVisible();
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 2);
      await blurPageFocus(page);
      await page.screenshot({
        path: path.join(output, "home-multiple-" + appearance.key + "-390.png"),
        fullPage: true,
      });
    }
  } finally {
    for (const matchId of activeMatches) {
      const response = await page.request.get("/api/v1/matches/" + matchId);
      if (!response.ok()) continue;
      const match = await response.json();
      if (match.view?.lifecycle === "active" || match.lifecycle === "active") {
        await action(page, matchId, "match.agree-abandon");
      }
    }
  }
});
