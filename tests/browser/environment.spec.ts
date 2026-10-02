import { test, expect } from "@playwright/test";
import { login, create, view, action, request } from "./helpers";
test("deep-link authentication guard, client session deadline and UI logout", async ({ page }) => {
  await page.goto("/matches/nonexistent-private-match");
  await expect(page).toHaveURL(/login/);
  await page.goto("/login");
  await login(page, "A");
  await page.goto("/us");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  const r = await page.request.get("/api/v1/auth/session");
  expect((await r.json()).authenticated).toBe(false);
  await page.clock.install();
  const again = await login(page, "A");
  while ((await page.evaluate(() => Date.now())) <= again.expiresAt) {
    const remaining = again.expiresAt - (await page.evaluate(() => Date.now())) + 1000;
    await page.clock.fastForward(Math.min(86400000, remaining));
  }
  await expect(page).toHaveURL(/login/);
});
test("four saved theme families/modes, portrait/laptop layout, keyboard focus and reduced motion screenshots", async ({
  page,
}) => {
  await login(page, "A");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/us");
  for (const family of ["standard", "romantic"]) {
    await page.getByRole("button", { name: new RegExp("^" + family, "i") }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-family", family);
    for (const mode of ["dark", "light"]) {
      await page.getByRole("button", { name: new RegExp("^" + mode + "$", "i") }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme-mode", mode);
      const textContrast = await page
        .getByRole("button", { name: /^standard/i })
        .evaluate((button) => {
          const rgb = (value: string) =>
            value
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number);
          const luminance = (values: number[]) =>
            values
              .map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const style = getComputedStyle(button);
          const foreground = luminance(rgb(style.color));
          const background = luminance(rgb(style.backgroundColor));
          return (
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
          );
        });
      expect(textContrast).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({
        path: `.local/browser-results/appearance-${family}-${mode}-390.png`,
        fullPage: true,
      });
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-family", "romantic");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "light");
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: /games|arcade/i }).first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `.local/browser-results/games-${width}-reduced-motion.png`,
      fullPage: true,
    });
  }
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : "",
  }));
  expect(focus.tag).not.toBe("BODY");
  expect(focus.outline).not.toBe("none");
  await page.screenshot({ path: ".local/browser-results/keyboard-focus-1280.png", fullPage: true });
});
test("actual service worker registration caches only public assets; API and private pages absent", async ({
  page,
}) => {
  await login(page, "A");
  await page.goto("/games");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await request(page, "/api/v1/profile");
  const result = await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    keys: (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  }));
  expect(result.registrations).toBeGreaterThan(0);
  expect(result.keys.length).toBeGreaterThan(0);
  expect(
    result.keys.some(
      (url) =>
        new URL(url).pathname.startsWith("/api/") || new URL(url).pathname.startsWith("/matches/"),
    ),
  ).toBe(false);
});
test("offline board input disabled then recovered; second device takeover disables previous controller", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "A");
  const id = await create(a, "connect-four", "together");
  await a.goto(`/matches/${id}`);
  const drop = a.getByRole("button", { name: "Drop disc into column 1", exact: true });
  await expect(drop).toBeEnabled();
  await ca.setOffline(true);
  await expect(drop).toBeDisabled();
  await expect(a.getByText(/Offline/).first()).toBeVisible();
  await ca.setOffline(false);
  await expect(drop).toBeEnabled();
  const before = (await view(a, id)).deliveryVersion;
  await drop.click();
  await expect.poll(async () => (await view(a, id)).deliveryVersion).toBeGreaterThan(before);
  await login(b, "B");
  await b.goto(`/matches/${id}`);
  await b.getByRole("button", { name: "Continue on this device", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Drop disc into column 1", exact: true }),
  ).toBeEnabled();
  await a.reload();
  await expect(
    a.getByRole("button", { name: "Drop disc into column 1", exact: true }),
  ).toBeDisabled();
  await action(b, id, "match.resign", { resigningSeat: "B" });
  expect((await view(b, id)).result.reason).toBe("resignation");
  await ca.close();
  await cb.close();
});
test("native authenticated browser WebSocket sends real authoritative snapshot", async ({
  page,
}) => {
  await login(page, "A");
  const id = await create(page, "rock-paper-scissors", "remote");
  const socket = await page.evaluate(
    (matchId) =>
      new Promise<{ ok: boolean; data?: any; error?: string }>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/v1/matches/${matchId}/socket`);
        const timer = setTimeout(() => {
          ws.close();
          resolve({ ok: false, error: "snapshot timeout" });
        }, 10000);
        ws.onmessage = (e) => {
          clearTimeout(timer);
          ws.close();
          resolve({ ok: true, data: JSON.parse(e.data) });
        };
        ws.onerror = () => {
          clearTimeout(timer);
          resolve({ ok: false, error: "upgrade rejected" });
        };
      }),
    id,
  );
  await action(page, id, "match.cancel");
  expect(socket.ok, socket.error).toBe(true);
  expect(JSON.stringify(socket.data)).toContain(id);
});
test("same-account independent sessions require explicit Together takeover", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  await login(a, "A");
  const id = await create(a, "connect-four", "together");
  try {
    await a.goto(`/matches/${id}`);
    await expect(
      a.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
    await login(b, "A");
    await b.goto(`/matches/${id}`);
    await expect(
      b.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeDisabled();
    await b.getByRole("button", { name: "Continue on this device", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
    await expect(
      a.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeDisabled();
    await a.reload();
    await expect(
      a.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeDisabled();
  } finally {
    try {
      await action(b, id, "match.resign", { resigningSeat: "B" });
    } catch {
      /* Preserve the original failure while cleaning up isolated fixtures. */
    }
    await first.close();
    await second.close();
  }
});
