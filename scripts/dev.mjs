import fs from "node:fs";
import path from "node:path";
import { setupLocal } from "./setup-local.mjs";
import { complete, runNode, wrangler } from "./local-runtime.mjs";
const devPort = Number(process.env.ARCADE_DEV_PORT || 5173);
const workerPort = Number(process.env.ARCADE_WORKER_PORT || 8787);
const statePath = process.env.ARCADE_DEV_STATE
  ? path.resolve(process.env.ARCADE_DEV_STATE)
  : ".wrangler/state";
if (
  !Number.isInteger(devPort) || devPort < 1 || devPort > 65535 ||
  !Number.isInteger(workerPort) || workerPort < 1 || workerPort > 65535 ||
  devPort === workerPort
) {
  throw new Error("ARCADE_DEV_PORT and ARCADE_WORKER_PORT must be distinct valid TCP ports");
}
const origin = process.env.ARCADE_DEV_ORIGIN || `http://localhost:${devPort}`;
const parsedOrigin = new URL(origin);
if (
  parsedOrigin.protocol !== "http:" ||
  parsedOrigin.port !== String(devPort) ||
  parsedOrigin.pathname !== "/" ||
  parsedOrigin.search ||
  parsedOrigin.hash ||
  parsedOrigin.username ||
  parsedOrigin.password
) {
  throw new Error(`ARCADE_DEV_ORIGIN must be the exact http://host:${devPort} browser origin`);
}
await setupLocal(statePath, Boolean(process.env.ARCADE_DEV_STATE));
if (!fs.existsSync("dist/client/index.html")) {
  await complete(runNode(path.resolve("node_modules/vite/bin/vite.js"), ["build"]));
  await complete(runNode("scripts/build-public.mjs"));
}
const workerArgs = [
  "dev",
  "--local",
  "--port",
  String(workerPort),
  "--var",
  `ALLOWED_ORIGIN:${origin}`,
  "--var",
  "ENVIRONMENT:development",
];
if (process.env.ARCADE_DEV_STATE) workerArgs.push("--persist-to", statePath);
const worker = wrangler(workerArgs);
const vite = runNode(path.resolve("node_modules/vite/bin/vite.js"), ["--host", "0.0.0.0", "--port", String(devPort)]);
function stop() { worker.kill(); vite.kill(); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
worker.on("exit", () => vite.kill());
vite.on("exit", () => worker.kill());
