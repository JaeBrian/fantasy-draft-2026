import {TOOL_USERS} from './study-seats.mjs';
// Validate the files consumed by load-sims, including the displayed comparison matrix.
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const cache=new URL('../.simcache/',import.meta.url);
const files=['plans','cliff','final_sim','riskdial','tree','priority','rbloss','first_pick','sim_all'];
const since=Number(process.argv[2]??0),results={};
assert.ok(Number.isFinite(since));
function finite(value,path){
 if(typeof value==='number')assert.ok(Number.isFinite(value),`${path}: nonfinite value`);
 if(value===null)assert.ok(path.endsWith('.delta'),`${path}: missing numeric result`);
 if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))finite(child,`${path}.${key}`);
}
for(const file of files){
 const url=new URL(file+'.json',cache);
 assert.ok(statSync(url).mtimeMs>=since,`${file}: stale result`);
 results[file]=JSON.parse(readFileSync(url,'utf8'));finite(results[file],file);
}
for(const [,seat] of TOOL_USERS){
 for(const file of ['plans','cliff','final_sim','riskdial','tree','first_pick'])assert.ok(results[file][seat],`${file}: missing seat ${seat}`);
 const rows=results.final_sim[seat].rows;
 assert.equal(rows.length,5);
 for(let i=0;i<rows.length;i++){
  assert.equal(rows[i].beats.length,rows.length);assert.equal(rows[i].beats[i],0);
  if(i)assert.ok(rows[i-1].mean>=rows[i].mean,'comparison rows must match sorted UI order');
  for(let j=0;j<rows.length;j++)if(i!==j){
   assert.ok(rows[i].beats[j]>=0&&rows[i].beats[j]<=100);
   assert.ok(Math.abs(rows[i].beats[j]+rows[j].beats[i]-100)<=1,'paired matchup rates must include half-credit for ties');
  }
 }
}
for(const [name,seat] of TOOL_USERS)for(const file of ['priority','rbloss']){
 assert.ok(results[file][name],`${file}: missing ${name}`);
 assert.equal(results[file][name].seat,seat,`${file}: wrong seat for ${name}`);
 assert.equal(Object.keys(results[file][name].rooms).length,2,`${file}: missing room`);
}
assert.deepEqual(results.sim_all.h2h.map(r=>[r.who,r.slot]),TOOL_USERS,'shared-room results must include every registered user');
for(const [,seat] of TOOL_USERS){
 const picks=Array.from({length:6},(_,r)=>r*12+(r%2?13-seat:seat));
 assert.deepEqual(results.plans[seat].picks.map(p=>p.pick),picks,`plans: wrong snake picks for seat ${seat}`);
 assert.deepEqual(results.tree[seat].picks,picks.slice(0,3),`tree: wrong snake picks for seat ${seat}`);
}
console.log(`RESULT: 0 FAIL; nine complete finite studies, ${TOOL_USERS.length} seats, both room scenarios, paired matrix and tie accounting`);
