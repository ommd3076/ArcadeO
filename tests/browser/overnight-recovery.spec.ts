import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("an unloaded route opened offline enables Retry when the connection returns", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await login(page, "A");
  await context.setOffline(true);
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reconnect to open this page" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry page", exact: true })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Retry page", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Retry page", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("heading", { name: /games|arcade/i }).first()).toBeVisible();
  await context.close();
});
