import { handleAuthRequest } from "./api/auth";
import { handleMatchesRequest } from "./api/matches";
import { handleCatalogRequest } from "./api/catalog";
import { handleChallengesRequest } from "./api/challenges";
import { handleProfileRequest } from "./api/profile";
import { handleRecordsRequest } from "./api/records";
import { handleLibraryRequest } from "./api/library";
import { getCsrfSecret, isAllowedOrigin } from "./config";
import { extractSessionToken, validateSession } from "./auth/session";

export interface Env {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;
  CSRF_SECRET?: string;
  SESSION_SECRET?: string;
  ASSETS?: Fetcher;
}

export { MatchDurableObject } from "./matches/match-do";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const response = await routeRequest(request, env);
      if (response.status === 101) return response;
      if (new URL(request.url).pathname.startsWith("/api/")) {
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("X-Content-Type-Options", "nosniff");
      }
      return response;
    } catch {
      return Response.json(
        { error: "Service temporarily unavailable", code: "UNAVAILABLE" },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  },
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Health check
  if (url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
    return new Response(JSON.stringify({ status: "healthy", timestamp: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!url.pathname.startsWith("/api/")) {
    return env.ASSETS
      ? env.ASSETS.fetch(request)
      : new Response("Build the public assets first", { status: 503 });
  }
  getCsrfSecret(env);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !isAllowedOrigin(request, env)) {
    return Response.json({ error: "Origin mismatch", code: "ORIGIN_MISMATCH" }, { status: 403 });
  }

  // Catalog & Games endpoints
  if (
    url.pathname.startsWith("/api/v1/games") ||
    url.pathname.startsWith("/api/games") ||
    url.pathname.startsWith("/api/v1/sudoku/catalog") ||
    url.pathname.startsWith("/api/sudoku/catalog")
  ) {
    const token = extractSessionToken(request);
    if (!token || !(await validateSession(env.DB, token, getCsrfSecret(env)))) {
      return Response.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    const catalogRes = await handleCatalogRequest(request);
    if (catalogRes) return catalogRes;
  }

  // Auth endpoints
  if (url.pathname.startsWith("/api/v1/auth/") || url.pathname.startsWith("/api/auth/")) {
    const authRes = await handleAuthRequest(request, env);
    if (authRes) return authRes;
  }

  // Challenges endpoints
  if (url.pathname.startsWith("/api/v1/challenges") || url.pathname.startsWith("/api/challenges")) {
    const challengeRes = await handleChallengesRequest(request, env);
    if (challengeRes) return challengeRes;
  }

  // Matches endpoints
  if (url.pathname.startsWith("/api/v1/matches") || url.pathname.startsWith("/api/matches")) {
    const matchRes = await handleMatchesRequest(request, env);
    if (matchRes) return matchRes;
  }

  // Profile & Preferences endpoints
  if (url.pathname.startsWith("/api/v1/library") || url.pathname.startsWith("/api/library")) {
    const libraryRes = await handleLibraryRequest(request, env);
    if (libraryRes) return libraryRes;
  }

  // Profile & Preferences endpoints
  if (url.pathname.startsWith("/api/v1/profile") || url.pathname.startsWith("/api/profile")) {
    const profileRes = await handleProfileRequest(request, env);
    if (profileRes) return profileRes;
  }

  // Records & Statistics endpoints
  if (url.pathname.startsWith("/api/v1/records") || url.pathname.startsWith("/api/records")) {
    const recordsRes = await handleRecordsRequest(request, env);
    if (recordsRes) return recordsRes;
  }

  return Response.json({ error: "Not Found", code: "NOT_FOUND" }, { status: 404 });
}
