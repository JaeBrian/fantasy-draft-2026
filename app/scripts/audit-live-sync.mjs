/* Read a real draft and verify every seat through the production snapshot and advisor. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{contents:'export {P} from "./src/data"; export {sleeperSnapshot} from "./src/lib/sleeper-draft"; export {advise,snapTeam} from "./src/lib/advisor";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/audit-live-sync.cjs',logLevel:'silent'});
const {P,sleeperSnapshot,advise,snapTeam}=createRequire(import.meta.url)('../.simcache/audit-live-sync.cjs');
const draft=process.argv[2]||'1402814176023322624';
assert.match(draft,/^\d{15,20}$/);
const response=await fetch(`https://api.sleeper.app/v1/draft/${draft}/picks?poll=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`Sleeper picks HTTP ${response.status}`);
const picks=await response.json();assert.ok(Array.isArray(picks));
for(let seat=1;seat<=12;seat++){
 const snapshot=sleeperSnapshot(picks,seat,P);
 assert.equal(snapshot.ord.length,picks.length);
 assert.equal(Object.keys(snapshot.DS).length,picks.length);
 assert.equal(Object.values(snapshot.DS).filter(v=>v==='mine').length,picks.filter(p=>p.draft_slot===seat).length);
 const advice=advise(snapshot.DS,seat,snapshot.ord);
 assert.equal(advice.cur,picks.length+1);
 assert.ok(advice.cands.every(c=>!snapshot.DS[c.now.r[0]]));
 for(const pick of picks)assert.equal(pick.draft_slot,snapTeam(pick.pick_no),'actual draft ownership matches supported 12-team snake');
}
const snapshot=sleeperSnapshot(picks,2,P);
console.log(`PASS: draft ${draft}, ${picks.length} picks (${snapshot.offBoard} off-board), ownership and clock correct for all 12 seats`);
