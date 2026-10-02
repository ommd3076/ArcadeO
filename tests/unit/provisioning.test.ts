import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { generateProvisioningSql } from "../../scripts/provision-accounts.mjs";
import { assertOriginConfiguration, getCsrfSecret, isAllowedOrigin } from "../../worker/config";
import { parseCookies } from "../../worker/auth/session";

describe("Explicit configuration and preserving provisioning", () => {
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
});
