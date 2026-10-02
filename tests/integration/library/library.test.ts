import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { generateSessionToken, deriveCsrfToken } from "../../../worker/auth/session";
import { sha256Hex } from "../../../worker/auth/crypto";
import { handleLibraryRequest } from "../../../worker/api/library";
import type { Env } from "../../../worker/index";

describe("Library API", () => {
  let db: D1Database;
  let env: Env;
  const secret = "test-csrf-secret-key-32-bytes-long!";

  beforeEach(async () => {
    db = createMockD1Database(new DatabaseSync(":memory:"));
    await db.exec(readFileSync("migrations/0001_initial_schema.sql", "utf8"));
    await db.exec(readFileSync("migrations/0003_library.sql", "utf8"));
    for (const id of ["A", "B"]) {
      await db
        .prepare(
          "INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily) VALUES (?, ?, ?, 'hash', 'salt', ?, 'standard')",
        )
        .bind(id, id, id, id === "A" ? "teal" : "violet")
        .run();
    }
    env = {
      DB: db,
      CSRF_SECRET: secret,
      MATCH_DO: {} as DurableObjectNamespace,
      ENVIRONMENT: "test",
      ALLOWED_ORIGIN: "*",
    };
  });

  async function session(id: "A" | "B") {
    const token = generateSessionToken();
    const csrf = await deriveCsrfToken(token, secret);
    await db
      .prepare(
        "INSERT INTO sessions (tokenHash, accountId, csrfHash, issuedAt, expiresAt, sessionId) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        await sha256Hex(token),
        id,
        await sha256Hex(csrf),
        Date.now(),
        Date.now() + 60000,
        crypto.randomUUID(),
      )
      .run();
    return { token, csrf };
  }

  function request(route: string, credentials?: { token: string; csrf: string }, body?: unknown) {
    return new Request(`http://localhost/api/v1/library${route}`, {
      method: body === undefined ? "GET" : "PUT",
      headers: credentials
        ? { Cookie: `arcade-session=${credentials.token}`, "X-Arcade-CSRF": credentials.csrf }
        : {},
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it("keeps favourites per account and play-next shared with CAS", async () => {
    const a = await session("A");
    const b = await session("B");
    const putA = await handleLibraryRequest(
      request("/favourites", a, { gameIds: ["sos", "ludo"], expectedVersion: 1 }),
      env,
    );
    expect(putA?.status).toBe(200);
    const bInitial = await handleLibraryRequest(request("", b), env);
    expect(await bInitial?.json()).toEqual({
      favourites: { gameIds: [], version: 1 },
      playNext: { gameIds: [], version: 1 },
    });
    const shared = await handleLibraryRequest(
      request("/play-next", a, { gameIds: ["sos", "ludo"], expectedVersion: 1 }),
      env,
    );
    expect(shared?.status).toBe(200);
    const stale = await handleLibraryRequest(
      request("/play-next", b, { gameIds: ["sudoku"], expectedVersion: 1 }),
      env,
    );
    expect(stale?.status).toBe(409);
    expect(((await stale?.json()) as { current: { gameIds: string[] } }).current.gameIds).toEqual([
      "sos",
      "ludo",
    ]);
    const updated = await handleLibraryRequest(
      request("/play-next", b, { gameIds: ["ludo", "sos"], expectedVersion: 2 }),
      env,
    );
    expect(updated?.status).toBe(200);
    const aFinal = await handleLibraryRequest(request("", a), env);
    expect(await aFinal?.json()).toEqual({
      favourites: { gameIds: ["sos", "ludo"], version: 2 },
      playNext: { gameIds: ["ludo", "sos"], version: 3 },
    });
  });

  it("rejects unauthenticated and invalid lists", async () => {
    expect((await handleLibraryRequest(request(""), env))?.status).toBe(401);
    const a = await session("A");
    expect(
      (
        await handleLibraryRequest(
          request("/play-next", a, { gameIds: ["sos", "sos"], expectedVersion: 1 }),
          env,
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await handleLibraryRequest(
          request("/play-next", a, { gameIds: ["unknown"], expectedVersion: 1 }),
          env,
        )
      )?.status,
    ).toBe(400);
  });
});
