import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { login, create, view, action, request, captureScreenshot } from "./helpers";

for (const game of ["dots-boxes", "sos"] as const) {
  test(`${game}: zoom pans to the outer column and accepts an outer action at 320px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, "A");
    const id = await create(page, game, "together", { gridSize: 9 });
    try {
      await page.goto(`/matches/${id}`);
      await page.getByRole("button", { name: "Zoom board", exact: true }).click();
      const viewport = page.getByRole("region", { name: `${game} board`, exact: true });
      await viewport.hover();
      await page.mouse.wheel(1000, 0);
      await expect
        .poll(() => viewport.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(100);
      const target = page.getByTestId(game === "sos" ? "sos-cell-0-8" : "edge-h-0-7");
      await target.click();
      await expect
        .poll(async () => {
          const saved = await view(page, id);
          return game === "sos" ? saved.gameState.board[0][8] : saved.gameState.edges.length;
        })
        .toBe(game === "sos" ? "S" : 1);
      const evidence = path.resolve(".local/evidence/owner-corrections");
      fs.mkdirSync(evidence, { recursive: true });
      await captureScreenshot(page, path.join(evidence, `${game}-zoom-panned-320.png`));
      await page.getByRole("button", { name: "Reset board zoom", exact: true }).click();
      expect(
        await viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
    } finally {
      await action(page, id, "match.agree-abandon");
    }
  });
}

test("shared recap projects a real scored result and excludes an abandoned match", async ({
  page,
}) => {
  await login(page, "A");
  const id = await create(page, "connect-four", "together");
  const starter = (await view(page, id)).turnSeat;
  for (let move = 0; move < 7; move++) {
    const saved = await view(page, id);
    await action(page, id, "connect-four.drop", { column: saved.turnSeat === starter ? 0 : 1 });
  }
  const terminal = await view(page, id);
  expect(terminal.result.reason).toBe("rules_win");
  await expect
    .poll(async () =>
      (await request(page, "/api/v1/records/recent")).body.sharedRecap.some(
        (entry: { matchId: string }) => entry.matchId === id,
      ),
    )
    .toBe(true);
  const recap = (await request(page, "/api/v1/records/recent")).body.sharedRecap;
  expect(recap.find((entry: { matchId: string }) => entry.matchId === id)).toMatchObject({
    gameId: "connect-four",
    mode: "together",
    reason: "rules_win",
    winnerAccountId: starter,
  });
  expect(recap.every((entry: Record<string, unknown>) => !("durationMs" in entry))).toBe(true);
  const abandoned = await create(page, "connect-four", "together");
  await action(page, abandoned, "match.agree-abandon");
  await page.goto("/us");
  await expect(
    page.getByRole("heading", { name: "Recent shared sessions", exact: true }),
  ).toBeVisible();
  expect(
    (await request(page, "/api/v1/records/recent")).body.sharedRecap.some(
      (entry: { matchId: string }) => entry.matchId === abandoned,
    ),
  ).toBe(false);
});
