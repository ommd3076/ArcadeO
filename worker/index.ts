import { handleAuthRequest } from "./api/auth";

export interface Env {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;
  CSRF_SECRET?: string;
  SESSION_SECRET?: string;
}

export class MatchDurableObject implements DurableObject {
  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

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
    if (url.pathname.startsWith("/api/v1/auth/")) {
      const authRes = await handleAuthRequest(request, env);
      if (authRes) return authRes;
    }

    return new Response("Not Found", { status: 404 });
  },
};
