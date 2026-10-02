import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { login, create, action, writeJsonWithRetry } from "./helpers";

function getInitialAppJsGzipBytes(): number {
  const manifest = JSON.parse(fs.readFileSync("dist/client/.vite/manifest.json", "utf8")) as Record<
    string,
    { file?: string; imports?: string[] }
  >;
  const files = new Set<string>();
  function collect(key: string) {
    if (files.has(key)) return;
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing static dependency ${key} from the Vite manifest`);
    files.add(key);
    for (const dependency of entry.imports ?? []) collect(dependency);
  }
  collect("index.html");
  return [...files]
    .map((key) => manifest[key].file)
    .filter((file): file is string => !!file && file.endsWith(".js"))
    .reduce(
      (sum, file) => sum + gzipSync(fs.readFileSync(path.join("dist/client", file))).byteLength,
      0,
    );
}

test("measure comparable loading, input, frames and route resource lifetime", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const label = process.env.ARCADE_PERF_LABEL ?? "current";
  const initialAppJsGzipBytes = getInitialAppJsGzipBytes();
  expect(initialAppJsGzipBytes).toBeLessThan(250 * 1024);
  const loading: unknown[] = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 50,
      downloadThroughput: 1024 * 1024,
      uploadThroughput: 1024 * 1024,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    for (const cache of ["cold", "warm"]) {
      await page.goto("/login");
      await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      loading.push(
        await page.evaluate(
          ({ repeat, cache }) => {
            const navigation = performance.getEntriesByType(
              "navigation",
            )[0] as PerformanceNavigationTiming;
            const resources = performance.getEntriesByType(
              "resource",
            ) as PerformanceResourceTiming[];
            return {
              repeat,
              cache,
              domContentLoadedMs: navigation.domContentLoadedEventEnd,
              firstContentfulPaintMs:
                performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
              jsDecodedBytes: resources
                .filter((entry) => new URL(entry.name).pathname.endsWith(".js"))
                .reduce((sum, entry) => sum + entry.decodedBodySize, 0),
              totalTransferredBytes: resources.reduce(
                (sum, entry) => sum + entry.transferSize,
                navigation.transferSize,
              ),
              fontDecodedBytes: resources
                .filter((entry) => entry.name.endsWith(".woff2"))
                .reduce((sum, entry) => sum + entry.decodedBodySize, 0),
            };
          },
          { repeat, cache },
        ),
      );
    }
    await context.close();
  }

  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const counters = {
      socketsCreated: 0,
      socketsActive: 0,
      sentMessages: 0,
      receivedMessages: 0,
      sentBytes: 0,
      receivedBytes: 0,
    };
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        counters.socketsCreated++;
        counters.socketsActive++;
        this.addEventListener("close", () => counters.socketsActive--, { once: true });
        this.addEventListener("message", (event) => {
          counters.receivedMessages++;
          if (typeof event.data === "string") counters.receivedBytes += event.data.length;
        });
      }
      override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        counters.sentMessages++;
        if (typeof data === "string") counters.sentBytes += data.length;
        super.send(data);
      }
    };
    (window as any).__arcadeTraffic = counters;
  });
  await login(page, "A");
  const id = await create(page, "connect-four", "together");
  await page.goto(`/matches/${id}`);
  await expect(
    page.getByRole("button", { name: "Drop disc into column 1", exact: true }),
  ).toBeEnabled();
  const cdp = await context.newCDPSession(page);
  async function memory() {
    await cdp.send("HeapProfiler.collectGarbage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const heapUsage = await cdp.send("Runtime.getHeapUsage");
    const heap = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
    return {
      ...dom,
      heapBytes: heap,
      preciseHeapBytes: heapUsage.usedSize,
      connectedNodes: await page.evaluate(() => document.querySelectorAll("*").length),
      headLinks: await page.evaluate(() =>
        Array.from(document.head.querySelectorAll("link")).map((link) => ({
          rel: link.rel,
          path: new URL(link.href).pathname,
        })),
      ),
      loadedScriptPaths: await page.evaluate(() =>
        (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .map((entry) => new URL(entry.name).pathname)
          .filter((pathname) => pathname.endsWith(".js")),
      ),
      traffic: await page.evaluate(() => (window as any).__arcadeTraffic),
    };
  }
  const beforeCycles = await memory();
  for (let repeat = 0; repeat < 6; repeat++) {
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Resume Connect Four", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Resume Connect Four", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
  }
  const afterCycles = await memory();
  expect(afterCycles.traffic.socketsActive).toBeLessThanOrEqual(1);
  const samples: unknown[] = [];
  for (const column of [0, 1, 0, 1, 2, 3]) {
    const discCount = await page.locator(".c4-disc").count();
    await page.evaluate(() => {
      const frameTimes: number[] = [];
      let start = 0,
        previous = 0;
      const capture = (time: number) => {
        if (previous) frameTimes.push(time - previous);
        previous = time;
        if (time - start < 1000) requestAnimationFrame(capture);
      };
      document.addEventListener(
        "pointerdown",
        () => {
          start = performance.now();
          (window as any).__arcadeInput = { start, frameTimes, latencyMs: null };
          requestAnimationFrame(capture);
        },
        { once: true },
      );
      const observer = new MutationObserver(() => {
        const state = (window as any).__arcadeInput;
        if (
          state &&
          document.querySelectorAll(".c4-disc").length > (window as any).__arcadeDiscCount
        ) {
          state.latencyMs = performance.now() - state.start;
          observer.disconnect();
        }
      });
      (window as any).__arcadeDiscCount = document.querySelectorAll(".c4-disc").length;
      observer.observe(document.body, { subtree: true, childList: true });
    });
    await page
      .getByRole("button", { name: `Drop disc into column ${column + 1}`, exact: true })
      .click();
    await expect(page.locator(".c4-disc")).toHaveCount(discCount + 1);
    await page.waitForTimeout(1100);
    samples.push(await page.evaluate(() => (window as any).__arcadeInput));
  }
  const traffic = await page.evaluate(() => (window as any).__arcadeTraffic);
  await action(page, id, "match.agree-abandon");
  await context.close();
  const result = {
    label,
    environment: {
      browser: browser.version(),
      viewport: "1280x900",
      loadingCpuRate: 4,
      loadingLatencyMs: 50,
      loadingBytesPerSecond: 1048576,
      serviceWorkers: "blocked for comparable cache measurements",
      initialAppJsGzipBytes,
      input: "unthrottled local Worker; pointerdown to accepted disc DOM insertion",
      frames: "headless Chromium requestAnimationFrame samples; includes capture overhead",
    },
    loading,
    beforeCycles,
    afterCycles,
    samples,
    traffic,
  };
  await writeJsonWithRetry(
    `planning/review/evidence/owner-corrections/performance-${label}.json`,
    result,
  );
  console.log("PERFORMANCE_MEASURED", label);
});
