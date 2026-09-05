/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-seat2.mjs
 *
 * Brian may be drafting from pick 2 rather than 6. Every study so far covers seats 1, 6 and
 * 10, so this is the seat from scratch.
 *
 * Pick 2 is its own animal. You take one of the two best players in football, then wait twenty
 * picks — the longest gap anyone has — and come back at 23 and 26 nearly together. So the
 * questions are different from seat 6's: not "who is best available", but who is still there
 * after a twenty-pick drought, and what the wheel at 23/26 can be relied on to hold.
 *
 * Everything here is scored week by week with byes live, on Sleeper's projections and the
 * measured 2025 spreads, with a standard error on every number. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf, missShareOf, seasonAvailability } = require(CACHE + 'risk.cjs');

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], idx: POOL.length, adp: s.adp,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss, knownMiss: rk.knownMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const IDX = new Map(POOL.map(p => [p.name, p]));
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(p => p.proj).sort((a,b) => b-a);
  REPL[pos] = v[Math.min({QB:14,RB:32,WR:34,TE:13}[pos]-1, v.length-1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, p.proj - REPL[p.pos]); });

const SLOT = 2;
const MYPICKS = []; for (let r = 1; r <= 14; r++) MYPICKS.push((r-1)*12 + (r%2 ? SLOT : 13-SLOT));

const snap = p => { const r=Math.ceil(p/12), i=p-(r-1)*12; return r%2?i:13-i; };
const mul = a => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = rnd => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = t => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };
function ncdf(z){ if(z<-8)return 0; if(z>8)return 1;
  const t=1/(1+0.2316419*Math.abs(z)), d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return z>0?1-p:p; }
const cache = new Map();
function realise(p,w){ const k=w*100000+p.idx; let v=cache.get(k); if(v!==undefined)return v;
  const rnd=mul(w*7919+p.idx*104729+13); rnd(); rnd();
  const s=Math.sqrt(Math.log(1+p.cv*p.cv));
  v=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*seasonAvailability(p, rnd);
  cache.set(k,v); return v; }
function oppPick(avail,team,rnd){ const c=NEED(team); let b=null,bs=Infinity;
  for(const p of avail){ let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;} } return b; }
function evLater(avail,pos,cur,nextPick){ let ev=REPL[pos],pAll=1;
  for(const p of avail.filter(x=>x.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0,26)){
    const Fk=ncdf((nextPick-p.mkt)/p.sig),Fc=ncdf((cur-p.mkt)/p.sig);
    const den=1-Fc; const pg=den<=0.03?0.97:Math.min(0.97,Math.max(0.01,(Fk-Fc)/den));
    ev+=pAll*(1-pg)*(p.proj-REPL[pos]); pAll*=pg; }
  return ev; }
function freePick(avail,team,cur,nextPick,myCount,forcePos){
  const c=NEED(team), late=myCount>=10;
  let cs=avail.filter(p=>p.pos==='QB'?c.QB<(late?2:1):p.pos==='TE'?c.TE<(late?2:1):c[p.pos]<6);
  if(!cs.length)cs=avail;
  if(forcePos){ const k=cs.filter(p=>p.pos===forcePos); if(k.length)cs=k; }
  const ev={}; for(const pos of ['QB','RB','WR','TE']) ev[pos]=evLater(avail,pos,cur,nextPick);
  const cnt={}; team.forEach(x=>{cnt[x.bye]=(cnt[x.bye]||0)+1;});
  const w=p=>{const n=c[p.pos];
    if(p.pos==='QB')return n===0?1:0.5;
    if(p.pos==='TE')return n===0?0.9:0.45;
    return n<2?1.05:(c.RB+c.WR+c.TE<7?0.8:0.45);};
  const score=p=>w(p)*(p.vorp+1.25*Math.max(0,p.proj-ev[p.pos]))
    *(cnt[p.bye]>=2?0.78:cnt[p.bye]===1?0.88:1);
  return cs.slice().sort((a,b)=>score(b)-score(a))[0];
}
function weekly(R){ let tot=0;
  for(let wk=1;wk<=17;wk++){
    const live=R.filter(x=>x.bye!==wk);
    const by=pos=>live.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
    const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
    const used=new Set(); let pts=0;
    const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
    take(qb,1);take(rb,2);take(wr,2);take(te,1);
    take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
    tot+=pts; }
  return tot/17; }
/* plan[i] is what to do at your i-th pick: a player, a position, or nothing */
function run(plan, w, watchAt) {
  const rnd=mul(1200000+w), avail=POOL.slice(), teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  let mine=0; let alive=null; const took=[];
  for(let pick=1;pick<=168;pick++){
    if(!avail.length)break;
    if(pick===watchAt) alive=new Set(avail.map(p=>p.name));
    const t=snap(pick); let p;
    if(t===SLOT){
      const step=plan[mine];
      if(step&&step.player){ p=IDX.get(step.player); if(!p||!avail.includes(p)) return null; }
      else p=freePick(avail,teams[t],pick,MYPICKS[mine+1]||pick+12,mine,step?step.pos:null);
      took.push(p.name); mine++;
    } else p=oppPick(avail,teams[t],rnd);
    if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return { pts: weekly(teams[SLOT].map(p=>({...p,real:realise(p,1200000+w)}))), alive, took };
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const stat=a=>{ const m=mean(a); const sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/(a.length-1));
  return { m, se: sd/Math.sqrt(a.length) }; };

console.log(`\nSEAT 2 — your picks are ${MYPICKS.slice(0,5).join(', ')} …`);
console.log('Twenty picks between your first and second, then 23 and 26 almost together.\n');

/* ---- 1. the opener ---- */
const W1 = 15000;
const OPEN = ['Jahmyr Gibbs','Bijan Robinson',"Ja'Marr Chase",'Puka Nacua','Christian McCaffrey',
              'Jonathan Taylor','Jaxon Smith-Njigba','Amon-Ra St. Brown'];
console.log(`WHO TO TAKE AT 2 — ${W1.toLocaleString()} seasons each`);
console.log('  candidate              pts/wk    ±SE   there    vs best');
const rows = [];
for (const n of OPEN) {
  if (!IDX.has(n)) continue;
  const out = [];
  for (let w = 0; w < W1; w++) { const r = run([{ player: n }], w); if (r) out.push(r.pts); }
  if (out.length < W1 * 0.05) continue;
  rows.push({ n, ...stat(out), avail: out.length / W1 * 100 });
}
rows.sort((a,b)=>b.m-a.m);
const best = rows[0];
rows.forEach(r => {
  const d = best.m - r.m, se = Math.sqrt(best.se**2 + r.se**2);
  console.log(`  ${r.n.padEnd(22)}${r.m.toFixed(2).padStart(7)}  ${r.se.toFixed(3)} ${r.avail.toFixed(0).padStart(5)}%   ${r === best ? 'BEST' : d > 2*se ? `-${d.toFixed(2)}` : 'tied'}`);
});

/* ---- 2. what survives the twenty-pick wait ---- */
console.log(`\nWHAT IS LEFT AT 23 — the cost of the longest gap in the draft`);
const W2 = 6000;
const surv = {};
for (let w = 0; w < W2; w++) {
  const r = run([{ player: best.n }], w, 23);
  if (!r || !r.alive) continue;
  r.alive.forEach(n => { surv[n] = (surv[n] || 0) + 1; });
}
const cands = POOL.filter(p => p.adp !== undefined && p.adp >= 12 && p.adp <= 45)
  .map(p => ({ n: p.name, pos: p.pos, adp: p.adp, proj: p.proj, s: (surv[p.name] || 0) / W2 }))
  .sort((a,b) => b.proj - a.proj).slice(0, 12);
console.log('  the best players you can realistically still get, by projection:');
cands.forEach(c => console.log(`    ${c.n.padEnd(22)}${c.pos}  proj ${c.proj.toFixed(1).padStart(5)}  ADP ${String(c.adp).padStart(5)}   there at 23: ${(c.s*100).toFixed(0)}%`));

/* ---- 3. the 23/26 wheel ---- */
console.log(`\nTHE WHEEL AT 23 AND 26 — what shape to come back in`);
const W3 = 8000;
const PLANS = [
  ['let the model choose both',    [{ player: best.n }]],
  ['RB then RB',                   [{ player: best.n }, { pos:'RB' }, { pos:'RB' }]],
  ['RB then WR',                   [{ player: best.n }, { pos:'RB' }, { pos:'WR' }]],
  ['WR then RB',                   [{ player: best.n }, { pos:'WR' }, { pos:'RB' }]],
  ['WR then WR',                   [{ player: best.n }, { pos:'WR' }, { pos:'WR' }]],
  ['TE then RB',                   [{ player: best.n }, { pos:'TE' }, { pos:'RB' }]],
];
console.log(`  opening ${best.n}, ${W3.toLocaleString()} seasons each`);
const wheel = [];
for (const [label, plan] of PLANS) {
  const out = [];
  for (let w = 0; w < W3; w++) { const r = run(plan, w); if (r) out.push(r.pts); }
  if (out.length) wheel.push({ label, ...stat(out) });
}
wheel.sort((a,b)=>b.m-a.m);
const wb = wheel[0];
wheel.forEach(r => {
  const d = wb.m - r.m, se = Math.sqrt(wb.se**2 + r.se**2);
  console.log(`    ${r.label.padEnd(26)}${r.m.toFixed(2).padStart(7)}  ±${r.se.toFixed(3)}   ${r === wb ? 'BEST' : d > 2*se ? `-${d.toFixed(2)}` : 'tied'}`);
});
console.log('');
