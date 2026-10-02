import { ErrorCode } from "../../shared/protocol/errors";
import { AccountId } from "../../shared/protocol/types";
import { extractSessionToken, validateCsrfToken, validateSession } from "../auth/session";
import { getPuzzleById } from "../sudoku/catalog";
import { getPrivateSolution } from "../sudoku/verification";
import { getCompletedPuzzleIds } from "../sudoku/records";
import { getCsrfSecret, isAllowedOrigin } from "../config";
export interface ChallengesEnv {
  DB: D1Database;
  MATCH_DO: DurableObjectNamespace;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  CSRF_SECRET?: string;
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
interface Source {
  puzzleId: string;
  senderElapsedMs: number;
  replay: boolean;
  senderSeat: "A" | "B";
}
interface Registry {
  matchId: string;
  creationPayload: string;
  creatorAccountId: string;
  participants: string;
}
export async function handleChallengesRequest(
  request: Request,
  env: ChallengesEnv,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/v1/challenges" && path !== "/api/challenges") return null;
  const token = extractSessionToken(request);
  if (!token) return json({ code: ErrorCode.AUTH_REQUIRED }, 401);
  const auth = await validateSession(env.DB, token, getCsrfSecret(env));
  if (!auth) return json({ code: ErrorCode.SESSION_EXPIRED }, 401);
  const account = auth.profile.id as AccountId,
    other: AccountId = account === "A" ? "B" : "A";
  const headers = { "X-Actor-Account": account, "X-Session-Id": auth.session.sessionId };
  if (request.method === "POST") {
    if (!isAllowedOrigin(request, env)) return json({ code: ErrorCode.FORBIDDEN }, 403);
    if (!(await validateCsrfToken(auth.session.csrfHash, request.headers.get("x-csrf-token"))))
      return json({ code: ErrorCode.FORBIDDEN }, 403);
    let body: { creationId?: string; senderAttemptId?: string };
    try {
      body = await request.json();
    } catch {
      return json({ code: ErrorCode.INVALID_ACTION }, 400);
    }
    if (
      typeof body.creationId !== "string" ||
      !body.creationId ||
      typeof body.senderAttemptId !== "string" ||
      !body.senderAttemptId
    )
      return json(
        { code: ErrorCode.INVALID_ACTION, error: "creationId and senderAttemptId required" },
        400,
      );
    const { creationId, senderAttemptId } = body;
    const existing = await env.DB.prepare(
      "SELECT matchId, creationPayload, creatorAccountId, participants FROM match_registry WHERE creationId = ?",
    )
      .bind(creationId)
      .first<Registry>();
    if (existing) {
      const saved = JSON.parse(existing.creationPayload || "{}");
      if (existing.creatorAccountId !== account || saved.senderAttemptId !== senderAttemptId)
        return json({ code: ErrorCode.ID_REUSED }, 409);
      return initialize(existing.matchId, saved.source, JSON.parse(existing.participants), 200);
    }
    const published = await env.DB.prepare(
      "SELECT matchId, creationPayload, creatorAccountId, participants FROM match_registry WHERE creatorAccountId = ? AND json_extract(creationPayload, '$.senderAttemptId') = ?",
    )
      .bind(account, senderAttemptId)
      .first<Registry>();
    if (published) {
      const saved = JSON.parse(published.creationPayload);
      return initialize(published.matchId, saved.source, JSON.parse(published.participants), 200);
    }
    const sourceResponse = await env.MATCH_DO.get(env.MATCH_DO.idFromName(senderAttemptId)).fetch(
      new Request("https://internal/challenge-source", { headers }),
    );
    if (!sourceResponse.ok)
      return json(
        {
          code: ErrorCode.INVALID_ACTION,
          error: "Publish requires your completed unassisted sender attempt",
        },
        sourceResponse.status,
      );
    const source = (await sourceResponse.json()) as Source;
    const puzzle = getPuzzleById(source.puzzleId);
    if (!puzzle || !Number.isFinite(source.senderElapsedMs) || source.senderElapsedMs < 0)
      return json({ code: ErrorCode.INVALID_ACTION }, 400);
    const replay =
      source.replay || (await getCompletedPuzzleIds(env.DB, other)).has(source.puzzleId);
    source.replay = replay;
    const slotKey = `sudoku:challenge:${account}:${other}`;
    const occupied = await env.DB.prepare("SELECT matchId FROM active_slots WHERE slotKey = ?")
      .bind(slotKey)
      .first<{ matchId: string }>();
    if (occupied)
      return json({ code: ErrorCode.SLOT_OCCUPIED, existingMatchId: occupied.matchId }, 409);
    const names = await env.DB.prepare("SELECT id, displayName FROM accounts").all<{
      id: string;
      displayName: string;
    }>();
    const display = (id: string) =>
      names.results?.find((n) => n.id === id)?.displayName || `Player ${id}`;
    const participants = {
      A: { accountId: account, displayName: display(account), ready: true },
      B: { accountId: other, displayName: display(other), ready: false },
    };
    const matchId = crypto.randomUUID(),
      now = Date.now();
    const saved = { senderAttemptId, source };
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO match_registry (matchId,creationId,creatorAccountId,gameId,mode,participants,creationPayload,doName,initializationState,lifecycle,deliveryVersion,schemaVersion,rulesVersion,createdAt,lastActionAt) VALUES (?,?,?,'sudoku','challenge',?,?,?,'initializing','waiting',1,1,1,?,?)`,
        ).bind(
          matchId,
          creationId,
          account,
          JSON.stringify(participants),
          JSON.stringify(saved),
          matchId,
          now,
          now,
        ),
        env.DB.prepare(
          "INSERT INTO active_slots (slotKey,matchId,creationId,reservedAt) VALUES (?,?,?,?)",
        ).bind(slotKey, matchId, creationId, now),
      ]);
    } catch {
      return json(
        { code: ErrorCode.SLOT_OCCUPIED, error: "Concurrent publication; retry same creationId" },
        409,
      );
    }
    return initialize(matchId, source, participants, 201);
    async function initialize(
      matchId: string,
      source: Source,
      participants: unknown,
      status: number,
    ): Promise<Response> {
      const puzzle = getPuzzleById(source.puzzleId),
        solution = getPrivateSolution(source.puzzleId);
      if (!puzzle || !solution) return json({ code: ErrorCode.UNAVAILABLE }, 503);
      const init = await env.MATCH_DO.get(env.MATCH_DO.idFromName(matchId)).fetch(
        new Request("https://internal/initialize", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            gameId: "sudoku",
            mode: "challenge",
            creatorAccountId: account,
            participants,
            gameOptions: {
              puzzleId: puzzle.puzzleId,
              givens: puzzle.givens,
              solution,
              mode: "challenge",
              senderSeat: "A",
              senderElapsedMs: source.senderElapsedMs,
              replay: source.replay,
              challengePublished: true,
              receiverAccepted: false,
            },
          }),
        }),
      );
      if (!init.ok)
        return json(
          { code: ErrorCode.UNAVAILABLE, error: "Publication reserved; retry same creationId" },
          503,
        );
      await env.DB.prepare(
        "UPDATE match_registry SET initializationState = 'ready' WHERE matchId = ?",
      )
        .bind(matchId)
        .run();
      const initialized = (await init.json()) as { view: unknown };
      return json(
        {
          challengeId: matchId,
          puzzleId: puzzle.puzzleId,
          bucket: puzzle.bucket,
          senderElapsedMs: source.senderElapsedMs,
          replay: source.replay,
          view: initialized.view,
        },
        status,
      );
    }
  }
  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT matchId, creationPayload, creatorAccountId, participants FROM match_registry WHERE gameId = 'sudoku' AND mode = 'challenge' AND creatorAccountId = ? ORDER BY createdAt DESC LIMIT 50",
    )
      .bind(other)
      .all<Registry>();
    const challenges = [];
    for (const row of rows.results || []) {
      const saved = JSON.parse(row.creationPayload || "{}");
      if (!saved.source) continue;
      const response = await env.MATCH_DO.get(env.MATCH_DO.idFromName(row.matchId)).fetch(
        new Request("https://internal/view", { headers }),
      );
      if (!response.ok) continue;
      const view = (await response.json()) as {
        lifecycle: string;
        gameView: { challenge?: { accepted: boolean } };
      };
      if (view.lifecycle !== "waiting") continue;
      const puzzle = getPuzzleById(saved.source.puzzleId);
      challenges.push({
        challengeId: row.matchId,
        bucket: puzzle?.bucket,
        senderAccountId: other,
        senderElapsedMs: saved.source.senderElapsedMs,
        replay: saved.source.replay,
      });
    }
    return json({ challenges });
  }
  return json({ code: ErrorCode.INVALID_ACTION }, 405);
}
