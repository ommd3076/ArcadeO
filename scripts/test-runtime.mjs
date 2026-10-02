import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setupLocal } from "./setup-local.mjs";
import { complete, runNode, waitForWorker, wrangler, runtimeEnv } from "./local-runtime.mjs";
const persistPath = path.resolve(`.local/runtime-${randomUUID()}`);
const origin = "http://localhost:8788";
await setupLocal(persistPath, true);
await complete(runNode("scripts/bundle-worker.mjs"));
const log = fs.openSync(path.join(persistPath, "worker.log"), "w");
const child = wrangler(["dev", "dist/worker/index.js", "--no-bundle", "--local", "--port", "8788", "--persist-to", persistPath, "--var", `ALLOWED_ORIGIN:${origin}`], { stdio: ["ignore", log, log] });
try {
  await waitForWorker(origin, child);
  await complete(runNode("tests/runtime/runtime.test.mjs", [], { env: { ...runtimeEnv(), ARCADE_ORIGIN: origin, ARCADE_ACCOUNTS_PATH: path.join(persistPath, "accounts.json") } }));
} finally { child.kill(); fs.closeSync(log); }
