import { ErrorCode } from "../../shared/protocol/errors";
import { GameId, PlayMode, AccountId, AccentFamily } from "../../shared/protocol/types";
import { getCsrfSecret } from "../config";
import { getGameEngine } from "../../shared/games/registry";
import { extractSessionToken, validateCsrfToken, validateSession } from "../auth/session";
import { isValidUuid } from "../../shared/utils/uuid";

export interface MatchApiEnv {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  CSRF_SECRET?: string;
}

import { computeCanonicalPayloadDigest } from "../matches/digest";
import { getPuzzleById, selectEligiblePuzzle, SudokuDifficulty } from "../sudoku/catalog";
import { getPrivateSolution } from "../sudoku/verification";

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
  return !!allowedOrigin && origin === allowedOrigin;
}

/**
 * Derives unique slot keys according to DATA-MODEL.md specifications.
 */
export function deriveSlotKey(
  gameId: string,
  mode: string,
  accountId: string,
  _targetAccountId?: string,
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
    return `sudoku:sender:${accountId}`;
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

  if (!env.CSRF_SECRET || env.CSRF_SECRET.length < 32)
    return jsonResponse({ code: ErrorCode.UNAVAILABLE }, 503);
  const csrfSecret = getCsrfSecret(env);
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

    const { creationId, gameId, mode } = body;
    let gameOptions = body.gameOptions;
    if (
      (gameId === "dots-boxes" || gameId === "sos") &&
      gameOptions?.gridSize !== undefined &&
      ![5, 7, 9].includes(gameOptions.gridSize as number)
    ) {
      return jsonResponse(
        { error: "Choose a 5, 7 or 9 grid", code: ErrorCode.INVALID_ACTION },
        400,
      );
    }
    if (gameId === "ludo" && gameOptions?.colours !== undefined) {
      const colours = gameOptions.colours as { A?: unknown; B?: unknown } | null;
      const A = colours?.A ?? "blue";
      const B = colours?.B ?? "green";
      const palette = ["blue", "green", "red", "yellow", "purple", "orange", "cyan", "pink"];
      const tooSimilar: Record<string, string> = {
        blue: "cyan",
        cyan: "blue",
        red: "pink",
        pink: "red",
        yellow: "orange",
        orange: "yellow",
      };
      if (
        typeof A !== "string" ||
        typeof B !== "string" ||
        !palette.includes(A) ||
        !palette.includes(B) ||
        A === B ||
        tooSimilar[A] === B
      ) {
        return jsonResponse(
          { error: "Choose distinct Ludo colours", code: ErrorCode.INVALID_ACTION },
          400,
        );
      }
    }
    if (!creationId || typeof creationId !== "string" || !isValidUuid(creationId)) {
      return jsonResponse(
        { error: "creationId must be a valid UUID", code: ErrorCode.INVALID_ACTION },
        400,
      );
    }
    if (!gameId || !getGameEngine(gameId)) {
      return jsonResponse(
        { error: `Unsupported or unknown gameId: ${gameId}`, code: ErrorCode.UNSUPPORTED_RULES },
        400,
      );
    }
    if (
      gameOptions?.rulesVersion !== undefined &&
      !getGameEngine(gameId, Number(gameOptions.rulesVersion))
    ) {
      return jsonResponse(
        { error: `Unsupported rules version for ${gameId}`, code: ErrorCode.UNSUPPORTED_RULES },
        400,
      );
    }
    if (
      gameId === "snakes-and-ladders" &&
      gameOptions?.boardVersion !== undefined &&
      ![1, 2].includes(gameOptions.boardVersion as number)
    ) {
      return jsonResponse(
        { error: "Choose board version 1 or 2", code: ErrorCode.INVALID_ACTION },
        400,
      );
    }
    const validModes =
      gameId === "sudoku" ? ["practice", "duel", "challenge"] : ["remote", "together"];

    if (!mode || !validModes.includes(mode)) {
      return jsonResponse(
        {
          error: `Invalid mode: ${mode} for game ${gameId}. Expected one of: ${validModes.join(", ")}`,
          code: ErrorCode.INVALID_ACTION,
        },
        400,
      );
    }

    const opponentAccountId: AccountId = actorAccount === "A" ? "B" : "A";
    if (body.opponentAccountId !== undefined && body.opponentAccountId !== opponentAccountId)
      return jsonResponse(
        { code: ErrorCode.INVALID_ACTION, error: "Other fixed account required" },
        400,
      );
    const creationPayload = JSON.stringify({
      creatorAccountId: actorAccount,
      gameId,
      mode,
      opponentAccountId,
      gameOptions: gameOptions ?? {},
    });
    const creationDigest = await computeCanonicalPayloadDigest(
      "match.create",
      JSON.parse(creationPayload),
    );
    const existingMatch = await env.DB.prepare("SELECT * FROM match_registry WHERE creationId = ?")
      .bind(creationId)
      .first<{
        matchId: string;
        gameId: string;
        mode: string;
        lifecycle: string;
        creationPayload: string;
        creatorAccountId: string;
        participants: string;
      }>();
    if (existingMatch) {
      if (
        existingMatch.creatorAccountId !== actorAccount ||
        !existingMatch.creationPayload ||
        (await computeCanonicalPayloadDigest(
          "match.create",
          JSON.parse(existingMatch.creationPayload),
        )) !== creationDigest
      )
        return jsonResponse({ code: ErrorCode.ID_REUSED, error: "Creation ID conflicts" }, 409);
      const saved = JSON.parse(existingMatch.creationPayload);
      const stub = env.MATCH_DO.get(env.MATCH_DO.idFromName(existingMatch.matchId));
      const current = await stub.fetch(
        new Request("https://internal/view", {
          headers: { "X-Actor-Account": actorAccount, "X-Session-Id": sessionId },
        }),
      );
      if (current.ok) {
        await env.DB.prepare(
          "UPDATE match_registry SET initializationState = 'ready' WHERE matchId = ?",
        )
          .bind(existingMatch.matchId)
          .run();
        return jsonResponse(
          {
            matchId: existingMatch.matchId,
            gameId: existingMatch.gameId,
            mode: existingMatch.mode,
            view: await current.json(),
          },
          200,
        );
      }
      const init = await stub.fetch(
        new Request("https://internal/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
          body: JSON.stringify({
            ...saved,
            matchId: existingMatch.matchId,
            participants: JSON.parse(existingMatch.participants),
            gameOptions: await authoritativeOptions(
              saved.gameId,
              saved.mode,
              saved.gameOptions,
              actorAccount,
              env,
            ),
          }),
        }),
      );
      if (!init.ok) return jsonResponse({ code: ErrorCode.UNAVAILABLE }, 503);
      await env.DB.prepare(
        "UPDATE match_registry SET initializationState = 'ready' WHERE matchId = ?",
      )
        .bind(existingMatch.matchId)
        .run();
      const initialized = (await init.json()) as { view: unknown };
      return jsonResponse(
        {
          matchId: existingMatch.matchId,
          gameId: existingMatch.gameId,
          mode: existingMatch.mode,
          view: initialized.view,
        },
        200,
      );
    }
    gameOptions = await authoritativeOptions(gameId, mode, gameOptions, actorAccount, env);

    // 2b. Slot reservation in active_slots
    const slotKey = deriveSlotKey(gameId, mode, actorAccount, opponentAccountId);

    const activeSlot = await env.DB.prepare("SELECT * FROM active_slots WHERE slotKey = ?")
      .bind(slotKey)
      .first<{ slotKey: string; matchId: string; creationId: string; reservedAt: number }>();

    if (activeSlot) {
      const regRow = await env.DB.prepare("SELECT lifecycle FROM match_registry WHERE matchId = ?")
        .bind(activeSlot.matchId)
        .first<{ lifecycle: string }>();

      if (
        regRow &&
        ["completed", "resigned", "abandoned", "cancelled", "expired"].includes(regRow.lifecycle)
      ) {
        await env.DB.prepare("DELETE FROM active_slots WHERE slotKey = ? AND matchId = ?")
          .bind(slotKey, activeSlot.matchId)
          .run();
      } else {
        const current = await env.MATCH_DO.get(env.MATCH_DO.idFromName(activeSlot.matchId)).fetch(
          new Request("https://internal/view", {
            headers: { "X-Actor-Account": actorAccount, "X-Session-Id": sessionId },
          }),
        );
        if (current.ok) {
          const view = (await current.json()) as { lifecycle: string };
          if (
            ["completed", "resigned", "abandoned", "cancelled", "expired"].includes(view.lifecycle)
          )
            await env.DB.prepare("DELETE FROM active_slots WHERE slotKey = ? AND matchId = ?")
              .bind(slotKey, activeSlot.matchId)
              .run();
          else
            return jsonResponse(
              {
                code: ErrorCode.SLOT_OCCUPIED,
                existingMatchId: activeSlot.matchId,
                error: "A match is already in progress for this game mode.",
              },
              409,
            );
        } else if (current.status === 404 && activeSlot.reservedAt <= Date.now() - 600000) {
          const aborted = await env.MATCH_DO.get(env.MATCH_DO.idFromName(activeSlot.matchId)).fetch(
            new Request("https://internal/abort-initialization", { method: "POST" }),
          );
          if (!aborted.ok || !((await aborted.json()) as { aborted: boolean }).aborted)
            return jsonResponse(
              {
                code: ErrorCode.SLOT_OCCUPIED,
                existingMatchId: activeSlot.matchId,
                error: "A match is already in progress for this game mode.",
              },
              409,
            );
          await env.DB.batch([
            env.DB.prepare("DELETE FROM active_slots WHERE slotKey = ? AND matchId = ?").bind(
              slotKey,
              activeSlot.matchId,
            ),
            env.DB.prepare(
              "UPDATE match_registry SET initializationState = 'failed', lifecycle = 'cancelled' WHERE matchId = ? AND initializationState = 'initializing'",
            ).bind(activeSlot.matchId),
          ]);
        } else
          return jsonResponse(
            {
              code: ErrorCode.SLOT_OCCUPIED,
              existingMatchId: activeSlot.matchId,
              error: "A match is already in progress for this game mode.",
            },
            409,
          );
      }
    }

    // 2c. Prepare participants and match registry row
    const matchId = crypto.randomUUID();
    const isTogether = mode === "together";

    // Lookup display names
    const creatorRow = await env.DB.prepare(
      "SELECT displayName, accentFamily FROM accounts WHERE id = ?",
    )
      .bind(actorAccount)
      .first<{ displayName: string; accentFamily: AccentFamily }>();
    const creatorDisplayName =
      creatorRow?.displayName || (actorAccount === "A" ? "Player A" : "Player B");

    let opponentDisplayName = "Player 2";
    let opponentAccent: AccentFamily | undefined;
    if (true) {
      const oppRow = await env.DB.prepare(
        "SELECT displayName, accentFamily FROM accounts WHERE id = ?",
      )
        .bind(opponentAccountId)
        .first<{ displayName: string; accentFamily: AccentFamily }>();
      opponentAccent = oppRow?.accentFamily;
      opponentDisplayName =
        oppRow?.displayName || (opponentAccountId === "A" ? "Player A" : "Player B");
    }

    const participants = {
      A: {
        accountId: actorAccount,
        displayName: creatorDisplayName,
        accentFamily: creatorRow?.accentFamily,
        ready: true,
      },
      B:
        mode === "practice" || mode === "challenge"
          ? undefined
          : {
              accountId: opponentAccountId,
              displayName: opponentDisplayName,
              accentFamily: opponentAccent,
              ready: isTogether,
            },
    };

    const initiallyActive = isTogether || mode === "practice" || mode === "challenge";
    const initialLifecycle = initiallyActive ? "active" : "waiting";
    const now = Date.now();

    // Insert into match_registry and active_slots atomically
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO match_registry (
          matchId, creationId, creatorAccountId, gameId, mode, participants, creationPayload,
          doName, initializationState, lifecycle, deliveryVersion, schemaVersion, rulesVersion,
          createdAt, startedAt, finishedAt, lastActionAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'initializing', ?, 1, 1, 1, ?, ?, NULL, ?)`,
        ).bind(
          matchId,
          creationId,
          actorAccount,
          gameId,
          mode,
          JSON.stringify(participants),
          creationPayload,
          matchId,
          initialLifecycle,
          now,
          initiallyActive ? now : null,
          now,
        ),
        env.DB.prepare(
          `INSERT INTO active_slots (slotKey, matchId, creationId, reservedAt)
         VALUES (?, ?, ?, ?)`,
        ).bind(slotKey, matchId, creationId, now),
      ]);
    } catch {
      const concurrent = await env.DB.prepare("SELECT matchId FROM active_slots WHERE slotKey = ?")
        .bind(slotKey)
        .first<{ matchId: string }>();
      return jsonResponse(
        {
          code: ErrorCode.SLOT_OCCUPIED,
          existingMatchId: concurrent?.matchId,
          error: "Creation reservation conflict; retry same ID",
        },
        409,
      );
    }

    // Initialize DO
    const doId = env.MATCH_DO.idFromName(matchId);
    const stub = env.MATCH_DO.get(doId);

    const initRes = await stub.fetch(
      new Request("https://internal/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
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
      `SELECT matchId, creationId, creatorAccountId, gameId, mode, participants, creationPayload,
              initializationState, lifecycle, deliveryVersion, createdAt, startedAt, finishedAt, lastActionAt
       FROM match_registry
       ORDER BY lastActionAt DESC
       LIMIT 50`,
    ).all<Record<string, unknown>>();

    const accessible: Record<string, unknown>[] = [];
    for (const row of rows.results ?? []) {
      let participants: { A?: { accountId: string }; B?: { accountId: string } };
      try {
        participants = JSON.parse(String(row.participants));
      } catch {
        continue;
      }
      if (participants.A?.accountId !== actorAccount && participants.B?.accountId !== actorAccount)
        continue;
      if (
        row.gameId === "sudoku" &&
        row.mode === "practice" &&
        participants.A?.accountId !== actorAccount
      )
        continue;
      if (
        row.gameId === "sudoku" &&
        row.mode === "challenge" &&
        participants.A?.accountId !== actorAccount
      ) {
        const saved = JSON.parse(String(row.creationPayload ?? "{}"));
        if (!saved.senderAttemptId) {
          // Legacy rows did not distinguish private sender attempts from published receiver matches.
          const authority = await env.MATCH_DO.get(
            env.MATCH_DO.idFromName(String(row.matchId)),
          ).fetch(
            new Request("https://internal/view", {
              headers: { "X-Actor-Account": actorAccount, "X-Session-Id": sessionId },
            }),
          );
          if (authority.status === 403 || authority.status === 404) continue;
          if (!authority.ok) return jsonResponse({ code: ErrorCode.UNAVAILABLE }, 503);
        }
      }
      const publicRow = { ...row };
      delete publicRow.creationPayload;
      accessible.push(publicRow);
    }

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
        headers: { "X-Actor-Account": actorAccount, "X-Session-Id": sessionId },
      }),
    );
    const view = await doRes.json();
    return jsonResponse(view, doRes.status);
  }

  // Route: POST /matches/:id/actions (Submit action envelope)
  if (actionSegment === "actions" && request.method === "POST") {
    let envelope: unknown;
    try {
      envelope = await request.json();
    } catch {
      return jsonResponse({ code: ErrorCode.INVALID_ACTION }, 400);
    }
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
        headers: { "X-Actor-Account": actorAccount, "X-Session-Id": sessionId },
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
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify(body),
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: POST /matches/:id/secret-recovery
  if (actionSegment === "secret-recovery" && request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ code: ErrorCode.INVALID_ACTION }, 400);
    }
    const doRes = await stub.fetch(
      new Request("https://internal/secret-recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Account": actorAccount,
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify(body),
      }),
    );
    const reply = await doRes.json();
    return jsonResponse(reply, doRes.status);
  }

  // Route: GET /matches/:id/socket (WebSocket upgrade)
  if (actionSegment === "socket" && request.method === "GET") {
    if (!checkOrigin(request, env.ALLOWED_ORIGIN))
      return jsonResponse({ code: ErrorCode.FORBIDDEN }, 403);
    return stub.fetch(
      new Request("https://internal/socket", {
        headers: {
          Upgrade: "websocket",
          Origin: request.headers.get("Origin")!,
          "X-Actor-Account": actorAccount,
          "X-Session-Id": sessionId,
        },
      }),
    );
  }

  return jsonResponse({ error: "Endpoint not found", code: ErrorCode.NOT_FOUND }, 404);
}

async function authoritativeOptions(
  gameId: string,
  mode: string,
  options: Record<string, unknown> | undefined,
  accountId: AccountId,
  env: MatchApiEnv,
): Promise<Record<string, unknown> | undefined> {
  if (gameId === "dots-boxes" || gameId === "sos") {
    const gridSize = options?.gridSize ?? 5;
    if (gridSize !== 5 && gridSize !== 7 && gridSize !== 9) throw new Error("Invalid grid size");
    return { gridSize };
  }
  if (gameId === "ludo") {
    const colours = options?.colours as { A?: unknown; B?: unknown } | undefined;
    const palette = ["blue", "green", "red", "yellow", "purple", "orange", "cyan", "pink"];
    const A = colours?.A ?? "blue";
    const B = colours?.B ?? "green";
    const tooSimilar: Record<string, string> = {
      blue: "cyan",
      cyan: "blue",
      red: "pink",
      pink: "red",
      yellow: "orange",
      orange: "yellow",
    };
    if (
      typeof A !== "string" ||
      typeof B !== "string" ||
      !palette.includes(A) ||
      !palette.includes(B) ||
      A === B ||
      tooSimilar[A] === B
    )
      throw new Error("Choose distinct Ludo colours");
    return { colours: { A, B } };
  }
  if (gameId !== "sudoku") return options;
  const query =
    mode === "duel"
      ? env.DB.prepare("SELECT puzzleId FROM sudoku_records")
      : env.DB.prepare("SELECT puzzleId FROM sudoku_records WHERE accountId = ?").bind(accountId);
  const completed = await query.all<{ puzzleId: string }>();
  const completedIds = new Set((completed.results ?? []).map((row) => row.puzzleId));
  let puzzle = typeof options?.puzzleId === "string" ? getPuzzleById(options.puzzleId) : undefined;
  if (options?.puzzleId !== undefined && !puzzle) throw new Error("Unknown puzzle");
  let replay = false;
  if (!puzzle) {
    const bucket = options?.difficulty ?? options?.bucket ?? "easy";
    if (!["easy", "medium", "hard", "expert"].includes(String(bucket)))
      throw new Error("Invalid difficulty");
    const selected = selectEligiblePuzzle(bucket as SudokuDifficulty, completedIds);
    puzzle = selected.puzzle;
    replay = selected.isReplay;
  } else replay = completedIds.has(puzzle.puzzleId);
  const solution = getPrivateSolution(puzzle.puzzleId);
  if (!solution) throw new Error("Puzzle unavailable");
  return {
    puzzleId: puzzle.puzzleId,
    givens: puzzle.givens,
    solution,
    mode,
    replay,
    senderSeat: "A",
  };
}
