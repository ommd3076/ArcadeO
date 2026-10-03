import { test, expect } from "@playwright/test";
import { login, request, view, action } from "./helpers";

for (const gameId of ["dots-boxes", "sos"] as const) {
  for (const size of [7, 9] as const) {
    test(`${gameId} ${size} setup saves an outer playable grid`, async ({ page }) => {
      await login(page, "A");
      await page.goto(`/games/${gameId}`);
      await page.getByRole("button", { name: /together side-by-side/i }).click();
      await page.getByRole("button", { name: `${size} × ${size}` }).click();
      await page.getByRole("button", { name: "Start Match", exact: true }).click();
      await expect(page).toHaveURL(/\/matches\//);
      const id = page.url().split("/").at(-1)!;
      const saved = await view(page, id);
      expect(saved.gameState.gridSize).toBe(size);
      if (gameId === "dots-boxes") {
        await expect(page.getByTestId(`dot-${size - 1}-${size - 1}`)).toBeVisible();
        await expect(page.getByTestId(`edge-h-${size - 1}-${size - 2}`)).toBeVisible();
        await page.getByTestId(`edge-h-${size - 1}-${size - 2}`).click();
        await expect.poll(async () => (await view(page, id)).gameState.edges.length).toBe(1);
      } else {
        await expect(page.getByTestId(`sos-cell-${size - 1}-${size - 1}`)).toBeVisible();
        await page.getByTestId(`sos-cell-${size - 1}-${size - 1}`).click();
        await expect
          .poll(async () => (await view(page, id)).gameState.board[size - 1][size - 1])
          .toBe("S");
      }
      await action(page, id, "match.agree-abandon");
      expect((await view(page, id)).lifecycle).toBe("abandoned");
    });
  }
}

test("Ludo pending pawn selection survives refresh and a colour update", async ({
  page,
}, testInfo) => {
  await login(page, "A");
  await page.goto("/games/ludo");
  await page.getByRole("button", { name: /together side-by-side/i }).click();
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page).toHaveURL(/\/matches\//);
  const id = page.url().split("/").at(-1)!;
  let saved = await view(page, id);
  for (let rolls = 0; rolls < 80 && saved.gameState.phase !== "choose-token"; rolls++) {
    saved = await action(page, id, "dice.roll");
  }
  expect(saved.gameState.phase).toBe("choose-token");
  const pending = saved.gameState.pendingRoll;
  const tokens = saved.gameState.tokens;
  await page.reload();
  await expect(page.getByTestId("ludo-roll-button")).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("ludo-pending-selection.png"),
    fullPage: true,
  });
  expect((await view(page, id)).gameState.pendingRoll).toBe(pending);
  await page.getByText("Pawn colours", { exact: true }).click();
  await page
    .getByRole("button", {
      name: `${saved.participants.A.displayName} pawn colour: Purple`,
      exact: true,
    })
    .click();
  await expect.poll(async () => (await view(page, id)).gameState.colours.A).toBe("purple");
  const changed = await view(page, id);
  expect(changed.gameState.pendingRoll).toBe(pending);
  expect(changed.gameState.tokens).toEqual(tokens);
  await expect(
    page.getByTestId(`ludo-token-button-${changed.gameState.legalTokenIds[0]}`),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("ludo-legal-pawn.png"), fullPage: true });
  await page.getByTestId(`ludo-token-button-${changed.gameState.legalTokenIds[0]}`).click();
  await expect.poll(async () => (await view(page, id)).gameState.phase).toBe("roll");
  await action(page, id, "match.agree-abandon");
});

test("personal pins stay isolated, shared queue rejects stale writes, and name save retains account", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "A");
  await login(b, "B");
  const beforeA = (await request(a, "/api/v1/library")).body;
  const beforeB = (await request(b, "/api/v1/library")).body;
  const pinned = [...new Set([...beforeA.favourites.gameIds, "ludo"])];
  const pin = await request(a, "/api/v1/library/favourites", "PUT", {
    gameIds: pinned,
    expectedVersion: beforeA.favourites.version,
  });
  expect(pin.r.status()).toBe(200);
  expect((await request(b, "/api/v1/library")).body.favourites.gameIds).toEqual(
    beforeB.favourites.gameIds,
  );
  const queue = [...new Set([...beforeA.playNext.gameIds, "sos"])];
  const first = await request(a, "/api/v1/library/play-next", "PUT", {
    gameIds: queue,
    expectedVersion: beforeA.playNext.version,
  });
  expect(first.r.status()).toBe(200);
  const stale = await request(b, "/api/v1/library/play-next", "PUT", {
    gameIds: ["ludo"],
    expectedVersion: beforeB.playNext.version,
  });
  expect(stale.r.status()).toBe(409);
  expect((await request(b, "/api/v1/library")).body.playNext.gameIds).toEqual(queue);
  await a.goto("/us");
  await a.getByLabel("Display name").fill("Arcade A");
  await a.getByRole("button", { name: "Save name" }).click();
  await expect(a.getByRole("status")).toContainText("Account preferences saved.");
  const session = (await request(a, "/api/v1/auth/session")).body;
  expect(session.profile.id).toBe("A");
  expect(session.profile.displayName).toBe("Arcade A");
  await ca.close();
  await cb.close();
});
