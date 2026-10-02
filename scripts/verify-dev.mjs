import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://localhost:5173";
const accounts = JSON.parse(fs.readFileSync(".local/accounts.json", "utf8"));
for (const route of ["/", "/games", "/matches/startup-proof"]) {
  const response = await fetch(origin + route); assert.equal(response.status, 200); assert.match(await response.text(), /<div id="root">/);
}
assert.equal((await fetch(origin + "/api/health")).status, 200);
for (const id of ["A", "B"]) {
  const response = await fetch(origin + "/api/v1/auth/login", { method: "POST", headers: {Origin:origin,"Content-Type":"application/json"}, body:JSON.stringify({username:accounts[`player${id}User`],password:accounts[`player${id}Password`]}) });
  assert.equal(response.status, 200); const body=await response.json(); assert.equal(body.profile.id,id);
  const cookie=response.headers.getSetCookie().map((s)=>s.split(";")[0]).join("; ");
  const session = await fetch(origin + "/api/v1/auth/session",{headers:{Cookie:cookie}}); assert.equal((await session.json()).profile.id,id);
  const logout=await fetch(origin+"/api/v1/auth/logout",{method:"POST",headers:{Origin:origin,Cookie:cookie,"X-CSRF-Token":body.csrfToken}}); assert.equal(logout.status,200);
}
fs.mkdirSync("planning/review/evidence",{recursive:true});
fs.writeFileSync("planning/review/evidence/dev-startup.json",JSON.stringify({command:"npm run dev",origin,workerOrigin:"http://localhost:8787",assertions:["SPA and deep links","same-origin API proxy","A and B real login/bootstrap/logout"],verifiedAt:new Date().toISOString()},null,2));
console.log("DEV_STARTUP_VERIFIED");
