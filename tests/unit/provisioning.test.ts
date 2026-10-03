import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { generateProvisioningSql } from "../../scripts/provision-accounts.mjs";
import { assertOriginConfiguration, getCsrfSecret, isAllowedOrigin } from "../../worker/config";
import { parseCookies } from "../../worker/auth/session";
import { hashPassword, verifyPassword } from "../../worker/auth/kdf";

describe("Explicit configuration and preserving provisioning", () => {
  it("verifies existing 600,000-iteration account hashes without reducing the work factor", async () => {
    const salt = "000102030405060708090a0b0c0d0e0f";
    const expectedHash = "51060a247a88153918bfcd5dcaf6199fcc62aebd0eea4d74155257b6c8d045dd";
    expect(await hashPassword("runtime-pbkdf2-regression", Buffer.from(salt, "hex"))).toEqual({
      passwordHash: expectedHash,
      salt,
      kdfAlgorithm: "PBKDF2-SHA256:600000",
    });
    expect(await verifyPassword("runtime-pbkdf2-regression", expectedHash, salt)).toBe(true);
    expect(await verifyPassword("wrong-password", expectedHash, salt)).toBe(false);
  });

  it("refuses missing secrets and malformed cookies safely", async () => {
    expect(() => getCsrfSecret({})).toThrow();
    expect(() => getCsrfSecret({ CSRF_SECRET: "short" })).toThrow();
    expect(parseCookies("arcade-session=%zz")).toEqual({});
    await expect(
      generateProvisioningSql({ playerAPassword: "", playerBPassword: "" }),
    ).rejects.toThrow();
  });

  it("rejects wildcard, inferred, non-HTTPS, and non-origin production configuration", () => {
    for (const ALLOWED_ORIGIN of [
      undefined,
      "*",
      "http://arcade.example",
      "https://arcade.example/path",
    ]) {
      expect(() =>
        assertOriginConfiguration({ ENVIRONMENT: "production", ALLOWED_ORIGIN }),
      ).toThrow(/exact HTTPS origin/);
    }
    expect(() =>
      assertOriginConfiguration({
        ENVIRONMENT: "production",
        ALLOWED_ORIGIN: "https://arcade.example",
      }),
    ).not.toThrow();
    expect(
      isAllowedOrigin(
        new Request("https://arcade.example/api/v1/auth/login", {
          method: "POST",
          headers: { Origin: "https://attacker.example" },
        }),
        { ENVIRONMENT: "production", ALLOWED_ORIGIN: "*" },
      ),
    ).toBe(false);
  });
  it("escapes names and preserves existing passwords/preferences on repeat setup", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(fs.readFileSync("migrations/0001_initial_schema.sql", "utf8"));
    const options = {
      playerAPassword: "explicit-long-password-A",
      playerBPassword: "explicit-long-password-B",
      playerAName: "O'Brien",
    };
    const first = await generateProvisioningSql(options);
    db.exec(first.sql);
    db.exec("UPDATE accounts SET paletteFamily='romantic', preferenceVersion=9 WHERE id='A'");
    db.exec("UPDATE accounts SET displayName='Owner B', preferenceVersion=6 WHERE id='B'");
    const second = await generateProvisioningSql({
      ...options,
      playerAPassword: "different-explicit-long-password",
      playerBPassword: "different-explicit-long-password-B",
    });
    db.exec(second.sql);
    const account = db
      .prepare(
        "SELECT passwordHash, displayName, paletteFamily, preferenceVersion FROM accounts WHERE id='A'",
      )
      .get();
    expect(account).toMatchObject({
      passwordHash: first.accountA.passwordHash,
      displayName: "O'Brien",
      paletteFamily: "romantic",
      preferenceVersion: 9,
    });
    const accountB = db
      .prepare(
        "SELECT passwordHash, displayName, paletteFamily, preferenceVersion FROM accounts WHERE id='B'",
      )
      .get();
    expect(accountB).toMatchObject({
      passwordHash: first.accountB.passwordHash,
      displayName: "Owner B",
      paletteFamily: "romantic",
      preferenceVersion: 6,
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM accounts").get()).toMatchObject({ count: 2 });
    db.close();
  });

  it("renames existing accounts without changing credentials or appearance and rejects stale revisions", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(fs.readFileSync("migrations/0001_initial_schema.sql", "utf8"));
    const seed = await generateProvisioningSql({
      playerAPassword: "explicit-long-password-A",
      playerBPassword: "explicit-long-password-B",
      playerAName: "Old A",
      playerBName: "Old B",
    });
    db.exec(seed.sql);
    db.exec("UPDATE accounts SET paletteFamily='romantic', preferenceVersion=9 WHERE id='A'");
    db.exec("UPDATE accounts SET preferenceVersion=6 WHERE id='B'");
    const before = db.prepare("SELECT * FROM accounts ORDER BY id").all();
    const migration = fs.readFileSync("migrations/0005_personal_display_names.sql", "utf8");
    db.exec(migration);
    const after = db.prepare("SELECT * FROM accounts ORDER BY id").all();
    expect(after).toEqual([
      { ...before[0], displayName: "Sly fox 🦊", preferenceVersion: 10 },
      { ...before[1], displayName: "Dumb Bunny 🐰", preferenceVersion: 7 },
    ]);
    const staleEdit = db
      .prepare("UPDATE accounts SET displayName='Old A' WHERE id='A' AND preferenceVersion=9")
      .run();
    expect(staleEdit.changes).toBe(0);
    db.exec(migration);
    expect(db.prepare("SELECT * FROM accounts ORDER BY id").all()).toEqual(after);
    db.close();
  });
});
