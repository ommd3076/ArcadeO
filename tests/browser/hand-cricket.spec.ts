import { expect, test } from "@playwright/test";
import { action, login, uiCreate, view } from "./helpers";

let openMatchId: string | undefined;
test.afterEach(async ({ page }) => {
  if (!openMatchId) return;
  const matchId = openMatchId;
  openMatchId = undefined;
  const saved = await view(page, matchId);
  if (saved.lifecycle === "active") await action(page, matchId, "match.agree-abandon");
});

for (const firstBatter of ["A", "B"] as const) {
  test(`Together Hand Cricket keeps ${firstBatter} batting until out and swaps once`, async ({
    page,
  }) => {
    await page.setViewportSize(
      firstBatter === "A" ? { width: 390, height: 844 } : { width: 1082, height: 668 },
    );
    if (firstBatter === "B") await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, "A");
    const id = await uiCreate(page, "hand-cricket");
    openMatchId = id;
    const toss = (await view(page, id)).gameState.tossWinner;
    await page
      .getByRole("button", { name: toss === firstBatter ? "Bat First" : "Bowl First", exact: true })
      .click();

    async function unmask() {
      await page.bringToFront();
      const resume = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      if (await resume.isVisible()) await resume.click();
    }

    async function delivery(bat: number, bowl: number, recoverFirstLock = false) {
      const before = await view(page, id);
      const batter = before.gameState.roles.bat;
      const bowler = before.gameState.roles.bowl;
      await unmask();
      await expect(
        page.getByRole("heading", { name: `Player ${batter}, make your choice`, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: `I am Player ${batter} (Ready)`, exact: true })
        .click();
      await expect(
        page.getByRole("radiogroup", { name: "Select runs to score (1..10)", exact: true }),
      ).toBeVisible();
      const layout = await page.getByRole("radiogroup").evaluate((group) => ({
        groupRight: group.getBoundingClientRect().right,
        optionRight: Math.max(
          ...Array.from(group.querySelectorAll('[role="radio"]')).map(
            (option) => option.getBoundingClientRect().right,
          ),
        ),
      }));
      expect(layout.optionRight).toBeLessThanOrEqual(layout.groupRight + 1);
      await page
        .getByRole("radio", { name: `${bat} ${bat === 1 ? "Run" : "Runs"}`, exact: true })
        .click();
      await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: `Pass phone to Player ${bowler}`, exact: true }),
      ).toBeVisible();
      expect((await view(page, id)).gameState.lockedSeats).toEqual([batter]);
      if (recoverFirstLock) {
        await page.reload();
        await expect(
          page.getByRole("button", { name: "Resume & Unmask", exact: true }),
        ).toBeVisible();
        await unmask();
        await expect(
          page.getByRole("heading", { name: `Pass phone to Player ${bowler}`, exact: true }),
        ).toBeVisible();
      }
      const ready = page.getByRole("button", {
        name: `I am Player ${bowler} (Ready)`,
        exact: true,
      });
      await ready.focus();
      await page.keyboard.press("Space");
      await expect(
        page.getByRole("radiogroup", { name: "Select delivery number (1..10)", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("radio", { name: `${bowl} ${bowl === 1 ? "Run" : "Runs"}`, exact: true })
        .click();
      await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await expect(page.getByRole("button", { name: "Reveal ball", exact: true })).toBeVisible();
      const hidden = await view(page, id);
      expect(hidden.lifecycle).toBe("active");
      expect(hidden.gameState.lastDelivery).toBeNull();
      expect(hidden.gameState.firstInningsRuns).toBe(before.gameState.firstInningsRuns);
      expect(hidden.gameState.secondInningsRuns).toBe(before.gameState.secondInningsRuns);
      expect(hidden.result).toBeUndefined();
      await page.getByRole("button", { name: "Reveal ball", exact: true }).click();
      await expect.poll(async () => (await view(page, id)).gameState.revealed).toBe(true);
      if (bat !== bowl) {
        await expect(page.locator(".arcade-match-turn-strip")).toContainText(
          `Player ${batter} keeps batting`,
        );
      }
    }

    async function next(label = "Next ball") {
      const previous = (await view(page, id)).gameState.deliveryId;
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(async () => (await view(page, id)).gameState.deliveryId).toBe(previous + 1);
      expect((await view(page, id)).gameState.revealed).toBe(false);
    }

    await unmask();
    await delivery(7, 3, true);
    await next();
    await page.reload();
    await expect(page.getByRole("button", { name: "Resume & Unmask", exact: true })).toBeVisible();
    await unmask();
    await expect(
      page.getByRole("heading", { name: `Player ${firstBatter}, make your choice`, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/browser-results/cricket-${firstBatter}-keeps-batting.png`,
      fullPage: true,
    });
    await delivery(4, 2);
    await next();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByRole("button", { name: "Resume & Unmask", exact: true })).toBeVisible();
    await unmask();
    await expect(
      page.getByRole("heading", { name: `Player ${firstBatter}, make your choice`, exact: true }),
    ).toBeVisible();
    await delivery(10, 10);
    expect((await view(page, id)).gameState.firstInningsRuns).toBe(11);
    await next("Switch batting");
    const secondBatter = firstBatter === "A" ? "B" : "A";
    expect((await view(page, id)).gameState.roles).toEqual({
      bat: secondBatter,
      bowl: firstBatter,
    });
    await delivery(10, 3);
    await next();
    await delivery(7, 2);
    const stillBatting = await view(page, id);
    expect(stillBatting.lifecycle).toBe("active");
    expect(stillBatting.gameState.secondInningsRuns).toBe(17);
    expect(stillBatting.gameState.roles.bat).toBe(secondBatter);
    await page.screenshot({
      path: `.local/browser-results/cricket-${firstBatter}-past-first-total.png`,
      fullPage: true,
    });
    await next();
    await delivery(5, 5);
    const finished = await view(page, id);
    expect(finished.lifecycle).toBe("completed");
    expect(finished.result.winner).toBe(secondBatter);
    expect(finished.result.scores).toEqual({ [firstBatter]: 11, [secondBatter]: 17 });
    expect(finished.result.details.bowlingWickets).toEqual({ A: 1, B: 1 });
    await expect(page.getByRole("button", { name: "Rematch", exact: true })).toBeVisible();
    await page.screenshot({
      path: `.local/browser-results/cricket-${firstBatter}-result.png`,
      fullPage: true,
    });
  });
}
