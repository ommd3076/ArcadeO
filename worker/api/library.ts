import type { Env } from "../index";
import type { GameId } from "../../shared/protocol/types";
import { extractSessionToken, validateCsrfToken, validateSession } from "../auth/session";
import { getCsrfSecret } from "../config";
import { ErrorCode } from "../../shared/protocol/errors";

const GAME_IDS = new Set<GameId>([
  "connect-four",
  "rock-paper-scissors",
  "ludo",
  "snakes-and-ladders",
  "dots-boxes",
  "sos",
  "hand-cricket",
  "sudoku",
]);

interface LibraryRow {
  gameIds: string;
  version: number;
}

function reply(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function decode(row: LibraryRow): { gameIds: GameId[]; version: number } {
  return { gameIds: JSON.parse(row.gameIds) as GameId[], version: row.version };
}

function validList(value: unknown): value is GameId[] {
  return (
    Array.isArray(value) &&
    value.length <= 8 &&
    value.every((id) => typeof id === "string" && GAME_IDS.has(id as GameId)) &&
    new Set(value).size === value.length
  );
}

export async function handleLibraryRequest(request: Request, env: Env): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/^\/api(?:\/v1)?/, "");
  if (!["/library", "/library/favourites", "/library/play-next"].includes(path)) return null;

  const token = extractSessionToken(request);
  const auth = token && (await validateSession(env.DB, token, getCsrfSecret(env)));
  if (!auth) return reply({ error: "Unauthorized", code: ErrorCode.AUTH_REQUIRED }, 401);
  const accountId = auth.session.accountId;

  if (path === "/library" && request.method === "GET") {
    const [favourites, playNext] = await Promise.all([
      env.DB.prepare("SELECT gameIds, version FROM account_favourites WHERE accountId = ?")
        .bind(accountId)
        .first<LibraryRow>(),
      env.DB.prepare(
        "SELECT gameIds, version FROM shared_play_next WHERE id = 1",
      ).first<LibraryRow>(),
    ]);
    return reply({
      favourites: favourites ? decode(favourites) : { gameIds: [], version: 1 },
      playNext: playNext ? decode(playNext) : { gameIds: [], version: 1 },
    });
  }

  if (
    (path === "/library/favourites" || path === "/library/play-next") &&
    request.method === "PUT"
  ) {
    const csrf = request.headers.get("X-Arcade-CSRF") || request.headers.get("X-CSRF-Token");
    if (!(await validateCsrfToken(auth.session.csrfHash, csrf))) {
      return reply({ error: "Invalid CSRF token", code: ErrorCode.INVALID_ACTION }, 403);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "Invalid JSON", code: ErrorCode.INVALID_ACTION }, 400);
    }
    if (!body || typeof body !== "object")
      return reply({ error: "Invalid payload", code: ErrorCode.INVALID_ACTION }, 400);
    const { gameIds, expectedVersion } = body as { gameIds?: unknown; expectedVersion?: unknown };
    if (
      !validList(gameIds) ||
      !Number.isSafeInteger(expectedVersion) ||
      (expectedVersion as number) < 1
    ) {
      return reply(
        {
          error: "Unique gameIds and expectedVersion are required",
          code: ErrorCode.INVALID_ACTION,
        },
        400,
      );
    }

    const personal = path === "/library/favourites";
    // A conditional INSERT covers a new personal row; a conditional UPDATE covers existing rows.
    // D1 serializes these statements, and the version predicate rejects stale writers.
    if (personal && expectedVersion === 1) {
      const inserted = await env.DB.prepare(
        "INSERT OR IGNORE INTO account_favourites (accountId, gameIds, version) VALUES (?, ?, 2)",
      )
        .bind(accountId, JSON.stringify(gameIds))
        .run();
      if (inserted.meta.changes === 1) return reply({ gameIds, version: 2 });
    }
    const statement = personal
      ? env.DB.prepare(
          "UPDATE account_favourites SET gameIds = ?, version = version + 1 WHERE accountId = ? AND version = ?",
        ).bind(JSON.stringify(gameIds), accountId, expectedVersion)
      : env.DB.prepare(
          "UPDATE shared_play_next SET gameIds = ?, version = version + 1 WHERE id = 1 AND version = ?",
        ).bind(JSON.stringify(gameIds), expectedVersion);
    const updated = await statement.run();
    if (updated.meta.changes === 1)
      return reply({ gameIds, version: (expectedVersion as number) + 1 });
    const current = personal
      ? await env.DB.prepare("SELECT gameIds, version FROM account_favourites WHERE accountId = ?")
          .bind(accountId)
          .first<LibraryRow>()
      : await env.DB.prepare(
          "SELECT gameIds, version FROM shared_play_next WHERE id = 1",
        ).first<LibraryRow>();
    return reply(
      {
        error: "Library changed. Refresh and retry.",
        code: ErrorCode.STALE_STATE,
        current: current ? decode(current) : { gameIds: [], version: 1 },
      },
      409,
    );
  }

  return reply({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
}
