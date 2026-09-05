// Full 16-round integration: every seat uses the advisor, with early and late K/DEF picks.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),app=new URL('../',import.meta.url).pathname;
for(const name of ['advisor','sleeper-draft'])execFileSync('npx',['esbuild',`src/lib/${name}.ts`,'--bundle','--format=cjs',`--outfile=${app}.simcache/full-${name}.cjs`,'--log-level=error'],{cwd:app});
const {advise,rosterSlots,snapTeam}=require(app+'.simcache/full-advisor.cjs');
const {sleeperSnapshot}=require(app+'.simcache/full-sleeper-draft.cjs');
const {P}=require(app+'.simcache/data.cjs');
let calls=0;
const scenarios=['late-kdef','early-k','early-kdef'];
for(const scenario of scenarios)for(let world=0;world<12;world++){
 const picks=[];
 for(let pick=1;pick<=192;pick++){
  const seat=snapTeam(pick),round=Math.ceil(pick/12),snapshot=sleeperSnapshot(picks,seat,P);
  const a=advise(snapshot.DS,seat,snapshot.ord);calls++;
  assert.equal(a.cur,pick);assert.equal(a.myCount,round-1);assert.equal(a.onClock,true);
  const kRound=scenario==='late-kdef'?15:7+(world+seat)%5;
  const dRound=scenario==='early-kdef'?12+(world+seat)%3:16;
  let metadata;
  if(round===kRound||round===dRound){
   const position=round===kRound?'K':'DEF';
   metadata={first_name:`Test ${position}`,last_name:`Seat ${seat}`,position,team:'TEST'};
  }else{
   const top=a.cands[0],row=top?.now.r;
   assert.ok(row&&Number.isFinite(top.score),`${scenario} world${world} pick${pick}: missing candidate`);
   assert.ok(!snapshot.DS[row[0]],'duplicate player');
   const count=P.filter(p=>snapshot.DS[p[0]]==='mine'&&p[1]===row[1]).length;
   if(['QB','TE'].includes(row[1]))assert.ok(count<2,`third ${row[1]}`);
   metadata={first_name:row[0],last_name:'',position:row[1],team:row[2]};
  }
  picks.push({pick_no:pick,draft_slot:seat,metadata});
 }
 for(let seat=1;seat<=12;seat++){
  const snapshot=sleeperSnapshot(picks,seat,P),a=advise(snapshot.DS,seat,snapshot.ord);
  assert.equal(snapshot.ord.length,192);assert.equal(a.myCount,16);assert.equal(a.nextPick,null);
  const slots=rosterSlots(snapshot.DS);
  assert.ok(slots.slice(0,10).every(s=>s.player),`${scenario}: incomplete seat${seat}`);
  assert.ok(!a.warnings.some(w=>w.startsWith('Use your remaining picks')));
 }
}
const result={drafts:36,rounds:16,picksPerDraft:192,advisorCalls:calls,scenarios,failures:0};
writeFileSync(app+'.simcache/full-draft-audit.json',JSON.stringify(result,null,2));
console.log(`RESULT: 0 FAIL; ${result.drafts} complete 192-pick drafts; ${calls} advisor decisions; every seat has all ten starters`);
