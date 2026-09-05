/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-precision.mjs
 *
 * A high-precision pass over the decisions that are actually close.
 *
 * Re-running the published studies would return identical numbers — they are seeded, so world
 * #1 is always world #1. More simulation only buys anything if it is NEW worlds, and it only
 * buys something useful where two options are close enough that the existing sample cannot
 * separate them. Several of ours are: Taylor and Chase were 0.17% apart at pick 3, seat 6's
 * five structures span 0.87 pts/wk, and the policy comparison had `needs` and `scarcity`
 * inside half a point.
 *
 * So: 20,000 fresh worlds per candidate, with a standard error on every mean, and an explicit
 * verdict on whether each gap is resolved or still a coin flip. A difference smaller than
 * about two standard errors is not a finding no matter how many decimal places it has. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf, missShareOf, seasonAvailability } = require(CACHE + 'risk.cjs');

const POOL = [];
P.forEach((r, i) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], ourRank: i + 1, idx: POOL.length,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss, knownMiss: rk.knownMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const IDX = new Map(POOL.map(p => [p.name, p]));
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(p => p.proj).sort((a, b) => b - a);
  REPL[pos] = v[Math.min({ QB:14, RB:32, WR:34, TE:13 }[pos] - 1, v.length - 1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, p.proj - REPL[p.pos]); });

const snap = p => { const r = Math.ceil(p/12), i = p-(r-1)*12; return r%2 ? i : 13-i; };
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
function realise(p, w) {
  const k = w*100000+p.idx; let v = cache.get(k); if (v !== undefined) return v;
  const rnd = mul(w*7919+p.idx*104729+13); rnd(); rnd();
  const s = Math.sqrt(Math.log(1+p.cv*p.cv));
  v = p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*seasonAvailability(p, rnd);
  cache.set(k, v); return v;
}
function oppPick(avail, team, rnd) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) { let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;} } return b;
}
function evLater(avail, pos, cur, nextPick) {
  let ev = REPL[pos], pAll = 1;
  for (const p of avail.filter(x=>x.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0,26)) {
    const Fk=ncdf((nextPick-p.mkt)/p.sig), Fc=ncdf((cur-p.mkt)/p.sig);
    const den=1-Fc; const pg = den<=0.03 ? 0.97 : Math.min(0.97, Math.max(0.01,(Fk-Fc)/den));
    ev += pAll*(1-pg)*(p.proj-REPL[pos]); pAll *= pg;
  }
  return ev;
}
function myPick(avail, team, cur, nextPick, myCount) {
  const c = NEED(team), late = myCount >= 10;
  let cs = avail.filter(p => p.pos==='QB' ? c.QB<(late?2:1) : p.pos==='TE' ? c.TE<(late?2:1) : c[p.pos]<6);
  if (!cs.length) cs = avail;
  const ev = {}; for (const pos of ['QB','RB','WR','TE']) ev[pos] = evLater(avail, pos, cur, nextPick);
  const cnt = {}; team.forEach(x => { cnt[x.bye] = (cnt[x.bye]||0)+1; });
  const w = p => { const n = c[p.pos];
    if (p.pos==='QB') return n===0?1:0.5;
    if (p.pos==='TE') return n===0?0.9:0.45;
    return n<2 ? 1.05 : (c.RB+c.WR+c.TE<7 ? 0.8 : 0.45); };
  const score = p => w(p) * (p.vorp + 1.25*Math.max(0,p.proj-ev[p.pos]))
    * (cnt[p.bye] >= 2 ? 0.78 : cnt[p.bye] === 1 ? 0.88 : 1);
  return cs.slice().sort((a,b) => score(b)-score(a))[0];
}
function weekly(R) {
  let tot = 0;
  for (let wk = 1; wk <= 17; wk++) {
    const live = R.filter(x => x.bye !== wk);
    const by = pos => live.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
    const rb=by('RB'), wr=by('WR'), te=by('TE'), qb=by('QB');
    const used = new Set(); let pts = 0;
    const take = (a,n) => a.slice(0,n).forEach(x => { pts += x.real; used.add(x.name); });
    take(qb,1); take(rb,2); take(wr,2); take(te,1);
    take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real), 2);
    tot += pts;
  }
  return tot/17;
}
function run(slot, force, w) {
  const rnd = mul(500000 + w);           // fresh seed space — not the published worlds
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=12;t++) teams[t]=[];
  const myPicks = []; for (let r=1;r<=14;r++) myPicks.push((r-1)*12+(r%2?slot:13-slot));
  let mine = 0;
  for (let pick=1; pick<=168; pick++) {
    if (!avail.length) break;
    const t = snap(pick); let p;
    if (t === slot) {
      if (mine === 0) { p = IDX.get(force); if (!p || !avail.includes(p)) return null; }
      else p = myPick(avail, teams[t], pick, myPicks[mine+1]||pick+12, mine);
      mine++;
    } else p = oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return weekly(teams[slot].map(p => ({ ...p, real: realise(p, 500000 + w) })));
}

const W = 20000;
const CANDS = {
  1:  ['Jahmyr Gibbs','Bijan Robinson','Jonathan Taylor',"Ja'Marr Chase",'James Cook','Puka Nacua'],
  6:  ['Jonathan Taylor','James Cook','Christian McCaffrey','Jaxon Smith-Njigba','Chase Brown','Derrick Henry'],
  10: ['James Cook','Chase Brown','Kenneth Walker III','Derrick Henry','Justin Jefferson','Brock Bowers'],
};
const SEATS = { 1:'ASHLEY (1)', 2:'BRIAN JK (2)', 10:'EMILY (10)' };
let total = 0;

console.log(`\nHIGH-PRECISION FIRST PICK — ${W.toLocaleString()} fresh worlds per candidate`);
console.log('Seeded outside the published studies, so these are genuinely new drafts.\n');
for (const slot of [1,2,10]) {
  const rows = [];
  for (const n of CANDS[slot]) {
    if (!IDX.has(n)) continue;
    const out = [];
    for (let w=0; w<W; w++) { const v = run(slot, n, w); if (v !== null) out.push(v); }
    total += W;
    if (out.length < W*0.05) continue;
    const m = out.reduce((a,b)=>a+b,0)/out.length;
    const sd = Math.sqrt(out.reduce((a,b)=>a+(b-m)*(b-m),0)/(out.length-1));
    rows.push({ n, m, se: sd/Math.sqrt(out.length), avail: out.length/W*100 });
  }
  rows.sort((a,b)=>b.m-a.m);
  console.log(`${SEATS[slot]}`);
  console.log('  candidate              pts/wk    ±SE     there   vs best');
  const best = rows[0];
  rows.forEach(r => {
    const d = best.m - r.m;
    const se = Math.sqrt(best.se**2 + r.se**2);
    const verdict = r === best ? '' : d > 2*se ? `behind by ${d.toFixed(2)}` : 'TOO CLOSE TO CALL';
    console.log(`  ${r.n.padEnd(22)}${r.m.toFixed(2).padStart(7)}  ${r.se.toFixed(3)}  ${r.avail.toFixed(0).padStart(5)}%   ${verdict}`);
  });
  console.log('');
}
console.log(`${total.toLocaleString()} simulated drafts in this run.`);
console.log('A gap under two combined standard errors is not a finding, however many decimals it has.\n');
