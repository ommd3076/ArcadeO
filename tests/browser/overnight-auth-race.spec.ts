import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

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

test("a successful sign-out clears the same session after a preference refresh", async ({
  page,
}) => {
  const initialSession = await login(page, "A");
  await page.goto("/us");
  await expect(page.getByLabel("Display name")).toBeVisible();

  let releaseLogout!: () => void;
  let releaseSession!: () => void;
  let signalLogoutStarted!: () => void;
  let signalSessionResponseReady!: () => void;
  const logoutStarted = new Promise<void>((resolve) => {
    signalLogoutStarted = resolve;
  });
  const sessionResponseReady = new Promise<void>((resolve) => {
    signalSessionResponseReady = resolve;
  });
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  const sessionGate = new Promise<void>((resolve) => {
    releaseSession = resolve;
  });

  await page.route("**/api/v1/auth/logout", async (route) => {
    signalLogoutStarted();
    await logoutGate;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.fulfill({ response });
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    const session = JSON.parse(body.toString()) as typeof initialSession & {
      authenticated: boolean;
    };
    expect(session.authenticated).toBe(true);
    expect(session.csrfToken).toBe(initialSession.csrfToken);
    signalSessionResponseReady();
    await sessionGate;
    await route.fulfill({ response, body });
  });

  try {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await logoutStarted;

    const displayName = page.getByLabel("Display name");
    await displayName.fill("A06 Logout Race");
    await page.getByRole("button", { name: "Save name" }).click();
    await sessionResponseReady;
    const refreshFinished = page.waitForEvent("requestfinished", (request) =>
      request.url().endsWith("/api/v1/auth/session"),
    );
    releaseSession();

    await expect(page.getByRole("status")).toContainText("Account preferences saved.");
    await refreshFinished;
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );

    releaseLogout();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
    // UsPage explicitly navigates to /login even if provider logout is broken.
    // Enter an already-loaded protected SPA route offline so an API 401 cannot hide a
    // stale authenticated provider: successful logout must already deny it.
    await page.context().setOffline(true);
    await page.evaluate(() => {
      const routeState = window.history.state;
      window.history.replaceState(routeState, "", "/us");
      window.dispatchEvent(new PopStateEvent("popstate", { state: routeState }));
    });
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
    releaseSession();
    releaseLogout();
  }
});
