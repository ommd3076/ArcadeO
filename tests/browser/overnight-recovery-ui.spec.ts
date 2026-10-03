import { expect, test, type Page } from "@playwright/test";
import { action, create, login, view, writeJsonWithRetry } from "./helpers";

const evidence = "planning/review/evidence/overnight-recovery-ui";

async function cleanup(page: Page, id: string) {
  if ((await view(page, id)).lifecycle === "active") await action(page, id, "match.agree-abandon");
}

test("UI01: named pawn swatches explain conflicts and persist real setup colors", async ({
  page,
}) => {
  const auth = await login(page, "A");
  const profileResponse = await page.request.get("/api/v1/profile");
  expect(profileResponse.status()).toBe(200);
  const profile = await profileResponse.json();
  expect(profile.profile.displayName).toBe(auth.profile.displayName);
  await page.goto("/games/ludo");
  await page.getByRole("button", { name: /together side-by-side/i }).click();
  const owners = page.getByRole("group", {
    name: "Player whose pawn colour to choose",
    exact: true,
  });
  await expect(
    owners.getByRole("button", { name: auth.profile.displayName, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const aColors = page.getByRole("group", {
    name: `${auth.profile.displayName} pawn colour`,
    exact: true,
  });
  const green = aColors.getByRole("button", { name: /: Green, unavailable/ });
  await expect(green).toBeDisabled();
  await expect(green).toHaveAccessibleName(/Already used by/);
  await aColors.getByRole("button", { name: /: Red$/ }).click();
  await expect(aColors.getByRole("button", { name: /: Red, selected$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const ownerButtons = owners.getByRole("button");
  await expect(ownerButtons).toHaveCount(2);
  const secondOwnerName = (await ownerButtons.nth(1).innerText()).trim();
  expect(secondOwnerName).toBe(profile.opponent.displayName);
  await ownerButtons.nth(1).click();
  const bColors = page.getByRole("group", {
    name: `${secondOwnerName} pawn colour`,
    exact: true,
  });
  await expect(bColors.getByRole("button", { name: /: Red, unavailable/ })).toBeDisabled();
  await expect(bColors.getByRole("button", { name: /: Pink, unavailable/ })).toHaveAccessibleName(
    /Too similar/,
  );
  await bColors.getByRole("button", { name: /: Yellow$/ }).click();
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page).toHaveURL(/\/matches\//);
  const id = page.url().split("/").at(-1)!;
  try {
    const accepted = await view(page, id);
    expect(accepted.gameState.colours).toEqual({ A: "red", B: "yellow" });
    await page.reload();
    expect((await view(page, id)).gameState.colours).toEqual({ A: "red", B: "yellow" });
    await writeJsonWithRetry(`${evidence}/pawn-swatches.json`, {
      namedPlayers: true,
      sameAndSimilarConflictsExplained: true,
      submittedColors: { A: "red", B: "yellow" },
      persistedAfterReload: true,
    });
  } finally {
    await cleanup(page, id);
  }
});

for (const failure of [403, 404, 409, 429, 503, "invalid-json"] as const) {
  test(`PERF06: setup ${failure} failure ends pending state and allows a successful explicit retry`, async ({
    page,
  }) => {
    await login(page, "A");
    await page.goto("/games/connect-four");
    await page.getByRole("button", { name: /together side-by-side/i }).click();
    const creationIds: string[] = [];
    let attempts = 0;
    await page.route("**/api/v1/matches", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      creationIds.push(route.request().postDataJSON().creationId);
      attempts++;
      if (attempts === 1) {
        await route.fulfill({
          status: failure === "invalid-json" ? 201 : failure,
          contentType: "application/json",
          body:
            failure === "invalid-json"
              ? "{unfinished"
              : JSON.stringify({
                  code: `FIXTURE_${failure}`,
                  message: `Temporary setup failure (${failure}). Retry.`,
                }),
        });
      } else await route.continue();
    });
    const start = page.getByRole("button", { name: "Start Match", exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          failure === "invalid-json"
            ? /server did not confirm.*retry/i
            : `Temporary setup failure (${failure}). Retry.`,
      }),
    ).toBeVisible();
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page).toHaveURL(/\/matches\//);
    const id = page.url().split("/").at(-1)!;
    try {
      expect(attempts).toBe(2);
      expect(creationIds[1]).toBe(creationIds[0]);
      expect((await view(page, id)).lifecycle).toBe("active");
      await expect(
        page.getByRole("button", { name: "Drop disc into column 1", exact: true }),
      ).toBeEnabled();
      await writeJsonWithRetry(`${evidence}/setup-${failure}.json`, {
        injectedNetworkResponse: failure,
        boundedVisibleFailure: true,
        pendingCleared: true,
        explicitRetryAcceptedByRealWorker: true,
        sameCreationId: true,
      });
    } finally {
      await cleanup(page, id);
    }
  });
}

test("PERF06: a protected 401 returns to sign in and unknown game/match routes expose safe navigation", async ({
  page,
}) => {
  await login(page, "A");
  await page.goto("/games/not-a-real-game");
  await expect(
    page.getByRole("heading", { name: "This game is unavailable", exact: true }),
  ).toBeVisible();
  await page.goto("/matches/not-a-real-match");
  await expect(page.getByRole("alert")).toContainText(/unavailable|not found/i);
  await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeVisible();
  await page.route("**/api/v1/records/summary", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "SESSION_REVOKED", message: "Sign in again." }),
    }),
  );
  await page.goto("/us");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  await writeJsonWithRetry(`${evidence}/unknown-and-401.json`, {
    unknownGameAndMatchHaveVisibleError: true,
    appBackVisible: true,
    injected401ClearsIdentity: true,
    signInReachable: true,
  });
});

test("REC15: an accepted creation with a lost response retries its identity and opens one saved match", async ({
  page,
}) => {
  await login(page, "A");
  await page.goto("/games/connect-four");
  await page.getByRole("button", { name: /together side-by-side/i }).click();
  const creationIds: string[] = [];
  let matchId: string | undefined;
  let acceptedVersion = 0;
  let posts = 0;
  await page.route("**/api/v1/matches", async (route) => {
    if (route.request().method() === "POST") {
      creationIds.push(route.request().postDataJSON().creationId);
      posts++;
      const response = await route.fetch();
      const body = await response.json();
      expect(response.status()).toBe(posts === 1 ? 201 : 200);
      if (posts === 1) {
        matchId = body.matchId;
        acceptedVersion = (await view(page, matchId!)).deliveryVersion;
        await route.abort("failed");
      } else {
        expect(body.matchId).toBe(matchId);
        await route.fulfill({ response });
      }
    } else await route.continue();
  });
  try {
    const start = page.getByRole("button", { name: "Start Match", exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page).toHaveURL(/\/matches\//);
    expect(page.url().split("/").at(-1)).toBe(matchId);
    expect(creationIds).toHaveLength(2);
    expect(creationIds[1]).toBe(creationIds[0]);
    expect((await view(page, matchId!)).deliveryVersion).toBe(acceptedVersion);
    await expect(
      page.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
    await writeJsonWithRetry(`${evidence}/lost-creation-response.json`, {
      fault: "first real201 response aborted after Worker acceptance",
      actualWorkerAcceptedBothRequests: true,
      creationIdReused: true,
      sameMatchRecovered: true,
      noDuplicateVersionAdvance: true,
    });
  } finally {
    await page.unroute("**/api/v1/matches");
    if (matchId) await cleanup(page, matchId);
  }
});

test("PERF08: an actual waiting service worker update preserves the active match and document", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "A");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const id = await create(page, "connect-four", "together");
  try {
    await page.goto(`/matches/${id}`);
    let documentNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documentNavigations++;
    });
    await page.getByRole("button", { name: "Drop disc into column 1", exact: true }).click();
    await expect(page.getByTestId("c4-disc-5-0")).toBeVisible();
    const before = await view(page, id);
    const controllerBefore = await page.evaluate(
      () => navigator.serviceWorker.controller!.scriptURL,
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.register(`/sw.js?overnight-update=${crypto.randomUUID()}`, {
        scope: "/",
      });
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await navigator.serviceWorker.getRegistration("/"))?.waiting?.state,
        ),
      )
      .toBe("installed");
    expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(
      controllerBefore,
    );
    expect(documentNavigations).toBe(0);
    expect((await view(page, id)).deliveryVersion).toBe(before.deliveryVersion);
    await page.getByRole("button", { name: "Drop disc into column 2", exact: true }).click();
    await expect(page.getByTestId("c4-disc-5-1")).toBeVisible();
    expect((await view(page, id)).deliveryVersion).toBe(before.deliveryVersion + 1);
    const cachedApi = await page.evaluate(async () => {
      for (const name of await caches.keys())
        for (const request of await (await caches.open(name)).keys())
          if (new URL(request.url).pathname.startsWith("/api")) return true;
      return false;
    });
    expect(cachedApi).toBe(false);
    await writeJsonWithRetry(`${evidence}/waiting-service-worker.json`, {
      actualBrowserInstalledWaitingWorker: true,
      updateFixture: "same production sw.js registered under a new query URL, unchanged scope",
      controllerPreserved: true,
      documentNavigations,
      activeMatchPreserved: true,
      nextUiActionAccepted: true,
      privateApiCached: false,
      hardwareStandaloneCertification: false,
    });
  } finally {
    await cleanup(page, id);
    await context.close();
  }
});
