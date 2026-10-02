import { setupLocal } from "./setup-local.mjs";
import { wrangler } from "./local-runtime.mjs";
const previewPort = Number(process.env.ARCADE_PREVIEW_PORT || 8787);
if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535) {
  throw new Error("ARCADE_PREVIEW_PORT must be a valid TCP port");
}
const origin = process.env.ARCADE_PREVIEW_ORIGIN || `http://localhost:${previewPort}`;
const parsedOrigin = new URL(origin);
if (
  parsedOrigin.protocol !== "http:" ||
  parsedOrigin.port !== String(previewPort) ||
  parsedOrigin.pathname !== "/" ||
  parsedOrigin.search ||
  parsedOrigin.hash ||
  parsedOrigin.username ||
  parsedOrigin.password
) {
  throw new Error(`ARCADE_PREVIEW_ORIGIN must be the exact http://host:${previewPort} browser origin`);
}
await setupLocal();
const child = wrangler([
  "dev",
  "--local",
  "--ip",
  "0.0.0.0",
  "--port",
  String(previewPort),
  "--var",
  `ALLOWED_ORIGIN:${origin}`,
  "--var",
  "ENVIRONMENT:development",
]);
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
