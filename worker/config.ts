export function getCsrfSecret(env: { CSRF_SECRET?: string }): string {
  if (!env.CSRF_SECRET || env.CSRF_SECRET.length < 32) {
    throw new Error("CSRF_SECRET must be explicitly configured with at least 32 characters");
  }
  return env.CSRF_SECRET;
}

export function isAllowedOrigin(request: Request, env: { ALLOWED_ORIGIN?: string }): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  if (env.ALLOWED_ORIGIN === "*") return true;
  return origin === (env.ALLOWED_ORIGIN || new URL(request.url).origin);
}
