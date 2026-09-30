import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Derives password hash using standard Web Crypto PBKDF2.
 */
export async function hashPassword(password, saltBytes, iterations = 600000) {
  const salt = saltBytes ?? crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256
  );

  const hexHash = Buffer.from(derivedBits).toString("hex");
  const hexSalt = Buffer.from(salt).toString("hex");
  return {
    passwordHash: hexHash,
    salt: hexSalt,
    kdfAlgorithm: `PBKDF2-SHA256:${iterations}`,
  };
}

/**
 * Generates SQL seed for accounts A and B.
 */
export async function generateProvisioningSql(options = {}) {
  const playerAPassword = options.playerAPassword || process.env.PLAYER_A_PASSWORD || "Arcade-PlayerA-2026!";
  const playerBPassword = options.playerBPassword || process.env.PLAYER_B_PASSWORD || "Arcade-PlayerB-2026!";

  const playerAUser = options.playerAUser || process.env.PLAYER_A_USERNAME || "player_a";
  const playerBUser = options.playerBUser || process.env.PLAYER_B_USERNAME || "player_b";

  const playerAName = options.playerAName || process.env.PLAYER_A_NAME || "Player A";
  const playerBName = options.playerBName || process.env.PLAYER_B_NAME || "Player B";

  const hashedA = await hashPassword(playerAPassword);
  const hashedB = await hashPassword(playerBPassword);

  const accountA = {
    id: "A",
    username: playerAUser.trim().toLowerCase(),
    displayName: playerAName,
    passwordHash: hashedA.passwordHash,
    salt: hashedA.salt,
    kdfAlgorithm: hashedA.kdfAlgorithm,
    accentFamily: "teal",
    paletteFamily: "standard",
    preferenceVersion: 1,
  };

  const accountB = {
    id: "B",
    username: playerBUser.trim().toLowerCase(),
    displayName: playerBName,
    passwordHash: hashedB.passwordHash,
    salt: hashedB.salt,
    kdfAlgorithm: hashedB.kdfAlgorithm,
    accentFamily: "violet",
    paletteFamily: "romantic",
    preferenceVersion: 1,
  };

  const sql = `-- Provisioned accounts seed
INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
VALUES
  ('${accountA.id}', '${accountA.username}', '${accountA.displayName}', '${accountA.passwordHash}', '${accountA.salt}', '${accountA.kdfAlgorithm}', '${accountA.accentFamily}', '${accountA.paletteFamily}', ${accountA.preferenceVersion}),
  ('${accountB.id}', '${accountB.username}', '${accountB.displayName}', '${accountB.passwordHash}', '${accountB.salt}', '${accountB.kdfAlgorithm}', '${accountB.accentFamily}', '${accountB.paletteFamily}', ${accountB.preferenceVersion})
ON CONFLICT(id) DO UPDATE SET
  username = excluded.username,
  displayName = excluded.displayName,
  passwordHash = excluded.passwordHash,
  salt = excluded.salt,
  kdfAlgorithm = excluded.kdfAlgorithm,
  accentFamily = excluded.accentFamily,
  paletteFamily = excluded.paletteFamily,
  preferenceVersion = excluded.preferenceVersion;
`;

  return { sql, accountA, accountB };
}

// CLI entry point
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  console.log("Generating account credentials...");
  generateProvisioningSql().then(({ sql, accountA, accountB }) => {
    const outputPath = path.resolve(process.cwd(), "migrations", "seed_accounts.sql");
    fs.writeFileSync(outputPath, sql, "utf8");
    console.log(`Saved provisioning SQL to ${outputPath}`);
    console.log(`Provisioned Account A: id=${accountA.id}, username=${accountA.username}, palette=${accountA.paletteFamily}, accent=${accountA.accentFamily}`);
    console.log(`Provisioned Account B: id=${accountB.id}, username=${accountB.username}, palette=${accountB.paletteFamily}, accent=${accountB.accentFamily}`);
    console.log("Credentials provisioned successfully without echoing secrets.");
  }).catch((err) => {
    console.error("Failed to provision accounts:", err);
    process.exit(1);
  });
}
