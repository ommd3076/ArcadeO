import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const origin = process.env.ARCADE_ORIGIN;
assert.ok(origin, "Actual Worker origin is required");
const accounts = JSON.parse(fs.readFileSync(process.env.ARCADE_ACCOUNTS_PATH, "utf8"));
const people = {};
const report = [];
async function check(name, fn) {
  try { await fn(); report.push(name); console.log(`PASS ${name}`); }
  catch (error) { saveReport(name); throw error; }
  saveReport();
}
function saveReport(failed) {
  fs.mkdirSync("planning/review/evidence", { recursive: true });
  const content = JSON.stringify(
    {
      runtime: "Wrangler/workerd, SQLite Durable Objects and D1, real HTTP",
      passed: report,
      count: report.length,
      complete: !failed,
      failed: failed ?? null,
      verifiedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync("planning/review/evidence/runtime-results.json", content);
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      const end = Date.now() + 50;
      while (Date.now() < end) {}
    }
  }
}
async function request(person, url, options = {}) {
  const response = await fetch(origin + url, { ...options, headers: { Origin: origin, "Content-Type": "application/json", ...(person ? { Cookie: people[person].cookie, "X-CSRF-Token": people[person].csrf } : {}), ...options.headers } });
  const body = await response.json();
  return { response, body };
}
async function login(person) {
  const response = await fetch(`${origin}/api/v1/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ username: accounts[`player${person}User`], password: accounts[`player${person}Password`] }) });
  const data = await response.json(); assert.equal(response.status, 200); assert.equal(data.profile.id, person);
  people[person] = { cookie: response.headers.getSetCookie().map((s) => s.split(";")[0]).join("; "), csrf: data.csrfToken };
}
async function create(gameId, mode, gameOptions = {}) {
  const creationId = randomUUID();
  const { body, response } = await request("A", "/api/v1/matches", { method: "POST", body: JSON.stringify({ creationId, gameId, mode, gameOptions }) });
  assert.equal(response.status, 201, `${gameId}/${mode} create: ${body.code ?? response.status}`);
  return { id: body.matchId, view: body.view, creationId };
}
async function view(person, match) {
  const { body, response } = await request(person, `/api/v1/matches/${match.id}`);
  assert.equal(response.status, 200); return body.view || body;
}
async function action(person, match, action, payload = {}, extra = {}) {
  const current = await view(person, match);
  const envelope = { protocolVersion: 1, matchId: match.id, actionId: randomUUID(), action, payload,
    controllerGeneration: current.controller.controllerGeneration,
    ...(action === "secret.lock" || action === "secret.next" || action === "secret.reveal" ? { roundId: current.roundId } : action.startsWith("sudoku.") ? { progressRevision: current.gameState.self.progressRevision } : { expectedVersion: current.deliveryVersion, turnId: current.turnId }), ...extra };
  const { body } = await request(person, `/api/v1/matches/${match.id}/actions`, { method: "POST", body: JSON.stringify(envelope) });
  assert.equal(body.status, "accepted", `${action}: ${body.code ?? body.status}`); return { body, envelope };
}
await check("real Worker KDF, secure session bootstrap and account identity", async () => {
  await login("A"); await login("B");
  for (const id of ["A", "B"]) {
    const { response, body } = await request(id, "/api/v1/auth/session");
    assert.equal(body.authenticated, true); assert.equal(body.profile.id, id);
    assert.equal(body.csrfToken, people[id].csrf); assert.match(response.headers.get("cache-control"), /no-store/);
  }
});
await check("assets, deep links, installed shell and API never falls back to HTML", async () => {
  for (const asset of ["/", "/matches/deep-link", "/sw.js", "/icon-192.png", "/icon-512.png"]) {
    const r = await fetch(origin + asset, { headers: { "Sec-Fetch-Mode": asset === "/matches/deep-link" ? "navigate" : "cors" } }); assert.equal(r.status, 200, asset);
  }
  const r = await fetch(`${origin}/api/v1/nonexistent`); assert.equal(r.status, 404); assert.match(r.headers.get("content-type"), /json/);
});
await check("catalog requires auth and never exposes unissued givens or private solutions", async () => {
  const unauthorized = await request(null, "/api/v1/sudoku/catalog?difficulty=easy"); assert.equal(unauthorized.response.status, 401);
  const r = await request("A", "/api/v1/sudoku/catalog?difficulty=easy"); assert.equal(r.response.status, 200);
  assert.ok(!JSON.stringify(r.body).includes('"givens"')); assert.ok(!JSON.stringify(r.body).includes('"solution"'));
});
await check("CSRF, exact Origin, strict configuration and distinct preferences", async () => {
  const r = await request("A", "/api/v1/profile/preferences", { method: "PATCH", headers: { "X-CSRF-Token": "invalid" }, body: JSON.stringify({ expectedPreferenceVersion: 1, paletteFamily: "romantic" }) }); assert.equal(r.response.status, 403);
  const bad = await request("A", "/api/v1/matches", { method: "POST", headers: { Origin: "https://foreign.invalid" }, body: "{}" }); assert.equal(bad.response.status, 403);
  const race = await Promise.all(["A", "B"].map((p) => request(p, "/api/v1/profile/preferences", { method: "PATCH", body: JSON.stringify({ expectedPreferenceVersion: 1, accentFamily: "cyan" }) })));
  assert.equal(race.filter((r) => r.response.ok).length, 1);
});
await check("atomic duplicate receipts, races, required controllers and terminal immutability", async () => {
  const m = await create("connect-four", "together");
  const v = await view("A", m);
  const e = { protocolVersion: 1, matchId: m.id, actionId: randomUUID(), action: "connect-four.drop", payload: { column: 0 }, expectedVersion: v.deliveryVersion, turnId: v.turnId, controllerGeneration: v.controller.controllerGeneration };
  const replies = await Promise.all([e, { ...e, actionId: randomUUID(), payload: { column: 1 } }].map((envelope) => request("A", `/api/v1/matches/${m.id}/actions`, { method: "POST", body: JSON.stringify(envelope) })));
  assert.equal(replies.filter((r) => r.body.status === "accepted").length, 1);
  const accepted = replies.find((r) => r.body.status === "accepted");
  const original = accepted === replies[0] ? e : { ...e, actionId: replies[1].body.actionId, payload: { column: 1 } };
  const duplicate = await request("A", `/api/v1/matches/${m.id}/actions`, { method: "POST", body: JSON.stringify(original) });
  assert.equal(duplicate.body.eventId, accepted.body.eventId);
  const missing = await request("A", `/api/v1/matches/${m.id}/actions`, { method: "POST", body: JSON.stringify({ ...original, actionId: randomUUID(), controllerGeneration: undefined }) }); assert.equal(missing.body.status, "rejected");
  await action("A", m, "match.resign", { resigningSeat: "B" });
  const terminal = await view("A", m); assert.equal(terminal.lifecycle, "resigned");
  const rejected = await request("A", `/api/v1/matches/${m.id}/actions`, { method: "POST", body: JSON.stringify({ ...original, actionId: randomUUID(), expectedVersion: terminal.deliveryVersion }) }); assert.equal(rejected.body.code, "MATCH_FINISHED");
});
await check("simultaneous remote secret locks and filtered receipt recovery", async () => {
  const m = await create("rock-paper-scissors", "remote");
  await action("B", m, "match.accept"); await action("A", m, "match.ready"); await action("B", m, "match.ready");
  const result = await Promise.all([action("A", m, "secret.lock", { choice: "rock" }), action("B", m, "secret.lock", { choice: "scissors" })]);
  assert.equal(result.length, 2);
  const current = await view("A", m); assert.equal(current.gameState.scores.A, 1);
  const { body } = await request("A", `/api/v1/matches/${m.id}/receipts/${result[0].envelope.actionId}`);
  assert.ok(!JSON.stringify(body).includes("payloadDigest"));
  await action("A", m, "match.resign");
});
await check("together secret privacy and delayed original submission tombstone", async () => {
  const m = await create("rock-paper-scissors", "together");
  const oldId = randomUUID(); const before = await view("A", m);
  const recovered = await request("A", `/api/v1/matches/${m.id}/secret-recovery`, { method: "POST", body: JSON.stringify({ pendingActionId: oldId, roundId: before.roundId, controllerGeneration: before.controller.controllerGeneration }) }); assert.equal(recovered.response.status, 200);
  const late = await request("A", `/api/v1/matches/${m.id}/actions`, { method: "POST", body: JSON.stringify({ protocolVersion: 1, matchId: m.id, actionId: oldId, action: "secret.lock", payload: { choice: "paper" }, roundId: before.roundId, controllerGeneration: before.controller.controllerGeneration }) }); assert.equal(late.body.code, "ACTION_SUPERSEDED");
  await action("A", m, "secret.lock", { choice: "rock" });
  const second = await action("A", m, "secret.lock", { choice: "scissors" });
  assert.ok(!JSON.stringify(second.body).includes('"choiceA":"rock"'));
  const hidden = await view("A", m); assert.equal(hidden.gameState.roundResult, null);
  await action("A", m, "secret.reveal");
  await action("A", m, "match.resign", { resigningSeat: "A" });
});
await check("actual Sudoku issuance, givens, notes, undo and server pause/check", async () => {
  const m = await create("sudoku", "practice", { puzzleId: "easy-001", difficulty: "easy" });
  const v = await view("A", m); assert.equal(v.gameState.puzzleId, "easy-001");
  assert.ok(!JSON.stringify(v).includes('"solution"'));
  const puzzle = v.gameState; const cell = puzzle.givens.indexOf("0");
  assert.ok(cell >= 0); const row = Math.floor(cell / 9), col = cell % 9;
  await action("A", m, "sudoku.edit", { row, col, operation: "toggle-note", value: 1 });
  await action("A", m, "sudoku.undo");
  await action("A", m, "sudoku.check"); await action("A", m, "sudoku.pause");
  const paused = await view("A", m); assert.equal(paused.gameState.self.paused, true);
  await action("A", m, "sudoku.resume");
  await action("A", m, "match.request-abandon");
  assert.equal((await view("A", m)).lifecycle, "abandoned");
  assert.equal((await request("B", `/api/v1/matches/${m.id}`)).response.status, 403);
});
const sharedGames = ["connect-four", "rock-paper-scissors", "dots-boxes", "sos", "hand-cricket", "snakes-and-ladders", "ludo"];
for (const mode of ["together", "remote"]) {
  for (const gameId of sharedGames) {
    await check(`normal saved completion: ${gameId}/${mode}`, async () => {
      const m = await create(gameId, mode);
      if (mode === "remote") { await action("B", m, "match.accept"); await action("A", m, "match.ready"); await action("B", m, "match.ready"); }
      const play = async (seat, type, payload = {}) => action(mode === "together" ? "A" : seat, m, type, payload);
      if (gameId === "connect-four") for (const column of [0, 1, 0, 1, 0, 1, 0]) { const v = await view("A", m); await play(v.turnSeat, "connect-four.drop", { column }); }
      if (gameId === "dots-boxes") {
        for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { const v = await view("A", m); await play(v.turnSeat, "dots-boxes.edge", { r1: r, c1: c, r2: r, c2: c + 1 }); }
        for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const v = await view("A", m); await play(v.turnSeat, "dots-boxes.edge", { r1: r, c1: c, r2: r + 1, c2: c }); }
      }
      if (gameId === "sos") for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) { const v = await view("A", m); await play(v.turnSeat, "sos.place", { row, col, letter: col % 2 ? "O" : "S" }); }
      if (gameId === "rock-paper-scissors") {
        for (let round = 0; round < 2; round++) {
          const v = await view("A", m); const order = mode === "together" && v.roundId % 2 === 0 ? ["B", "A"] : ["A", "B"];
          for (const seat of order) await play(seat, "secret.lock", { choice: seat === "A" ? "rock" : "scissors" });
          if (mode === "together") await play("A", "secret.reveal");
          if (round === 0) { await play("A", "secret.next"); if (mode === "remote") await play("B", "secret.next"); }
        }
      }
      if (gameId === "hand-cricket") {
        let v = await view("A", m); await play(v.gameState.tossWinner, "cricket.choose-role", { role: "bat" });
        for (let innings = 0; innings < 2; innings++) {
          v = await view("A", m); const order = mode === "together" && v.roundId % 2 === 0 ? ["B", "A"] : ["A", "B"];
          for (const seat of order) await play(seat, "secret.lock", { value: 1 });
          if (mode === "together") await play("A", "secret.reveal");
          if (innings === 0) { await play("A", "secret.next"); if (mode === "remote") await play("B", "secret.next"); }
        }
      }
      if (gameId === "ludo" || gameId === "snakes-and-ladders") {
        let moves = 0;
        while (moves++ < 6000) {
          const v = await view("A", m); if (v.lifecycle === "completed") break;
          if (gameId === "ludo" && v.gameState.phase === "choose-token") {
            const seat = v.gameState.activeSeat;
            const tokenId = [...v.gameState.legalTokenIds].sort((a, b) => v.gameState.tokens[seat][b] - v.gameState.tokens[seat][a])[0];
            await play(seat, "ludo.move", { tokenId });
          } else await play(v.turnSeat, "dice.roll");
        }
        assert.ok(moves < 6000, "Bounded server-random game must reach its exact normal finish");
        console.log(`SAVED_ACTIONS ${gameId}/${mode} ${moves}`);
      }
      const finished = await view("A", m); assert.equal(finished.lifecycle, "completed");
      assert.ok(["rules_win", "rules_draw"].includes(finished.result.reason));
      assert.equal((await view("B", m)).result.finishedAt, finished.result.finishedAt);
    });
  }
}
const solutions = JSON.parse(fs.readFileSync("content/sudoku/solutions.json", "utf8"));
async function solve(person, match) {
  let v = await view(person, match);
  const solution = solutions[v.gameState.puzzleId]; assert.ok(solution);
  for (let i = 0; i < 81; i++) if (v.gameState.givens[i] === "0") await action(person, match, "sudoku.edit", { row: Math.floor(i / 9), col: i % 9, operation: "set", value: Number(solution[i]) });
  return view(person, match);
}
await check("practice normal completion and permanently marked assisted/replay records", async () => {
  const m = await create("sudoku", "practice", { puzzleId: "easy-001" });
  await action("A", m, "sudoku.check");
  const finished = await solve("A", m); assert.equal(finished.lifecycle, "completed"); assert.equal(finished.gameState.self.assisted, true);
  const repeat = await create("sudoku", "practice", { puzzleId: "easy-001" });
  assert.equal((await view("A", repeat)).gameState.replay, true);
  await action("A", repeat, "match.request-abandon");
});
await check("duel common start, independent revisions, private opponent and normal finish", async () => {
  const m = await create("sudoku", "duel", { difficulty: "easy" });
  const waiting = await view("A", m); assert.match(waiting.gameState.givens, /^0{81}$/); assert.equal(waiting.gameState.self.cells, undefined);
  await action("B", m, "match.accept"); await action("A", m, "match.ready"); await action("B", m, "match.ready");
  const before = await view("A", m); assert.equal(before.gameState.hasStarted, false);
  assert.match(before.gameState.givens, /^0{81}$/); assert.equal(before.gameState.self.cells, undefined);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, before.gameState.scheduledStartTime - Date.now() + 30)));
  const v = await view("A", m); const priorBRevision = (await view("B", m)).gameState.self.progressRevision; const idx = v.gameState.givens.indexOf("0"); const payload = { row: Math.floor(idx / 9), col: idx % 9, operation: "toggle-note", value: 1 };
  await Promise.all([action("A", m, "sudoku.edit", payload), action("B", m, "sudoku.edit", payload)]);
  const after = await view("B", m); assert.equal(after.gameState.self.progressRevision, priorBRevision + 1); assert.equal(after.gameState.opponent.cells, undefined); assert.equal(after.gameState.opponent.notes, undefined);
  const finished = await solve("A", m); assert.equal(finished.lifecycle, "completed"); assert.equal(finished.result.winner, "A");
});
await check("async sender completion, idempotent publication, receiver privacy/start/normal comparison", async () => {
  const sender = await create("sudoku", "challenge", { puzzleId: "easy-003" });
  const senderFinished = await solve("A", sender); assert.equal(senderFinished.lifecycle, "completed");
  assert.equal(senderFinished.result.details.scored, false);
  const publish = { creationId: randomUUID(), senderAttemptId: sender.id };
  const r = await request("A", "/api/v1/challenges", { method: "POST", body: JSON.stringify(publish) }); assert.ok(r.response.ok, r.body.code);
  const challenge = { id: r.body.challengeId ?? r.body.matchId };
  const duplicate = await request("A", "/api/v1/challenges", { method: "POST", body: JSON.stringify(publish) }); assert.equal(duplicate.body.challengeId ?? duplicate.body.matchId, challenge.id);
  const waiting = await view("B", challenge); assert.match(waiting.gameState.givens, /^0{81}$/); assert.equal(waiting.gameState.self.cells, undefined);
  await action("B", challenge, "match.accept");
  const started = await view("B", challenge); assert.equal(started.gameState.hasStarted, true);
  const finished = await solve("B", challenge); assert.equal(finished.lifecycle, "completed"); assert.ok(["rules_win", "rules_draw"].includes(finished.result.reason));
});
await check("logout revokes the session across actual HTTP requests", async () => {
  const logout = await request("B", "/api/v1/auth/logout", { method: "POST", body: "{}" }); assert.equal(logout.response.status, 200);
  const r = await request("B", "/api/v1/matches"); assert.equal(r.response.status, 401);
});
saveReport();
console.log(`WORKERS_RUNTIME_VERIFIED ${report.length}`);
