import { handleAuthRequest } from "./api/auth";
import { handleMatchesRequest } from "./api/matches";
import { handleCatalogRequest } from "./api/catalog";
import { handleChallengesRequest } from "./api/challenges";
import { handleProfileRequest } from "./api/profile";
import { handleRecordsRequest } from "./api/records";
import { handleLibraryRequest } from "./api/library";
import { assertOriginConfiguration, getCsrfSecret, isAllowedOrigin } from "./config";
import { extractSessionToken, validateSession } from "./auth/session";

export interface Env {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  AUTH_KDF_DO?: DurableObjectNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;
  CSRF_SECRET?: string;
  SESSION_SECRET?: string;
  ASSETS?: Fetcher;
}

export { MatchDurableObject } from "./matches/match-do";
export { AuthKdfDurableObject } from "./auth/kdf-do";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    let response: Response;
    try {
      response = await routeRequest(request, env);
    } catch {
      response = isApiRequest(request)
        ? jsonError("The service is temporarily unavailable. Retry shortly.", "UNAVAILABLE", 503)
        : new Response("The arcade could not load this page. Retry your connection.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
    }

    if (response.status === 101) return response;
    if (isApiRequest(request)) {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      if (!response.headers.has("Content-Type")) {
        response.headers.set("Content-Type", "application/json; charset=utf-8");
      }
    }
    return response;
  },
};

function isApiRequest(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  return pathname === "/api" || pathname.startsWith("/api/");
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
}

function isDocumentRequest(request: Request): boolean {
  return request.method === "GET" && request.headers.get("Accept")?.includes("text/html") === true;
}

function isKnownAppRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/games" ||
    pathname.startsWith("/games/") ||
    pathname.startsWith("/matches/") ||
    pathname === "/sudoku" ||
    pathname === "/us" ||
    pathname.startsWith("/us/")
  );
}

function looksLikeMissingAsset(pathname: string): boolean {
  const finalSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return pathname.startsWith("/assets/") || /\.[a-z0-9]{1,12}$/i.test(finalSegment);
}

async function fetchPublicAsset(request: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) {
    return new Response("Build the public assets first", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return env.ASSETS.fetch(request);
}

async function fetchAppShell(request: Request, env: Env, status = 200): Promise<Response> {
  if (!env.ASSETS) {
    return new Response("Build the public assets first", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  // Ask the static binding for `/`, whose directory index it resolves itself.
  // `/index.html` is redirected to `/` by Wrangler's assets binding and would
  // recurse through this Worker when `run_worker_first` is enabled.
  const shellUrl = new URL("/", request.url);
  const shellRequest = new Request(shellUrl, request);
  const shell = await env.ASSETS.fetch(shellRequest);
  if (!shell.ok) return shell;
  return new Response(shell.body, {
    status,
    statusText: status === 404 ? "Not Found" : shell.statusText,
    headers: shell.headers,
  });
}

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Health is useful before secrets/bindings are configured and reveals no auth state.
  if (url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
    return Response.json(
      { status: "healthy", timestamp: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isApiRequest(request)) {
    if (isKnownAppRoute(url.pathname) && isDocumentRequest(request)) {
      return fetchAppShell(request, env);
    }
    // Let the browser router render its authored not-found/recovery page while
    // preserving the HTTP 404 for an unknown document path.
    if (isDocumentRequest(request) && !looksLikeMissingAsset(url.pathname)) {
      return fetchAppShell(request, env, 404);
    }
    return fetchPublicAsset(request, env);
  }

  try {
    assertOriginConfiguration(env);
  } catch {
    return jsonError("The service origin is not configured safely.", "CONFIGURATION_ERROR", 503);
  }
  const csrfSecret = getCsrfSecret(env);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !isAllowedOrigin(request, env)) {
    return jsonError("This request origin is not allowed.", "ORIGIN_MISMATCH", 403);
  }

  if (
    url.pathname.startsWith("/api/v1/games") ||
    url.pathname.startsWith("/api/games") ||
    url.pathname.startsWith("/api/v1/sudoku/catalog") ||
    url.pathname.startsWith("/api/sudoku/catalog")
  ) {
    const token = extractSessionToken(request);
    if (!token || !(await validateSession(env.DB, token, csrfSecret))) {
      return jsonError("Sign in to continue.", "AUTH_REQUIRED", 401);
    }
    const catalogRes = await handleCatalogRequest(request);
    if (catalogRes) return catalogRes;
  }

  if (url.pathname.startsWith("/api/v1/auth/") || url.pathname.startsWith("/api/auth/")) {
    const authRes = await handleAuthRequest(request, env);
    if (authRes) return authRes;
  }

  if (url.pathname.startsWith("/api/v1/challenges") || url.pathname.startsWith("/api/challenges")) {
    const challengeRes = await handleChallengesRequest(request, env);
    if (challengeRes) return challengeRes;
  }

  if (url.pathname.startsWith("/api/v1/matches") || url.pathname.startsWith("/api/matches")) {
    const matchRes = await handleMatchesRequest(request, env);
    if (matchRes) return matchRes;
  }

  if (url.pathname.startsWith("/api/v1/library") || url.pathname.startsWith("/api/library")) {
    const libraryRes = await handleLibraryRequest(request, env);
    if (libraryRes) return libraryRes;
  }

  if (url.pathname.startsWith("/api/v1/profile") || url.pathname.startsWith("/api/profile")) {
    const profileRes = await handleProfileRequest(request, env);
    if (profileRes) return profileRes;
  }

  if (url.pathname.startsWith("/api/v1/records") || url.pathname.startsWith("/api/records")) {
    const recordsRes = await handleRecordsRequest(request, env);
    if (recordsRes) return recordsRes;
  }

  return jsonError("That API route was not found.", "NOT_FOUND", 404);
}
