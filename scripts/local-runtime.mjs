import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
export function runtimeEnv() {
  const localDir = path.resolve(".local");
  fs.mkdirSync(localDir, { recursive: true });
  return { ...process.env, XDG_CONFIG_HOME: path.join(localDir, "xdg"), WRANGLER_LOG_PATH: path.join(localDir, "wrangler.log"), WRANGLER_SEND_METRICS: "false" };
}
export function runNode(entry, args = [], options = {}) {
  return spawn(process.execPath, [entry, ...args], { stdio: "inherit", env: runtimeEnv(), ...options });
}
export function wrangler(args, options = {}) {
  return runNode(path.resolve(path.dirname(require.resolve("wrangler")), "../bin/wrangler.js"), args, options);
}
export async function complete(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Process exited ${code}`)));
  });
}
export async function waitForWorker(origin, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Worker exited before health check");
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Worker startup timed out");
}
