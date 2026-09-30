import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { createMockDONamespace } from "./do-mock";
import { createSession } from "../../../worker/auth/session";
import { handleMatchesRequest } from "../../../worker/api/matches";
import { ErrorCode } from "../../../shared/protocol/errors";
import { ActionEnvelope } from "../../../shared/protocol/types";

describe("Match Authority & API Integration (B01)", () => {
  const CSRF_SECRET = "test-csrf-secret-key-32-bytes-long";
  let sqlite: DatabaseSync;
  let d1: D1Database;
  let matchDoNamespace: any;
  let env: any;

  let sessionA: { rawToken: string; csrfToken: string };
  let sessionB: { rawToken: string; csrfToken: string };

  function authHeaders(
    session: { rawToken: string; csrfToken: string },
    isMutating = false,
  ): HeadersInit {
    const headers: Record<string, string> = {
      Cookie: `arcade-session=${session.rawToken}`,
    };
    if (isMutating) {
      headers["Content-Type"] = "application/json";
      headers["x-csrf-token"] = session.csrfToken;
    }
    return headers;
  }

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    d1 = createMockD1Database(sqlite);

    // Run initial migration
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations", "0001_initial_schema.sql"),
      "utf8",
    );
    await d1.exec(migrationSql);

    // Seed Player A and Player B
    await d1
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily, preferenceVersion)
         VALUES ('A', 'player_a', 'Player A', 'dummy_hash', 'dummy_salt', 'teal', 'standard', 1)`,
      )
      .run();

    await d1
      .prepare(
        `INSERT INTO accounts (id, username, displayName, passwordHash, salt, accentFamily, paletteFamily, preferenceVersion)
         VALUES ('B', 'player_b', 'Player B', 'dummy_hash', 'dummy_salt', 'violet', 'romantic', 1)`,
      )
      .run();

    // Create sessions
    sessionA = await createSession(d1, "A", CSRF_SECRET);
    sessionB = await createSession(d1, "B", CSRF_SECRET);

    // Wire environment with DO Namespace
    env = {
      DB: d1,
      CSRF_SECRET,
      MATCH_DO: null,
    };
    matchDoNamespace = createMockDONamespace(() => env);
    env.MATCH_DO = matchDoNamespace;
  });

  describe("Match creation and slot reservation", () => {
    it("creates a new remote match and reserves slot in active_slots", async () => {
      const creationId = crypto.randomUUID();
      const req = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId,
          gameId: "connect-four",
          mode: "remote",
        }),
      });

      const res = await handleMatchesRequest(req, env);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(201);

      const data = (await res!.json()) as any;
      expect(data.matchId).toBeDefined();
      expect(data.gameId).toBe("connect-four");
      expect(data.mode).toBe("remote");
      expect(data.lifecycle).toBe("waiting");
      expect(data.view.participants.A.accountId).toBe("A");
      expect(data.view.participants.B.accountId).toBe("B");

      // Verify active slot in D1
      const slotRow = await d1
        .prepare("SELECT * FROM active_slots WHERE slotKey = ?")
        .bind("shared:connect-four:remote")
        .first<any>();
      expect(slotRow).not.toBeNull();
      expect(slotRow.matchId).toBe(data.matchId);
    });

    it("returns existing match idempotently if creationId is replayed", async () => {
      const creationId = crypto.randomUUID();
      const body = JSON.stringify({
        creationId,
        gameId: "connect-four",
        mode: "remote",
      });

      // 1st request
      const req1 = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body,
      });
      const res1 = await handleMatchesRequest(req1, env);
      expect(res1!.status).toBe(201);
      const data1 = (await res1!.json()) as any;

      // 2nd request (replay same creationId)
      const req2 = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body,
      });
      const res2 = await handleMatchesRequest(req2, env);
      expect(res2!.status).toBe(200);
      const data2 = (await res2!.json()) as any;

      expect(data2.matchId).toBe(data1.matchId);
      expect(data2.view.matchId).toBe(data1.matchId);
    });

    it("rejects match creation with SLOT_OCCUPIED if an active match already holds that slot", async () => {
      const creationId1 = crypto.randomUUID();
      const req1 = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: creationId1,
          gameId: "connect-four",
          mode: "remote",
        }),
      });
      const res1 = await handleMatchesRequest(req1, env);
      expect(res1!.status).toBe(201);
      const data1 = (await res1!.json()) as any;

      // Try creating another remote match for connect-four with different creationId
      const creationId2 = crypto.randomUUID();
      const req2 = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: creationId2,
          gameId: "connect-four",
          mode: "remote",
        }),
      });
      const res2 = await handleMatchesRequest(req2, env);
      expect(res2!.status).toBe(409);
      const data2 = (await res2!.json()) as any;
      expect(data2.code).toBe(ErrorCode.SLOT_OCCUPIED);
      expect(data2.existingMatchId).toBe(data1.matchId);
    });

    it("creates a together mode match and sets it active immediately", async () => {
      const creationId = crypto.randomUUID();
      const req = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId,
          gameId: "connect-four",
          mode: "together",
        }),
      });

      const res = await handleMatchesRequest(req, env);
      expect(res!.status).toBe(201);
      const data = (await res!.json()) as any;
      expect(data.mode).toBe("together");
      expect(data.lifecycle).toBe("active");
      expect(data.view.turnSeat).toBe("A");

      const slotRow = await d1
        .prepare("SELECT * FROM active_slots WHERE slotKey = ?")
        .bind("shared:connect-four:together")
        .first<any>();
      expect(slotRow.matchId).toBe(data.matchId);
    });
  });

  describe("Idempotent action delivery and receipts", () => {
    it("returns identical cached accepted reply when replaying same actionId", async () => {
      // 1. Create a together connect-four match (active immediately)
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "together",
        }),
      });
      const createRes = await handleMatchesRequest(createReq, env);
      const match = (await createRes!.json()) as any;
      const matchId = match.matchId;

      // 2. Post an action: connect-four.drop column 3
      const actionId = crypto.randomUUID();
      const envelope: ActionEnvelope = {
        protocolVersion: 1,
        matchId,
        actionId,
        action: "connect-four.drop",
        payload: { column: 3 },
      };

      const actionReq1 = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify(envelope),
      });
      const actionRes1 = await handleMatchesRequest(actionReq1, env);
      expect(actionRes1!.status).toBe(200);
      const reply1 = (await actionRes1!.json()) as any;
      expect(reply1.status).toBe("accepted");
      expect(reply1.actionId).toBe(actionId);
      expect(reply1.acceptedVersion).toBe(2);
      expect(reply1.eventId).toBeDefined();

      // 3. Replay exact same actionId and payload
      const actionReq2 = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify(envelope),
      });
      const actionRes2 = await handleMatchesRequest(actionReq2, env);
      expect(actionRes2!.status).toBe(200);
      const reply2 = (await actionRes2!.json()) as any;

      expect(reply2.status).toBe("accepted");
      expect(reply2.actionId).toBe(actionId);
      expect(reply2.acceptedVersion).toBe(reply1.acceptedVersion);
      expect(reply2.eventId).toBe(reply1.eventId);
      expect(reply2.serverTime).toBe(reply1.serverTime);

      // 4. Query receipt endpoint
      const receiptReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/receipts/${actionId}`,
        {
          method: "GET",
          headers: authHeaders(sessionA),
        },
      );
      const receiptRes = await handleMatchesRequest(receiptReq, env);
      expect(receiptRes!.status).toBe(200);
      const receiptData = (await receiptRes!.json()) as any;
      expect(receiptData.status).toBe("accepted");
      expect(receiptData.acceptedVersion).toBe(reply1.acceptedVersion);
      expect(receiptData.eventId).toBe(reply1.eventId);
      expect(receiptData.view).toBeDefined();
    });

    it("rejects with ID_REUSED when the same actionId is used with a different payload", async () => {
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "together",
        }),
      });
      const match = (await (await handleMatchesRequest(createReq, env))!.json()) as any;
      const matchId = match.matchId;

      const actionId = crypto.randomUUID();

      // Drop in column 3
      const req1 = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId,
          action: "connect-four.drop",
          payload: { column: 3 },
        }),
      });
      const res1 = await handleMatchesRequest(req1, env);
      const reply1 = (await res1!.json()) as any;
      expect(reply1.status).toBe("accepted");

      // Same actionId, different column (4)
      const req2 = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId,
          action: "connect-four.drop",
          payload: { column: 4 },
        }),
      });
      const res2 = await handleMatchesRequest(req2, env);
      const reply2 = (await res2!.json()) as any;
      expect(reply2.status).toBe("rejected");
      expect(reply2.code).toBe(ErrorCode.ID_REUSED);
      expect(reply2.retryable).toBe(false);
    });
  });

  describe("Out-of-turn moves & turn enforcement", () => {
    it("rejects out-of-turn moves with NOT_YOUR_TURN in remote mode", async () => {
      // 1. Create remote match
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "remote",
        }),
      });
      const match = (await (await handleMatchesRequest(createReq, env))!.json()) as any;
      const matchId = match.matchId;

      // 2. Player B accepts invitation
      const acceptReq = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionB, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId: crypto.randomUUID(),
          action: "match.accept",
          payload: {},
        }),
      });
      const acceptRes = await handleMatchesRequest(acceptReq, env);
      const acceptReply = (await acceptRes!.json()) as any;
      expect(acceptReply.status).toBe("accepted");
      expect(acceptReply.view.lifecycle).toBe("active");
      expect(acceptReply.view.turnSeat).toBe("A");

      // 3. Player B attempts to make a move when it is Player A's turn
      const dropBReq = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionB, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId: crypto.randomUUID(),
          action: "connect-four.drop",
          payload: { column: 2 },
        }),
      });
      const dropBRes = await handleMatchesRequest(dropBReq, env);
      const dropBReply = (await dropBRes!.json()) as any;
      expect(dropBReply.status).toBe("rejected");
      expect(dropBReply.code).toBe(ErrorCode.NOT_YOUR_TURN);
      expect(dropBReply.retryable).toBe(true);

      // 4. Player A makes valid move
      const dropAReq = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId: crypto.randomUUID(),
          action: "connect-four.drop",
          payload: { column: 2 },
        }),
      });
      const dropARes = await handleMatchesRequest(dropAReq, env);
      const dropAReply = (await dropARes!.json()) as any;
      expect(dropAReply.status).toBe("accepted");
      expect(dropAReply.view.turnSeat).toBe("B");
    });
  });

  describe("Connect Four game engine rules, gravity, and win detection", () => {
    it("simulates full Connect Four game to vertical win, checks gravity, terminal result, and slot release", async () => {
      // 1. Create active together match
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "together",
        }),
      });
      const match = (await (await handleMatchesRequest(createReq, env))!.json()) as any;
      const matchId = match.matchId;

      // Play vertical line in column 0 for A (rows 5, 4, 3, 2)
      // B plays in column 1 (rows 5, 4, 3)
      const moves = [
        { col: 0, expectedRow: 5, expectedTurnSeat: "B" }, // A
        { col: 1, expectedRow: 5, expectedTurnSeat: "A" }, // B
        { col: 0, expectedRow: 4, expectedTurnSeat: "B" }, // A
        { col: 1, expectedRow: 4, expectedTurnSeat: "A" }, // B
        { col: 0, expectedRow: 3, expectedTurnSeat: "B" }, // A
        { col: 1, expectedRow: 3, expectedTurnSeat: "A" }, // B
        { col: 0, expectedRow: 2, expectedWin: true }, // A wins with 4th disc
      ];

      let lastReply: any;
      for (const m of moves) {
        const req = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({
            protocolVersion: 1,
            matchId,
            actionId: crypto.randomUUID(),
            action: "connect-four.drop",
            payload: { column: m.col },
          }),
        });
        const res = await handleMatchesRequest(req, env);
        lastReply = (await res!.json()) as any;
        expect(lastReply.status).toBe("accepted");

        if (m.expectedWin) {
          expect(lastReply.view.lifecycle).toBe("completed");
          expect(lastReply.view.result).toBeDefined();
          expect(lastReply.view.result.winner).toBe("A");
          expect(lastReply.view.result.reason).toBe("rules_win");
          expect(lastReply.view.result.scores.A).toBe(1);
          expect(lastReply.view.result.scores.B).toBe(0);
        } else {
          expect(lastReply.view.turnSeat).toBe(m.expectedTurnSeat);
        }
      }

      // Verify board state: column 0 has discs in rows 5, 4, 3, 2
      const board = lastReply.view.gameState.board;
      expect(board[5][0]).toBe("A");
      expect(board[4][0]).toBe("A");
      expect(board[3][0]).toBe("A");
      expect(board[2][0]).toBe("A");

      // Verify gravity: column 1 has discs in rows 5, 4, 3
      expect(board[5][1]).toBe("B");
      expect(board[4][1]).toBe("B");
      expect(board[3][1]).toBe("B");
      expect(board[2][1]).toBeNull();

      // Subsequent move on completed match must be rejected with MATCH_FINISHED
      const postFinishReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/actions`,
        {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({
            protocolVersion: 1,
            matchId,
            actionId: crypto.randomUUID(),
            action: "connect-four.drop",
            payload: { column: 3 },
          }),
        },
      );
      const postFinishRes = await handleMatchesRequest(postFinishReq, env);
      const postFinishReply = (await postFinishRes!.json()) as any;
      expect(postFinishReply.status).toBe("rejected");
      expect(postFinishReply.code).toBe(ErrorCode.MATCH_FINISHED);

      // Verify slot in active_slots was released after completion projection
      const slotAfter = await d1
        .prepare("SELECT * FROM active_slots WHERE matchId = ?")
        .bind(matchId)
        .first();
      expect(slotAfter).toBeNull();

      // Verify results table in D1 has terminal record
      const resultRow = await d1
        .prepare("SELECT * FROM results WHERE matchId = ?")
        .bind(matchId)
        .first<any>();
      expect(resultRow).not.toBeNull();
      expect(resultRow.winner).toBe("A");
      expect(resultRow.reason).toBe("rules_win");
    });
  });

  describe("Controller takeover and generation checks", () => {
    it("increments controller generation and rejects moves with old controller generation", async () => {
      // 1. Create together match
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "together",
        }),
      });
      const match = (await (await handleMatchesRequest(createReq, env))!.json()) as any;
      const matchId = match.matchId;
      expect(match.view.controller.controllerGeneration).toBe(1);

      // 2. Perform takeover
      const takeoverReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/controller`,
        {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({ expectedControllerGeneration: 1 }),
        },
      );
      const takeoverRes = await handleMatchesRequest(takeoverReq, env);
      expect(takeoverRes!.status).toBe(200);
      const takeoverData = (await takeoverRes!.json()) as any;
      expect(takeoverData.success).toBe(true);
      expect(takeoverData.controllerGeneration).toBe(2);

      // 3. Post action with old controller generation 1 -> must reject with CONTROL_TRANSFERRED
      const staleActionReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/actions`,
        {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({
            protocolVersion: 1,
            matchId,
            actionId: crypto.randomUUID(),
            action: "connect-four.drop",
            payload: { column: 0 },
            controllerGeneration: 1,
          }),
        },
      );
      const staleRes = await handleMatchesRequest(staleActionReq, env);
      const staleReply = (await staleRes!.json()) as any;
      expect(staleReply.status).toBe("rejected");
      expect(staleReply.code).toBe(ErrorCode.CONTROL_TRANSFERRED);

      // 4. Post action with new controller generation 2 -> accepted
      const validActionReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/actions`,
        {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({
            protocolVersion: 1,
            matchId,
            actionId: crypto.randomUUID(),
            action: "connect-four.drop",
            payload: { column: 0 },
            controllerGeneration: 2,
          }),
        },
      );
      const validRes = await handleMatchesRequest(validActionReq, env);
      const validReply = (await validRes!.json()) as any;
      expect(validReply.status).toBe("accepted");
    });
  });

  describe("Refresh and recovery", () => {
    it("fetches snapshot accurately and handles secret-recovery superseding", async () => {
      // 1. Create together match and drop one disc
      const createReq = new Request("https://arcade.internal/api/v1/matches", {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          creationId: crypto.randomUUID(),
          gameId: "connect-four",
          mode: "together",
        }),
      });
      const match = (await (await handleMatchesRequest(createReq, env))!.json()) as any;
      const matchId = match.matchId;

      await handleMatchesRequest(
        new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({
            protocolVersion: 1,
            matchId,
            actionId: crypto.randomUUID(),
            action: "connect-four.drop",
            payload: { column: 3 },
          }),
        }),
        env,
      );

      // 2. Fetch snapshot via GET /matches/:id
      const viewReq = new Request(`https://arcade.internal/api/v1/matches/${matchId}`, {
        method: "GET",
        headers: authHeaders(sessionA),
      });
      const viewRes = await handleMatchesRequest(viewReq, env);
      expect(viewRes!.status).toBe(200);
      const snapshotView = (await viewRes!.json()) as any;
      expect(snapshotView.deliveryVersion).toBe(2);
      expect(snapshotView.turnSeat).toBe("B");
      expect(snapshotView.gameState.board[5][3]).toBe("A");

      // 3. Secret-recovery endpoint: supersede an unaccepted pending action ID
      const pendingId = crypto.randomUUID();
      const recReq = new Request(
        `https://arcade.internal/api/v1/matches/${matchId}/secret-recovery`,
        {
          method: "POST",
          headers: authHeaders(sessionA, true),
          body: JSON.stringify({ pendingActionId: pendingId }),
        },
      );
      const recRes = await handleMatchesRequest(recReq, env);
      expect(recRes!.status).toBe(200);
      const recData = (await recRes!.json()) as any;
      expect(recData.status).toBe("superseded");
      expect(recData.locked).toBe(false);

      // 4. If that pending action ID later arrives, it must be rejected with ACTION_SUPERSEDED
      const lateReq = new Request(`https://arcade.internal/api/v1/matches/${matchId}/actions`, {
        method: "POST",
        headers: authHeaders(sessionA, true),
        body: JSON.stringify({
          protocolVersion: 1,
          matchId,
          actionId: pendingId,
          action: "connect-four.drop",
          payload: { column: 4 },
        }),
      });
      const lateRes = await handleMatchesRequest(lateReq, env);
      const lateReply = (await lateRes!.json()) as any;
      expect(lateReply.status).toBe("rejected");
      expect(lateReply.code).toBe(ErrorCode.ACTION_SUPERSEDED);
    });
  });
});
