import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("different accounts finish Remote Connect Four using live UI without reload", async ({
  browser,
}) => {
  const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await pc.newPage();
  const b = await phone.newPage();
  const accounts = JSON.parse(fs.readFileSync(".local/browser-accounts.json", "utf8"));
  for (const [page, seat] of [
    [a, "A"],
    [b, "B"],
  ] as const) {
    await page.goto("/login");
    await page.getByLabel(/account|username/i).fill(accounts[`player${seat}User`]);
    await page.getByLabel(/^password$/i).fill(accounts[`player${seat}Password`]);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/login/);
  }
  await a.goto("/games/connect-four");
  await a.getByRole("button", { name: /^Remote/ }).click();
  await a.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(a).toHaveURL(/\/matches\//);
  await b.goto(a.url());
  await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await a.getByRole("button", { name: "I am ready", exact: true }).click();
  await b.getByRole("button", { name: "I am ready", exact: true }).click();
  let discs = 0;
  for (const [page, col] of [
    [a, 1],
    [b, 2],
    [a, 1],
    [b, 2],
    [a, 1],
    [b, 2],
    [a, 1],
  ] as const) {
    const drop = page.getByRole("button", { name: `Drop disc into column ${col}`, exact: true });
    await expect(drop).toBeEnabled();
    await drop.click();
    discs++;
    await expect(a.locator(".c4-disc")).toHaveCount(discs);
    await expect(b.locator(".c4-disc")).toHaveCount(discs);
  }
  await expect(a.getByText(/Wins!/, { exact: false }).first()).toBeVisible();
  await expect(b.getByText(/Wins!/, { exact: false }).first()).toBeVisible();
  await pc.close();
  await phone.close();
});
