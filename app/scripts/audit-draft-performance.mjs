// Both versions use the same inputs and opponent/player random numbers.
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),app=new URL('../',import.meta.url).pathname,cache=app+'.simcache/';
const baselineRef=process.env.DRAFT_BASELINE_REF??'c8a093f206cd36e1534c23cfb900b2735528a8ab';
const baselineSource=execFileSync('git',['show',`${baselineRef}:app/src/lib/advisor.ts`],{cwd:app,encoding:'utf8'});
await build({entryPoints:[app+'src/lib/advisor.ts'],bundle:true,platform:'node',format:'cjs',outfile:cache+'performance-baseline.cjs',logLevel:'silent',plugins:[{name:'previous-advisor',setup(b){b.onLoad({filter:/\/src\/lib\/advisor\.ts$/},()=>({loader:'ts',contents:baselineSource}));}}]});
await build({entryPoints:[app+'src/lib/advisor.ts'],bundle:true,platform:'node',format:'cjs',outfile:cache+'performance-candidate.cjs',logLevel:'silent'});
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const inputHashes=Object.fromEntries(['data','projections','sleeper','risk'].map(k=>[k,hash(cache+k+'.cjs')]));
const policies={baseline:require(cache+'performance-baseline.cjs').advise,candidate:require(cache+'performance-candidate.cjs').advise};
const {P,MKT,BYE,CUFFS,TOOL_USERS}=require(cache+'data.cjs'),{SLP}=require(cache+'sleeper.cjs'),{PROJ}=require(cache+'projections.cjs'),{CUFF_K,riskOf,cuffUplift,unavailableInWeek}=require(cache+'risk.cjs');
const seats=TOOL_USERS.filter(([name])=>['Ashley','Brian JK','Emily'].includes(name));
if(seats.length!==3)throw Error('Expected all three requested managers');
const worlds=Number(process.argv[2]??20),offset=Number(process.argv[3]??0),output=process.argv[4]??cache+'draft-performance.json';
mkdirSync(dirname(output),{recursive:true});
if(!Number.isInteger(worlds)||worlds<1||!Number.isInteger(offset))throw Error('Invalid run size');
const pool=P.filter(p=>['QB','RB','WR','TE'].includes(p[1])).map((r,i)=>({name:r[0],pos:r[1],team:r[2],i,market:.75*(SLP[r[0]]?.adp??r[3])+.25*(MKT[r[0]]?.[0]??r[3]),points:(PROJ[r[0]]??0)+cuffUplift(r[0]),bye:BYE[r[2]]??0,...riskOf(r[0],r[1],r[4])}));
for(const p of pool){const starter=pool.find(st=>CUFFS[st.name]===p.name&&st.team===p.team);if(starter){p.starter=starter;p.points-=cuffUplift(p.name);}}
function random(...keys){let x=2166136261;for(const key of keys)x=Math.imul(x^key,16777619);return()=>{x+=0x6D2B79F5;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const normal=r=>Math.sqrt(-2*Math.log(Math.max(r(),1e-12)))*Math.cos(2*Math.PI*r());
const snap=p=>Math.ceil(p/12)%2?(p-1)%12+1:12-(p-1)%12;
const counts=t=>Object.fromEntries(['QB','RB','WR','TE'].map(pos=>[pos,t.filter(p=>p.pos===pos).length]));
const timing={baseline:[],candidate:[]},failures=[];
function draft(policy,world,room){
 const teams=Array.from({length:13},()=>[]),avail=pool.slice(),ord=[];
 for(let pick=1;pick<=168;pick++){
  const seat=snap(pick),team=teams[seat],c=counts(team);let chosen;
  if(seats.some(([,s])=>s===seat)){
   const own=new Set(team.map(p=>p.name)),state=Object.fromEntries(ord.map(n=>[n,own.has(n)?'mine':'gone']));
   const started=performance.now(),a=policies[policy](state,seat,ord);timing[policy].push(performance.now()-started);
   chosen=avail.find(p=>p.name===a.cands[0]?.now.r[0]);
   if(!chosen||!a.onClock||!Number.isFinite(a.cands[0]?.score))throw Error(`${policy} illegal decision ${room} ${world} ${pick}`);
   if(['QB','TE'].includes(chosen.pos)&&c[chosen.pos]>=2)failures.push(`${policy} third ${chosen.pos}`);
  }else{
   const needs={QB:Math.max(0,1-c.QB),RB:Math.max(0,2-c.RB),WR:Math.max(0,2-c.WR),TE:Math.max(0,1-c.TE)},must=14-team.length<=Object.values(needs).reduce((a,b)=>a+b,0);let best=Infinity;
   for(const p of avail){if(must&&!needs[p.pos])continue;
    let v=p.market+normal(random(world,pick,p.i,7))*Math.max(.5,.13*p.market)*.9;
    if(room==='rb-run'&&pick<=72&&p.pos==='RB')v-=18;
    if(room==='wr-run'&&pick<=72&&p.pos==='WR')v-=18;
    if(room==='qb-te-run'&&pick<=84&&['QB','TE'].includes(p.pos)&&c[p.pos]===0)v-=25;
    if(['QB','TE'].includes(p.pos))v+=c[p.pos]>=2?1000:c[p.pos]===1?65:0;
    if(['RB','WR'].includes(p.pos)&&c[p.pos]>=6)v+=75;
    if(v<best){best=v;chosen=p;}
   }
  }
  if(!chosen)throw Error('Exhausted pool');teams[seat].push(chosen);ord.push(chosen.name);avail.splice(avail.indexOf(chosen),1);
 }
 for(const[,seat]of seats){const c=counts(teams[seat]);if(c.QB<1||c.RB<2||c.WR<2||c.TE<1||teams[seat].length!==14)failures.push(`${policy} incomplete ${seat}`);}
 return {teams,avail};
}
function starters(team){const used=new Set(),chosen=[];for(const[pos,n]of Object.entries({QB:1,RB:2,WR:2,TE:1})){for(const p of team.filter(p=>p.pos===pos).sort((a,b)=>b.points-a.points).slice(0,n)){used.add(p.name);chosen.push(p);}}chosen.push(...team.filter(p=>p.pos!=='QB'&&!used.has(p.name)).sort((a,b)=>b.points-a.points).slice(0,2));return chosen;}
// Separate draws from the live ranking evaluator. Select starters before revealing outcomes.
function evaluate(team,world,environment,avail){let total=0,empty=0;
 for(let outcome=0;outcome<12;outcome++)for(let week=1;week<=17;week++){
  const isActive=p=>p.bye!==week&&!unavailableInWeek(p,week,random(world,outcome,week,p.i,901));
  const weeklyPlayer=p=>({...p,points:p.points+(p.starter&&!isActive(p.starter)?CUFF_K*p.starter.points:0)});
  const active=team.filter(isActive).map(weeklyPlayer);
  let lineup=starters(active);empty+=8-lineup.length;
  // Generous streaming scenario: add one available free agent whenever it improves the lineup.
  // Tests upgrades over weak rostered starters too, rather than only filling empty slots.
  if(environment==='streaming'){
   const eligible=avail.filter(isActive).map(weeklyPlayer);
   const shortlist=['QB','RB','WR','TE'].flatMap(pos=>eligible.filter(p=>p.pos===pos).sort((a,b)=>b.points-a.points).slice(0,1));
   let best=lineup.reduce((sum,p)=>sum+p.points,0);
   for(const p of shortlist){const trial=starters([...active,p]),score=trial.reduce((sum,p)=>sum+p.points,0);if(score>best){best=score;lineup=trial;}}
  }
  for(const p of lineup){const r=random(world,outcome,p.i,431),cv=Math.sqrt(Math.log(1+p.cv*p.cv));const seasonError=Math.exp(normal(r)*cv-cv*cv/2);const tilt=environment==='rb-down'&&p.pos==='RB'?.85:environment==='wr-down'&&p.pos==='WR'?.85:1;total+=p.points*seasonError*tilt;}

 }
 return {ppw:total/(12*17),emptyPerWeek:empty/(12*17)};
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const summarize=a=>{const m=mean(a),se=a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)/a.length):0;return {mean:m,ci95:[m-1.96*se,m+1.96*se],n:a.length};};
const results={};
for(const room of ['market','rb-run','wr-run','qb-te-run']){
 for(let w=0;w<worlds;w++){
  const world=offset+w,drafts=Object.fromEntries(Object.keys(policies).map(k=>[k,draft(k,world,room)]));
  for(const[name,seat]of seats)for(const environment of ['baseline','rb-down','wr-down','streaming']){
   const key=`${name}/${room}/${environment}`,a=evaluate(drafts.baseline.teams[seat],world,environment,drafts.baseline.avail),b=evaluate(drafts.candidate.teams[seat],world,environment,drafts.candidate.avail);
   results[key]??={baseline:[],candidate:[],difference:[],emptyDifference:[]};const r=results[key];r.baseline.push(a.ppw);r.candidate.push(b.ppw);r.difference.push(b.ppw-a.ppw);r.emptyDifference.push(b.emptyPerWeek-a.emptyPerWeek);
  }
 }
 writeFileSync(output+'.checkpoint',JSON.stringify({room,results,failures}));
 console.log(`${room}: ${worlds*2} complete drafts`);
}
const out={baselineRef,worldsPerRoom:worlds,seedOffset:offset,totalDrafts:worlds*4*2,decisions:Object.fromEntries(Object.entries(timing).map(([k,a])=>[k,{n:a.length,meanMs:mean(a),p95Ms:a.sort((x,y)=>x-y)[Math.floor(a.length*.95)],maxMs:Math.max(...a)}])),failures,inputs:inputHashes,advisorHashes:Object.fromEntries(Object.keys(policies).map(k=>[k,hash(cache+'performance-'+k+'.cjs')])),results:Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{baseline:mean(r.baseline),candidate:mean(r.candidate),delta:summarize(r.difference),preStreamingEmptySlotDelta:mean(r.emptyDifference)}]))};
writeFileSync(output,JSON.stringify(out,null,2));
unlinkSync(output+'.checkpoint');
for(const[name]of seats){const rows=Object.entries(out.results).filter(([k])=>k.startsWith(name+'/')&&k.endsWith('/baseline'));console.log(name,rows.map(([k,r])=>`${k.split('/')[1]} ${r.delta.mean.toFixed(2)} [${r.delta.ci95.map(x=>x.toFixed(2)).join(',')}]`).join(' | '));}
console.log(JSON.stringify({failures:failures.length,timing:out.decisions}));if(failures.length)process.exitCode=1;
