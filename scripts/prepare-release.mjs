import fs from "node:fs";
import path from "node:path";

// Preparation only. This script never invokes Wrangler or changes a cloud account.
const accountId = process.env.ARCADE_CF_ACCOUNT_ID;
const databaseId = process.env.ARCADE_D1_DATABASE_ID;
const rawOrigin = process.env.ARCADE_PRODUCTION_ORIGIN;
if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error("Set ARCADE_CF_ACCOUNT_ID to the Arcade account's 32-character ID.");
}
if (!databaseId || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId)) {
  throw new Error("Set ARCADE_D1_DATABASE_ID to the real Arcade D1 UUID.");
}
const origin = new URL(rawOrigin ?? "");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("ARCADE_PRODUCTION_ORIGIN must be the exact HTTPS origin, without a path or credentials.");
}
const base = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const config = {
  ...base,
  $schema: "../node_modules/wrangler/config-schema.json",
  account_id: accountId,
  name: "private-arcade",
  main: "../worker/index.ts",
  assets: { ...base.assets, directory: "../dist/client" },
  d1_databases: [{ binding: "DB", database_name: "private-arcade-db", database_id: databaseId, migrations_dir: "../migrations" }],
  vars: { ENVIRONMENT: "production", ALLOWED_ORIGIN: origin.origin },
};
if (process.argv.includes("--check")) {
  console.log("Account ID, D1 UUID and HTTPS origin formats validated. Target ownership is unverified; no file or cloud mutation.");
} else {
  const output = path.resolve(".local/wrangler.arcade-production.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  console.log("Prepared .local/wrangler.arcade-production.json. Deployment still requires release authorization.");
}
