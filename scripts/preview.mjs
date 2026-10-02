import { setupLocal } from "./setup-local.mjs";
import { wrangler } from "./local-runtime.mjs";
await setupLocal();
const child = wrangler(["dev", "--local", "--ip", "0.0.0.0", "--port", "8787", "--var", "ALLOWED_ORIGIN:*"]);
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
