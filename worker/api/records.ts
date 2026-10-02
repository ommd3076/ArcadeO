/**
 * Private Arcade V1 — Records & Statistics API
 *
 * Exposes server-authoritative projections:
 * - Head-to-head match stats between Player A and Player B
 * - Streak calculation in chronological order
 * - Asia/Calcutta Monday-anchored weekly match summary
 * - Per-game breakdowns
 * - Sudoku best times (unassisted vs assisted)
 * - Recent match history
 */

import type { Env } from "../index";
import { validateSession, extractSessionToken } from "../auth/session";
import { ErrorCode } from "../../shared/protocol/errors";
import { getCsrfSecret } from "../config";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Calculates start of the current week (Monday 00:00:00) in Asia/Calcutta (+05:30).
 */
export function getCalcuttaWeekStart(nowMs: number = Date.now()): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(nowMs + IST_OFFSET_MS);

  // UTC day of week for the shifted IST date: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const day = istDate.getUTCDay();
  const diffDays = day === 0 ? 6 : day - 1; // Days since Monday

  // Reset to Monday 00:00:00 IST
  const mondayIst = new Date(istDate.getTime() - diffDays * 24 * 60 * 60 * 1000);
  mondayIst.setUTCHours(0, 0, 0, 0);

  // Convert back to UTC epoch ms
  return mondayIst.getTime() - IST_OFFSET_MS;
}

export async function handleRecordsRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Authentication
  const rawToken = extractSessionToken(request);
  if (!rawToken) {
    return jsonResponse({ error: "Unauthorized", code: ErrorCode.AUTH_REQUIRED }, 401);
  }

  const csrfSecret = getCsrfSecret(env);
  const auth = await validateSession(env.DB, rawToken, csrfSecret);
  if (!auth) {
    return jsonResponse({ error: "Unauthorized", code: ErrorCode.AUTH_REQUIRED }, 401);
  }

  // GET /api/v1/records/summary
  if (
    (path === "/api/v1/records/summary" || path === "/api/records/summary") &&
    request.method === "GET"
  ) {
    // 1. Fetch valid completed results
    const results = (await env.DB.prepare(
      `SELECT matchId, gameId, mode, participants, winner, reason, scores, finishedAt, details, interrupted
       FROM results 
       WHERE reason IN ('rules_win', 'rules_draw', 'resignation')
       ORDER BY finishedAt ASC, matchId ASC`,
    ).all()) as {
      results?: Array<{
        matchId: string;
        gameId: string;
        mode: string;
        participants: string;
        winner: string | null;
        reason: string;
        scores: string;
        finishedAt: number;
        details?: string | null;
        interrupted: number;
      }>;
    };

    const rows = results.results ?? [];

    let winsA = 0;
    let winsB = 0;
    let draws = 0;

    const byGame: Record<
      string,
      {
        played: number;
        winsA: number;
        winsB: number;
        draws: number;
        winStreak: { holder: "A" | "B"; count: number } | null;
      }
    > = {};

    // Weekly metrics (Asia/Calcutta)
    const weekStartMs = getCalcuttaWeekStart();
    let thisWeekTotal = 0;
    let thisWeekWinsA = 0;
    let thisWeekWinsB = 0;
    let thisWeekDraws = 0;

    // Streaks
    let currentStreak: { holder: "A" | "B"; count: number } | null = null;
    const playDays = new Set<number>();

    // Cricket records
    let highestCompletedInnings = 0;
    const cricketBattingRuns: Record<string, number> = { A: 0, B: 0 };
    const cricketBowlingWickets: Record<string, number> = { A: 0, B: 0 };

    for (const r of rows) {
      const details = parseDetails(r.details);
      // Deliberately saved/resumed Sudoku Duels remain history, but never enter
      // shared competitive totals, streaks or play-day/week counts.
      if (r.gameId === "sudoku" && r.mode === "duel" && r.interrupted === 1) continue;
      if (r.mode === "practice" || details.scored === false || details.senderAttempt === true)
        continue;

      // Cricket metrics: only completed matches (rules_win / rules_draw), excluding resignation and unscored
      if (r.gameId === "hand-cricket" && (r.reason === "rules_win" || r.reason === "rules_draw")) {
        const batting = details.battingRuns as Record<string, number> | undefined;
        const bowling = details.bowlingWickets as Record<string, number> | undefined;
        let scores: Record<string, number> = {};
        try {
          scores = JSON.parse(r.scores);
        } catch {}

        const runsA = batting?.A ?? scores.A ?? 0;
        const runsB = batting?.B ?? scores.B ?? 0;
        cricketBattingRuns.A += runsA;
        cricketBattingRuns.B += runsB;

        const maxInnings = Math.max(
          typeof details.highestInnings === "number" ? details.highestInnings : 0,
          typeof details.firstInningsRuns === "number" ? details.firstInningsRuns : 0,
          typeof details.secondInningsRuns === "number" ? details.secondInningsRuns : 0,
          runsA,
          runsB,
        );
        highestCompletedInnings = Math.max(highestCompletedInnings, maxInnings);

        if (bowling) {
          cricketBowlingWickets.A += bowling.A ?? 0;
          cricketBowlingWickets.B += bowling.B ?? 0;
        } else if (Array.isArray(details.innings)) {
          for (const inn of details.innings as Array<{ bowlerSeat?: string; wickets?: number }>) {
            if (inn.bowlerSeat === "A") cricketBowlingWickets.A += inn.wickets ?? 0;
            if (inn.bowlerSeat === "B") cricketBowlingWickets.B += inn.wickets ?? 0;
          }
        }
      }

      const winner = winnerAccount(r.participants, r.winner);
      playDays.add(Math.floor((r.finishedAt + 19_800_000) / 86_400_000));

      if (!byGame[r.gameId]) {
        byGame[r.gameId] = { played: 0, winsA: 0, winsB: 0, draws: 0, winStreak: null };
      }

      byGame[r.gameId].played++;

      const previousGameStreak = byGame[r.gameId].winStreak;
      byGame[r.gameId].winStreak = winner
        ? {
            holder: winner,
            count: previousGameStreak?.holder === winner ? previousGameStreak.count + 1 : 1,
          }
        : null;
      if (winner === "A") {
        winsA++;
        byGame[r.gameId].winsA++;
        if (currentStreak?.holder === "A") {
          currentStreak.count++;
        } else {
          currentStreak = { holder: "A", count: 1 };
        }
      } else if (winner === "B") {
        winsB++;
        byGame[r.gameId].winsB++;
        if (currentStreak?.holder === "B") {
          currentStreak.count++;
        } else {
          currentStreak = { holder: "B", count: 1 };
        }
      } else {
        draws++;
        byGame[r.gameId].draws++;
        currentStreak = null; // Draw resets streak
      }

      // Check if in current IST week
      if (r.finishedAt >= weekStartMs) {
        thisWeekTotal++;
        if (winner === "A") thisWeekWinsA++;
        else if (winner === "B") thisWeekWinsB++;
        else thisWeekDraws++;
      }
    }

    const totalPlayed = winsA + winsB + draws;
    const today = Math.floor((Date.now() + 19_800_000) / 86_400_000);
    let day = playDays.has(today) ? today : today - 1;
    let playDayStreak = 0;
    while (playDays.has(day--)) playDayStreak++;

    // Weekly sentence
    const weeklySentence =
      thisWeekTotal > 0
        ? `${thisWeekTotal} match${thisWeekTotal === 1 ? "" : "es"} played this week (${thisWeekWinsA} A, ${thisWeekWinsB} B${thisWeekDraws > 0 ? `, ${thisWeekDraws} draws` : ""})`
        : "No matches played yet this week";

    // 2. Fetch Sudoku records (best times)
    const sudokuRows = (await env.DB.prepare(
      `SELECT attemptId, accountId, puzzleId, mode, elapsedMs, assisted, replay, interrupted, completedAt
       FROM sudoku_records 
       ORDER BY elapsedMs ASC`,
    ).all()) as {
      results?: Array<{
        attemptId: string;
        accountId: string;
        puzzleId: string;
        mode: string;
        elapsedMs: number;
        assisted: number;
        replay: number;
        interrupted: number;
        completedAt: number;
      }>;
    };

    const sRecords = sudokuRows.results ?? [];
    const ownCompletedPuzzleIds = [
      ...new Set(sRecords.filter((r) => r.accountId === auth.profile.id).map((r) => r.puzzleId)),
    ];
    const sudokuBestTimes: Record<
      string,
      { unassisted?: number; assisted?: number; fastestAccountId?: string }
    > = {};
    const soloRecords = {
      A: sRecords.filter((r) => r.accountId === "A" && r.mode === "practice"),
      B: sRecords.filter((r) => r.accountId === "B" && r.mode === "practice"),
    };

    for (const sr of sRecords) {
      if (sr.mode !== "practice" || sr.replay || sr.interrupted === 1) continue;
      if (!sudokuBestTimes[sr.puzzleId]) {
        sudokuBestTimes[sr.puzzleId] = {};
      }
      const entry = sudokuBestTimes[sr.puzzleId];
      if (sr.assisted === 0) {
        if (entry.unassisted === undefined || sr.elapsedMs < entry.unassisted) {
          entry.unassisted = sr.elapsedMs;
          entry.fastestAccountId = sr.accountId;
        }
      } else {
        if (entry.assisted === undefined || sr.elapsedMs < entry.assisted) {
          entry.assisted = sr.elapsedMs;
        }
      }
    }

    return jsonResponse({
      ownCompletedPuzzleIds,
      summary: {
        totalPlayed,
        winsA,
        winsB,
        draws,
        currentStreak,
        playDayStreak,
        thisWeek: {
          total: thisWeekTotal,
          winsA: thisWeekWinsA,
          winsB: thisWeekWinsB,
          draws: thisWeekDraws,
          sentence: weeklySentence,
        },
      },
      byGame,
      sudokuBestTimes,
      soloRecords,
      cricketRecords: {
        highestCompletedInnings,
        battingRuns: cricketBattingRuns,
        bowlingWickets: cricketBowlingWickets,
      },
    });
  }

  // GET /api/v1/records/recent
  if (
    (path === "/api/v1/records/recent" || path === "/api/records/recent") &&
    request.method === "GET"
  ) {
    const recent = (await env.DB.prepare(
      `SELECT r.matchId, r.gameId, r.mode, r.participants, r.winner, r.reason,
              r.scores, r.finishedAt, r.details, r.interrupted, m.createdAt AS startedAt
       FROM results r
       LEFT JOIN match_registry m ON m.matchId = r.matchId
       ORDER BY r.finishedAt DESC, r.matchId DESC
       LIMIT 20`,
    ).all()) as {
      results?: Array<{
        matchId: string;
        gameId: string;
        mode: string;
        participants: string;
        winner: string | null;
        reason: string;
        scores: string;
        finishedAt: number;
        details?: string | null;
        interrupted: number;
        startedAt?: number | null;
      }>;
    };

    const formatted = (recent.results ?? []).map((r) => {
      let parsedScores: Record<string, number> = { A: 0, B: 0 };
      let parsedParticipants: Record<string, unknown> = {};

      try {
        parsedScores = JSON.parse(r.scores);
      } catch {}

      try {
        parsedParticipants = JSON.parse(r.participants);
      } catch {}

      return {
        matchId: r.matchId,
        gameId: r.gameId,
        mode: r.mode,
        participants: parsedParticipants,
        winner: r.winner,
        winnerAccountId: winnerAccount(r.participants, r.winner),
        details: parseDetails(r.details),
        interrupted: r.interrupted === 1,
        reason: r.reason,
        scores: parsedScores,
        finishedAt: r.finishedAt,
        startedAt: r.startedAt ?? null,
      };
    });

    const sharedRecap = formatted
      .filter(
        (r) =>
          r.startedAt !== null &&
          r.mode !== "practice" &&
          r.details.scored !== false &&
          !(r.gameId === "sudoku" && r.mode === "duel" && r.interrupted) &&
          r.details.senderAttempt !== true &&
          (r.reason === "rules_win" || r.reason === "rules_draw" || r.reason === "resignation") &&
          hasBothAccounts(r.participants),
      )
      .slice(0, 5)
      .map(({ matchId, gameId, mode, winnerAccountId, reason, finishedAt }) => ({
        matchId,
        gameId,
        mode,
        winnerAccountId,
        reason,
        finishedAt,
      }));

    return jsonResponse({ recentMatches: formatted, sharedRecap });
  }

  return null;
}

function hasBothAccounts(participants: Record<string, unknown>): boolean {
  const account = (seat: string) => {
    const value = participants[seat];
    return typeof value === "string"
      ? value
      : value && typeof value === "object" && "accountId" in value
        ? value.accountId
        : null;
  };
  return [account("A"), account("B")].sort().join(",") === "A,B";
}

function parseDetails(raw?: string | null): Record<string, unknown> {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function winnerAccount(rawParticipants: string, seat: string | null): "A" | "B" | null {
  if (seat !== "A" && seat !== "B") return null;
  try {
    const participant = JSON.parse(rawParticipants)[seat];
    const account = typeof participant === "string" ? participant : participant?.accountId;
    return account === "A" || account === "B" ? account : seat;
  } catch {
    return seat;
  }
}
