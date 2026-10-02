import { env } from "cloudflare:workers";
import { runInDurableObject, runDurableObjectAlarm, evictDurableObject, reset } from "cloudflare:test";
import { beforeEach, it, expect } from "vitest";
import schema from "../../migrations/0001_initial_schema.sql?raw";
import integrity from "../../migrations/0002_review_integrity.sql?raw";
import interruptedEligibility from "../../migrations/0004_sudoku_interrupted.sql?raw";

beforeEach(async () => {
  await reset();
  for (const sql of [schema, integrity, interruptedEligibility]) for (const statement of sql.replace(/^\s*--.*$/gm, "").split(";").filter((s) => s.trim())) {
    if (statement.includes("ADD COLUMN creationPayload") && (await env.DB.prepare("PRAGMA table_info(match_registry)").all()).results.some((r) => r.name === "creationPayload")) continue;
    await env.DB.prepare(statement).run();
  }
  for (const [id, accent] of [["A", "teal"], ["B", "violet"]]) {
    await env.DB.prepare("INSERT INTO accounts(id,username,displayName,passwordHash,salt,accentFamily,paletteFamily) VALUES(?,?,?,'unused','unused',?,'standard')").bind(id, id, id, accent).run();
    await env.DB.prepare("INSERT INTO sessions(tokenHash,accountId,csrfHash,issuedAt,expiresAt,sessionId) VALUES(?,?,'unused',?,?,?)").bind(`token-${id}`, id, Date.now(), Date.now()+86400000, `session-${id}`).run();
  }
});
async function match(gameId = "connect-four") {
  const id = crypto.randomUUID();
  const stub = env.MATCH_DO.get(env.MATCH_DO.idFromName(id));
  const participants = { A: {accountId:"A",displayName:"A",ready:true}, B:{accountId:"B",displayName:"B",ready:true} };
  await env.DB.prepare("INSERT INTO match_registry(matchId,creationId,creatorAccountId,gameId,mode,participants,doName,initializationState,lifecycle,deliveryVersion,schemaVersion,rulesVersion,createdAt,lastActionAt) VALUES(?,?, 'A',?,'together',?,?,'initialized','active',0,1,1,?,?)").bind(id,crypto.randomUUID(),gameId,JSON.stringify(participants),id,Date.now(),Date.now()).run();
  await env.DB.prepare("INSERT INTO active_slots(slotKey,matchId,creationId,reservedAt) VALUES(?,?,?,?)").bind(`slot-${id}`,id,id,Date.now()).run();
  const initialized = await stub.fetch("http://do/initialize", { method:"POST", headers:{"X-Actor-Account":"A","X-Session-Id":"session-A"}, body:JSON.stringify({matchId:id,gameId,mode:"together",creatorAccountId:"A",participants}) });
  await initialized.json();
  return {id,stub};
}
async function view(m) { return (await m.stub.fetch("http://do/view", {headers:{"X-Actor-Account":"A","X-Session-Id":"session-A"}})).json(); }
async function envelope(m, action = "connect-four.drop", payload = {column:0}) {
  const v = await view(m);
  return {protocolVersion:1,matchId:m.id,actionId:crypto.randomUUID(),action,payload,expectedVersion:v.deliveryVersion,turnId:v.turnId,roundId:v.roundId,controllerGeneration:v.controller.controllerGeneration};
}
async function submit(m, e) { return (await m.stub.fetch("http://do/action", {method:"POST",headers:{"X-Actor-Account":"A","X-Session-Id":"session-A"},body:JSON.stringify(e)})).json(); }
it("real SQLite rolls back snapshot, event, receipt and outbox when a middle acceptance write fails", async () => {
  const m = await match(); const before = await view(m); const e = await envelope(m);
  await runInDurableObject(m.stub, (_instance, state) => {
    state.storage.sql.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON action_receipts BEGIN SELECT RAISE(ABORT, 'injected storage fault'); END");
  });
  const failed = await runInDurableObject(m.stub, async (instance) => {
    try { await instance.handleAction(e, "A", "session-A"); return false; }
    catch { return true; }
  });
  expect(failed).toBe(true);
  const after = await view(m); expect(after.deliveryVersion).toBe(before.deliveryVersion); expect(after.gameState).toEqual(before.gameState);
  await runInDurableObject(m.stub, (_instance,state) => {
    for (const table of ["events","action_receipts","projection_outbox"]) expect(state.storage.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n).toBe(0);
    state.storage.sql.exec("DROP TRIGGER fail_receipt");
  });
  const accepted = await submit(m,e); expect(accepted.status).toBe("accepted");
  expect((await submit(m,e)).eventId).toBe(accepted.eventId);
});
it("real Durable Object eviction restores saved dice, controller, receipt and filtered secret state", async () => {
  for (const game of ["snakes-and-ladders","rock-paper-scissors"]) {
    const m = await match(game); const e = await envelope(m, game === "rock-paper-scissors" ? "secret.lock" : "dice.roll", game === "rock-paper-scissors" ? {choice:"rock"} : {});
    const accepted = await submit(m,e); expect(accepted.status).toBe("accepted");
    const before = await view(m); await evictDurableObject(m.stub); const after = await view(m);
    expect(after.gameState).toEqual(before.gameState); expect(after.controller).toEqual(before.controller); expect(after.turnId).toBe(before.turnId);
    expect((await submit(m,e)).eventId).toBe(accepted.eventId);
    if (game === "rock-paper-scissors") expect(JSON.stringify(after.gameState)).not.toContain('"rock"');
  }
});
it("projection failure leaves real acceptance saved; a real alarm retries D1 and releases the terminal slot once", async () => {
  const m = await match();
  await runInDurableObject(m.stub, (instance) => {
    const db = instance.env.DB;
    instance.env.DB = new Proxy(db, {get(target,key) { if (key === "prepare") return (sql) => { if (sql.startsWith("UPDATE match_registry")) throw new Error("injected projection outage"); return target.prepare(sql); }; const value = target[key]; return typeof value === "function" ? value.bind(target) : value; }});
    instance.restoreTestDatabase = () => { instance.env.DB = db; };
  });
  const e = await envelope(m,"match.resign",{resigningSeat:"B"}); const accepted = await submit(m,e); expect(accepted.status).toBe("accepted"); expect((await view(m)).lifecycle).toBe("resigned");
  await runInDurableObject(m.stub, (instance,state) => {
    expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM projection_outbox").one().n).toBe(1);
    instance.restoreTestDatabase(); state.storage.sql.exec("UPDATE projection_outbox SET nextAttemptAt = 0");
  });
  expect(await runDurableObjectAlarm(m.stub)).toBe(true);
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM results WHERE matchId = ?").bind(m.id).first()).n).toBe(1);
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM active_slots WHERE matchId = ?").bind(m.id).first()).n).toBe(0);
  await evictDurableObject(m.stub); expect((await submit(m,e)).eventId).toBe(accepted.eventId);
});
it("native WebSocket hibernates across eviction and revocation closes the original session without accepting a write", async () => {
  const m = await match();
  const response = await m.stub.fetch("http://do/socket", {headers:{Upgrade:"websocket",Origin:env.ALLOWED_ORIGIN,"X-Actor-Account":"A","X-Session-Id":"session-A"}});
  expect(response.status).toBe(101); const ws = response.webSocket;
  const messages = []; const waiters = [];
  ws.addEventListener("message", (event) => { const data = JSON.parse(event.data); messages.push(data); for (const notify of waiters) notify(data); });
  const next = (predicate) => new Promise((resolve,reject) => {
    const existing = messages.find(predicate); if (existing) return resolve(existing);
    const timer = setTimeout(() => reject(new Error("Expected socket delivery timed out")), 5000);
    waiters.push((data) => { if (predicate(data)) { clearTimeout(timer); resolve(data); } });
  });
  ws.accept(); await next((d) => d.type === "snapshot");
  await evictDurableObject(m.stub);
  const e = await envelope(m); ws.send(JSON.stringify({type:"action",envelope:e}));
  const accepted = await next((d) => d.status === "accepted" && d.actionId === e.actionId); expect(accepted.acceptedVersion).toBe(e.expectedVersion + 1);
  await env.DB.prepare("UPDATE sessions SET revokedAt = ? WHERE sessionId = 'session-A'").bind(Date.now()).run();
  const closed = new Promise((resolve,reject) => { const timer=setTimeout(()=>reject(new Error("Revoked socket stayed open")),5000); ws.addEventListener("close",(event)=>{clearTimeout(timer);resolve(event.code);},{once:true}); });
  ws.send(JSON.stringify({type:"ping"})); expect(await closed).toBe(1008);
  await runInDurableObject(m.stub, (_instance,state) => { expect(state.storage.sql.exec("SELECT deliveryVersion FROM match_snapshot").one().deliveryVersion).toBe(e.expectedVersion + 1); });
});
