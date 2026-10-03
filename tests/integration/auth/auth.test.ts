import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "./d1-mock";
import {
  derivePbkdf2Key,
  hashPassword,
  verifyPassword,
  benchmarkKdf,
  timingSafeEqual,
  bytesToHex,
} from "../../../worker/auth";
import { handleAuthRequest, type AuthEnv } from "../../../worker/api/auth";
import { checkLoginRateLimit, recordLoginFailure } from "../../../worker/auth/rate-limit";
import { generateProvisioningSql } from "../../../scripts/provision-accounts.mjs";

describe("Worker Auth Foundation (F02)", () => {
  describe("KDF Qualification & Known Vectors", () => {
    it("matches RFC 6070 / PBKDF2-HMAC-SHA256 test vectors", async () => {
      const enc = new TextEncoder();
      const pass = "password";
      const salt = enc.encode("salt");

      // Iteration = 1
      const dk1 = await derivePbkdf2Key(pass, salt, 1, 32);
      expect(bytesToHex(dk1)).toBe(
        "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
      );

      // Iteration = 2
      const dk2 = await derivePbkdf2Key(pass, salt, 2, 32);
      expect(bytesToHex(dk2)).toBe(
        "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43",
      );

      // Iteration = 4096
      const dk4096 = await derivePbkdf2Key(pass, salt, 4096, 32);
      expect(bytesToHex(dk4096)).toBe(
        "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
      );
    });

    it("verifies and benchmarks PBKDF2-SHA256 at OWASP recommended 600,000 iterations", async () => {
      const { passwordHash, salt, kdfAlgorithm } = await hashPassword("super-secret-password");
      expect(kdfAlgorithm).toBe("PBKDF2-SHA256:600000");
      expect(passwordHash).toHaveLength(64);
      expect(salt).toHaveLength(32);

      const isValid = await verifyPassword("super-secret-password", passwordHash, salt);
      expect(isValid).toBe(true);

      const isWrong = await verifyPassword("wrong-password", passwordHash, salt);
      expect(isWrong).toBe(false);

      // Benchmark qualification
      const bench = await benchmarkKdf(600_000, 1);
      expect(bench.durationMs).toBeGreaterThan(0);
      expect(bench.iterations).toBe(600_000);
    });

    it("evaluates timing safe equality correctly", () => {
      expect(timingSafeEqual("abcdef", "abcdef")).toBe(true);
      expect(timingSafeEqual("abcdef", "abcdeg")).toBe(false);
      expect(timingSafeEqual("abc", "abcdef")).toBe(false);
    });
  });

  describe("D1 Database Migrations & Account Provisioning", () => {
    let sqlite: DatabaseSync;
    let d1: D1Database;

    beforeEach(async () => {
      sqlite = new DatabaseSync(":memory:");
      d1 = createMockD1Database(sqlite);

      // Run initial schema migration
      const schemaSql = fs.readFileSync(
        path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
        "utf8",
      );
      await d1.exec(schemaSql);
    });

    it("creates all required tables and constraints from migrations/0001_initial_schema.sql", async () => {
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain("accounts");
      expect(tableNames).toContain("sessions");
      expect(tableNames).toContain("login_limits");
      expect(tableNames).toContain("puzzles");
      expect(tableNames).toContain("match_registry");
      expect(tableNames).toContain("active_slots");
      expect(tableNames).toContain("results");
      expect(tableNames).toContain("sudoku_records");
    });

    it("provisions Player A and Player B with specified palettes and accents", async () => {
      const { sql, accountA, accountB } = await generateProvisioningSql({
        playerAPassword: "PlayerA-Password!",
        playerBPassword: "PlayerB-Password!",
      });

      await d1.exec(sql);

      const rowA = await d1.prepare("SELECT * FROM accounts WHERE id = ?").bind("A").first<any>();
      const rowB = await d1.prepare("SELECT * FROM accounts WHERE id = ?").bind("B").first<any>();

      expect(rowA).toBeDefined();
      expect(rowA.username).toBe(accountA.username);
      expect(rowA.displayName).toBe("Sly fox 🦊");
      expect(rowA.paletteFamily).toBe("standard");
      expect(rowA.accentFamily).toBe("teal");
      expect(rowA.kdfAlgorithm).toBe("PBKDF2-SHA256:600000");

      expect(rowB).toBeDefined();
      expect(rowB.username).toBe(accountB.username);
      expect(rowB.displayName).toBe("Dumb Bunny 🐰");
      expect(rowB.paletteFamily).toBe("romantic");
      expect(rowB.accentFamily).toBe("violet");
      expect(rowB.kdfAlgorithm).toBe("PBKDF2-SHA256:600000");
    });
  });

  describe("Auth API Integration", () => {
    let sqlite: DatabaseSync;
    let env: AuthEnv;
    const CSRF_SECRET = "test-csrf-secret-key-12345-explicit-long";
    const ALLOWED_ORIGIN = "http://localhost:5173";

    beforeEach(async () => {
      sqlite = new DatabaseSync(":memory:");
      const d1 = createMockD1Database(sqlite);

      const schemaSql = fs.readFileSync(
        path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
        "utf8",
      );
      await d1.exec(schemaSql);

      const { sql } = await generateProvisioningSql({
        playerAPassword: "PlayerA-Secret!",
        playerBPassword: "PlayerB-Secret!",
      });
      await d1.exec(sql);

      env = {
        DB: d1,
        ENVIRONMENT: "development",
        ALLOWED_ORIGIN,
        CSRF_SECRET,
      };
    });

    it("rejects login with bad origin", async () => {
      const req = new Request("http://localhost:5173/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.com",
        },
        body: JSON.stringify({ username: "player_a", password: "PlayerA-Secret!" }),
      });

      const res = await handleAuthRequest(req, env);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(403);
      const data = (await res?.json()) as any;
      expect(data.code).toBe("ORIGIN_MISMATCH");
    });

    it("authenticates valid credentials, sets cookie, and returns safe profile without secret leak", async () => {
      const req = new Request("http://localhost:5173/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: ALLOWED_ORIGIN,
        },
        body: JSON.stringify({ username: "player_a", password: "PlayerA-Secret!" }),
      });

      const res = await handleAuthRequest(req, env);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(200);

      const setCookie = res?.headers.get("Set-Cookie");
      expect(setCookie).toContain("arcade-session=");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Path=/");

      const data = (await res?.json()) as any;
      expect(data.success).toBe(true);
      expect(data.csrfToken).toBeDefined();
      expect(data.expiresAt).toBeGreaterThan(Date.now());

      // Safe profile verification
      expect(data.profile.id).toBe("A");
      expect(data.profile.username).toBe("player_a");
      expect(data.profile.displayName).toBe("Sly fox 🦊");
      expect(data.profile.accentFamily).toBe("teal");
      expect(data.profile.paletteFamily).toBe("standard");
      expect(data.profile.passwordHash).toBeUndefined();
      expect(data.profile.salt).toBeUndefined();
    });

    it("rejects invalid password and enforces rate limiting after 5 failed attempts", async () => {
      for (let i = 0; i < 5; i++) {
        const req = new Request("http://localhost:5173/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: ALLOWED_ORIGIN,
            "CF-Connecting-IP": "192.168.1.100",
          },
          body: JSON.stringify({ username: "player_a", password: "WrongPassword!" }),
        });

        const res = await handleAuthRequest(req, env);
        expect(res?.status).toBe(401);
        const data = (await res?.json()) as any;
        expect(data.error).toBe("Invalid username or password");
      }

      // 6th attempt should be blocked with 429
      const blockedReq = new Request("http://localhost:5173/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: ALLOWED_ORIGIN,
          "CF-Connecting-IP": "192.168.1.100",
        },
        body: JSON.stringify({ username: "player_a", password: "PlayerA-Secret!" }),
      });

      const blockedRes = await handleAuthRequest(blockedReq, env);
      expect(blockedRes?.status).toBe(429);
      const blockedData = (await blockedRes?.json()) as any;
      expect(blockedData.code).toBe("RATE_LIMITED");
      expect(blockedData.blockedUntil).toBeGreaterThan(Date.now());
    });

    it("increments bounded-window counters atomically when failed logins race", async () => {
      const d1 = env.DB;
      const failures = 17;
      await Promise.all(
        Array.from({ length: failures }, () => recordLoginFailure(d1, "Player_A", "192.0.2.40")),
      );

      const account = await d1
        .prepare("SELECT windowStart, failures, blockedUntil FROM login_limits WHERE key = ?")
        .bind("account:player_a")
        .first<any>();
      const ip = await d1
        .prepare("SELECT windowStart, failures, blockedUntil FROM login_limits WHERE key = ?")
        .bind("ip:192.0.2.40")
        .first<any>();

      expect(account.failures).toBe(failures);
      expect(account.blockedUntil).toBeGreaterThan(Date.now());
      expect(ip.failures).toBe(failures);
      expect(ip.blockedUntil).toBe(0);
      await expect(checkLoginRateLimit(d1, "player_a", "192.0.2.40")).resolves.toMatchObject({
        allowed: false,
        reason: "account",
      });
    });

    it("uses an exact production HTTPS origin and Secure host-only cookies", async () => {
      const productionEnv = {
        ...env,
        ENVIRONMENT: "production",
        ALLOWED_ORIGIN: "https://arcade.example",
      };
      const req = new Request("https://arcade.example/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://arcade.example",
        },
        body: JSON.stringify({ username: "player_a", password: "PlayerA-Secret!" }),
      });
      const res = await handleAuthRequest(req, productionEnv);
      expect(res?.status).toBe(200);
      const cookie = res?.headers.get("Set-Cookie") ?? "";
      expect(cookie).toContain("__Host-arcade-session=");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie).not.toContain("Domain=");

      const wildcardEnv = { ...productionEnv, ALLOWED_ORIGIN: "*" };
      const rejected = await handleAuthRequest(req, wildcardEnv);
      expect(rejected?.status).toBe(403);
      const rejectedData = (await rejected?.json()) as any;
      expect(rejectedData.code).toBe("ORIGIN_MISMATCH");
    });

    it("retrieves active session, verifies CSRF token derivation, and handles unauthenticated state", async () => {
      // 1. Unauthenticated request without cookie
      const unauthReq = new Request("http://localhost:5173/api/v1/auth/session", {
        method: "GET",
      });
      const unauthRes = await handleAuthRequest(unauthReq, env);
      expect(unauthRes?.status).toBe(200);
      const unauthData = (await unauthRes?.json()) as any;
      expect(unauthData.authenticated).toBe(false);

      // 2. Log in
      const loginReq = new Request("http://localhost:5173/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: ALLOWED_ORIGIN,
        },
        body: JSON.stringify({ username: "player_b", password: "PlayerB-Secret!" }),
      });
      const loginRes = await handleAuthRequest(loginReq, env);
      const loginData = (await loginRes?.json()) as any;
      const rawCookie = loginRes?.headers.get("Set-Cookie");
      const match = rawCookie?.match(/arcade-session=([^;]+)/);
      const sessionToken = match ? match[1] : "";

      // 3. Authenticated session request
      const authReq = new Request("http://localhost:5173/api/v1/auth/session", {
        method: "GET",
        headers: {
          Cookie: `arcade-session=${sessionToken}`,
        },
      });
      const authRes = await handleAuthRequest(authReq, env);
      expect(authRes?.status).toBe(200);
      const authData = (await authRes?.json()) as any;
      expect(authData.authenticated).toBe(true);
      expect(authData.profile.id).toBe("B");
      expect(authData.profile.paletteFamily).toBe("romantic");
      expect(authData.profile.accentFamily).toBe("violet");
      expect(authData.csrfToken).toBe(loginData.csrfToken);
    });

    it("validates CSRF on logout and marks session revoked in D1", async () => {
      // Log in
      const loginReq = new Request("http://localhost:5173/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: ALLOWED_ORIGIN,
        },
        body: JSON.stringify({ username: "player_a", password: "PlayerA-Secret!" }),
      });
      const loginRes = await handleAuthRequest(loginReq, env);
      const loginData = (await loginRes?.json()) as any;
      const rawCookie = loginRes?.headers.get("Set-Cookie");
      const match = rawCookie?.match(/arcade-session=([^;]+)/);
      const sessionToken = match ? match[1] : "";

      // Logout without CSRF token -> 403
      const badLogoutReq = new Request("http://localhost:5173/api/v1/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `arcade-session=${sessionToken}`,
          Origin: ALLOWED_ORIGIN,
        },
      });
      const badLogoutRes = await handleAuthRequest(badLogoutReq, env);
      expect(badLogoutRes?.status).toBe(403);
      const badLogoutData = (await badLogoutRes?.json()) as any;
      expect(badLogoutData.code).toBe("CSRF_INVALID");

      // Logout with correct CSRF token -> 200
      const goodLogoutReq = new Request("http://localhost:5173/api/v1/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `arcade-session=${sessionToken}`,
          "x-csrf-token": loginData.csrfToken,
          Origin: ALLOWED_ORIGIN,
        },
      });
      const goodLogoutRes = await handleAuthRequest(goodLogoutReq, env);
      expect(goodLogoutRes?.status).toBe(200);
      const clearCookie = goodLogoutRes?.headers.get("Set-Cookie");
      expect(clearCookie).toContain("Max-Age=0");

      // Verify session was revoked in D1
      const sessionRow = await env.DB.prepare(
        "SELECT * FROM sessions WHERE accountId = 'A'",
      ).first<any>();
      expect(sessionRow.revokedAt).not.toBeNull();

      // Subsequent session check with revoked cookie should return unauthenticated
      const recheckReq = new Request("http://localhost:5173/api/v1/auth/session", {
        method: "GET",
        headers: {
          Cookie: `arcade-session=${sessionToken}`,
        },
      });
      const recheckRes = await handleAuthRequest(recheckReq, env);
      const recheckData = (await recheckRes?.json()) as any;
      expect(recheckData.authenticated).toBe(false);
    });
  });
});
