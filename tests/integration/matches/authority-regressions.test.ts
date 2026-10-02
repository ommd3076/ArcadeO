import { createMockD1Database } from "../auth/d1-mock";
import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createMockDOStorage } from "./do-mock";
import { MatchDurableObject } from "../../../worker/matches/match-do";
import type { ActionEnvelope } from "../../../shared/protocol/types";

async function fixture(
  gameId: "connect-four" | "rock-paper-scissors" = "connect-four",
  mode: "remote" | "together" = "together",
) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE sessions(sessionId TEXT PRIMARY KEY, accountId TEXT, expiresAt INTEGER, revokedAt INTEGER)",
  );
  db.prepare("INSERT INTO sessions VALUES(?,?,?,NULL)").run("unit-A", "A", Date.now() + 60000);
  const authority = new MatchDurableObject({ storage: createMockDOStorage(db) } as any, {
    DB: createMockD1Database(db),
  });
  await authority.initializeMatch({
    matchId: "match",
    gameId,
    mode,
    creatorAccountId: "A",
    participants: {
      A: { accountId: "A", displayName: "A", ready: true },
      B: { accountId: "B", displayName: "B", ready: true },
    },
  });
  const action = (column: number, actionId = crypto.randomUUID()): ActionEnvelope => ({
    protocolVersion: 1,
    matchId: "match",
    actionId,
    action: "connect-four.drop",
    payload: { column },
    expectedVersion: 1,
    turnId: 1,
    controllerGeneration: 1,
  });
  return { authority, db, action };
}

describe("serialized authority regressions (SQLite adapter, not Workers runtime)", () => {
  it("allows only one simultaneous turn consumption", async () => {
    const { authority, db, action } = await fixture();
    const replies = await Promise.all([
      authority.handleAction(action(0), "A", "unit-A"),
      authority.handleAction(action(1), "A", "unit-A"),
    ]);
    expect(replies.filter((reply) => reply.status === "accepted")).toHaveLength(1);
    expect(authority.getSnapshot()?.deliveryVersion).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(1);
  });
  it("returns original identity once for simultaneous identical retries", async () => {
    const { authority, db, action } = await fixture();
    const envelope = action(0);
    const replies = await Promise.all([
      authority.handleAction(envelope, "A", "unit-A"),
      authority.handleAction(envelope, "A", "unit-A"),
    ]);
    expect(replies.map((reply) => reply.status)).toEqual(["accepted", "accepted"]);
    expect((replies[0] as any).eventId).toBe((replies[1] as any).eventId);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(1);
  });
  it("rejects missing/future controller and nonmembers without exposing a view", async () => {
    const { authority, action } = await fixture();
    expect(
      (
        (await authority.handleAction(
          { ...action(0), controllerGeneration: undefined },
          "A",
          "unit-A",
        )) as any
      ).code,
    ).toBe("CONTROL_TRANSFERRED");
    expect(
      (
        (await authority.handleAction(
          { ...action(0), controllerGeneration: 99 },
          "A",
          "unit-A",
        )) as any
      ).code,
    ).toBe("CONTROL_TRANSFERRED");
    const other = await authority.handleAction(action(0), "C" as any, "unit-A");
    expect((other as any).latestView).toBeUndefined();
  });
  it("recovery tombstones serialize against a delayed secret submission", async () => {
    const { authority, db } = await fixture("rock-paper-scissors");
    const actionId = crypto.randomUUID();
    await authority.handleSecretRecovery(actionId, "A", 1, "unit-A", 1);
    const reply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: "match",
        actionId,
        action: "secret.lock",
        payload: { choice: "rock" },
        roundId: 1,
        controllerGeneration: 1,
      },
      "A",
      "unit-A",
    );
    expect((reply as any).code).toBe("ACTION_SUPERSEDED");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
  });
  it("rolls back all accepted artifacts when a related write fails", async () => {
    const { authority, db, action } = await fixture();
    db.exec(
      "CREATE TRIGGER abort_receipt BEFORE INSERT ON action_receipts BEGIN SELECT RAISE(ABORT, 'fault'); END;",
    );
    await expect(authority.handleAction(action(0), "A", "unit-A")).rejects.toThrow();
    expect(authority.getSnapshot()?.deliveryVersion).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
  });
});
