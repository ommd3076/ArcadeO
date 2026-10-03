import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("ArcadeO identity is consistent across browser, installed manifest, login and Home", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page).toHaveTitle("ArcadeO");
  await expect(page.getByText("ArcadeO", { exact: true })).toBeVisible();
  const manifestResponse = await page.request.get("/manifest.json");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("ArcadeO");
  expect(manifest.short_name).toBe("ArcadeO");
  expect(manifest.start_url).toBe("/");
  await login(page, "A");
  await page.goto("/");
  await expect(page.getByText("ArcadeO", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("ArcadeO");
  fs.mkdirSync(".local/evidence/arcadeo", { recursive: true });
  await page.screenshot({
    path: path.resolve(".local/evidence/arcadeo/home-390.png"),
    fullPage: true,
  });
});
