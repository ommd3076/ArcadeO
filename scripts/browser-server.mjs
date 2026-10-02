import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { setupLocal } from "./setup-local.mjs";
import { wrangler, waitForWorker } from "./local-runtime.mjs";
const persistPath = path.resolve(".local/browser-" + randomUUID());
const accounts = await setupLocal(persistPath, true);
fs.writeFileSync(path.resolve(".local/browser-accounts.json"), JSON.stringify(accounts), {
  mode: 0o600,
});
const logFd = fs.openSync(path.resolve(".local/browser-server.log"), "a");
const child = wrangler(
  [
    "dev",
    "dist/worker/index.js",
    "--no-bundle",
    "--local",
    "--port",
    "8789",
    "--persist-to",
    persistPath,
    "--var",
    "ALLOWED_ORIGIN:http://localhost:8789",
  ],
  { stdio: ["ignore", logFd, logFd] },
);
const controlToken = randomUUID();
fs.writeFileSync(
  path.resolve(".local/browser-control.json"),
  JSON.stringify({ token: controlToken }),
  { mode: 0o600 },
);
const control = http.createServer((request, response) => {
  if (
    request.method !== "POST" ||
    request.url !== "/shutdown" ||
    request.headers.authorization !== controlToken
  ) {
    response.writeHead(403).end();
    return;
  }
  response.writeHead(200).end("stopping");
  child.kill();
});
control.listen(8790, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
    process.exit(0);
  });
}
child.once("exit", (code) => process.exit(code ?? 1));
await waitForWorker("http://localhost:8789", child);
console.log("Browser QA isolated Worker ready at http://localhost:8789");
