import { complete, wrangler } from "./local-runtime.mjs";
await complete(wrangler(["deploy", "--dry-run", "--outdir", "dist/worker"]));
