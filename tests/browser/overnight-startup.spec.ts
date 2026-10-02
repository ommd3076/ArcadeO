import { test, expect } from "@playwright/test";

test("stalled session bootstrap shows loading and Retry states, then recovers", async ({
  page,
}, testInfo) => {
  const missingAsset = await page.request.get("/assets/missing-auth-regression.js");
  expect(missingAsset.status()).toBe(404);
  expect(missingAsset.headers()["content-type"] ?? "").not.toContain("text/html");
  const unknownDocument = await page.request.get("/not-an-arcade-route", {
    headers: { Accept: "text/html" },
  });
  expect(unknownDocument.status()).toBe(404);
  expect(unknownDocument.headers()["content-type"]).toContain("text/html");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const browserWindow = window as Window & { __arcadeUnhandledErrors?: string[] };
    browserWindow.__arcadeUnhandledErrors = [];
    window.addEventListener("unhandledrejection", (event) => {
      event.preventDefault();
      browserWindow.__arcadeUnhandledErrors?.push(String(event.reason));
    });
    let heldFirstSessionBody = false;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/v1/auth/session") && !heldFirstSessionBody) {
        heldFirstSessionBody = true;
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start() {},
              cancel() {
                return Promise.reject(new Error("cancel cleanup rejected"));
              },
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      return originalFetch(input, init);
    };
  });

  await page.goto("/");
  const loading = page.getByRole("status");
  await expect(loading).toContainText("Opening your arcade…");
  expect(
    await page
      .locator(".auth-state__icon svg")
      .evaluate((icon) => getComputedStyle(icon).animationName),
  ).toBe("none");
  await testInfo.attach("auth-loading-state", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  const retry = page.getByRole("button", { name: "Retry connection", exact: true });
  await expect(retry).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("alert")).toContainText(/took too long/);
  await expect(page.getByText("Opening your arcade…")).toHaveCount(0);
  await testInfo.attach("auth-retry-state", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await retry.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  const unhandled = await page.evaluate(
    () => (window as Window & { __arcadeUnhandledErrors?: string[] }).__arcadeUnhandledErrors ?? [],
  );
  expect(unhandled).toEqual([]);
});
