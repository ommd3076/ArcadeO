import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { generateSessionToken, deriveCsrfToken } from "../../../worker/auth/session";
import { sha256Hex } from "../../../worker/auth/crypto";
import { handleProfileRequest } from "../../../worker/api/profile";
import type { Env } from "../../../worker/index";

describe("Account Preferences & Profile API (Task B03)", () => {
  let sqlite: DatabaseSync;
  let db: D1Database;
  const CSRF_SECRET = "test-csrf-secret-key-32-bytes-long!";

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    db = createMockD1Database(sqlite);

    const schemaSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
      "utf8",
    );
    await db.exec(schemaSql);

    // Seed Player A (teal, standard) and Player B (violet, romantic)
    await db
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "A",
        "player_a",
        "Player A",
        "hashA",
        "saltA",
        "PBKDF2-SHA256:600000",
        "teal",
        "standard",
        1,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "B",
        "player_b",
        "Player B",
        "hashB",
        "saltB",
        "PBKDF2-SHA256:600000",
        "violet",
        "romantic",
        1,
      )
      .run();
  });

  async function createSession(accountId: "A" | "B") {
    const rawToken = generateSessionToken();
    const tokenHash = await sha256Hex(rawToken);
    const csrfToken = await deriveCsrfToken(rawToken, CSRF_SECRET);
    const csrfHash = await sha256Hex(csrfToken);

    await db
      .prepare(
        `INSERT INTO sessions (tokenHash, accountId, csrfHash, issuedAt, expiresAt, sessionId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        tokenHash,
        accountId,
        csrfHash,
        Date.now(),
        Date.now() + 86400000,
        `session-${accountId}`,
      )
      .run();

    return { rawToken, csrfToken };
  }

  it("fetches safe profile and opponent profile info", async () => {
    const { rawToken } = await createSession("A");
    const mockEnv = {
      DB: db,
      CSRF_SECRET,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    } as Env;

    const req = new Request("http://localhost/api/v1/profile", {
      headers: { Cookie: `arcade-session=${rawToken}` },
    });

    const res = await handleProfileRequest(req, mockEnv);
    expect(res?.status).toBe(200);

    const data = (await res?.json()) as {
      profile: {
        id: string;
        accentFamily: string;
        paletteFamily: string;
        preferenceVersion: number;
      };
      opponent: { id: string; accentFamily: string; paletteFamily: string };
    };

    expect(data.profile.id).toBe("A");
    expect(data.profile.accentFamily).toBe("teal");
    expect(data.profile.paletteFamily).toBe("standard");
    expect(data.opponent.id).toBe("B");
    expect(data.opponent.accentFamily).toBe("violet");
  });

  it("updates palette family and advances preferenceVersion", async () => {
    const { rawToken, csrfToken } = await createSession("A");
    const mockEnv = {
      DB: db,
      CSRF_SECRET,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    } as Env;

    const req = new Request("http://localhost/api/v1/profile/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `arcade-session=${rawToken}`,
        "X-Arcade-CSRF": csrfToken,
      },
      body: JSON.stringify({
        paletteFamily: "romantic",
        expectedPreferenceVersion: 1,
      }),
    });

    const res = await handleProfileRequest(req, mockEnv);
    expect(res?.status).toBe(200);

    const data = (await res?.json()) as { paletteFamily: string; preferenceVersion: number };
    expect(data.paletteFamily).toBe("romantic");
    expect(data.preferenceVersion).toBe(2);
  });

  it("enforces distinct accents constraint atomically", async () => {
    const { rawToken, csrfToken } = await createSession("A");
    const mockEnv = {
      DB: db,
      CSRF_SECRET,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    } as Env;

    // Player B currently has 'violet'. Player A attempts to choose 'violet'
    const req = new Request("http://localhost/api/v1/profile/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `arcade-session=${rawToken}`,
        "X-Arcade-CSRF": csrfToken,
      },
      body: JSON.stringify({
        accentFamily: "violet",
        expectedPreferenceVersion: 1,
      }),
    });

    const res = await handleProfileRequest(req, mockEnv);
    expect(res?.status).toBe(409);

    const err = (await res?.json()) as { error: string };
    expect(err.error).toContain("already chosen by opponent");
  });

  it("rejects update when preferenceVersion does not match", async () => {
    const { rawToken, csrfToken } = await createSession("A");
    const mockEnv = {
      DB: db,
      CSRF_SECRET,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    } as Env;

    const req = new Request("http://localhost/api/v1/profile/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `arcade-session=${rawToken}`,
        "X-Arcade-CSRF": csrfToken,
      },
      body: JSON.stringify({
        accentFamily: "cyan",
        expectedPreferenceVersion: 99, // Stale version
      }),
    });

    const res = await handleProfileRequest(req, mockEnv);
    expect(res?.status).toBe(409);
  });
});
