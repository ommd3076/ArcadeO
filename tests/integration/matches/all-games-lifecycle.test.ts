import { apiFixture } from "./api-fixture";
import { describe, it, expect, beforeEach } from "vitest";
import { getPuzzleById } from "../../../worker/sudoku/catalog";
import { getPrivateSolution } from "../../../worker/sudoku/verification";
import { getAllRegisteredGameIds, getGameEngine } from "../../../shared/games/registry";
import { ARCADE_GAMES, handleCatalogRequest } from "../../../worker/api/catalog";
import { handleChallengesRequest } from "../../../worker/api/challenges";
import { deriveSlotKey } from "../../../worker/api/matches";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";

describe("All Eight Games Engine Integration & Worker Lifecycle (Task B02)", () => {
  let sqlite: DatabaseSync;
  let db: D1Database;

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    db = createMockD1Database(sqlite);

    const schemaSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
      "utf8",
    );
    await db.exec(schemaSql);

    // Insert accounts
    await db
      .prepare(
        "INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "A",
        "player_a",
        "Player A",
        "hashA",
        "saltA",
        "PBKDF2-SHA256:600000",
        "teal",
        "standard",
      )
      .run();

    await db
      .prepare(
        "INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "B",
        "player_b",
        "Player B",
        "hashB",
        "saltB",
        "PBKDF2-SHA256:600000",
        "violet",
        "romantic",
      )
      .run();
  });

  it("verifies all eight game engines are registered in shared registry", () => {
    const registeredIds = getAllRegisteredGameIds();
    const expectedGames = [
      "connect-four",
      "rock-paper-scissors",
      "ludo",
      "snakes-and-ladders",
      "dots-boxes",
      "sos",
      "hand-cricket",
      "sudoku",
    ];

    expect(registeredIds.length).toBe(8);
    for (const id of expectedGames) {
      expect(registeredIds).toContain(id);
      const engine = getGameEngine(id as any);
      expect(engine).toBeDefined();
      expect(engine?.gameId).toBe(id);

      // Verify createInitialState
      const initial = engine?.createInitialState({
        serverTime: Date.now(),
        startingSeat: "A",
        config:
          id === "sudoku"
            ? {
                puzzleId: "easy-001",
                givens: getPuzzleById("easy-001")!.givens,
                solution: getPrivateSolution("easy-001"),
              }
            : undefined,
      });
      expect(initial).toBeDefined();
    }
  });

  it("verifies catalog API returns all eight games metadata and 1,000 Sudoku puzzles", async () => {
    // 1. /api/v1/games
    const gamesReq = new Request("http://localhost/api/v1/games");
    const gamesRes = await handleCatalogRequest(gamesReq);
    expect(gamesRes).not.toBeNull();
    expect(gamesRes?.status).toBe(200);

    const gamesData = (await gamesRes?.json()) as { games: typeof ARCADE_GAMES };
    expect(gamesData.games.length).toBe(8);
    expect(gamesData.games.map((g) => g.id)).toEqual([
      "connect-four",
      "rock-paper-scissors",
      "ludo",
      "snakes-and-ladders",
      "dots-boxes",
      "sos",
      "hand-cricket",
      "sudoku",
    ]);

    // 2. /api/v1/sudoku/catalog (all buckets)
    const catalogReq = new Request("http://localhost/api/v1/sudoku/catalog?limit=250");
    const catalogRes = await handleCatalogRequest(catalogReq);
    expect(catalogRes).not.toBeNull();
    const catalogData = (await catalogRes?.json()) as { total: number; puzzles: unknown[] };
    expect(catalogData.total).toBe(1000);
    expect(catalogData.puzzles.length).toBe(250);
    expect(JSON.stringify(catalogData)).not.toContain("givens");
    expect(JSON.stringify(catalogData)).not.toContain("solution");

    // 3. /api/v1/sudoku/catalog?bucket=expert
    const expertReq = new Request("http://localhost/api/v1/sudoku/catalog?bucket=expert&limit=50");
    const expertRes = await handleCatalogRequest(expertReq);
    const expertData = (await expertRes?.json()) as {
      total: number;
      puzzles: Array<{ bucket: string }>;
    };
    expect(expertData.total).toBe(250);
    expect(expertData.puzzles.length).toBe(50);
    expect(expertData.puzzles.every((p) => p.bucket === "expert")).toBe(true);

    // 4. /api/v1/sudoku/catalog?random=true
    const randomReq = new Request("http://localhost/api/v1/sudoku/catalog?random=true");
    const randomRes = await handleCatalogRequest(randomReq);
    const randomData = (await randomRes?.json()) as {
      puzzle: { puzzleId: string; givens: string };
    };
    expect(randomData.puzzle).toBeDefined();
    expect(randomData.puzzle.puzzleId).toBeTruthy();
    expect(randomData.puzzle).not.toHaveProperty("givens");
  });

  it("derives slot keys correctly for all shared and Sudoku modes", () => {
    // Shared games: shared:<game>:<mode>
    expect(deriveSlotKey("connect-four", "remote", "A")).toBe("shared:connect-four:remote");
    expect(deriveSlotKey("rock-paper-scissors", "together", "A")).toBe(
      "shared:rock-paper-scissors:together",
    );
    expect(deriveSlotKey("ludo", "remote", "B")).toBe("shared:ludo:remote");
    expect(deriveSlotKey("snakes-and-ladders", "together", "B")).toBe(
      "shared:snakes-and-ladders:together",
    );
    expect(deriveSlotKey("dots-boxes", "remote", "A")).toBe("shared:dots-boxes:remote");
    expect(deriveSlotKey("sos", "together", "A")).toBe("shared:sos:together");
    expect(deriveSlotKey("hand-cricket", "remote", "B")).toBe("shared:hand-cricket:remote");

    // Sudoku modes
    expect(deriveSlotKey("sudoku", "practice", "A")).toBe("sudoku:practice:A");
    expect(deriveSlotKey("sudoku", "duel", "A")).toBe("sudoku:duel");
    expect(deriveSlotKey("sudoku", "challenge", "A", "B")).toBe("sudoku:sender:A");
  });

  it("publishes only a completed authority-owned sender attempt and discovers the receiver match", async () => {
    const f = await apiFixture();
    const { match } = await f.create("challenge", "sudoku", crypto.randomUUID(), "A", {
      puzzleId: "easy-001",
    });
    const authority = f.namespace._instances.get(match.matchId)!;
    const state = authority.do.getSnapshot()!.gameState as any;
    // Restore an accepted completed source fixture; no D1 result is trusted by publishing.
    state.players.A.completedAt = Date.now();
    state.players.A.elapsedMs = 145000;
    state.senderElapsedMs = 145000;
    authority.sqlite.prepare("UPDATE match_snapshot SET gameState = ?").run(JSON.stringify(state));
    const body = { creationId: crypto.randomUUID(), senderAttemptId: match.matchId };
    const publishReq = () =>
      new Request("https://arcade.internal/api/v1/challenges", {
        method: "POST",
        headers: {
          Cookie: `__Host-arcade-session=${f.sessions.A.rawToken}`,
          Origin: f.env.ALLOWED_ORIGIN,
          "x-csrf-token": f.sessions.A.csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const published = await handleChallengesRequest(publishReq(), f.env);
    expect(published?.status).toBe(201);
    const data = (await published!.json()) as any;
    const again = await handleChallengesRequest(publishReq(), f.env);
    expect(again?.status).toBe(200);
    expect(((await again!.json()) as any).challengeId).toBe(data.challengeId);
    const list = (await (await f.request("", "B")).json()) as any;
    expect(
      list.matches.some(
        (row: any) => row.matchId === data.challengeId && row.lifecycle === "waiting",
      ),
    ).toBe(true);
    const accepted = await f.action(data.challengeId, "match.accept", "B");
    expect(accepted.reply.status).toBe("accepted");
    expect(accepted.reply.view.lifecycle).toBe("active");
    expect(accepted.reply.view.gameState.challenge.accepted).toBe(true);
  });
});
