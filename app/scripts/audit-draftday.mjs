import {TOOL_USERS} from './study-seats.mjs';
// Exercise the real browser advisor for all tool users in the same stochastic room.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),app=new URL('../',import.meta.url).pathname,cache=app+'.simcache/';
execFileSync('npx',['esbuild','src/lib/advisor.ts','--bundle','--format=cjs',`--outfile=${cache}advisor-live.cjs`,'--log-level=error'],{cwd:app});
const {advise}=require(`${cache}advisor-live.cjs`),{P,MKT}=require(`${cache}data.cjs`),{SLP}=require(`${cache}sleeper.cjs`),{PROJ}=require(`${cache}projections.cjs`),{riskOf,cuffUplift,missShareOf}=require(`${cache}risk.cjs`);
const pool=P.filter(r=>['QB','RB','WR','TE'].includes(r[1])).map(r=>{
 const market=0.75*(SLP[r[0]]?.adp??MKT[r[0]]?.[0]??r[3])+0.25*(MKT[r[0]]?.[0]??r[3]);
 return {name:r[0],pos:r[1],market,sigma:Math.max(MKT[r[0]]?.[1]??0,0.13*market,0.5),value:((PROJ[r[0]]??0)+cuffUplift(r[0]))*(1-missShareOf(riskOf(r[0],r[1],r[4])))};
});
const replacement={};for(const pos of ['QB','RB','WR','TE'])replacement[pos]=pool.filter(p=>p.pos===pos).map(p=>p.value).sort((a,b)=>b-a)[{QB:11,RB:30,WR:39,TE:12}[pos]]??0;
const snap=p=>{const r=Math.ceil(p/12),i=p-(r-1)*12;return r%2?i:13-i;};
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const gauss=r=>Math.sqrt(-2*Math.log(Math.max(1e-12,r())))*Math.cos(2*Math.PI*r());
const counts=team=>Object.fromEntries(['QB','RB','WR','TE'].map(p=>[p,team.filter(x=>x.pos===p).length]));
const worlds=Number(process.argv[2]??100),seats=TOOL_USERS.map(([,seat])=>seat),results={},failures=[];
let calls=0,maxMs=0,totalMs=0;
for(const room of ['market','early-rb-run','value-aware']){
 const frequencies=Object.fromEntries(seats.map(s=>[s,Array.from({length:6},()=>({}))]));
 for(let w=0;w<worlds;w++){
  const rnd=mul(830000+w),available=pool.slice(),teams=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,[]])),ord=[];
  for(let pick=1;pick<=168;pick++){
   const seat=snap(pick),team=teams[seat];let chosen;
   if(seats.includes(seat)){
    const own=new Set(team.map(p=>p.name)),state=Object.fromEntries(ord.map(n=>[n,own.has(n)?'mine':'gone']));
    const start=performance.now(),advice=advise(state,seat,ord),elapsed=performance.now()-start;calls++;totalMs+=elapsed;maxMs=Math.max(maxMs,elapsed);
    const top=advice.cands[0];chosen=available.find(p=>p.name===top?.now.r[0]);
    if(!chosen||!advice.onClock||!Number.isFinite(top.score)){failures.push(`${room} world${w} seat${seat} pick${pick}: invalid advice; top=${top?.now.r[0]} score=${top?.score} onClock=${advice.onClock} owned=${JSON.stringify(counts(team))} remaining=${available.map(p=>p.name+':'+p.pos).join(',')}`);break;}
    const c=counts(team);
    if((chosen.pos==='QB'||chosen.pos==='TE')&&c[chosen.pos]>=2)failures.push(`${room} world${w} pick${pick}: third ${chosen.pos}`);
    if(team.length<6){const f=frequencies[seat][team.length];f[chosen.name]=(f[chosen.name]??0)+1;}
   }else{
    const c=counts(team);let best=Infinity;
    const needs={QB:Math.max(0,1-c.QB),RB:Math.max(0,2-c.RB),WR:Math.max(0,2-c.WR),TE:Math.max(0,1-c.TE)};
    const must=14-team.length<=Object.values(needs).reduce((a,b)=>a+b,0);
    for(const p of available){
     if(must&&!needs[p.pos])continue;
     let score=p.market+gauss(rnd)*p.sigma*0.8;
     if(room==='early-rb-run'&&pick<=60&&p.pos==='RB')score-=15;
     if(room==='value-aware')score=-10*(p.value-replacement[p.pos])+(c[p.pos]>=({QB:1,RB:2,WR:2,TE:1}[p.pos])?35:0)+gauss(rnd)*4;
     if(p.pos==='QB')score+=c.QB>=2?900:c.QB>=1?60:0;
     if(p.pos==='TE')score+=c.TE>=2?900:c.TE>=1?50:0;
     if((p.pos==='RB'||p.pos==='WR')&&c[p.pos]>=5)score+=25;
     if(score<best){best=score;chosen=p;}
    }
    chosen??=available[0];
   }
   if(!chosen){failures.push(`${room} world${w}: pool exhausted`);break;}
   teams[seat].push(chosen);ord.push(chosen.name);available.splice(available.indexOf(chosen),1);
  }
  if(new Set(ord).size!==168)failures.push(`${room} world${w}: duplicate or incomplete draft`);
  for(const seat of seats){const c=counts(teams[seat]);if(teams[seat].length!==14||c.QB<1||c.RB<2||c.WR<2||c.TE<1)failures.push(`${room} world${w} seat${seat}: unfilled starting positions`);}
 }
 results[room]={worlds,frequencies};console.log(`${room}: ${worlds} full drafts with all ${seats.length} using the real advisor; ${failures.length} failures so far`);
}
writeFileSync(cache+'draftday-audit.json',JSON.stringify({worldsPerRoom:worlds,totalDrafts:3*worlds,advisorCalls:calls,averageMilliseconds:totalMs/calls,maxMilliseconds:maxMs,failures,results},null,2));
console.log(`RESULT: ${failures.length} FAIL; ${calls} live advisor decisions; average ${(totalMs/calls).toFixed(1)} ms`);
if(failures.length)console.log(failures.slice(0,12).join('\n'));
process.exitCode=failures.length?1:0;
