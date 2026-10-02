import type { AccountRecord, SafeProfile } from "../auth/types";
import { verifyPassword } from "../auth/kdf";
import {
  createClearSessionCookieHeaders,
  createSession,
  createSessionCookieHeaders,
  extractSessionToken,
  validateCsrfToken,
  validateSession,
  revokeSession,
} from "../auth/session";
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "../auth/rate-limit";
import { getCsrfSecret, isAllowedOrigin } from "../config";

export interface AuthEnv {
  DB: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  CSRF_SECRET?: string;
}

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");

  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

function checkOrigin(request: Request, allowedOrigin?: string): boolean {
  return isAllowedOrigin(request, { ALLOWED_ORIGIN: allowedOrigin });
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp;
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return "127.0.0.1";
}

/**
 * Main router for worker auth API endpoints.
 * Handles:
 *   POST /api/v1/auth/login
 *   GET  /api/v1/auth/session
 *   POST /api/v1/auth/logout
 */
export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  let subpath = "";
  if (path.startsWith("/api/v1/auth/")) {
    subpath = path.slice("/api/v1/auth/".length);
  } else if (path.startsWith("/api/auth/")) {
    subpath = path.slice("/api/auth/".length);
  } else {
    return null;
  }

  const csrfSecret = getCsrfSecret(env);
  const isSecure = url.protocol === "https:" || env.ENVIRONMENT === "production";

  // POST /login
  if (subpath === "login" && request.method === "POST") {
    if (!checkOrigin(request, env.ALLOWED_ORIGIN)) {
      return jsonResponse({ error: "Forbidden: origin mismatch", code: "ORIGIN_MISMATCH" }, 403);
    }

    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON request body", code: "BAD_REQUEST" }, 400);
    }

    const { username, password } = body;
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return jsonResponse(
        { error: "Username and password are required", code: "BAD_REQUEST" },
        400,
      );
    }

    const ip = getClientIp(request);
    const normalizedUsername = username.trim().toLowerCase();

    // Check rate limits
    const limitCheck = await checkLoginRateLimit(env.DB, normalizedUsername, ip);
    if (!limitCheck.allowed) {
      return jsonResponse(
        {
          error: "Too many login attempts. Please try again later.",
          code: "RATE_LIMITED",
          blockedUntil: limitCheck.blockedUntil,
        },
        429,
      );
    }

    // Lookup account
    const account = await env.DB.prepare(
      `SELECT id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion
         FROM accounts
         WHERE username = ?`,
    )
      .bind(normalizedUsername)
      .first<AccountRecord>();

    if (!account) {
      // Dummy constant-time work to prevent timing side-channels
      await verifyPassword("dummy-password", "0".repeat(64), "0".repeat(32), 600_000);
      await recordLoginFailure(env.DB, normalizedUsername, ip);
      return jsonResponse(
        { error: "Invalid username or password", code: "INVALID_CREDENTIALS" },
        401,
      );
    }

    const algorithm = /^PBKDF2-SHA256:(\d+)$/.exec(account.kdfAlgorithm);
    const iterations = algorithm ? Number(algorithm[1]) : 0;
    const isValidPassword =
      iterations >= 600_000 &&
      iterations <= 2_000_000 &&
      (await verifyPassword(password, account.passwordHash, account.salt, iterations));
    if (!isValidPassword) {
      await recordLoginFailure(env.DB, normalizedUsername, ip);
      return jsonResponse(
        { error: "Invalid username or password", code: "INVALID_CREDENTIALS" },
        401,
      );
    }

    // Reset rate limits on success
    await recordLoginSuccess(env.DB, normalizedUsername);

    // Create session
    const session = await createSession(env.DB, account.id, csrfSecret);

    const safeProfile: SafeProfile = {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      accentFamily: account.accentFamily,
      paletteFamily: account.paletteFamily,
      preferenceVersion: account.preferenceVersion,
    };

    const headers = new Headers();
    const cookieHeaders = createSessionCookieHeaders(session.rawToken, isSecure);
    for (const cookie of cookieHeaders) {
      headers.append("Set-Cookie", cookie);
    }

    return jsonResponse(
      {
        success: true,
        profile: safeProfile,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
      },
      200,
      headers,
    );
  }

  // GET /session
  if (subpath === "session" && request.method === "GET") {
    const rawToken = extractSessionToken(request);
    if (!rawToken) {
      return jsonResponse({ authenticated: false }, 200);
    }

    const validation = await validateSession(env.DB, rawToken, csrfSecret);
    if (!validation) {
      const headers = new Headers();
      for (const cookie of createClearSessionCookieHeaders(isSecure)) {
        headers.append("Set-Cookie", cookie);
      }
      return jsonResponse({ authenticated: false }, 200, headers);
    }

    return jsonResponse(
      {
        authenticated: true,
        profile: validation.profile,
        csrfToken: validation.csrfToken,
        expiresAt: validation.session.expiresAt,
      },
      200,
    );
  }

  // POST /logout
  if (subpath === "logout" && request.method === "POST") {
    if (!checkOrigin(request, env.ALLOWED_ORIGIN)) {
      return jsonResponse({ error: "Forbidden: origin mismatch", code: "ORIGIN_MISMATCH" }, 403);
    }

    const rawToken = extractSessionToken(request);
    const headers = new Headers();
    for (const cookie of createClearSessionCookieHeaders(isSecure)) {
      headers.append("Set-Cookie", cookie);
    }

    if (!rawToken) {
      return jsonResponse({ success: true }, 200, headers);
    }

    const validation = await validateSession(env.DB, rawToken, csrfSecret);
    if (!validation) {
      return jsonResponse({ success: true }, 200, headers);
    }

    const providedCsrf = request.headers.get("x-csrf-token") || request.headers.get("X-CSRF-Token");
    const isCsrfValid = await validateCsrfToken(validation.session.csrfHash, providedCsrf);
    if (!isCsrfValid) {
      return jsonResponse({ error: "Invalid CSRF token", code: "CSRF_INVALID" }, 403);
    }

    await revokeSession(env.DB, rawToken);

    return jsonResponse({ success: true }, 200, headers);
  }

  return jsonResponse({ error: "Not Found", code: "NOT_FOUND" }, 404);
}
