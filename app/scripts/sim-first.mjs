/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-first.mjs
 * sim-build.mjs transpiles src/data.ts and src/sleeper.ts into .simcache/.
 * Opponents are priced off Sleeper's real half-PPR ADP (SLP[name].adp). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
/* Which first pick, on the corrected model? Force each candidate, best-available after,
   play the season out with paired per-player seasons. */
const fs = require('fs');
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');


const PPG = { QB: r=>Math.max(14,23.5-0.32*r), RB: r=>12.5*Math.exp(-(r-1)/20)+5.8,
  WR: r=>11.5*Math.exp(-(r-1)/26)+6.2, TE: r=>8.5*Math.exp(-(r-1)/7)+5 };
const RISK={buy:1.02,solid:1,risk:0.93,avoid:0.86};
const BASE_CV={QB:0.26,RB:0.44,WR:0.40,TE:0.42}, RISK_CV={buy:0.95,solid:1.0,risk:1.22,avoid:1.32};
const BASE_MISS={QB:0.14,RB:0.30,WR:0.22,TE:0.24};
const POOL=[]; { const c={QB:0,RB:0,WR:0,TE:0};
  P.forEach((r,i)=>{ if(c[r[1]]===undefined)return; const pr=++c[r[1]];
    const ffc=MKT[r[0]]?MKT[r[0]][0]:r[3], s=SLP[r[0]]||{};
    const mkt=s.adp!==undefined?0.75*s.adp+0.25*ffc:ffc;
    const hurt=['O','IR','PUP','SUS'].includes(s.inj)?0.85:s.inj==='D'?0.95:1;
    POOL.push({name:r[0],pos:r[1],ourRank:i+1,idx:POOL.length,
      proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : PPG[r[1]](pr),   /* riskOf already prices verdict and injury */
      cv: riskOf(r[0], r[1], r[4]).cv,
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(0.5,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0}); }); }

/* ---- value, not board position ---------------------------------------------------------
 * `ourRank` used to be the row's index in data.ts — a hand-curated opinion standing in for a
 * measurement. Every sort site below reads it, so rather than touch them all, it is now
 * assigned from value over replacement on availability-adjusted points: the same basis the
 * advisor and the season loop use. Replacement ranks are the measured ones (sim-replacement).
 *
 * This is the same proxy-for-value mistake fixed in the advisor, then in sim-seats and
 * sim-rbrun, then in sim-tree. It survived here because nothing reads these numbers except a
 * panel nobody was checking against anything. */
{
  const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };
  const adj = (p) => p.proj * (1 - 0.4 * (p.pMiss ?? 0.25));
  const REPL = {};
  for (const pos of ['QB','RB','WR','TE']) {
    const v = POOL.filter(p => p.pos === pos).map(adj).sort((a,b) => b-a);
    REPL[pos] = v[Math.min(REPL_RANK[pos]-1, v.length-1)] || 0;
  }
  POOL.forEach(p => { p.vorp = Math.max(0.2, adj(p) - REPL[p.pos]); });
  POOL.slice().sort((a,b) => b.vorp - a.vorp).forEach((p, i) => { p.ourRank = i + 1; });
}
const IDX=new Map(POOL.map(p=>[p.name,p]));
const snap=p=>{const r=Math.ceil(p/12),i=p-(r-1)*12;return r%2?i:13-i;};
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const gauss=rnd=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const NEED=t=>{const c={QB:0,RB:0,WR:0,TE:0};t.forEach(x=>c[x.pos]++);return c;};
const cache=new Map();
function realiseFor(p,w){const k=w*100000+p.idx; let v=cache.get(k); if(v!==undefined)return v;
  const rnd=mul(w*7919+p.idx*104729+13); rnd();rnd();
  const s=Math.sqrt(Math.log(1+p.cv*p.cv));
  const ppg=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2);
  v=ppg*(rnd()<p.pMiss?0.35+0.5*rnd():1); cache.set(k,v); return v; }
function oppPick(avail,team,rnd){const c=NEED(team);let b=null,bs=Infinity;
  for(const p of avail){let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;}} return b;}
function bestAvail(avail,team){const c=NEED(team);
  const ok=['RB','WR','TE','QB'].filter(pos=>pos==='QB'?c.QB<2:pos==='TE'?c.TE<2:c[pos]<6);
  const cs=avail.filter(p=>ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];}
function run(slot,forceName,w){
  const rnd=mul(20000+w); const avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[]; let mine=0;
  for(let pick=1;pick<=168;pick++){ if(!avail.length)break; const t=snap(pick); let p;
    if(t===slot){ if(mine===0&&forceName){p=IDX.get(forceName); if(!p||!avail.includes(p))return null;}
      else p=bestAvail(avail,teams[t]); mine++; }
    else p=oppPick(avail,teams[t],rnd);
    if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1); }
  const R=teams[slot].map(p=>({...p,real:realiseFor(p,w)}));
  const by=pos=>R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set(); let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}
const WORLDS=2500, out={};
for (const slot of [1,2,10]) {
  const first=(slot%2?slot:13-slot);
  const cands=POOL.filter(p=>p.mkt<=first+32).sort((a,b)=>a.ourRank-b.ourRank).slice(0,22);
  const rows=[];
  for(const F of cands){ let sum=0,n=0;
    for(let w=0;w<WORLDS;w++){const v=run(slot,F.name,w); if(v!==null){sum+=v;n++;}}
    if(n>=WORLDS*0.08) rows.push({name:F.name,pos:F.pos,pts:+(sum/n).toFixed(2),avail:Math.round(n/WORLDS*100)}); }
  rows.sort((a,b)=>b.pts-a.pts);
  out[slot]=rows.slice(0,9);
  console.log(`\nslot ${slot}:`);
  out[slot].forEach(r=>console.log(`   ${r.name.padEnd(24)} ${r.pos}  ${r.pts.toFixed(2)}  there ${r.avail}%`));
}
fs.writeFileSync(CACHE + 'first_pick.json', JSON.stringify(out,null,2));
