import { test, expect, type Page, type Locator } from "@playwright/test";
import { login, action } from "./helpers";

const games = [
  "connect-four",
  "dots-boxes",
  "sos",
  "snakes-and-ladders",
  "ludo",
  "rock-paper-scissors",
  "hand-cricket",
] as const;

// Observe delivered versions only. Neither observer submits an API game action.
function deliveredVersions(page: Page) {
  let latest = 0;
  const observe = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const message = data as {
      deliveryVersion?: number;
      acceptedVersion?: number;
      view?: { deliveryVersion?: number };
      latestView?: { deliveryVersion?: number };
    };
    for (const version of [
      message.deliveryVersion,
      message.acceptedVersion,
      message.view?.deliveryVersion,
      message.latestView?.deliveryVersion,
    ]) {
      if (typeof version === "number") latest = Math.max(latest, version);
    }
  };
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      try {
        observe(JSON.parse(String(payload)));
      } catch {
        /* Ignore non-JSON transport frames. */
      }
    }),
  );
  page.on("response", (response) => {
    if (/\/api\/v1\/matches\//.test(response.url()) && response.status() === 200) {
      void response
        .json()
        .then(observe)
        .catch(() => {});
    }
  });
  return () => latest;
}

async function enabledActor(pages: Page[], locate: (page: Page) => Locator) {
  let actor: Page | undefined;
  await expect
    .poll(async () => {
      const enabled: Page[] = [];
      for (const page of pages) {
        const control = locate(page);
        if ((await control.count()) && (await control.isEnabled())) enabled.push(page);
      }
      actor = enabled[0];
      return enabled.length;
    })
    .toBe(1);
  return actor!;
}

async function unmaskIfNeeded(page: Page) {
  const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
  if (await unmask.isVisible()) await unmask.click();
}

for (const game of games)
  for (const creatorSeat of ["A", "B"] as const) {
    test(`${game}: creator ${creatorSeat} accepts and delivers the first Remote action through UI without reload`, async ({
      browser,
    }) => {
      const pc = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        serviceWorkers: "block",
      });
      // Separate browser processes keep the emulated devices' focus independent
      // during simultaneous secret choice selection and locking.
      const phoneBrowser = await browser.browserType().launch();
      const phone = await phoneBrowser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
      });
      const a = await pc.newPage(),
        b = await phone.newPage();
      const pages = [a, b];
      const versions = pages.map(deliveredVersions);
      const creator = creatorSeat === "A" ? a : b;
      const receiver = creatorSeat === "A" ? b : a;
      let matchId: string | undefined;
      try {
        const authA = await login(a, "A");
        const authB = await login(b, "B");
        await creator.goto(`/games/${game}`);
        await creator.getByRole("button", { name: /^Remote/ }).click();
        if (game === "ludo") {
          const creatorName = (creatorSeat === "A" ? authA : authB).profile.displayName;
          const receiverName = (creatorSeat === "A" ? authB : authA).profile.displayName;
          const players = creator.getByRole("group", {
            name: "Player whose pawn colour to choose",
            exact: true,
          });
          await expect(players.getByRole("button").first()).toHaveText(creatorName);
          await creator.getByRole("button", { name: `${creatorName}: Pink`, exact: true }).click();
          await players.getByRole("button", { name: receiverName, exact: true }).click();
          await creator.getByRole("button", { name: `${receiverName}: Cyan`, exact: true }).click();
        }
        const createdResponse = creator.waitForResponse(
          (response) =>
            response.url().endsWith("/api/v1/matches") && response.request().method() === "POST",
        );
        await creator.getByRole("button", { name: "Start Match", exact: true }).click();
        const created = await createdResponse;
        if (game === "ludo") {
          expect(created.request().postDataJSON().gameOptions.colours).toEqual({
            A: "pink",
            B: "cyan",
          });
        }
        await expect(creator).toHaveURL(/\/matches\//);
        matchId = creator.url().split("/").at(-1)!;
        await receiver.goto(creator.url());
        await receiver.getByRole("button", { name: "Accept invitation", exact: true }).click();
        await creator.getByRole("button", { name: "I am ready", exact: true }).click();
        await receiver.getByRole("button", { name: "I am ready", exact: true }).click();
        if (game === "ludo") {
          // Read the accepted state only; setup and gameplay remain UI actions.
          const received = await (await creator.request.get(`/api/v1/matches/${matchId}`)).json();
          const state = received.view ?? received;
          expect(state.gameState.colours).toEqual({ A: "pink", B: "cyan" });
          expect(state.participants.A.accountId).toBe(creatorSeat);
        }

        if (game === "hand-cricket") {
          const tossWinner = await enabledActor(pages, (page) =>
            page.getByTestId("cricket-choose-bat"),
          );
          await tossWinner.getByTestId("cricket-choose-bat").click();
        }
        const secret = game === "rock-paper-scissors" || game === "hand-cricket";
        if (secret) {
          for (const page of pages) {
            await expect(page.locator(".arcade-secret-handoff")).toBeVisible();
            await unmaskIfNeeded(page);
            await expect(page.getByRole("radio").first()).toBeVisible();
          }
        }
        await expect.poll(() => versions[0]() > 2 && versions[0]() === versions[1]()).toBe(true);
        const prior = versions[0]();
        if (secret) {
          await a
            .getByRole("radio", {
              name: game === "rock-paper-scissors" ? "Rock" : "1 Run",
              exact: true,
            })
            .click();
          await b
            .getByRole("radio", {
              name: game === "rock-paper-scissors" ? "Paper" : "2 Runs",
              exact: true,
            })
            .click();
          await Promise.all(
            pages.map((page) =>
              page.getByRole("button", { name: "Lock Choice", exact: true }).click(),
            ),
          );
          for (const page of pages) {
            await unmaskIfNeeded(page);
            await expect(
              page
                .getByText(
                  game === "rock-paper-scissors" ? "Round 1 Result" : /\+\d+ Runs Scored!/,
                  { exact: true },
                )
                .first(),
            ).toBeVisible();
          }
        } else {
          const locate = (page: Page) =>
            game === "connect-four"
              ? page.getByRole("button", { name: "Drop disc into column 1", exact: true })
              : game === "dots-boxes"
                ? page.getByTestId("edge-h-0-0")
                : game === "sos"
                  ? page.getByTestId("sos-cell-0-0")
                  : page.getByTestId(game === "ludo" ? "ludo-roll-button" : "snl-roll-button");
          const actor = await enabledActor(pages, locate);
          await locate(actor).click();
          if (game === "connect-four")
            for (const page of pages) await expect(page.locator(".c4-disc")).toHaveCount(1);
          if (game === "dots-boxes")
            for (const page of pages)
              await expect(page.getByTestId("edge-h-0-0")).toHaveAttribute(
                "aria-label",
                /claimed by/,
              );
          if (game === "sos")
            for (const page of pages)
              await expect(page.getByTestId("sos-cell-0-0")).toHaveText("S");
        }
        for (const version of versions) await expect.poll(version).toBeGreaterThan(prior);
      } finally {
        // Cleanup of this isolated fixture follows the completed first-action
        // assertions; it is not API-assisted invitation, readiness or gameplay.
        if (matchId) await action(creator, matchId, "match.resign").catch(() => {});
        await pc.close();
        await phone.close();
        await phoneBrowser.close();
      }
    });
  }
