import path from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
process.env.XDG_CONFIG_HOME = path.resolve(".local/xdg");
process.env.WRANGLER_LOG_PATH = path.resolve(".local/workers-vitest.log");
process.env.WRANGLER_SEND_METRICS = "false";
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: { bindings: { ENVIRONMENT: "test", CSRF_SECRET: "isolated-workers-test-secret-32-characters", ALLOWED_ORIGIN: "http://localhost" } } })],
  test: { include: ["tests/workers/**/*.test.mjs"], maxWorkers: 1, isolate: false, testTimeout: 30_000 },
});
