import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {test} from 'node:test';
await build({stdin:{contents:'export {advise,snapTeam,pGoneBy} from "./src/lib/advisor"; export {setPin,togglePin,pinnedPick} from "./src/lib/intel"; export {P} from "./src/data"; export {runForecast} from "./src/lib/forecast"; export {opponentPick} from "./src/lib/mock";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/draft-probabilities.cjs',logLevel:'silent'});
const {advise,snapTeam,pGoneBy,setPin,togglePin,pinnedPick,P,runForecast,opponentPick}=createRequire(import.meta.url)('../.simcache/draft-probabilities.cjs');
const row=name=>P.find(r=>r[0]===name);

test('rising positional demand increases selection probability',()=>{
 for(const name of ['Rico Dowdle','Ladd McConkey','Brock Bowers','Josh Allen']){
  const r=row(name);
  for(const cur of [1,28,70]) for(const horizon of [cur+1,cur+12,cur+24]){
   assert.ok(pGoneBy(r,horizon,cur,2.5)>=pGoneBy(r,horizon,cur,0),name);
   assert.ok(pGoneBy(r,horizon,cur,0)>=pGoneBy(r,horizon,cur,-2.5),name);
  }
 }
});

test('personal exclusions do not change an unexcluded player’s availability',()=>{
 const before=advise({},10,[],undefined,false);
 const after=advise({},10,[],new Set(['Jahmyr Gibbs','Bijan Robinson',"Ja'Marr Chase"]),false);
 const a=before.cands.find(c=>c.now.r[0]==='CeeDee Lamb');
 const b=after.cands.find(c=>c.now.r[0]==='CeeDee Lamb');
 assert.ok(a&&b);
 assert.equal(b.pReach,a.pReach);
 assert.equal(b.pGone,a.pGone);
 assert.ok(after.cands.every(c=>!['Jahmyr Gibbs','Bijan Robinson',"Ja'Marr Chase"].includes(c.now.r[0])));
});

test('consecutive own picks have no opponent availability loss',()=>{
 const ord=P.slice(0,23).map(r=>r[0]);
 const state=Object.fromEntries(ord.map((n,i)=>[n,snapTeam(i+1)===1?'mine':'gone']));
 const advice=advise(state,1,ord);
 assert.equal(advice.onClock,true);
 assert.ok(advice.cands.length);
 for(const c of advice.cands) assert.equal(c.pGone,0,c.now.r[0]);
 const name=advice.cands[0].now.r[0];
 setPin(name,24);
 try{
  const pinned=advise(state,1,ord);
  assert.deepEqual(pinned.cands.map(c=>[c.now.r[0],c.evLater,c.pGone]),advice.cands.map(c=>[c.now.r[0],c.evLater,c.pGone]),'passing on our own pinned pick preserves the same future value');
 }finally{setPin(name,null);}
});

test('known picks honor their exact horizon despite demand and calibration',()=>{
 setPin('Brock Bowers',32);
 try{
  for(const shift of [-2.5,0,2.5]) for(const offset of [-24,0,4]){
   assert.equal(pGoneBy(row('Brock Bowers'),32,28,shift,offset),0,'available at the named pick');
   assert.equal(pGoneBy(row('Brock Bowers'),34,28,shift,offset),1,'gone after the named pick');
  }
  const owned=['Chase Brown','James Cook'],ord=[],state={};
  const others=P.filter(r=>!owned.includes(r[0])&&r[0]!=='Brock Bowers').map(r=>r[0]);
  for(let pk=1;pk<28;pk++){
   const mine=snapTeam(pk)===10,n=mine?owned.shift():others.shift();
   state[n]=mine?'mine':'gone';ord.push(n);
  }
  const advice=advise(state,10,ord);
  assert.equal(advice.nextPick,34);
  assert.ok(advice.cands.every(c=>c.now.r[0]!=='Brock Bowers'));
  assert.notEqual(advice.dream?.o.r[0],'Brock Bowers');
 }finally{setPin('Brock Bowers',null);}
});

test('an available player contradicting an old pin returns to the market model',()=>{
 const r=row('Brock Bowers'),expected=pGoneBy(r,40,34,0);
 setPin(r[0],32);
 try{assert.equal(pGoneBy(r,40,34,0),expected);}finally{setPin(r[0],null);}
});

test('forecast agrees with exact known picks',async()=>{
 setPin('Brock Bowers',8);
 try{
  const result=await runForecast({},[],10,100);
  assert.equal(result.survive['Brock Bowers'],0);
  const early=await runForecast({},[],8,100);
  assert.equal(early.survive['Brock Bowers'],1);
 }finally{setPin('Brock Bowers',null);}
});


test('only one active known player can occupy a pick',()=>{
 setPin('Brock Bowers',8);
 setPin('Quintin Morris',8);
 try{
  assert.equal(pinnedPick('Brock Bowers'),undefined);
  assert.equal(pinnedPick('Quintin Morris'),8);
  togglePin('Brock Bowers');
  assert.equal(pinnedPick('Brock Bowers'),8);
  assert.equal(pinnedPick('Quintin Morris'),undefined);
 }finally{setPin('Brock Bowers',null);setPin('Quintin Morris',null);}
});

test('a known pick on our future turn guarantees reaching that turn',()=>{
 setPin('Bijan Robinson',10);
 try{
  const advice=advise({},10,[]);
  const candidate=advice.cands.find(c=>c.now.r[0]==='Bijan Robinson');
  assert.ok(candidate);
  assert.equal(candidate.pReach,1);
 }finally{setPin('Bijan Robinson',null);}
});

test('practice opponents honor exact known picks',()=>{
 const random=Math.random;Math.random=()=>.9;
 setPin('Brock Bowers',1);
 try{assert.equal(opponentPick({},[],1),'Brock Bowers');}
 finally{setPin('Brock Bowers',null);Math.random=random;}
});
