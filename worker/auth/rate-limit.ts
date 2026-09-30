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

/**
 * Prunes expired login limits rows.
 */
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

/**
 * Checks whether an account or IP is currently rate-limited.
 */
export async function checkLoginRateLimit(
  db: D1Database,
  username: string,
  ip: string,
): Promise<RateLimitCheckResult> {
  const accountKey = formatAccountKey(username);
  const ipKey = formatIpKey(ip);
  const now = Date.now();

  // Maintenance prune (best effort, fire and forget or await)
  try {
    await pruneExpiredLimits(db);
  } catch {
    // Non-blocking maintenance failure
  }

  const accountLimit = await db
    .prepare(`SELECT key, windowStart, failures, blockedUntil FROM login_limits WHERE key = ?`)
    .bind(accountKey)
    .first<LoginLimitsRecord>();

  if (accountLimit && accountLimit.blockedUntil > now) {
    return {
      allowed: false,
      blockedUntil: accountLimit.blockedUntil,
      reason: "account",
    };
  }

  const ipLimit = await db
    .prepare(`SELECT key, windowStart, failures, blockedUntil FROM login_limits WHERE key = ?`)
    .bind(ipKey)
    .first<LoginLimitsRecord>();

  if (ipLimit && ipLimit.blockedUntil > now) {
    return {
      allowed: false,
      blockedUntil: ipLimit.blockedUntil,
      reason: "ip",
    };
  }

  return { allowed: true };
}

async function recordFailureForKey(
  db: D1Database,
  key: string,
  maxFailures: number,
): Promise<void> {
  const now = Date.now();
  const existing = await db
    .prepare(`SELECT key, windowStart, failures, blockedUntil FROM login_limits WHERE key = ?`)
    .bind(key)
    .first<LoginLimitsRecord>();

  let windowStart = now;
  let failures = 1;

  if (existing) {
    if (now - existing.windowStart <= RATE_LIMIT_WINDOW_MS) {
      windowStart = existing.windowStart;
      failures = existing.failures + 1;
    }
  }

  const blockedUntil = failures >= maxFailures ? now + RATE_LIMIT_WINDOW_MS : 0;

  await db
    .prepare(
      `INSERT INTO login_limits (key, windowStart, failures, blockedUntil)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         windowStart = excluded.windowStart,
         failures = excluded.failures,
         blockedUntil = excluded.blockedUntil`,
    )
    .bind(key, windowStart, failures, blockedUntil)
    .run();
}

/**
 * Records a login failure for both the specified username and IP address.
 */
export async function recordLoginFailure(
  db: D1Database,
  username: string,
  ip: string,
): Promise<void> {
  const accountKey = formatAccountKey(username);
  const ipKey = formatIpKey(ip);

  await recordFailureForKey(db, accountKey, ACCOUNT_MAX_FAILURES);
  await recordFailureForKey(db, ipKey, IP_MAX_FAILURES);
}

/**
 * Resets account-level failure counter on successful login.
 */
export async function recordLoginSuccess(db: D1Database, username: string): Promise<void> {
  const accountKey = formatAccountKey(username);
  await db.prepare(`DELETE FROM login_limits WHERE key = ?`).bind(accountKey).run();
}
