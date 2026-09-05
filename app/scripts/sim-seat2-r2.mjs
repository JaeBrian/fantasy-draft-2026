/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-seat2-r2.mjs
 *
 * Seat 2, round 2. The seat study answered it by position — do not come back chasing running
 * backs — which is the right shape but not a pick. This answers it by name: having taken Bijan
 * at 2, who exactly should you take at 23, and then at 26?
 *
 * Only players who actually survive the twenty-pick wait are worth testing, so candidates are
 * drawn from what is genuinely still on the board rather than from a wishlist. Availability is
 * reported next to every name because a better player you cannot have is worth less than a
 * good one you can.
 *
 * Week by week with byes live, standard error on everything, nothing forced after the pick
 * being tested. */
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

const SLOT = 2, OPENER = 'Bijan Robinson';
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
function freePick(avail,team,cur,nextPick,myCount){
  const c=NEED(team), late=myCount>=10;
  let cs=avail.filter(p=>p.pos==='QB'?c.QB<(late?2:1):p.pos==='TE'?c.TE<(late?2:1):c[p.pos]<6);
  if(!cs.length)cs=avail;
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
/* forced: name to take at pick 23 (index 1) and optionally at 26 (index 2) */
function run(forced, w, snapshotAt) {
  const rnd=mul(1400000+w), avail=POOL.slice(), teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  let mine=0, snap23=null, third=null;
  for(let pick=1;pick<=168;pick++){
    if(!avail.length)break;
    if(pick===snapshotAt) snap23=new Set(avail.map(p=>p.name));
    const t=snap(pick); let p;
    if(t===SLOT){
      const want=forced[mine];
      if(want){ p=IDX.get(want); if(!p||!avail.includes(p)) return null; }
      else p=freePick(avail,teams[t],pick,MYPICKS[mine+1]||pick+12,mine);
      if(mine===2) third=p.name;
      mine++;
    } else p=oppPick(avail,teams[t],rnd);
    if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return { pts: weekly(teams[SLOT].map(p=>({...p,real:realise(p,1400000+w)}))), snap23, third };
}
const stat=a=>{ const m=a.reduce((x,y)=>x+y,0)/a.length;
  const sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/(a.length-1));
  return { m, se: sd/Math.sqrt(a.length) }; };

console.log(`\nSEAT 2, ROUND 2 — you took ${OPENER} at 2. Now pick 23.\n`);

/* who is genuinely available at 23 often enough to be worth testing */
const W0 = 5000, seen = {};
for (let w = 0; w < W0; w++) {
  const r = run([OPENER], w, 23);
  if (r?.snap23) r.snap23.forEach(n => { seen[n] = (seen[n] || 0) + 1; });
}
const CANDS = POOL
  .filter(p => (seen[p.name] || 0) / W0 >= 0.25 && p.adp !== undefined && p.adp <= 60)
  .sort((a, b) => b.proj - a.proj)
  .slice(0, 10)
  .map(p => p.name);

const W = 10000;
console.log(`  ${W.toLocaleString()} seasons per candidate, nothing forced after pick 23\n`);
console.log('  take at 23             pos  proj   there    pts/wk    ±SE    verdict');
const rows = [];
for (const n of CANDS) {
  const out = [], thirds = {};
  for (let w = 0; w < W; w++) {
    const r = run([OPENER, n], w);
    if (!r) continue;
    out.push(r.pts);
    thirds[r.third] = (thirds[r.third] || 0) + 1;
  }
  if (out.length < W * 0.1) continue;
  const top = Object.entries(thirds).sort((a,b)=>b[1]-a[1])[0];
  rows.push({ n, pos: IDX.get(n).pos, proj: IDX.get(n).proj,
    avail: (seen[n] || 0) / W0 * 100, ...stat(out),
    then: top ? `${top[0]} ${(top[1]/out.length*100).toFixed(0)}%` : '' });
}
rows.sort((a,b) => b.m - a.m);
const best = rows[0];
rows.forEach(r => {
  const d = best.m - r.m, se = Math.sqrt(best.se**2 + r.se**2);
  const v = r === best ? 'BEST' : d > 2*se ? `-${d.toFixed(2)}` : 'tied';
  console.log(`  ${r.n.padEnd(22)}${r.pos.padEnd(5)}${r.proj.toFixed(1).padStart(5)}${r.avail.toFixed(0).padStart(7)}%${r.m.toFixed(2).padStart(10)}  ${r.se.toFixed(3)}  ${v}`);
});

console.log(`\n  and then at 26, after each of the top three at 23:`);
rows.slice(0, 3).forEach(r => console.log(`    ${r.n.padEnd(22)}-> ${r.then}`));
console.log('');
