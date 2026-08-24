/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-wheel.mjs [worlds]
 *
 * Brian, on being told to take Derrick Henry at pick 10: "wow derrick henry even though he is
 * 7.4 above our adp?"
 *
 * The right question, and the head-to-head study could not answer it. That study forces a
 * player at pick 10 and compares against forcing someone else at pick 10 — so it silently
 * assumes the alternative to taking Henry now is never having him. At seat 10 that assumption
 * is wrong: picks 10 and 15 are five apart, and Henry is on the board at 10 in 96% of drafts.
 * If he is still there five picks later, taking him at 10 spends a pick on a player nobody
 * else was going to take.
 *
 * So compare the plans that actually exist:
 *
 *   A. Henry at 10, then best available at 15
 *   B. someone else at 10, then Henry at 15 if he lasted — and if he did not, best available
 *
 * B is the plan a human would actually run, including its downside: sometimes he is gone and
 * you took the risk for nothing. That downside is priced here rather than assumed away. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 6000);
const TEAMS = 12, ROUNDS = 14;
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2], adp: s.adp ?? ffc,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const adj = (p) => p.proj * (1 - 0.4 * p.pMiss);
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(adj).sort((a,b) => b-a);
  REPL[pos] = v[Math.min(REPL_RANK[pos]-1, v.length-1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, adj(p) - REPL[p.pos]); });

const snap = (pk) => { const r = Math.ceil(pk/TEAMS), i = pk-(r-1)*TEAMS; return r%2 ? i : TEAMS+1-i; };
const mul = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = (rnd) => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = (t) => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };
const FREE = 5, FULL = 12;
const rbShift = (base, pk) => (!base || pk > 24 || pk <= FREE) ? 0
  : pk >= FULL ? base : base * ((pk - FREE) / (FULL - FREE));

function oppPick(avail, team, rnd, lean, pk) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if (p.pos==='QB') s += c.QB>=2 ? 900 : c.QB>=1 ? 60 : 0;
    if (p.pos==='TE') s += c.TE>=2 ? 900 : c.TE>=1 ? 50 : 0;
    if (p.pos==='RB' && c.RB>=5) s += 25;
    if (p.pos==='WR' && c.WR>=5) s += 25;
    if (p.pos==='RB') s -= rbShift(lean, pk);
    if (s<bs){bs=s;b=p;}
  }
  return b;
}
function ourPick(avail, team, rnd) {
  const c = NEED(team), n = team.length; let b=null, bs=-Infinity;
  for (const p of avail) {
    let s = p.vorp;
    if (p.pos==='QB') s *= c.QB===0 ? (n>=8?1:0.5) : 0.05;
    if (p.pos==='TE') s *= c.TE===0 ? (n>=6?1:0.8) : 0.07;
    if (p.pos==='RB' && c.RB>=5) s *= 0.3;
    if (p.pos==='WR' && c.WR>=5) s *= 0.3;
    if (team.some(x=>x.bye===p.bye && p.bye)) s *= 0.9;
    s += gauss(rnd)*0.15;
    if (s>bs){bs=s;b=p;}
  }
  return b;
}
const LINEUP = { QB:1, RB:2, WR:2, TE:1, FLEX:2 };
function season(roster, rnd) {
  const sd = roster.map(p => p.proj * p.cv);
  let tot = 0;
  for (let wk=1; wk<=17; wk++) {
    const shock = {};
    const real = roster.map((p,i) => {
      if (p.bye===wk || rnd() < p.pMiss/17) return { p, v:0 };
      shock[p.team] ??= gauss(rnd);
      /* Loadings on one shared team shock. The shock IS the quarterback's own deviation, so a
           receiver's correlation to him is his loading directly, and receiver-to-receiver falls out
           as the product of two loadings rather than being forced equal to it.
           Measured targets: QB-WR +0.342, QB-TE +0.236, QB-RB +0.071, WR-WR +0.006.
           With QB at 1.0 and WR at 0.342, WR-WR lands at 0.117 — still above the measured 0.006,
           but a third of the 0.342 the old symmetric form produced. A single factor cannot hold a
           high QB-WR and a near-zero WR-WR at once; two receivers share the quarterback's good day
           and split his targets, and only a second factor captures both. Documented, not hidden. */
        const load = p.pos==='QB'?1.0 : p.pos==='WR'?0.342 : p.pos==='TE'?0.236 : 0.071;
      const z = load*shock[p.team] + Math.sqrt(Math.max(0,1-load*load))*gauss(rnd);
      return { p, v: Math.max(0, p.proj + z*sd[i]) };
    });
    const by = ps => real.filter(x=>x.p.pos===ps).sort((a,b)=>b.v-a.v);
    const used = new Set(); let t = 0;
    const take = (a,n) => a.slice(0,n).forEach(x=>{ t += x.v; used.add(x.p.name); });
    take(by('QB'),LINEUP.QB); take(by('RB'),LINEUP.RB);
    take(by('WR'),LINEUP.WR); take(by('TE'),LINEUP.TE);
    take(real.filter(x=>!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.v-a.v), LINEUP.FLEX);
    tot += t;
  }
  return tot/17;
}

/** plan: array of {pick, want} — take `want` at that pick if he is there, else best available */
function play(seat, lean, w, plan) {
  const rnd = mul(70000 + w*7919);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  const log = {};
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    let p;
    if (t === seat) {
      const want = plan.find(x => x.pick === pk)?.want;
      p = want ? avail.find(x => x.name === want) : null;
      if (want && !p) log[`missed@${pk}`] = true;      // he was gone — fall through
      if (!p) p = ourPick(avail, teams[t], rnd);
    } else {
      p = oppPick(avail, teams[t], rnd, lean, pk);
    }
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
    if (t === seat) log[pk] = p.name;
  }
  return { ppg: season(teams[seat], rnd), log };
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const seOf = a => { const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length); };

const SEAT = Number(process.argv[3] || 10);
const PICKS = (() => { const a=[]; for(let pk=1;pk<=TEAMS*ROUNDS;pk++) if(snap(pk)===SEAT) a.push(pk); return a; })();
const P1 = PICKS[0], P2 = PICKS[1];
console.log(`\nSEAT ${SEAT} — picks ${P1} and ${P2} are five apart. Does a player who lasts to ${P1} also last to ${P2}?\n`);

for (const [roomLbl, lean] of [['RB LOSS (very RB-heavy)', 15], ['Market', 0]]) {
  /* survival of each interesting name at 10 and at 15 */
  const at10 = {}, at15 = {};
  for (let w=0; w<3000; w++) {
    const rnd = mul(70000 + w*7919);
    const avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    for (let pk=1; pk<=P2-1; pk++) {
      const t = snap(pk);
      let p;
      if (t === SEAT) { p = ourPick(avail, teams[t], rnd); }
      else p = oppPick(avail, teams[t], rnd, lean, pk);
      if (!p) break;
      if (pk === P1) for (const q of avail) at10[q.name] = (at10[q.name]||0)+1;
      teams[t].push(p); avail.splice(avail.indexOf(p),1);
    }
    for (const q of avail) at15[q.name] = (at15[q.name]||0)+1;
  }

  console.log(`\n${'='.repeat(80)}\n  ${roomLbl}\n${'='.repeat(80)}`);
  console.log('  player                adp    there at 10   still there at 15    survives the turn');
  console.log('  ' + '-'.repeat(78));
  const names = ['Derrick Henry',"De'Von Achane",'Chase Brown','Jaxon Smith-Njigba',
                 'Omarion Hampton','Justin Jefferson','CeeDee Lamb','Kenneth Walker III'];
  for (const n of names) {
    const p = POOL.find(x => x.name === n); if (!p) continue;
    const a = (at10[n]||0)/3000, b = (at15[n]||0)/3000;
    const keep = a > 0.02 ? b/a : 0;
    console.log(`  ${n.padEnd(21)} ${p.adp.toFixed(1).padStart(5)}   ${(100*a).toFixed(0).padStart(8)}%   ${(100*b).toFixed(0).padStart(15)}%   ${(100*keep).toFixed(0).padStart(14)}%`);
  }

  /* the plan comparison that matters */
  console.log(`\n  PLAN COMPARISON — ${W.toLocaleString()} worlds, paired on the same drafts\n`);
  const PLANS = [
    { k: 'Henry at 10, best at 15',            plan: [{pick:P1, want:'Derrick Henry'}] },
    { k: 'Smith-Njigba at 10, Henry at 15',    plan: [{pick:P1, want:'Jaxon Smith-Njigba'}, {pick:P2, want:'Derrick Henry'}] },
    { k: 'Lamb at 10, Henry at 15',            plan: [{pick:P1, want:'CeeDee Lamb'}, {pick:P2, want:'Derrick Henry'}] },
    { k: 'Jefferson at 10, Henry at 15',       plan: [{pick:P1, want:'Justin Jefferson'}, {pick:P2, want:'Derrick Henry'}] },
    { k: 'best available at both',             plan: [] },
  ];
  const scored = PLANS.map(({k, plan}) => {
    const v = [], missed = [];
    for (let w=0; w<W; w++) {
      const r = play(SEAT, lean, w, plan);
      v.push(r.ppg);
      missed.push(r.log[`missed@${P2}`] ? 1 : 0);
    }
    return { k, v, m: mean(v), s: seOf(v), miss: 100*mean(missed) };
  }).sort((a,b) => b.m - a.m);
  const ref = scored[0];
  console.log('  plan                                pts/wk           vs best      Henry gone at 15');
  console.log('  ' + '-'.repeat(78));
  for (const r of scored) {
    const diffs = r.v.map((x,i) => x - ref.v[i]);
    const m2 = mean(diffs);
    const sd = Math.sqrt(diffs.reduce((s,x)=>s+(x-m2)**2,0)/(diffs.length-1)/diffs.length);
    const tag = r === ref ? 'BEST' : `${m2.toFixed(2)} ±${sd.toFixed(2)}${Math.abs(m2) < 2*sd ? '  (coin flip)' : ''}`;
    console.log(`  ${r.k.padEnd(34)} ${r.m.toFixed(2)} ±${r.s.toFixed(2)}   ${tag.padStart(22)}   ${r.miss > 0 ? r.miss.toFixed(0)+'%' : '—'}`);
  }
}
console.log('');
