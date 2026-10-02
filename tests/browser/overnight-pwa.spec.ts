import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("precaches only the public shell graph and recovers cold offline routes", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const browserFailures: Array<Record<string, string>> = [];
  const retryEvents: string[] = [];
  page.on("requestfailed", (request) => {
    browserFailures.push({
      kind: "requestfailed",
      url: new URL(request.url()).pathname,
      error: request.failure()?.errorText ?? "unknown",
    });
  });
  page.on("pageerror", (error) =>
    browserFailures.push({ kind: "pageerror", error: error.message }),
  );
  page.on("request", (request) => {
    if (request.isNavigationRequest())
      retryEvents.push(`request:${new URL(request.url()).pathname}`);
  });
  page.on("response", (response) => {
    if (response.url().endsWith(".js")) {
      const path = new URL(response.url()).pathname;
      if (/games-page|index-/.test(path)) {
        retryEvents.push(`script:${response.status()}:${path}`);
      }
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) retryEvents.push(`navigated:${new URL(frame.url()).pathname}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error")
      browserFailures.push({ kind: "console", error: message.text() });
  });

  await page.goto("/login");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const initialCache = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith("arcade-shell-"));
    const urls = (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname),
        ),
      )
    ).flat();
    const shell = await caches.match("/index.html");
    return {
      names,
      urls,
      shell: shell
        ? { url: shell.url, redirected: shell.redirected, status: shell.status, type: shell.type }
        : null,
    };
  });
  console.log("PWA_CACHED_INDEX", JSON.stringify(initialCache.shell));
  expect(initialCache.names.length).toBeGreaterThan(0);
  expect(initialCache.urls).toContain("/index.html");
  expect(initialCache.urls).toContain("/manifest.json");
  expect(initialCache.urls).toContain("/fonts/plus-jakarta-sans-latin-variable.woff2");
  expect(initialCache.urls).toContain("/fonts/barlow-condensed-latin-600.woff2");
  expect(initialCache.urls).toContain("/fonts/barlow-condensed-latin-700.woff2");
  expect(initialCache.urls).toContain("/fonts/dm-mono-latin-400.woff2");
  expect(initialCache.names.every((name) => /^arcade-shell-[a-f0-9]{16}$/.test(name))).toBe(true);
  expect(initialCache.urls.some((url) => url.includes("dm-sans-latin"))).toBe(false);
  expect(
    initialCache.urls.some((url) =>
      /\/(home-page|games-page|game-detail-page|match-page|sudoku-list)-[^/]+\.js$/.test(url),
    ),
  ).toBe(false);

  await login(page, "A");
  const afterPrivateReads = await page.evaluate(async () => {
    await fetch("/api", { credentials: "include" }).catch(() => undefined);
    await fetch("/api/v1/auth/session?cache-probe=1", { credentials: "include" }).catch(
      () => undefined,
    );
    const names = (await caches.keys()).filter((name) => name.startsWith("arcade-shell-"));
    return (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname),
        ),
      )
    ).flat();
  });
  expect(afterPrivateReads.some((url) => url === "/api" || url.startsWith("/api/"))).toBe(false);

  await context.setOffline(true);
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { name: /Reconnect to open this page|Reconnect to your arcade/ }),
  ).toBeVisible();
  const retryPage = page.getByRole("button", { name: "Retry page", exact: true });
  const retryConnection = page.getByRole("button", { name: "Retry connection", exact: true });
  if (await retryConnection.isVisible()) {
    await expect(retryConnection).toBeDisabled();
  } else {
    await expect(retryPage).toBeDisabled();
  }
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  const onlineProbes = await page.evaluate(async () => {
    async function probe(url: string) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        return {
          path: new URL(url, location.href).pathname,
          status: response.status,
          ok: response.ok,
          type: response.headers.get("content-type"),
          bytes: (await response.arrayBuffer()).byteLength,
        };
      } catch (error) {
        return {
          path: new URL(url, location.href).pathname,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return await Promise.all([probe("/api/health"), probe("/")]);
  });
  console.log("PWA_ONLINE_PROBES", JSON.stringify(onlineProbes));
  console.log("PWA_BROWSER_FAILURES", JSON.stringify(browserFailures));
  expect(onlineProbes.every((probe) => "ok" in probe && probe.ok)).toBe(true);
  if (await retryConnection.isVisible()) {
    await retryConnection.click();
  } else if (await retryPage.isVisible()) {
    console.log("PWA_RETRY_BUTTON", JSON.stringify({ disabled: await retryPage.isDisabled() }));
    expect(await retryPage.isDisabled()).toBe(false);
    await retryPage.click();
  }
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  console.log("PWA_RETRY_URL", new URL(page.url()).pathname);
  console.log(
    "PWA_AFTER_RETRY",
    JSON.stringify({
      route: new URL(page.url()).pathname,
      failures: browserFailures,
      events: retryEvents,
    }),
  );
  await context.close();
});
