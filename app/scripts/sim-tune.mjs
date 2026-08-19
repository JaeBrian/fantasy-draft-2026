/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-tune.mjs
 *
 * The advisor is full of numbers I chose by judgement. The scarcity term is multiplied by 1.25
 * because that felt right. Positional weights are 1.05 / 0.8 / 0.45. Bye clashes cost 12% and
 * 22%. None of it was measured, and all session I have been tuning them one at a time by hand.
 *
 * This is that loop, done properly and all at once: vary each parameter across a sensible range,
 * hold the rest fixed, score on the realistic measure (week by week with byes live, so a week
 * with a hole in the lineup counts as the loss it is), and report a standard error next to
 * every result.
 *
 * Deliberately REPORTS rather than applies. Two reasons. The objective is my own simulation, so
 * tuning against it optimises for my opponent model and my risk assumptions rather than for
 * reality — an error in those propagates straight into the tuned values and looks like an
 * improvement. And a draft is eleven days out; quietly retuning the tool people will actually
 * use is how you ship something like the McCaffrey artifact without noticing.
 *
 * A change that does not clear two standard errors is not a finding. Most of these will not. */
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
  POOL.push({ name: r[0], pos: r[1], idx: POOL.length,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(p => p.proj).sort((a,b) => b-a);
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

/* the live advisor's numbers, as knobs */
const BASE = { gap: 1.25, bye2: 0.88, bye3: 0.78, rbFilled: 0.8, rbDeep: 0.45, teFirst: 0.85, qbFirst: 1.0 };

function myPick(avail, team, cur, nextPick, myCount, K) {
  const c = NEED(team), late = myCount >= 10;
  let cs = avail.filter(p => p.pos==='QB' ? c.QB<(late?2:1) : p.pos==='TE' ? c.TE<(late?2:1) : c[p.pos]<6);
  if (!cs.length) cs = avail;
  const ev = {}; for (const pos of ['QB','RB','WR','TE']) ev[pos] = evLater(avail,pos,cur,nextPick);
  const cnt = {}; team.forEach(x => { cnt[x.bye] = (cnt[x.bye]||0)+1; });
  const w = p => { const n = c[p.pos];
    if (p.pos==='QB') return n===0 ? (myCount>=5?K.qbFirst:0.55) : 0.5;
    if (p.pos==='TE') return n===0 ? K.teFirst : 0.45;
    return n<2 ? 1.05 : (c.RB+c.WR+c.TE<7 ? K.rbFilled : K.rbDeep); };
  const score = p => w(p) * (p.vorp + K.gap*Math.max(0,p.proj-ev[p.pos]))
    * (cnt[p.bye] >= 2 ? K.bye3 : cnt[p.bye] === 1 ? K.bye2 : 1);
  return cs.slice().sort((a,b) => score(b)-score(a))[0];
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
function season(slot, K, w) {
  const rnd = mul(900000 + w);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=12;t++) teams[t]=[];
  const myPicks=[]; for(let r=1;r<=14;r++) myPicks.push((r-1)*12+(r%2?slot:13-slot));
  let mine=0;
  for (let pick=1; pick<=168; pick++) {
    if (!avail.length) break;
    const t=snap(pick); let p;
    if (t===slot) { p=myPick(avail,teams[t],pick,myPicks[mine+1]||pick+12,mine,K); mine++; }
    else p=oppPick(avail,teams[t],rnd);
    if(!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return weekly(teams[slot].map(p=>({...p,real:realise(p,900000+w)})));
}
const W = 3000;
function evaluate(K) {
  const all = [];
  for (const slot of [1,6,10]) for (let w=0; w<W; w++) all.push(season(slot,K,w));
  const m = all.reduce((a,b)=>a+b,0)/all.length;
  const sd = Math.sqrt(all.reduce((a,b)=>a+(b-m)*(b-m),0)/(all.length-1));
  return { m, se: sd/Math.sqrt(all.length) };
}

const SWEEP = {
  gap:      [0.0, 0.5, 1.0, 1.25, 1.75, 2.5],
  bye2:     [1.0, 0.94, 0.88, 0.80],
  bye3:     [1.0, 0.88, 0.78, 0.65],
  rbFilled: [1.0, 0.9, 0.8, 0.65],
  rbDeep:   [0.7, 0.55, 0.45, 0.3],
  teFirst:  [1.1, 0.95, 0.85, 0.7, 0.5],
  qbFirst:  [1.4, 1.15, 1.0, 0.8],
};

console.log(`\nPARAMETER SWEEP — ${W.toLocaleString()} seasons per seat per value, three seats.`);
console.log('Scored week by week with byes live. One knob moves at a time; the rest stay live.\n');
const baseline = evaluate(BASE);
console.log(`baseline (what ships today): ${baseline.m.toFixed(3)} ±${baseline.se.toFixed(3)} pts/wk\n`);

const findings = [];
for (const [key, values] of Object.entries(SWEEP)) {
  console.log(`${key}  (currently ${BASE[key]})`);
  let bestAlt = null;
  for (const v of values) {
    if (v === BASE[key]) { console.log(`   ${String(v).padEnd(6)} ${baseline.m.toFixed(3)}  <- current`); continue; }
    const r = evaluate({ ...BASE, [key]: v });
    const d = r.m - baseline.m;
    const se = Math.sqrt(r.se**2 + baseline.se**2);
    const sig = Math.abs(d) > 2*se;
    console.log(`   ${String(v).padEnd(6)} ${r.m.toFixed(3)}  ${d>=0?'+':''}${d.toFixed(3)}  ${sig ? (d>0?'BETTER':'worse') : 'inside noise'}`);
    if (sig && d > 0 && (!bestAlt || d > bestAlt.d)) bestAlt = { v, d, se };
  }
  if (bestAlt) findings.push({ key, ...bestAlt });
  console.log('');
}

console.log('='.repeat(70));
if (!findings.length) {
  console.log('No single change beat the current setting by more than two standard errors.');
  console.log('The hand-tuned values are, as far as this can tell, already fine.');
} else {
  console.log('Settings that beat the current value by more than two standard errors:');
  findings.forEach(f => console.log(`  ${f.key}: ${BASE[f.key]} -> ${f.v}   +${f.d.toFixed(3)} pts/wk (±${f.se.toFixed(3)})`));
  console.log('\nReported, not applied. These are tuned against this simulation, which carries');
  console.log('its own opponent model and risk assumptions — an error there shows up here as a');
  console.log('gain. Apply only what also survives audit-agreement.');
}
console.log('');
