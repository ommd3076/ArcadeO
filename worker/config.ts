export function getCsrfSecret(env: { CSRF_SECRET?: string }): string {
  if (!env.CSRF_SECRET || env.CSRF_SECRET.length < 32) {
    throw new Error("CSRF_SECRET must be explicitly configured with at least 32 characters");
  }
  return env.CSRF_SECRET;
}

export interface OriginConfig {
  ALLOWED_ORIGIN?: string;
  ENVIRONMENT?: string;
}

/**
 * Production must be pinned to one explicit HTTPS origin. A wildcard or an
 * inferred request origin is convenient locally but unsafe as a deploy config.
 */
export function assertOriginConfiguration(env: OriginConfig): void {
  if (env.ENVIRONMENT !== "production") return;
  const configured = env.ALLOWED_ORIGIN;
  if (!configured || configured === "*") {
    throw new Error("ALLOWED_ORIGIN must be one exact HTTPS origin in production");
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("ALLOWED_ORIGIN must be one exact HTTPS origin in production");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== configured ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error("ALLOWED_ORIGIN must be one exact HTTPS origin in production");
  }
}

export function isAllowedOrigin(request: Request, env: OriginConfig): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  if (env.ENVIRONMENT === "production") {
    try {
      assertOriginConfiguration(env);
    } catch {
      return false;
    }
  }
  if (env.ALLOWED_ORIGIN === "*") return env.ENVIRONMENT !== "production";
  return (
    origin ===
    (env.ALLOWED_ORIGIN || (env.ENVIRONMENT === "production" ? "" : new URL(request.url).origin))
  );
}
