import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{contents:'export {advise,snapTeam,mktADP} from "./src/lib/advisor"; export {setPin} from "./src/lib/intel"; export {P} from "./src/data";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/te-value-test.cjs',logLevel:'silent'});
const require=createRequire(import.meta.url);
const {advise,snapTeam,mktADP,setPin,P}=require('../.simcache/te-value-test.cjs');
function fixture(pick,owned,kept=['Colston Loveland','Ladd McConkey','Jaylen Waddle','Tee Higgins'],clearTightEnds=false){
 const ord=[],state={},others=P.filter(r=>!owned.includes(r[0])&&!kept.includes(r[0])).sort((a,b)=>clearTightEnds?Number(b[1]==='TE')-Number(a[1]==='TE'):0).map(r=>r[0]);let i=0;
 for(let n=1;n<pick;n++){const mine=snapTeam(n)===10,name=mine?owned[i++]:others.shift();assert.ok(name);ord.push(name);state[name]=mine?'mine':'gone';}
 return {ord,state};
}
const owned=['Chase Brown','James Cook'];
const early=fixture(34,owned);
assert.ok(advise(early.state,10,early.ord,undefined,false).cands.some(c=>c.now.r[0]==='Colston Loveland'),'unrestricted mode still evaluates Loveland');
assert.equal(advise(early.state,10,early.ord).cands.some(c=>c.p==='TE'),false,'default preference waits at market price');
setPin('Colston Loveland',20);
assert.equal(advise(early.state,10,early.ord).cands.some(c=>c.now.r[0]==='Colston Loveland'),false,'a known-pick override must not create a market discount');
setPin('Colston Loveland',null);
const later=fixture(58,[...owned,'Nico Collins','DeVonta Smith']);
const discount=advise(later.state,10,later.ord);
assert.ok(discount.cands.some(c=>c.now.r[0]==='Colston Loveland'),'a falling TE is eligible');
assert.ok(discount.cands.filter(c=>c.p==='TE').every(c=>58-mktADP(c.now.r)>=6),'every optional TE must meet the actual ADP discount');
// At the last skill pick, an empty TE slot takes priority even when the remaining TE is expensive.
const filled=['Josh Allen','Brock Purdy','Chase Brown','James Cook','Jahmyr Gibbs','Bijan Robinson','Jonathan Taylor','Nico Collins','DeVonta Smith','Ladd McConkey','Jaylen Waddle','Tee Higgins','Amon-Ra St. Brown'];
const final=fixture(159,filled,['Quintin Morris'],true);
const last=advise(final.state,10,final.ord);
assert.equal(last.cands[0]?.p,'TE','preserve a legal starting lineup');
console.log('PASS: TE value preference, unrestricted mode, falling targets and required starter');
