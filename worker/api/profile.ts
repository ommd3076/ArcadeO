/**
 * Private Arcade V1 — Profile & Preferences API
 *
 * Server-authoritative preferences and account settings:
 * - Versioned palette family updates
 * - Atomic constraint: Players A and B must maintain distinct accent colors
 * - Optimistic concurrency protection with preferenceVersion
 */

import type { Env } from "../index";
import { validateSession, validateCsrfToken, extractSessionToken } from "../auth/session";
import { ErrorCode } from "../../shared/protocol/errors";
import { getCsrfSecret } from "../config";

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

const VALID_PALETTES = new Set(["standard", "romantic"]);
const VALID_ACCENTS = new Set(["teal", "violet", "cyan", "mint", "pink", "yellow"]);

export async function handleProfileRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Session authentication
  const rawToken = extractSessionToken(request);
  if (!rawToken) {
    return jsonResponse({ error: "Unauthorized", code: ErrorCode.AUTH_REQUIRED }, 401);
  }

  const csrfSecret = getCsrfSecret(env);
  const auth = await validateSession(env.DB, rawToken, csrfSecret);
  if (!auth) {
    return jsonResponse({ error: "Unauthorized", code: ErrorCode.AUTH_REQUIRED }, 401);
  }

  const { session, profile } = auth;
  const currentAccountId = session.accountId;
  const opponentAccountId = currentAccountId === "A" ? "B" : "A";

  // GET /api/v1/profile
  if ((path === "/api/v1/profile" || path === "/api/profile") && request.method === "GET") {
    const oppRecord = (await env.DB.prepare(
      "SELECT id, username, displayName, accentFamily, paletteFamily FROM accounts WHERE id = ?",
    )
      .bind(opponentAccountId)
      .first()) as {
      id: string;
      username: string;
      displayName: string;
      accentFamily: string;
      paletteFamily: string;
    } | null;

    return jsonResponse({
      profile,
      opponent: oppRecord
        ? {
            id: oppRecord.id,
            displayName: oppRecord.displayName,
            accentFamily: oppRecord.accentFamily,
            paletteFamily: oppRecord.paletteFamily,
          }
        : null,
    });
  }

  // PATCH /api/v1/profile/preferences
  if (
    (path === "/api/v1/profile/preferences" || path === "/api/profile/preferences") &&
    (request.method === "PATCH" || request.method === "POST")
  ) {
    // CSRF verification
    const csrfToken = request.headers.get("X-Arcade-CSRF") || request.headers.get("X-CSRF-Token");
    const isCsrfValid = await validateCsrfToken(session.csrfHash, csrfToken);
    if (!isCsrfValid) {
      return jsonResponse({ error: "Invalid CSRF token", code: ErrorCode.INVALID_ACTION }, 403);
    }

    let payload: {
      paletteFamily?: string;
      accentFamily?: string;
      displayName?: string;
      expectedPreferenceVersion?: number;
    };

    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return jsonResponse({ error: "Invalid JSON payload", code: ErrorCode.INVALID_ACTION }, 400);
    }

    const { paletteFamily, accentFamily, displayName, expectedPreferenceVersion } = payload;

    if (displayName !== undefined && typeof displayName !== "string") {
      return jsonResponse({ error: "Name must be text", code: ErrorCode.INVALID_ACTION }, 400);
    }
    const normalizedName = displayName?.trim();
    if (
      displayName !== undefined &&
      (!normalizedName || normalizedName.length > 32 || /[<>\u0000-\u001f]/.test(normalizedName))
    ) {
      return jsonResponse(
        { error: "Name must be 1–32 readable characters", code: ErrorCode.INVALID_ACTION },
        400,
      );
    }

    if (paletteFamily !== undefined && !VALID_PALETTES.has(paletteFamily)) {
      return jsonResponse({ error: "Invalid palette family", code: ErrorCode.INVALID_ACTION }, 400);
    }

    if (accentFamily !== undefined && !VALID_ACCENTS.has(accentFamily)) {
      return jsonResponse({ error: "Invalid accent family", code: ErrorCode.INVALID_ACTION }, 400);
    }

    if (!Number.isSafeInteger(expectedPreferenceVersion) || (expectedPreferenceVersion ?? 0) < 1) {
      return jsonResponse(
        { error: "expectedPreferenceVersion is required", code: ErrorCode.INVALID_ACTION },
        400,
      );
    }

    // Atomic fetch current account and opponent account
    const currentAccount = (await env.DB.prepare(
      "SELECT id, displayName, paletteFamily, accentFamily, preferenceVersion FROM accounts WHERE id = ?",
    )
      .bind(currentAccountId)
      .first()) as {
      id: string;
      displayName: string;
      paletteFamily: string;
      accentFamily: string;
      preferenceVersion: number;
    } | null;

    if (!currentAccount) {
      return jsonResponse({ error: "Account not found", code: ErrorCode.NOT_FOUND }, 404);
    }

    // Check version concurrency
    if (currentAccount.preferenceVersion !== expectedPreferenceVersion) {
      return jsonResponse(
        {
          error: "Preference version conflict. Please refresh.",
          code: ErrorCode.STALE_STATE,
          currentVersion: currentAccount.preferenceVersion,
        },
        409,
      );
    }

    const oppAccount = (await env.DB.prepare("SELECT id, accentFamily FROM accounts WHERE id = ?")
      .bind(opponentAccountId)
      .first()) as { id: string; accentFamily: string } | null;

    // Distinct accent constraint: Player A and Player B cannot share identical accent
    const targetAccent = accentFamily ?? currentAccount.accentFamily;
    if (oppAccount && oppAccount.accentFamily === targetAccent) {
      return jsonResponse(
        {
          error: `Accent '${targetAccent}' is already chosen by opponent. Both players must have distinct accents.`,
          code: ErrorCode.INVALID_ACTION,
        },
        409,
      );
    }

    const targetPalette = paletteFamily ?? currentAccount.paletteFamily;
    const targetName = normalizedName ?? currentAccount.displayName;
    const newVersion = currentAccount.preferenceVersion + 1;

    // Update in D1
    const updateResult = await env.DB.prepare(
      "UPDATE accounts SET displayName = ?, paletteFamily = ?, accentFamily = ?, preferenceVersion = ? WHERE id = ? AND preferenceVersion = ? AND NOT EXISTS (SELECT 1 FROM accounts other WHERE other.id <> accounts.id AND other.accentFamily = ?)",
    )
      .bind(
        targetName,
        targetPalette,
        targetAccent,
        newVersion,
        currentAccountId,
        expectedPreferenceVersion,
        targetAccent,
      )
      .run();

    if (!updateResult.success) {
      return jsonResponse(
        { error: "Failed to update preferences", code: ErrorCode.INVALID_ACTION },
        500,
      );
    }

    if (updateResult.meta.changes !== 1) {
      return jsonResponse(
        { error: "Preferences changed. Please refresh.", code: ErrorCode.STALE_STATE },
        409,
      );
    }

    return jsonResponse({
      id: currentAccountId,
      displayName: targetName,
      paletteFamily: targetPalette,
      accentFamily: targetAccent,
      preferenceVersion: newVersion,
    });
  }

  return null;
}
