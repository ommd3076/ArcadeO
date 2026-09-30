import { handleAuthRequest } from "./api/auth";
import { handleMatchesRequest } from "./api/matches";

export interface Env {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;
  CSRF_SECRET?: string;
  SESSION_SECRET?: string;
}

export { MatchDurableObject } from "./matches/match-do";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
      return new Response(JSON.stringify({ status: "healthy", timestamp: Date.now() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auth endpoints
    if (url.pathname.startsWith("/api/v1/auth/") || url.pathname.startsWith("/api/auth/")) {
      const authRes = await handleAuthRequest(request, env);
      if (authRes) return authRes;
    }

    // Matches endpoints
    if (url.pathname.startsWith("/api/v1/matches") || url.pathname.startsWith("/api/matches")) {
      const matchRes = await handleMatchesRequest(request, env);
      if (matchRes) return matchRes;
    }

    return new Response("Not Found", { status: 404 });
  },
};
