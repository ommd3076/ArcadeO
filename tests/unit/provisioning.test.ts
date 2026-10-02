import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { generateProvisioningSql } from "../../scripts/provision-accounts.mjs";
import { getCsrfSecret } from "../../worker/config";
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
    const second = await generateProvisioningSql({
      ...options,
      playerAPassword: "different-explicit-long-password",
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
    db.close();
  });
});
