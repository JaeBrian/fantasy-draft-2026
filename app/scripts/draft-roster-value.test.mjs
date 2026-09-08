import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({entryPoints:['src/lib/draft-roster-value.ts','src/lib/advisor.ts','src/lib/sleeper-draft.ts'],bundle:true,platform:'node',format:'cjs',outdir:'.simcache/roster-value-test',outExtension:{'.js':'.cjs'},logLevel:'silent'});
const require=createRequire(import.meta.url);
const {rosterGainEvaluator}=require('../.simcache/roster-value-test/draft-roster-value.cjs');
const p=(name,pos,points,bye=0,miss=0,knownMiss=0)=>({name,pos,points,bye,miss,knownMiss});
const roster=[p('QB','QB',20,7),p('RB1','RB',15),p('RB2','RB',14),p('WR1','WR',15),p('WR2','WR',14),p('TE','TE',10),p('Flex1','WR',12),p('Flex2','RB',11)];
const gain=rosterGainEvaluator(roster);
assert.equal(gain(p('WR5','WR',8)),0);assert.equal(gain(p('Upgrade','WR',16)),5);
assert.ok(Math.abs(gain(p('Backup','QB',17,9))-1)<1e-10);assert.equal(gain(p('SameBye','QB',17,7)),0);
assert.equal(gain(p('Out','WR',40,0,1,1)),0);assert.equal(gain(roster[0]),0);
const injuries=rosterGainEvaluator(roster.map(r=>({...r,miss:.15})));
assert.ok(injuries(p('Depth','WR',8))>0);assert.equal(injuries(p('Depth','WR',8)),injuries(p('Depth','WR',8)));
console.log('PASS: actual lineup improvement, shared-bye backup, two flex slots, absences and deterministic depth value');

const starter=p('Starter','RB',20,0,.2);
const backfield=[starter,p('RB2','RB',15),p('WR1','WR',15),p('WR2','WR',14),p('TE','TE',12),p('Flex1','WR',13),p('Flex2','WR',13),p('Bench','RB',12)];
const cuff={...p('Handcuff','RB',7),handcuff:{starter,uplift:13}};
assert.equal(rosterGainEvaluator(backfield)(p('Flat average','RB',9.6)),0);
assert.ok(rosterGainEvaluator(backfield)(cuff)>1,'starter absences must create conditional handcuff value');
console.log('PASS: handcuff upside occurs in the same weeks its starter is absent');

// A synced skill player outside the projection pool must retain the unknown-value warning
// and use the existing scorer. K/DST records do not make skill projections incomplete.
const {advise,snapTeam}=require('../.simcache/roster-value-test/advisor.cjs');
const {externalPickKey}=require('../.simcache/roster-value-test/sleeper-draft.cjs');
const {P}=require('../.simcache/data.cjs');
const owned=['Chase Brown','David Montgomery','Nico Collins','Jameson Williams','Colston Loveland','Jaylen Warren','Jayden Reed','Brock Purdy'];
for(const seat of [1,2,10]){
 const ord=[],DS={},others=P.filter(p=>!owned.includes(p[0])).map(p=>p[0]);let own=0;
 for(let pick=1;own<8||snapTeam(pick)!==seat;pick++){
  const mine=snapTeam(pick)===seat,name=mine?owned[own++]:others.shift();
  ord.push(name);DS[name]=mine?'mine':'gone';
 }
 const advice=advise(DS,seat,ord);
 assert.equal(advice.onClock,true);assert.ok(advice.cands.length>0);
 assert.ok(advice.cands.every(c=>Number.isFinite(c.rosterGain)&&c.rosterGain>=0));
 for(const pos of ['WR','OTHER','K']){
  const key=externalPickKey(ord.indexOf(owned[2])+1,pos,'Unmodeled player'),changed={...DS};delete changed[owned[2]];changed[key]='mine';
  const next=advise(changed,seat,ord.map(n=>n===owned[2]?key:n));
  assert.ok(next.cands.length>0);
  assert.ok(next.cands.every(c=>pos==='K'?c.rosterGain!==undefined:c.rosterGain===undefined));
  if(pos!=='K')assert.ok(next.warnings.some(w=>w.includes('off-board')));
 }
}
console.log('PASS: late-round integration and unmodeled roster fallback for Ashley, Brian and Emily');
