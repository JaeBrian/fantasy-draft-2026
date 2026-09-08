import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({stdin:{contents:'export * from "./src/lib/advisor"; export {P} from "./src/data";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.simcache/receiver-diversity-test.cjs',logLevel:'silent'});
const {advise,snapTeam,mktADP,preferReceiverDiversity,P}=createRequire(import.meta.url)('../.simcache/receiver-diversity-test.cjs');

// Exercise the live advisor, including the ownership lookup used by synced and manual drafts.
for(const seat of [1,2,8,10]){
 const owned=['Bijan Robinson','Nico Collins','Kyren Williams','Jaylen Waddle','Christian Watson'];
 const others=P.filter(r=>!owned.includes(r[0])&&r[0]!=='Jayden Reed').sort((a,b)=>mktADP(a)-mktADP(b)).map(r=>r[0]);
 const ord=[],state={};let count=0;
 for(let pick=1;count<owned.length||snapTeam(pick)!==seat;pick++){
  const mine=snapTeam(pick)===seat,name=mine?owned[count++]:others.shift();
  ord.push(name);state[name]=mine?'mine':'gone';
 }
 const blocked=new Set(P.filter(r=>r[1]==='WR'&&r[0]!=='Jayden Reed').map(r=>r[0]));
 const a=advise(state,seat,ord,blocked);
 const reed=a.cands.find(c=>c.now.r[0]==='Jayden Reed');
 assert.ok(reed,'retain the receiver when alternatives are exhausted');
 assert.deepEqual(reed.receiverWith,['Christian Watson'],`seat ${seat}: explain Watson/Reed exposure`);
 assert.ok(reed.clash,'keep the existing shared-bye warning');
}

// This saved-board scenario exercises the preference through advise(), not only the helper.
{
 const owned=['Bijan Robinson','Nico Collins','Kyren Williams','Jaylen Waddle','Christian Watson','Brock Purdy','Colston Loveland','Jaylen Warren'];
 const others=P.filter(r=>!owned.includes(r[0])&&r[0]!=='Jayden Reed').sort((a,b)=>mktADP(a)-mktADP(b)).map(r=>r[0]);
 const ord=[],state={};let count=0;
 for(let pick=1;count<owned.length||snapTeam(pick)!==2;pick++){
  const mine=snapTeam(pick)===2,name=mine?owned[count++]:others.shift();
  ord.push(name);state[name]=mine?'mine':'gone';
 }
 const a=advise(state,2,ord),names=a.cands.map(c=>c.now.r[0]);
 const robinson=a.cands.find(c=>c.now.r[0]==="Wan'Dale Robinson");
 assert.equal(robinson.diversifiesFrom,'Matthew Golden','apply diversity to another Packers receiver in the live advisor');
 assert.ok(names.indexOf("Wan'Dale Robinson")<names.indexOf('Matthew Golden'));
 assert.ok(names.indexOf('Jayden Reed')<names.indexOf("Wan'Dale Robinson"),'retain Reed when his value advantage is clear');
}

// Controlled candidate scores isolate the preference from changing market data.
const pick=(name,score=10,proj=11,receiverWith=[],p='WR',pReach=1)=>({now:{r:[name,p,name==='Reed'?'GB':'IND']},p,score,proj,receiverWith,pReach});
const rank=(...p)=>{preferReceiverDiversity(p);return p;};
let ordered=rank(pick('Reed',10,11,['Watson']),pick('Downs',9.5,10.8));
assert.equal(ordered[0].now.r[0],'Downs','prefer comparable production from another offense');
assert.equal(ordered[0].diversifiesFrom,'Reed');
assert.equal(ordered[0].score,9.5,'the preference must preserve the model score');
assert.equal(ordered[1].proj,11,'the preference must preserve player projections');
for(const alternative of [pick('Downs',9,10.8),pick('Downs',9.5,10.4),pick('Downs',9.5,10.8,[], 'WR',.8)]){
 assert.equal(rank(pick('Reed',10,11,['Watson']),alternative)[0].now.r[0],'Reed','retain a clear score, production or availability advantage');
}
assert.equal(rank(pick('Reed',10,11,['Watson']),pick('Downs',9.5,10.8,['Pittman']))[0].now.r[0],'Reed','avoid moving exposure to another already-owned offense');
assert.equal(rank(pick('Reed'),pick('Downs',9.5,10.8))[0].now.r[0],'Reed','leave unpaired receivers alone');
assert.equal(rank(pick('Reed',10,11,['Watson']),pick('RB',9.5,10.8,[],'RB'))[0].now.r[0],'Reed','preserve positional needs and RB/WR pairings');
assert.equal(rank(pick('Reed',-1,11,['Watson']),pick('Downs',-1.04,10.8))[0].now.r[0],'Downs','handle negative late-round scores');
assert.equal(rank(pick('Reed',0,11,['Watson']),pick('Downs',0,10.8))[0].now.r[0],'Downs','resolve zero-value depth ties');
assert.equal(rank(pick('Reed',.1,11,['Watson']),pick('Downs',.05,10.8))[0].now.r[0],'Reed','preserve meaningful marginal lineup value');
ordered=rank(pick('Reed',10,11,['Watson']),pick('QB',9.8,20,[],'QB'),pick('Downs',9.5,10.8));
assert.deepEqual(ordered.map(c=>c.now.r[0]),['Downs','Reed','QB'],'retain every candidate and stable fallback order');
assert.equal(rank()[0],undefined);
console.log('PASS: receiver diversity, all managed seats, clear value, availability, late depth and positional safeguards');
