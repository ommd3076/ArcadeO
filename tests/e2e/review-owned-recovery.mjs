import { chromium } from 'playwright';
import fs from 'node:fs'; import { randomUUID } from 'node:crypto';
const creds=JSON.parse(fs.readFileSync('.local/accounts.json','utf8'));
const rows=JSON.parse(fs.readFileSync('tests/e2e/evidence/final-boards/review.json','utf8'));
const b=await chromium.launch(); const c=await b.newContext(); const p=await c.newPage();
await c.request.post('http://localhost:8787/api/v1/auth/login',{headers:{Origin:'http://localhost:8787'},data:{username:creds.playerAUser,password:creds.playerAPassword}});
const a=await(await c.request.get('http://localhost:8787/api/v1/auth/session')).json();const headers={Origin:'http://localhost:8787','X-CSRF-Token':a.csrfToken};
for(const game of ['hand-cricket','sudoku']) { const id=rows.find(r=>r.game===game).id; let v=await(await c.request.get('http://localhost:8787/api/v1/matches/'+id)).json();
const takeover=await c.request.post('http://localhost:8787/api/v1/matches/'+id+'/controller',{headers,data:{expectedControllerGeneration:v.controller.controllerGeneration}}); if(!takeover.ok())throw Error('takeover '+takeover.status());
await p.goto('http://localhost:8787/matches/'+id);await p.waitForTimeout(300);
for(const [label,width,height] of [['phone-320',320,740],['phone-390',390,844],['laptop',1366,900]]){await p.setViewportSize({width,height});const unmask=p.getByRole('button',{name:'Resume & Unmask'});if(await unmask.count())await unmask.click();const ready=p.getByRole('button',{name:/I am .*Ready/});if(await ready.count())await ready.click();await p.screenshot({path:'tests/e2e/evidence/final-boards/'+game+'-'+label+'.png',fullPage:true});}
v=await(await c.request.get('http://localhost:8787/api/v1/matches/'+id)).json();const result=await c.request.post('http://localhost:8787/api/v1/matches/'+id+'/actions',{headers,data:{protocolVersion:1,matchId:id,actionId:randomUUID(),action:game==='sudoku'?'match.request-abandon':'match.agree-abandon',payload:{},expectedVersion:v.deliveryVersion,...(game==='hand-cricket'?{controllerGeneration:v.controller.controllerGeneration}:{})}});console.log(game,await result.text());}
await b.close();