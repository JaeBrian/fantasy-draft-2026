/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-pair10.mjs
 *
 * Emily picks at 10 and 15 — five picks apart. Brian's point: Derrick Henry's ADP is 17.1, so
 * he is usually still there at 15, while CeeDee Lamb's is 10.9 and he is not. If that holds,
 * opening Lamb and taking Henry on the way back gets both, and opening Henry throws Lamb away
 * for nothing.
 *
 * He also said not to force things, which is the right instinct — the earlier studies fixed a
 * position each round and that is exactly how they produced two wrong answers. So nothing is
 * forced here beyond the pick being tested: after pick 10 the value-plus-scarcity policy runs
 * free and takes whoever it wants. The question is only which opener leaves you best off, and
 * the answer includes whatever the policy chooses to do at 15 as a consequence.
 *
 * Also reports how often each candidate is still there at 15, which is the whole crux. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const POOL = [];
P.forEach((r, i) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], idx: POOL.length, adp: s.adp,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const IDX = new Map(POOL.map(p => [p.name, p]));
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(p => p.proj).sort((a,b)=>b-a);
  REPL[pos] = v[Math.min({QB:14,RB:32,WR:34,TE:13}[pos]-1, v.length-1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, p.proj - REPL[p.pos]); });

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
  v=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*(rnd()<p.pMiss?0.35+0.5*rnd():1);
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
/* nothing forced — the policy picks whoever it wants */
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

/* returns the season, plus who was taken at 15 and which watched players survived to it */
function run(open, w, watch) {
  const rnd = mul(700000 + w);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=12;t++) teams[t]=[];
  const myPicks=[]; for(let r=1;r<=14;r++) myPicks.push((r-1)*12+(r%2?10:13-10));
  let mine=0, second=null, aliveAt15=null;
  for (let pick=1; pick<=168; pick++) {
    if (!avail.length) break;
    if (pick === 15) aliveAt15 = new Set(avail.map(p=>p.name));
    const t=snap(pick); let p;
    if (t===10) {
      if (mine===0) { p=IDX.get(open); if(!p||!avail.includes(p)) return null; }
      else p=freePick(avail,teams[t],pick,myPicks[mine+1]||pick+12,mine);
      if (mine===1) second=p.name;
      mine++;
    } else p=oppPick(avail,teams[t],rnd);
    if(!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  const survived = {};
  watch.forEach(n => { survived[n] = aliveAt15 ? aliveAt15.has(n) : false; });
  return { pts: weekly(teams[10].map(p=>({...p,real:realise(p,700000+w)}))), second, survived };
}

const W = 12000;
const OPEN = ['CeeDee Lamb','Derrick Henry','James Cook','Chase Brown','Kenneth Walker III',
              'Justin Jefferson','Saquon Barkley','Brock Bowers'];
const WATCH = ['Derrick Henry','Kenneth Walker III','Chase Brown','CeeDee Lamb'];

console.log('\nEMILY, picks 10 and 15 — nothing forced after the opener.');
console.log(`${W.toLocaleString()} fresh worlds per candidate. "back at 15" = still on the board at her second pick.\n`);
console.log('  open with            ADP    pts/wk    ±SE    there   most common pick 15');
const rows = [];
for (const n of OPEN) {
  if (!IDX.has(n)) continue;
  const out=[], seconds={}, back={};
  WATCH.forEach(x => back[x]=0);
  for (let w=0; w<W; w++) {
    const r = run(n, w, WATCH);
    if (!r) continue;
    out.push(r.pts);
    seconds[r.second] = (seconds[r.second]||0)+1;
    WATCH.forEach(x => { if (r.survived[x]) back[x]++; });
  }
  if (out.length < W*0.05) continue;
  const m = out.reduce((a,b)=>a+b,0)/out.length;
  const sd = Math.sqrt(out.reduce((a,b)=>a+(b-m)*(b-m),0)/(out.length-1));
  const top = Object.entries(seconds).sort((a,b)=>b[1]-a[1])[0];
  rows.push({ n, adp: IDX.get(n).adp, m, se: sd/Math.sqrt(out.length),
    avail: out.length/W*100, top: `${top[0]} ${(top[1]/out.length*100).toFixed(0)}%`, back });
}
rows.sort((a,b)=>b.m-a.m);
const best = rows[0];
rows.forEach(r => {
  const d = best.m - r.m, se = Math.sqrt(best.se**2 + r.se**2);
  const v = r===best ? 'BEST' : d > 2*se ? `-${d.toFixed(2)}` : 'tied';
  console.log(`  ${r.n.padEnd(21)}${String(r.adp).padStart(5)}  ${r.m.toFixed(2).padStart(7)}  ${r.se.toFixed(3)}  ${r.avail.toFixed(0).padStart(4)}%   ${r.top.padEnd(24)}${v}`);
});
console.log('\n  who is still on the board at pick 15 (from the run that opened Lamb):');
const lamb = rows.find(r => r.n === 'CeeDee Lamb');
if (lamb) WATCH.forEach(x => console.log(`    ${x.padEnd(22)}${(lamb.back[x]/W*100).toFixed(0)}%`));
console.log('');
