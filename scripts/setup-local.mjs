import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { generateProvisioningSql } from "./provision-accounts.mjs";
import { complete, wrangler } from "./local-runtime.mjs";

export async function setupLocal(persistPath = ".wrangler/state", isolated = false) {
  fs.mkdirSync(".local", { recursive: true });
  if (!fs.existsSync(".dev.vars")) {
    fs.writeFileSync(".dev.vars", `CSRF_SECRET=${randomBytes(32).toString("hex")}\nENVIRONMENT=development\n`, { mode: 0o600 });
  }
  const accountPath = path.resolve(isolated ? `${persistPath}/accounts.json` : ".local/accounts.json");
  fs.mkdirSync(path.dirname(accountPath), { recursive: true });
  let accounts;
  if (fs.existsSync(accountPath)) accounts = JSON.parse(fs.readFileSync(accountPath, "utf8"));
  else {
    accounts = {
      playerAUser: process.env.ACCOUNT_A_USERNAME || "player_a",
      playerBUser: process.env.ACCOUNT_B_USERNAME || "player_b",
      playerAPassword: process.env.ACCOUNT_A_PASSWORD || randomBytes(24).toString("base64url"),
      playerBPassword: process.env.ACCOUNT_B_PASSWORD || randomBytes(24).toString("base64url"),
    };
    fs.writeFileSync(accountPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  }
  await complete(wrangler(["d1", "migrations", "apply", "arcade-db", "--local", "--persist-to", persistPath]));
  const { sql } = await generateProvisioningSql(accounts);
  const seedPath = path.resolve(isolated ? `${persistPath}/accounts.sql` : ".local/accounts.sql");
  fs.writeFileSync(seedPath, sql, { mode: 0o600 });
  await complete(wrangler(["d1", "execute", "arcade-db", "--local", "--persist-to", persistPath, "--file", seedPath]));
  console.log(`Local schema ready. Account inserts preserve existing credentials/preferences. Credentials: ${accountPath}`);
  return accounts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve("scripts/setup-local.mjs")) {
  await setupLocal();
}
