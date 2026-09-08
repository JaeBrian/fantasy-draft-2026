import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{contents:'export {advise,snapTeam,mktADP} from "./src/lib/advisor"; export {setPin} from "./src/lib/intel"; export {P} from "./src/data"; export {SLP} from "./src/sleeper"; export {riskOf} from "./src/lib/risk";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/shared-backfield-test.cjs',logLevel:'silent'});
const {advise,snapTeam,mktADP,setPin,P,SLP,riskOf}=createRequire(import.meta.url)('../.simcache/shared-backfield-test.cjs');
const core=['Bijan Robinson','Nico Collins','Kyren Williams','Jaylen Waddle','Jaylen Warren'];
function fixture(owned,seat=2,extraKept=[]){
 const kept=[...extraKept,'Rico Dowdle','Jaylen Warren','Jayden Reed','Josh Downs','Courtland Sutton','Rhamondre Stevenson','Tee Higgins'];
 const others=P.filter(r=>!owned.includes(r[0])&&!kept.includes(r[0])).sort((a,b)=>mktADP(a)-mktADP(b)).map(r=>r[0]);
 const ord=[],state={};let count=0;
 for(let pick=1;count<owned.length||snapTeam(pick)!==seat;pick++){
  const mine=snapTeam(pick)===seat,name=mine?owned[count++]:others.shift();assert.ok(name);
  ord.push(name);state[name]=mine?'mine':'gone';
 }
 return {ord,state,seat};
}
const advice=f=>advise(f.state,f.seat,f.ord);
const has=(a,name)=>a.cands.some(c=>c.now.r[0]===name);
for(const seat of [1,2,10]){
 const f=fixture(core,seat),a=advice(f);
 assert.equal(has(a,'Rico Dowdle'),false,`seat ${seat}: defer Rico after a fifth-round Warren pick`);
 assert.ok(a.backfieldWait.some(x=>x.name==='Rico Dowdle'&&x.teammate==='Jaylen Warren'),'explain the shared backfield');
 const justAfter={...f,state:{...f.state},ord:f.ord.slice()};
 while(justAfter.state[justAfter.ord.at(-1)]==='gone')delete justAfter.state[justAfter.ord.pop()];
 assert.equal(has(advice(justAfter),'Rico Dowdle'),false,'upcoming-turn targets follow the same rule');
}
const early=fixture(core);
setPin('Rico Dowdle',20);
assert.equal(has(advice(early),'Rico Dowdle'),false,'known-pick intel cannot manufacture a discount');
setPin('Rico Dowdle',null);
const ricoRow=P.find(r=>r[0]==='Rico Dowdle'),originalADP=SLP['Rico Dowdle'].adp;
const mockPart=mktADP(ricoRow)-.75*originalADP;
for(const [discount,expected] of [[11.99,false],[12.01,true]]){
 SLP['Rico Dowdle'].adp=(early.ord.length+1-discount-mockPart)/.75;
 assert.equal(has(advice(early),'Rico Dowdle'),expected,`full-round discount boundary at ${discount} picks`);
}
SLP['Rico Dowdle'].adp=originalADP;
assert.ok(has(advice(fixture([...core.slice(0,4),'Tony Pollard'])),'Rico Dowdle'),'Rico remains available without an owned Pittsburgh RB');
assert.equal(has(advice(fixture([...core.slice(0,4),'Rico Dowdle'])),'Jaylen Warren'),false,'the policy works in both directions');
const rbRun=new Set(P.filter(r=>r[1]==='RB'&&!['Rico Dowdle','Kenneth Gainwell'].includes(r[0])).map(r=>r[0]));
assert.ok(has(advise(early.state,early.seat,early.ord,rbRun),'Kenneth Gainwell'),'a deferred high-projection RB must not hide the best eligible RB');
assert.ok(has(advice(fixture([...core.slice(0,4),'Chase Brown'])),'Tee Higgins'),'RB/WR teammates remain eligible');
const fallen=advice(fixture([...core,'Brock Purdy','Colston Loveland']));
assert.ok(has(fallen,'Rico Dowdle'),'a full-round market discount permits the pairing');
const ricoADP=SLP['Rico Dowdle'].adp;
SLP['Rico Dowdle'].adp=180;
assert.equal(has(advice(fixture([...core,'Brock Purdy','Colston Loveland'])),'Rico Dowdle'),false,'eighth selection still follows the early rule');
const late=advice(fixture([...core,'Brock Purdy','Colston Loveland','Alec Pierce']));
assert.ok(late.horizon.takeAt-mktADP(P.find(r=>r[0]==='Rico Dowdle'))<12,'late fixture must not qualify through a discount');
assert.ok(has(late,'Rico Dowdle'),'late depth remains eligible');
assert.equal(late.cands.find(c=>c.now.r[0]==='Rico Dowdle').backfieldWith,'Jaylen Warren','eligible teammates retain an overlap warning');
SLP['Rico Dowdle'].adp=ricoADP;
const injury=SLP['Jaylen Warren'].inj;
SLP['Jaylen Warren'].inj='IR';
assert.ok(has(advice(early),'Rico Dowdle'),'cover a known absence in the owned backfield');
SLP['Jaylen Warren'].inj=injury;
const emergency=fixture(['Josh Allen','Nico Collins','Colston Loveland','Jaylen Waddle','Jaylen Warren']);
const blocked=new Set(P.filter(r=>r[1]==='RB'&&r[0]!=='Rico Dowdle').map(r=>r[0]));
assert.ok(has(advise(emergency.state,emergency.seat,emergency.ord,blocked),'Rico Dowdle'),'a required starting slot overrides the overlap rule');
console.log('PASS: shared-backfield deferral, all managed seats, discounts, injuries, starter coverage and late depth');

// Every healthy same-team RB pair is checked in both ownership orders, with equal
// draft cost. Isolate the backfield from other RBs so an unrelated shortlist cutoff
// cannot make a forbidden pairing appear to pass this check accidentally.
const healthy=P.filter(r=>r[1]==='RB'&&riskOf(r[0],r[1],r[4]).knownMiss===0&&!['O','IR','PUP','SUS','NA'].includes(SLP[r[0]]?.inj));
let cases=0;const teams=new Set();
for(const owner of healthy)for(const target of healthy){
 if(owner[0]===target[0]||owner[2]!==target[2])continue;
 for(const seat of [1,2,10]){
  const otherRB=P.find(r=>r[1]==='RB'&&r[2]!==owner[2]);
  const owned=[owner[0],otherRB[0],'Josh Allen','Brock Bowers','Nico Collins'];
  const f=fixture(owned,seat,[target[0]]),original=SLP[target[0]];
  SLP[target[0]]={...original,adp:200};
  const blocked=new Set(P.filter(r=>r[1]==='RB'&&r[0]!==target[0]).map(r=>r[0]));
  const a=advise(f.state,seat,f.ord,blocked);
  assert.equal(has(a,target[0]),false,`${owner[0]} -> ${target[0]}, seat ${seat}`);
  assert.ok(a.backfieldWait.some(x=>x.name===target[0]),'the candidate reached the overlap rule');
  assert.ok(a.cands.length>0,'other positions remain available');
  if(original===undefined)delete SLP[target[0]];else SLP[target[0]]=original;
  cases++;teams.add(owner[2]);
 }
}
console.log(`PASS: ${cases} ownership/seat scenarios across ${teams.size} NFL backfields`);
