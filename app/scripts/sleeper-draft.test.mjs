import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const app=new URL('../',import.meta.url).pathname,require=createRequire(import.meta.url);
for(const module of ['sleeper-draft','advisor'])execFileSync('npx',['esbuild',`src/lib/${module}.ts`,'--bundle','--format=cjs',`--outfile=${app}.simcache/test-${module}.cjs`,'--log-level=error'],{cwd:app});
const {sleeperSnapshot,offBoardPick,externalPickKey}=require(app+'.simcache/test-sleeper-draft.cjs');
const {advise,rosterSlots,pGoneBy}=require(app+'.simcache/test-advisor.cjs');
const {P}=require(app+'.simcache/data.cjs');
const picks=[
 {pick_no:1,draft_slot:1,metadata:{first_name:'Jahmyr',last_name:'Gibbs',team:'DET',position:'RB'}},
 {pick_no:2,draft_slot:2,metadata:{first_name:'Brandon',last_name:'Aubrey',team:'DAL',position:'K'}},
 {pick_no:3,draft_slot:3,metadata:{first_name:'Philadelphia',last_name:'Eagles',team:'PHI',position:'DEF'}},
 {pick_no:4,draft_slot:4,metadata:{first_name:'Kenny',last_name:'Gainwell',team:'TB',position:'RB'}},
 {pick_no:5,draft_slot:5,metadata:{first_name:'Offboard',last_name:'Receiver',team:'SEA',position:'WR'}},
];
const snapshot=sleeperSnapshot(picks.slice().reverse(),2,P);
assert.equal(snapshot.ord.length,5);assert.equal(Object.keys(snapshot.DS).length,5);
assert.equal(snapshot.DS['Jahmyr Gibbs'],'gone');assert.equal(snapshot.DS['Kenneth Gainwell'],'gone');
assert.equal(snapshot.offBoard,3);assert.equal(offBoardPick(snapshot.ord[1]).pos,'K');
const advice=advise(snapshot.DS,2,snapshot.ord);
assert.equal(advice.cur,6);assert.equal(advice.myCount,1);assert.equal(advice.nextPick,23);
assert.equal(rosterSlots(snapshot.DS).find(s=>s.label==='K').player,'Brandon Aubrey');
const switched=sleeperSnapshot(picks,4,P);assert.equal(switched.DS['Kenneth Gainwell'],'mine');assert.equal(switched.DS[snapshot.ord[1]],'gone');
const rolledBack=sleeperSnapshot(picks.slice(0,2),2,P);assert.equal(rolledBack.ord.length,2);assert.equal(rolledBack.DS['Kenneth Gainwell'],undefined);
assert.throws(()=>sleeperSnapshot([picks[1]],2,P),/sequence/);
assert.throws(()=>sleeperSnapshot([picks[0],{...picks[0],pick_no:2}],1,P),/Duplicate/);
const ownOffboard=sleeperSnapshot(picks,5,P);assert.equal(advise(ownOffboard.DS,5,ownOffboard.ord).wr,1);
assert.ok(advise(ownOffboard.DS,5,ownOffboard.ord).warnings.some(w=>w.includes('off-board')));
assert.equal(rosterSlots(ownOffboard.DS).find(s=>s.label==='WR1').player,'Offboard Receiver');
console.log('PASS: batched live snapshot, off-board clock, kicker/defense, alias, identity switch, rollback, invalid sequence');

assert.deepEqual(offBoardPick(externalPickKey(192,'DST','Philadelphia Eagles')),{name:'Philadelphia Eagles',pos:'DST'});
assert.throws(()=>externalPickKey(193,'K','Test'),/valid draft pick/);
assert.throws(()=>externalPickKey(1,'K',' '),/name/);
// A 1% floor across 235 candidates made the one-pick calibration impossible.
assert.equal(advise({},2,[]).cands[0].now.r[0],'Bijan Robinson');
console.log('PASS: manual external picks and one-pick waiting recommendation');

const overdue=P.filter(r=>['Jahmyr Gibbs','Bijan Robinson'].includes(r[0]));
const totalAt=k=>overdue.reduce((sum,r)=>sum+pGoneBy(r,k,100,0),0);
assert.equal(totalAt(100),0);assert.ok(totalAt(100.000001)<.01);
let lo=100,hi=101;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(totalAt(mid)>1)hi=mid;else lo=mid;}
assert.ok(Math.abs(totalAt((lo+hi)/2)-1)<1e-6,'two overdue players must calibrate to one intervening pick');
console.log('PASS: continuous overdue-player probabilities preserve one-pick mass');
