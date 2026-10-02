import fs from "node:fs";
import { test, expect } from "@playwright/test";

test("late unauthenticated bootstrap cannot replace the newer UI sign-in session", async ({
  page,
}) => {
  const accounts = JSON.parse(fs.readFileSync(".local/browser-accounts.json", "utf8"));
  let freshSignIn = false;
  let releaseOld!: () => void;
  let oldRequests = 0;
  let oldResponses = 0;
  const held = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/api/v1/auth/login") && response.status() === 200)
      freshSignIn = true;
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    if (freshSignIn) return route.continue();
    oldRequests++;
    await held;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
    oldResponses++;
  });
  try {
    await page.goto("/login");
    await expect.poll(() => oldRequests).toBeGreaterThan(0);
    await page.getByLabel(/account|username/i).fill(accounts.playerAUser);
    await page.getByLabel(/^password$/i).fill(accounts.playerAPassword);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole("link", { name: "Games", exact: true })).toBeVisible();
    releaseOld();
    await expect.poll(() => oldResponses).toBe(oldRequests);
    await expect(page.getByRole("link", { name: "Games", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Games", exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByRole("link", { name: /Connect Four/ })).toBeVisible();
  } finally {
    releaseOld();
  }
});
