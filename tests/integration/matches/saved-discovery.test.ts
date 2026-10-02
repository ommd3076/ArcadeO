import { it, expect } from "vitest";
import { apiFixture } from "./api-fixture";

it("keeps an old saved match discoverable beyond the recent history limit", async () => {
  const f = await apiFixture();
  try {
    const first = await f.create();
    expect(first.response.status).toBe(201);
    f.sqlite
      .prepare("UPDATE match_registry SET lifecycle='saved', lastActionAt=0 WHERE matchId=?")
      .run(first.match.matchId);
    const insert = f.sqlite.prepare(`
      INSERT INTO match_registry (
        matchId, creationId, creatorAccountId, gameId, mode, participants,
        doName, initializationState, lifecycle, deliveryVersion, createdAt, lastActionAt
      ) SELECT ?, ?, creatorAccountId, gameId, mode, participants,
        ?, 'ready', 'completed', 9, ?, ? FROM match_registry WHERE matchId=?
    `);
    for (let i = 0; i < 80; i++) {
      insert.run(
        `history-${i}`,
        crypto.randomUUID(),
        `history-${i}`,
        i + 1,
        i + 1,
        first.match.matchId,
      );
    }
    const response = await f.request("");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      matches: Array<{ matchId: string; lifecycle: string }>;
    };
    expect(body.matches).toHaveLength(50);
    expect(body.matches[0]).toMatchObject({ matchId: first.match.matchId, lifecycle: "saved" });
  } finally {
    f.sqlite.close();
  }
});
