import path from "node:path";
import { defineConfig } from "@playwright/test";
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".local/browsers");
export default defineConfig({
  testDir: "./tests/browser",
  globalTeardown: "./tests/browser/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 12000 },
  reporter: [["list"], ["html", { outputFolder: ".local/browser-report", open: "never" }]],
  outputDir: ".local/browser-results/run-" + Date.now(),
  use: {
    baseURL: "http://localhost:8789",
    actionTimeout: 12000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "node scripts/browser-server.mjs",
    url: "http://localhost:8789/api/health",
    reuseExistingServer: false,
    timeout: 120000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
