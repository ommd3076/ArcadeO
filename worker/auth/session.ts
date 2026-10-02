import { hmacSha256Hex, randomHex, sha256Hex, timingSafeEqual } from "./crypto";
import type { AccountId, SafeProfile, SessionRecord } from "./types";

export const SESSION_COOKIE_NAME = "arcade-session";
export const HOST_SESSION_COOKIE_NAME = "__Host-arcade-session";
export const CSRF_PURPOSE_TAG = "arcade-csrf-v1";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

export interface SessionValidationResult {
  session: SessionRecord;
  profile: SafeProfile;
  csrfToken: string;
}

/**
 * Generates an opaque cryptographically secure 256-bit token (64 hex chars).
 */
export function generateSessionToken(): string {
  return randomHex(32);
}

/**
 * Derives a CSRF token from the session token and CSRF secret using HMAC-SHA-256.
 */
export async function deriveCsrfToken(
  rawSessionToken: string,
  csrfSecret: string,
): Promise<string> {
  return hmacSha256Hex(csrfSecret, `${CSRF_PURPOSE_TAG}:${rawSessionToken}`);
}

/**
 * Validates a user-provided CSRF token against the session csrfHash.
 */
export async function validateCsrfToken(
  sessionCsrfHash: string,
  providedCsrfToken: string | null | undefined,
): Promise<boolean> {
  if (!providedCsrfToken || typeof providedCsrfToken !== "string") {
    return false;
  }
  const providedHash = await sha256Hex(providedCsrfToken);
  return timingSafeEqual(providedHash, sessionCsrfHash);
}

/**
 * Parses cookies from a Cookie header string.
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        // A malformed cookie must not turn an unauthenticated request into a 500.
      }
    }
  }
  return cookies;
}

/**
 * Extracts the raw session token from request cookies.
 */
export function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies[HOST_SESSION_COOKIE_NAME] || cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Builds Set-Cookie headers for logging in.
 */
export function createSessionCookieHeaders(token: string, isSecure = false): string[] {
  const directives = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${SESSION_DURATION_SECONDS}`];
  if (isSecure) {
    directives.push("Secure");
  }

  const standardCookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${directives.join("; ")}`;
  if (isSecure) {
    const hostCookie = `${HOST_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${directives.join("; ")}`;
    return [hostCookie, standardCookie];
  }
  return [standardCookie];
}

/**
 * Builds Set-Cookie headers for logging out / revoking.
 */
export function createClearSessionCookieHeaders(isSecure = false): string[] {
  const directives = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];
  if (isSecure) {
    directives.push("Secure");
  }

  const standardClear = `${SESSION_COOKIE_NAME}=; ${directives.join("; ")}`;
  const hostClear = `${HOST_SESSION_COOKIE_NAME}=; ${directives.join("; ")}`;
  return [standardClear, hostClear];
}

/**
 * Creates and persists a new session in D1.
 */
export async function createSession(
  db: D1Database,
  accountId: AccountId,
  csrfSecret: string,
): Promise<{ rawToken: string; csrfToken: string; expiresAt: number; sessionId: string }> {
  const rawToken = generateSessionToken();
  const tokenHash = await sha256Hex(rawToken);
  const csrfToken = await deriveCsrfToken(rawToken, csrfSecret);
  const csrfHash = await sha256Hex(csrfToken);
  const sessionId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_DURATION_MS;

  await db
    .prepare(
      `INSERT INTO sessions (tokenHash, accountId, csrfHash, issuedAt, expiresAt, revokedAt, sessionId)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(tokenHash, accountId, csrfHash, issuedAt, expiresAt, sessionId)
    .run();

  return { rawToken, csrfToken, expiresAt, sessionId };
}

/**
 * Validates a session against D1 primary state.
 */
export async function validateSession(
  db: D1Database,
  rawToken: string,
  csrfSecret: string,
): Promise<SessionValidationResult | null> {
  const tokenHash = await sha256Hex(rawToken);

  interface JoinedSessionRow {
    tokenHash: string;
    accountId: string;
    csrfHash: string;
    issuedAt: number;
    expiresAt: number;
    revokedAt: number | null;
    sessionId: string;
    id: string;
    username: string;
    displayName: string;
    accentFamily: string;
    paletteFamily: string;
    preferenceVersion: number;
  }

  const primary = typeof db.withSession === "function" ? db.withSession("first-primary") : db;
  const row = await primary
    .prepare(
      `SELECT
         s.tokenHash, s.accountId, s.csrfHash, s.issuedAt, s.expiresAt, s.revokedAt, s.sessionId,
         a.id, a.username, a.displayName, a.accentFamily, a.paletteFamily, a.preferenceVersion
       FROM sessions s
       JOIN accounts a ON s.accountId = a.id
       WHERE s.tokenHash = ?`,
    )
    .bind(tokenHash)
    .first<JoinedSessionRow>();

  if (!row) return null;
  if (row.revokedAt !== null && row.revokedAt !== undefined) return null;
  if (row.expiresAt <= Date.now()) return null;

  const derivedCsrf = await deriveCsrfToken(rawToken, csrfSecret);
  const derivedCsrfHash = await sha256Hex(derivedCsrf);

  if (!timingSafeEqual(derivedCsrfHash, row.csrfHash)) {
    return null;
  }

  return {
    session: {
      tokenHash: row.tokenHash,
      accountId: row.accountId as AccountId,
      csrfHash: row.csrfHash,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      sessionId: row.sessionId,
    },
    profile: {
      id: row.id as AccountId,
      username: row.username,
      displayName: row.displayName,
      accentFamily: row.accentFamily,
      paletteFamily: row.paletteFamily,
      preferenceVersion: row.preferenceVersion,
    },
    csrfToken: derivedCsrf,
  };
}

/**
 * Revokes an active session by token hash in D1.
 */
export async function revokeSession(db: D1Database, rawToken: string): Promise<boolean> {
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();

  const result = await db
    .prepare(
      `UPDATE sessions
       SET revokedAt = ?
       WHERE tokenHash = ? AND revokedAt IS NULL`,
    )
    .bind(now, tokenHash)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
