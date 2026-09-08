/* Check current Sleeper player payloads with the same resolver used by the live board. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{contents:'export {P} from "./src/data"; export {sleeperSnapshot} from "./src/lib/sleeper-draft";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/audit-sync.cjs',logLevel:'silent'});
const {P,sleeperSnapshot}=createRequire(import.meta.url)('../.simcache/audit-sync.cjs');
const response=await fetch('https://api.sleeper.app/v1/players/nfl',{signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`Sleeper players HTTP ${response.status}`);
const players=await response.json(),seen=new Set();
for(const p of Object.values(players)){
 if(!p?.first_name||!p?.last_name||![p.position,...(p.fantasy_positions??[])].some(pos=>['QB','RB','WR','TE'].includes(pos)))continue;
 const snapshot=sleeperSnapshot([{pick_no:1,draft_slot:1,metadata:{first_name:p.first_name,last_name:p.last_name,position:p.position,team:p.team}}],1,P);
 if(snapshot.offBoard===0)seen.add(snapshot.ord[0]);
}
const missing=P.filter(r=>!seen.has(r[0])).map(r=>r[0]);
assert.deepEqual(missing,[],'board players unresolved by current Sleeper payloads');
console.log(`PASS: all ${P.length} board players resolve through the live draft parser (one player-database request)`);
