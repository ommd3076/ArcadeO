import path from "node:path";
import fs from "node:fs";
import { setupLocal } from "./setup-local.mjs";
import { complete, runNode, wrangler } from "./local-runtime.mjs";
await setupLocal();
if (!fs.existsSync("dist/client/index.html")) {
  await complete(runNode(path.resolve("node_modules/vite/bin/vite.js"), ["build"]));
  await complete(runNode("scripts/build-public.mjs"));
}
const worker = wrangler(["dev", "--local", "--port", "8787", "--var", "ALLOWED_ORIGIN:http://localhost:5173"]);
const vite = runNode(path.resolve("node_modules/vite/bin/vite.js"));
function stop() { worker.kill(); vite.kill(); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
worker.on("exit", () => vite.kill());
vite.on("exit", () => worker.kill());
