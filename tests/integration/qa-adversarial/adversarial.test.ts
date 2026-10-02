import { describe, it, expect } from "vitest";
import { apiFixture } from "../matches/api-fixture";

describe("adversarial API guards and privacy (SQLite adapters)", () => {
  it("keeps both remote same-round locks valid despite delivery version change", async () => {
    const f = await apiFixture();
    const { match } = await f.create("remote", "rock-paper-scissors");
    await f.action(match.matchId, "match.accept", "B");
    await f.action(match.matchId, "match.ready", "A");
    await f.action(match.matchId, "match.ready", "B");
    const make = (choice: string) => ({
      protocolVersion: 1,
      matchId: match.matchId,
      actionId: crypto.randomUUID(),
      action: "secret.lock",
      payload: { choice },
      roundId: 1,
      expectedVersion: 4,
    });
    const replies = await Promise.all([
      f.request(`/${match.matchId}/actions`, "A", make("rock")),
      f.request(`/${match.matchId}/actions`, "B", make("paper")),
    ]);
    const data = await Promise.all(replies.map((reply) => reply.json() as Promise<any>));
    expect(data.map((reply) => reply.status)).toEqual(["accepted", "accepted"]);
    expect(JSON.stringify(data[0])).not.toContain('"paper"');
    expect(data[1].view.gameState.roundResult.choices).toEqual({ A: "rock", B: "paper" });
  });
  it("masks together resolution and effects until persisted reveal, including duplicate receipts", async () => {
    const f = await apiFixture();
    const { match } = await f.create("together", "rock-paper-scissors");
    const first = await f.action(match.matchId, "secret.lock", "A", { choice: "rock" });
    expect(first.reply.view.turnSeat).toBe("B");
    expect(first.reply.view.legalActions).toContain("secret.lock");
    const second = await f.action(match.matchId, "secret.lock", "A", { choice: "paper" });
    expect(second.reply.view.gameState.roundResult).toBeNull();
    expect(second.reply.effects).toEqual([]);
    const replay = (await (
      await f.request(`/${match.matchId}/actions`, "A", second.envelope)
    ).json()) as any;
    expect(replay.effects).toEqual([]);
    expect(JSON.stringify(replay)).not.toContain('"paper"');
    const revealed = await f.action(match.matchId, "secret.reveal");
    expect(revealed.reply.view.gameState.roundResult.choices).toEqual({ A: "rock", B: "paper" });
  });
  it("binds controller takeover to session and rejects old generation, then freezes terminal control", async () => {
    const f = await apiFixture();
    const { match } = await f.create();
    const takeover = (await (
      await f.request(`/${match.matchId}/controller`, "A", { expectedControllerGeneration: 1 })
    ).json()) as any;
    expect(takeover.controllerGeneration).toBe(2);
    expect(
      (
        await f.action(
          match.matchId,
          "connect-four.drop",
          "A",
          { column: 0 },
          { controllerGeneration: 1 },
        )
      ).reply.code,
    ).toBe("CONTROL_TRANSFERRED");
    await f.action(match.matchId, "match.resign", "A", { resigningSeat: "B" });
    expect(
      (await f.request(`/${match.matchId}/controller`, "A", { expectedControllerGeneration: 2 }))
        .status,
    ).toBe(400);
  });
  it("retries failed projection by alarm without undoing saved acceptance", async () => {
    const f = await apiFixture();
    const { match } = await f.create();
    const authority = f.namespace._instances.get(match.matchId)!.do;
    const originalPrepare = f.env.DB.prepare;
    f.env.DB.prepare = () => {
      throw new Error("projection failure");
    };
    // Direct serialized path has auth store too: allow session reads, fail projection writes only.
    f.env.DB.prepare = (query: string) =>
      query.startsWith("SELECT accountId")
        ? originalPrepare.call(f.env.DB, query)
        : (() => {
            throw new Error("projection failure");
          })();
    const reply = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: match.matchId,
        actionId: crypto.randomUUID(),
        action: "connect-four.drop",
        payload: { column: 0 },
        expectedVersion: 1,
        turnId: 1,
        controllerGeneration: 1,
      },
      "A",
      f.sessions.A.sessionId,
    );
    expect(reply.status).toBe("accepted");
    await authority.flushProjectionOutbox();
    expect(authority.getSnapshot()?.deliveryVersion).toBe(2);
    f.env.DB.prepare = originalPrepare;
    const storage = f.namespace._instances.get(match.matchId)!.sqlite;
    storage.exec("UPDATE projection_outbox SET nextAttemptAt=0");
    await authority.alarm();
    expect(storage.prepare("SELECT COUNT(*) AS n FROM projection_outbox").get()?.n).toBe(0);
  });
  it("keeps a winning together secret outcome immutable before Reveal", async () => {
    const f = await apiFixture();
    const { match } = await f.create("together", "rock-paper-scissors");
    for (let round = 0; round < 2; round++) {
      await f.action(match.matchId, "secret.lock", "A", {
        choice: round === 0 ? "rock" : "scissors",
      });
      await f.action(match.matchId, "secret.lock", "A", {
        choice: round === 0 ? "scissors" : "rock",
      });
      if (round === 0) {
        await f.action(match.matchId, "secret.reveal");
        await f.action(match.matchId, "secret.next");
      }
    }
    const resigned = await f.action(match.matchId, "match.resign", "A", { resigningSeat: "A" });
    expect(resigned.reply.code).toBe("MATCH_FINISHED");
    const revealed = await f.action(match.matchId, "secret.reveal");
    expect(revealed.reply.view.lifecycle).toBe("completed");
    expect(revealed.reply.view.result.winner).toBe("A");
  });
  it("recovers a durable receipt after controller transfer without repeating effects", async () => {
    const f = await apiFixture();
    const { match } = await f.create();
    const accepted = await f.action(match.matchId, "connect-four.drop", "A", { column: 0 });
    await f.request(`/${match.matchId}/controller`, "B", { expectedControllerGeneration: 1 });
    const receipt = (await (
      await f.request(`/${match.matchId}/actions`, "A", accepted.envelope)
    ).json()) as any;
    expect(receipt.status).toBe("accepted");
    expect(receipt.eventId).toBe(accepted.reply.eventId);
    expect(receipt.view.deliveryVersion).toBe(3);
  });
  it("retains a newer outbox revision replaced during a slow older projection", async () => {
    const f = await apiFixture();
    const { match } = await f.create();
    const item = f.namespace._instances.get(match.matchId)!;
    const authority = item.do;
    await authority.flushProjectionOutbox();
    const snapshot = authority.getSnapshot()!;
    const key = `proj_${match.matchId}_1`;
    item.sqlite.prepare("INSERT INTO projection_outbox VALUES(?,?,?,0,0)").run(
      key,
      1,
      JSON.stringify({
        matchId: match.matchId,
        deliveryVersion: 1,
        lifecycle: "active",
        result: null,
        finishedAt: null,
        lastActionAt: Date.now(),
      }),
    );
    const originalPrepare = f.env.DB.prepare;
    let unblock!: () => void;
    let announce!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      announce = resolve;
    });
    f.env.DB.prepare = (query: string) => {
      const statement = originalPrepare.call(f.env.DB, query);
      if (!query.startsWith("UPDATE match_registry")) return statement;
      return {
        bind: (...bindings: unknown[]) => ({
          run: async () => {
            announce();
            await blocked;
            return statement.bind(...bindings).run();
          },
        }),
      };
    };
    const savedFlush = authority.flushProjectionOutbox.bind(authority);
    const flushing = savedFlush();
    await reached;
    authority.flushProjectionOutbox = async () => {};
    const accepted = await authority.handleAction(
      {
        protocolVersion: 1,
        matchId: match.matchId,
        actionId: crypto.randomUUID(),
        action: "connect-four.drop",
        payload: { column: 0 },
        expectedVersion: snapshot.deliveryVersion,
        turnId: 1,
        controllerGeneration: 1,
      },
      "A",
      f.sessions.A.sessionId,
    );
    expect(accepted.status).toBe("accepted");
    // Simulate retaining latest projection under an existing key during its await.
    item.sqlite
      .prepare("UPDATE projection_outbox SET requiredVersion=2 WHERE projectionKey=?")
      .run(key);
    unblock();
    await flushing;
    f.env.DB.prepare = originalPrepare;
    authority.flushProjectionOutbox = savedFlush;
    expect(
      item.sqlite
        .prepare("SELECT requiredVersion FROM projection_outbox WHERE projectionKey=?")
        .get(key)?.requiredVersion,
    ).toBe(2);
  });
});
