import { ErrorCode } from "../../shared/protocol/errors";
import { GameId, PlayMode, AccountId } from "../../shared/protocol/types";
import { getGameEngine } from "../../shared/games/registry";
import { extractSessionToken, validateCsrfToken, validateSession } from "../auth/session";

export interface MatchApiEnv {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  CSRF_SECRET?: string;
}

const DEFAULT_CSRF_SECRET = "arcade-dev-csrf-secret-change-in-prod";

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");

  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

function checkOrigin(request: Request, allowedOrigin?: string): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  if (!allowedOrigin) return true;
  const reqUrl = new URL(request.url);
  return origin === allowedOrigin || origin === reqUrl.origin;
}

/**
 * Derives unique slot keys according to DATA-MODEL.md specifications.
 */
export function deriveSlotKey(
  gameId: string,
  mode: string,
  accountId: string,
  targetAccountId?: string,
): string {
  if (gameId !== "sudoku") {
    return `shared:${gameId}:${mode}`;
  }
  if (mode === "practice") {
    return `sudoku:practice:${accountId}`;
  }
  if (mode === "duel") {
    return `sudoku:duel`;
  }
  if (mode === "challenge") {
    return `sudoku:challenge:${accountId}:${targetAccountId || ""}`;
  }
  return `sudoku:${mode}:${accountId}`;
}

/**
 * Main router for worker match API endpoints.
 */
export async function handleMatchesRequest(
  request: Request,
  env: MatchApiEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  let subpath = "";
  if (path.startsWith("/api/v1/matches")) {
    subpath = path.slice("/api/v1/matches".length);
  } else if (path.startsWith("/api/matches")) {
    subpath = path.slice("/api/matches".length);
  } else {
    return null;
  }

  // Clean subpath: e.g. "" or "/" or "/:id" or "/:id/actions"
  if (subpath.startsWith("/")) {
    subpath = subpath.slice(1);
  }

  // 1. Session Authentication
  const rawToken = extractSessionToken(request);
  if (!rawToken) {
    return jsonResponse({ error: "Authentication required", code: ErrorCode.AUTH_REQUIRED }, 401);
  }

  const csrfSecret = env.CSRF_SECRET || DEFAULT_CSRF_SECRET;
  const sessionRes = await validateSession(env.DB, rawToken, csrfSecret);
  if (!sessionRes) {
    return jsonResponse(
      { error: "Session expired or invalid", code: ErrorCode.SESSION_EXPIRED },
      401,
    );
  }

  const actorAccount = sessionRes.profile.id as AccountId;
  const sessionId = sessionRes.session.sessionId;

  // 2. CSRF & Origin checks for mutating HTTP methods
  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    if (!checkOrigin(request, env.ALLOWED_ORIGIN)) {
      return jsonResponse({ error: "Forbidden: origin mismatch", code: "ORIGIN_MISMATCH" }, 403);
    }

    const csrfHeader = request.headers.get("x-csrf-token");
    const isCsrfValid = await validateCsrfToken(sessionRes.session.csrfHash, csrfHeader);
    if (!isCsrfValid) {
      return jsonResponse({ error: "Invalid CSRF token", code: ErrorCode.FORBIDDEN }, 403);
    }
  }

  // Route: POST /matches (Create Match)
  if (subpath === "" && request.method === "POST") {
    let body: {
      creationId?: string;
      gameId?: GameId;
      mode?: PlayMode;
      gameOptions?: Record<string, unknown>;
      opponentAccountId?: AccountId;
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body", code: ErrorCode.INVALID_ACTION }, 400);
    }

    const { creationId, gameId, mode, gameOptions } = body;
    if (!creationId || typeof creationId !== "string") {
      return jsonResponse({ error: "creationId is required", code: ErrorCode.INVALID_ACTION }, 400);
    }
    if (!gameId || !getGameEngine(gameId)) {
      return jsonResponse(
        { error: `Unsupported or unknown gameId: ${gameId}`, code: ErrorCode.UNSUPPORTED_RULES },
        400,
      );
    }
    if (mode !== "remote" && mode !== "together") {
      return jsonResponse(
        {
          error: `Invalid mode: ${mode}. Expected 'remote' or 'together'`,
          code: ErrorCode.INVALID_ACTION,
        },
        400,
      );
    }

    // 2a. Check creationId idempotency
    const existingMatch = await env.DB.prepare("SELECT * FROM match_registry WHERE creationId = ?")
      .bind(creationId)
      .first<{ matchId: string; gameId: string; mode: string; lifecycle: string }>();

    if (existingMatch) {
      const doId = env.MATCH_DO.idFromName(existingMatch.matchId);
      const stub = env.MATCH_DO.get(doId);
      const doRes = await stub.fetch(
        new Request("https://internal/view", {
          headers: { "X-Actor-Account": actorAccount },
        }),
      );
      const view = await doRes.json();
      return jsonResponse(
        {
          matchId: existingMatch.matchId,
          gameId: existingMatch.gameId,
          mode: existingMatch.mode,
          lifecycle: existingMatch.lifecycle,
          view,
        },
        200,
      );
    }

    // 2b. Slot reservation in active_slots
    const opponentAccountId: AccountId =
      body.opponentAccountId || (actorAccount === "A" ? "B" : "A");
    const slotKey = deriveSlotKey(gameId, mode, actorAccount, opponentAccountId);

    const activeSlot = await env.DB.prepare("SELECT * FROM active_slots WHERE slotKey = ?")
      .bind(slotKey)
      .first<{ slotKey: string; matchId: string; creationId: string }>();

    if (activeSlot) {
      const occupyingMatch = await env.DB.prepare(
        "SELECT matchId, lifecycle FROM match_registry WHERE matchId = ?",
      )
        .bind(activeSlot.matchId)
        .first<{ matchId: string; lifecycle: string }>();

      if (occupyingMatch && ["waiting", "active"].includes(occupyingMatch.lifecycle)) {
        return jsonResponse(
          {
            error: "Slot already occupied by an active match",
            code: ErrorCode.SLOT_OCCUPIED,
            existingMatchId: occupyingMatch.matchId,
          },
          409,
        );
      } else {
        // Clean up stale slot
        await env.DB.prepare("DELETE FROM active_slots WHERE slotKey = ?").bind(slotKey).run();
      }
    }

    // 2c. Prepare participants and match registry row
    const matchId = crypto.randomUUID();
    const isTogether = mode === "together";

    // Lookup display names
    const creatorRow = await env.DB.prepare("SELECT displayName FROM accounts WHERE id = ?")
      .bind(actorAccount)
      .first<{ displayName: string }>();
    const creatorDisplayName =
      creatorRow?.displayName || (actorAccount === "A" ? "Player A" : "Player B");

    let opponentDisplayName = "Player 2";
    if (!isTogether) {
      const oppRow = await env.DB.prepare("SELECT displayName FROM accounts WHERE id = ?")
        .bind(opponentAccountId)
        .first<{ displayName: string }>();
      opponentDisplayName =
        oppRow?.displayName || (opponentAccountId === "A" ? "Player A" : "Player B");
    }

    const participants = {
      A: {
        accountId: actorAccount,
        displayName: creatorDisplayName,
        ready: true,
      },
      B: {
        accountId: isTogether ? actorAccount : opponentAccountId,
        displayName: opponentDisplayName,
        ready: isTogether,
      },
    };

    const initialLifecycle = isTogether ? "active" : "waiting";
    const now = Date.now();

    // Insert into match_registry and active_slots atomically
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO match_registry (
          matchId, creationId, creatorAccountId, gameId, mode, participants,
          doName, initializationState, lifecycle, deliveryVersion, schemaVersion, rulesVersion,
          createdAt, startedAt, finishedAt, lastActionAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'initializing', ?, 1, 1, 1, ?, ?, NULL, ?)`,
      ).bind(
        matchId,
        creationId,
        actorAccount,
        gameId,
        mode,
        JSON.stringify(participants),
        matchId,
        initialLifecycle,
        now,
        isTogether ? now : null,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO active_slots (slotKey, matchId, creationId, reservedAt)
         VALUES (?, ?, ?, ?)`,
      ).bind(slotKey, matchId, creationId, now),
    ]);

    // Initialize DO
    const doId = env.MATCH_DO.idFromName(matchId);
    const stub = env.MATCH_DO.get(doId);

    const initRes = await stub.fetch(
      new Request("https://internal/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          gameId,
          mode,
          creatorAccountId: actorAccount,
          participants,
          gameOptions,
        }),
      }),
    );

    if (!initRes.ok) {
      return jsonResponse(
        { error: "Failed to initialize match authority", code: ErrorCode.UNAVAILABLE },
        500,
      );
    }

    const initData = (await initRes.json()) as { status: string; view: unknown };

    // Update initializationState to ready
    await env.DB.prepare(
      "UPDATE match_registry SET initializationState = 'ready' WHERE matchId = ?",
    )
      .bind(matchId)
      .run();

    return jsonResponse(
      {
        matchId,
        gameId,
        mode,
        lifecycle: initialLifecycle,
        view: initData.view,
      },
      201,
    );
  }

  // Route: GET /matches (List accessible matches)
  if (subpath === "" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT matchId, creationId, creatorAccountId, gameId, mode, participants,
              initializationState, lifecycle, deliveryVersion, createdAt, startedAt, finishedAt, lastActionAt
       FROM match_registry
       ORDER BY lastActionAt DESC
       LIMIT 50`,
    ).all<Record<string, unknown>>();

    const accessible = (rows.results || []).filter((r) => {
      try {
        const parts = JSON.parse(r.participants as string);
        return parts.A?.accountId === actorAccount || parts.B?.accountId === actorAccount;
      } catch {
        return false;
      }
    });

    return jsonResponse({ matches: accessible }, 200);
  }

  // Dissect matchId from subpath: e.g. ":id" or ":id/actions" or ":id/socket"
  const parts = subpath.split("/");
  const matchId = parts[0];
  const actionSegment = parts[1];
  const subActionSegment = parts[2];

  if (!matchId) {
    return jsonResponse({ error: "Match ID required", code: ErrorCode.NOT_FOUND }, 404);
  }

  const doId = env.MATCH_DO.idFromName(matchId);
  const stub = env.MATCH_DO.get(doId);

  // Route: GET /matches/:id (Fetch snapshot view)
  if (!actionSegment && request.method === "GET") {
    const doRes = await stub.fetch(
      new Request("https://internal/view", {
        headers: { "X-Actor-Account": actorAccount },
      }),
    );
    const view = await doRes.json();
    return jsonResponse(view, doRes.status);
  }

  // Route: POST /matches/:id/actions (Submit action envelope)
  if (actionSegment === "actions" && request.method === "POST") {
    const envelope = await request.json();
    const doRes = await stub.fetch(
      new Request("https://internal/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Account": actorAccount,
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify(envelope),
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: GET /matches/:id/receipts/:actionId
  if (actionSegment === "receipts" && subActionSegment && request.method === "GET") {
    const actionId = subActionSegment;
    const doRes = await stub.fetch(
      new Request(`https://internal/receipts/${actionId}`, {
        headers: { "X-Actor-Account": actorAccount },
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: POST /matches/:id/controller (Takeover)
  if (actionSegment === "controller" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {}
    const doRes = await stub.fetch(
      new Request("https://internal/controller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Account": actorAccount,
        },
        body: JSON.stringify(body),
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: POST /matches/:id/secret-recovery
  if (actionSegment === "secret-recovery" && request.method === "POST") {
    const body = await request.json();
    const doRes = await stub.fetch(
      new Request("https://internal/secret-recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Account": actorAccount,
        },
        body: JSON.stringify(body),
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: GET /matches/:id/socket (WebSocket upgrade)
  if (actionSegment === "socket" && request.method === "GET") {
    return stub.fetch(
      new Request("https://internal/socket", {
        headers: {
          Upgrade: "websocket",
          "X-Actor-Account": actorAccount,
          "X-Session-Id": sessionId,
        },
      }),
    );
  }

  return jsonResponse({ error: "Endpoint not found", code: ErrorCode.NOT_FOUND }, 404);
}
