/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-all.mjs
 * sim-build.mjs transpiles src/data.ts and src/sleeper.ts into .simcache/.
 * Opponents are priced off Sleeper's real half-PPR ADP (SLP[name].adp). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
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
    POOL.push({name:r[0],pos:r[1],team:r[2],ourRank:i+1,idx:POOL.length,posRank:pr,
      sadp: s.adp, ffc,
      proj: (PROJ[r[0]] !== undefined ? PROJ[r[0]] : PPG[r[1]](pr)) * (RISK[r[4]] || 1) * hurt,
      cv: riskOf(r[0], r[1], r[4]).cv,
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(0.5,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0,tag:r[4]}); }); }

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
  v=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*(rnd()<p.pMiss?0.35+0.5*rnd():1);
  cache.set(k,v); return v; }
function oppPick(avail,team,rnd){const c=NEED(team);let b=null,bs=Infinity;
  for(const p of avail){let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;}} return b;}
function tplPick(avail,team,tpl,round){const c=NEED(team),want=tpl[round-1];
  if(want){const k=avail.filter(p=>p.pos===want); if(k.length)return k.sort((a,b)=>a.ourRank-b.ourRank)[0];}
  const ok=['RB','WR','TE','QB'].filter(pos=>pos==='QB'?c.QB<2:pos==='TE'?c.TE<2:c[pos]<6);
  const cs=avail.filter(p=>ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];}
function lineup(R){const by=pos=>R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set(); let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}

const BEST_TPL = { 1:['RB','WR','WR','RB','TE','QB'], 6:['WR','RB','WR','RB','TE','QB'], 10:['RB','RB','WR','WR','TE','QB'] };
const BEST_LABEL = { 1:'RB-WR-WR-RB', 6:'WR-RB-WR-RB', 10:'RB-RB-WR-WR' };
const WORLDS = 4000;
const out = { plans:{}, cliff:{}, h2h:[], arbitrage:{}, runTiming:[] };

/* ---------- A + B: plans and scarcity, from the same runs ---------- */
for (const slot of [1,6,10]) {
  const myPicks=[]; for(let r=1;r<=6;r++) myPicks.push((r-1)*12+(r%2?slot:13-slot));
  const tookAt = myPicks.map(()=>({}));
  const bestBy = myPicks.map(()=>({RB:[],WR:[],TE:[],QB:[]}));
  const totals=[];
  for(let w=0;w<WORLDS;w++){
    const rnd=mul(20000+w), avail=POOL.slice(), teams={};
    for(let t=1;t<=12;t++)teams[t]=[]; let mine=0;
    for(let pick=1;pick<=168;pick++){ if(!avail.length)break; const t=snap(pick); let p;
      if(t===slot){
        const mi=myPicks.indexOf(pick);
        if(mi>=0){ for(const pos of ['RB','WR','TE','QB']){
          const b=avail.filter(x=>x.pos===pos).sort((a,b2)=>b2.proj-a.proj)[0];
          bestBy[mi][pos].push(b?b.proj:0); } }
        p=tplPick(avail,teams[t],BEST_TPL[slot],Math.ceil(pick/12)); mine++;
        if(mi>=0&&p) tookAt[mi][p.name]=(tookAt[mi][p.name]||0)+1;
      } else p=oppPick(avail,teams[t],rnd);
      if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1); }
    totals.push(lineup(teams[slot].map(p=>({...p,real:realiseFor(p,w)}))));
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  out.plans[slot]={ strategy:BEST_LABEL[slot], ppw:+mean(totals).toFixed(1),
    picks: myPicks.map((pk,i)=>({ pick:pk,
      opts: Object.entries(tookAt[i]).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .filter(([,n])=>n/WORLDS>=0.08)
        .map(([nm,n])=>[nm, Math.round(n/WORLDS*100)]) })) };
  out.cliff[slot]=myPicks.map((pk,i)=>({ pick:pk,
    rb:+mean(bestBy[i].RB).toFixed(1), wr:+mean(bestBy[i].WR).toFixed(1),
    te:+mean(bestBy[i].TE).toFixed(1), qb:+mean(bestBy[i].QB).toFixed(1) }));
  console.log(`\nseat ${slot} (${BEST_LABEL[slot]}, ${mean(totals).toFixed(1)} pts/wk)`);
  out.plans[slot].picks.forEach(p=>console.log(`   #${String(p.pick).padEnd(4)}${p.opts.map(o=>o[0]+' '+o[1]+'%').join('  ·  ')}`));
}

/* ---------- C: which seat is actually best, all three drafting identically ---------- */
{
  const seats=[1,6,10], scores={1:[],6:[],10:[]}, wins={1:0,6:0,10:0};
  for(let w=0;w<WORLDS;w++){
    const rnd=mul(31000+w), avail=POOL.slice(), teams={};
    for(let t=1;t<=12;t++)teams[t]=[];
    for(let pick=1;pick<=168;pick++){ if(!avail.length)break; const t=snap(pick);
      /* our three seats all use the same board-first policy; the other nine use ADP */
      const p = seats.includes(t) ? tplPick(avail,teams[t],BEST_TPL[t],Math.ceil(pick/12))
                                  : oppPick(avail,teams[t],rnd);
      if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1); }
    const v={}; seats.forEach(s=>{ v[s]=lineup(teams[s].map(p=>({...p,real:realiseFor(p,w)}))); scores[s].push(v[s]); });
    wins[seats.sort((a,b)=>v[b]-v[a])[0]]++;
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const who={1:'Ashley',6:'Brian JK',10:'Emily'};
  out.h2h=[1,6,10].map(s=>({ who:who[s], slot:s, avg:+mean(scores[s]).toFixed(1), best:Math.round(wins[s]/WORLDS*100) }));
  console.log('\nseat head-to-head (all three drafting the same way, same league):');
  out.h2h.forEach(r=>console.log(`   ${r.who.padEnd(10)} pick ${String(r.slot).padEnd(3)} ${r.avg} pts/wk   best team ${r.best}% of the time`));
}

/* ---------- D: ADP arbitrage — who Sleeper's room lets fall ---------- */
{
  const rows=POOL.filter(p=>p.sadp!==undefined&&p.sadp<=150)
    .map(p=>({name:p.name,pos:p.pos,tag:p.tag,ourRank:p.ourRank,sadp:p.sadp,gap:+(p.sadp-p.ourRank).toFixed(1)}));
  out.arbitrage.falls=rows.filter(r=>r.gap>=12).sort((a,b)=>b.gap-a.gap).slice(0,14);
  out.arbitrage.traps=rows.filter(r=>r.gap<=-12).sort((a,b)=>a.gap-b.gap).slice(0,14);
  console.log('\nBIGGEST VALUE FALLS on Sleeper (our rank far better than what the room pays):');
  out.arbitrage.falls.forEach(r=>console.log(`   ${r.name.padEnd(24)} ${r.pos}  our #${String(r.ourRank).padEnd(4)} Sleeper ADP ${String(r.sadp).padEnd(6)} +${r.gap}`));
  console.log('\nBIGGEST TRAPS (the room pays well above our valuation):');
  out.arbitrage.traps.forEach(r=>console.log(`   ${r.name.padEnd(24)} ${r.pos}  our #${String(r.ourRank).padEnd(4)} Sleeper ADP ${String(r.sadp).padEnd(6)} ${r.gap}`));
}

/* ---------- E: when does each position actually go? ---------- */
{
  for (let round=1; round<=10; round++) {
    const upto=round*12;
    const row={round};
    for(const pos of ['RB','WR','TE','QB'])
      row[pos]=POOL.filter(p=>p.pos===pos&&p.sadp!==undefined&&p.sadp<=upto).length;
    out.runTiming.push(row);
  }
  console.log('\nPLAYERS GONE BY END OF EACH ROUND (real Sleeper half-PPR ADP):');
  console.log('   round   RB   WR   TE   QB');
  out.runTiming.forEach(r=>console.log(`   ${String(r.round).padStart(5)} ${String(r.RB).padStart(4)} ${String(r.WR).padStart(4)} ${String(r.TE).padStart(4)} ${String(r.QB).padStart(4)}`));
}

fs.writeFileSync(CACHE + 'sim_all.json', JSON.stringify(out,null,2));
console.log('\nwrote sim_all.json');
