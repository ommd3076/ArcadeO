import type { LoginLimitsRecord } from "./types";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const ACCOUNT_MAX_FAILURES = 5;
export const IP_MAX_FAILURES = 20;

export interface RateLimitCheckResult {
  allowed: boolean;
  blockedUntil?: number;
  reason?: "account" | "ip";
}

export function formatAccountKey(username: string): string {
  return `account:${username.trim().toLowerCase()}`;
}

export function formatIpKey(ip: string): string {
  return `ip:${ip.trim()}`;
}

/** Prunes expired login limits rows. */
export async function pruneExpiredLimits(db: D1Database): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `DELETE FROM login_limits
       WHERE blockedUntil <= ? AND (windowStart + ?) <= ?`,
    )
    .bind(now, RATE_LIMIT_WINDOW_MS, now)
    .run();
}

/** Checks whether an account or IP is currently rate-limited. */
export async function checkLoginRateLimit(
  db: D1Database,
  username: string,
  ip: string,
): Promise<RateLimitCheckResult> {
  const accountKey = formatAccountKey(username);
  const ipKey = formatIpKey(ip);
  const now = Date.now();

  // Pruning is maintenance only. An auth-store outage during a required read
  // remains an error; a failed cleanup must not make valid login checks fail.
  try {
    await pruneExpiredLimits(db);
  } catch {
    // A later request can retry this bounded cleanup.
  }

  const accountLimit = await db
    .prepare(`SELECT key, windowStart, failures, blockedUntil FROM login_limits WHERE key = ?`)
    .bind(accountKey)
    .first<LoginLimitsRecord>();

  if (accountLimit && accountLimit.blockedUntil > now) {
    return { allowed: false, blockedUntil: accountLimit.blockedUntil, reason: "account" };
  }

  const ipLimit = await db
    .prepare(`SELECT key, windowStart, failures, blockedUntil FROM login_limits WHERE key = ?`)
    .bind(ipKey)
    .first<LoginLimitsRecord>();

  if (ipLimit && ipLimit.blockedUntil > now) {
    return { allowed: false, blockedUntil: ipLimit.blockedUntil, reason: "ip" };
  }

  return { allowed: true };
}

/**
 * One SQL upsert is the serialization point for each key. In particular, a
 * read/modify/write pair loses increments when several wrong passwords race.
 */
function failureUpsert(db: D1Database, key: string, maxFailures: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO login_limits (key, windowStart, failures, blockedUntil)
       VALUES (?, ?, 1, 0)
       ON CONFLICT(key) DO UPDATE SET
         windowStart = CASE
           WHEN excluded.windowStart - login_limits.windowStart >= ?
             THEN excluded.windowStart
           ELSE login_limits.windowStart
         END,
         failures = CASE
           WHEN excluded.windowStart - login_limits.windowStart >= ?
             THEN 1
           ELSE login_limits.failures + 1
         END,
         blockedUntil = CASE
           WHEN (CASE
             WHEN excluded.windowStart - login_limits.windowStart >= ? THEN 1
             ELSE login_limits.failures + 1
           END) >= ?
             THEN excluded.windowStart + ?
           ELSE 0
         END`,
    )
    .bind(
      key,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_WINDOW_MS,
      maxFailures,
      RATE_LIMIT_WINDOW_MS,
    );
}

/** Atomically increments the normalized account and IP counters in single upserts. */
export async function recordLoginFailure(
  db: D1Database,
  username: string,
  ip: string,
): Promise<void> {
  await Promise.all([
    failureUpsert(db, formatAccountKey(username), ACCOUNT_MAX_FAILURES).run(),
    failureUpsert(db, formatIpKey(ip), IP_MAX_FAILURES).run(),
  ]);
}

/** Resets account-level failure counter on successful login. */
export async function recordLoginSuccess(db: D1Database, username: string): Promise<void> {
  const accountKey = formatAccountKey(username);
  await db.prepare(`DELETE FROM login_limits WHERE key = ?`).bind(accountKey).run();
}
