/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-plans.mjs [worlds]
 *
 * Replaces draft-sim.mjs, which generated SIM_PLANS and CLIFF_MAP and had become
 * unreproducible: it no longer runs at all (it require()s a .ts file directly), and when it
 * last ran it was built on the two inputs this project has since replaced —
 *
 *   proj: PPG[pos](rank)   a rank CURVE. No per-player information; measured MAE 1.99 pts/wk
 *                          against real projections, quarterbacks overrated by about 5.
 *   mkt:  0.55*search_rank a superflex-biased ranking that pushes QBs ~37 picks early in a
 *                          half-PPR room, and ties at the top so "rank 4" is not "4th".
 *
 * So the headline strategy advice in the app was computed from a model we had already proved
 * wrong, and could not be regenerated to check. This script does the same job on real Sleeper
 * projections, real half-PPR ADP, the shared risk model, and value measured the way the season
 * is actually scored.
 *
 * winPct is honest here too: all twelve teams play the same simulated season and we count how
 * often our seat finishes with the most points. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf, cuffUplift, missShareOf, seasonAvailability, unavailableInWeek } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 4000);
const TEAMS = 12, ROUNDS = 14;
const SEATS = [1, 2, 10];
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2],
    proj: (PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6) + cuffUplift(r[0]), cv: rk.cv, pMiss: rk.pMiss, knownMiss: rk.knownMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const adj = (p) => p.proj * (1 - missShareOf(p));
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(adj).sort((a,b) => b-a);
  REPL[pos] = v[Math.min(REPL_RANK[pos]-1, v.length-1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, adj(p) - REPL[p.pos]); });

const snap = (pk) => { const r = Math.ceil(pk/TEAMS), i = pk-(r-1)*TEAMS; return r%2 ? i : TEAMS+1-i; };
const picksOf = (seat) => { const a=[]; for(let pk=1;pk<=TEAMS*ROUNDS;pk++) if(snap(pk)===seat) a.push(pk); return a; };
const mul = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = (rnd) => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = (t) => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };

function oppPick(avail, team, rnd) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if (p.pos==='QB') s += c.QB>=2 ? 900 : c.QB>=1 ? 60 : 0;
    if (p.pos==='TE') s += c.TE>=2 ? 900 : c.TE>=1 ? 50 : 0;
    if (p.pos==='RB' && c.RB>=5) s += 25;
    if (p.pos==='WR' && c.WR>=5) s += 25;
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
      if (p.bye===wk || unavailableInWeek(p, wk, rnd)) return { p, v:0, available:false };
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
      return { p, v: Math.max(0, p.proj + z*sd[i]), available:true };
    });
    const by = ps => real.filter(x=>x.available && x.p.pos===ps).sort((a,b)=>b.p.proj-a.p.proj);
    const used = new Set(); let t = 0;
    const take = (a,n) => a.slice(0,n).forEach(x=>{ t += x.v; used.add(x.p.name); });
    take(by('QB'),LINEUP.QB); take(by('RB'),LINEUP.RB);
    take(by('WR'),LINEUP.WR); take(by('TE'),LINEUP.TE);
    take(real.filter(x=>x.available&&!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.p.proj-a.p.proj), LINEUP.FLEX);
    tot += t;
  }
  return tot/17;
}

const OUT = {}, OUTC = {};
for (const seat of SEATS) {
  const mine = picksOf(seat).slice(0, 6);
  const landed = mine.map(() => ({}));
  const shapes = {};
  let ppgSum = 0, wins = 0;
  /* CLIFF_MAP: the best projection still available at each of your picks, by position. The
     position that falls fastest between two rows is the one to take first — that is the whole
     point of the panel. It used to come from draft-sim.mjs, which no longer runs; computing it
     here means it can never drift out of step with SIM_PLANS, since both read the same draft. */
  const cliff = mine.map(() => ({ RB: [], WR: [], TE: [], QB: [] }));

  for (let w=0; w<W; w++) {
    const rnd = mul(11000 + w*7919);
    const avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
      if (!avail.length) break;
      const t = snap(pk);
      const p = t===seat ? ourPick(avail, teams[t], rnd) : oppPick(avail, teams[t], rnd);
      if (!p) break;
      teams[t].push(p); avail.splice(avail.indexOf(p),1);
      const i = mine.indexOf(pk);
      if (t===seat && i >= 0) landed[i][p.name] = (landed[i][p.name]||0)+1;
      if (t===seat && i >= 0) for (const pos of ['RB','WR','TE','QB']) {
        const best = avail.filter(x => x.pos === pos).reduce((m,x) => x.proj > (m?.proj ?? -1) ? x : m, null);
        if (best) cliff[i][pos].push(best.proj);
      }
    }
    /* every team plays the same season, so winPct means something */
    const scores = [];
    for (let t=1;t<=TEAMS;t++) scores.push({ t, s: season(teams[t], rnd) });
    scores.sort((a,b)=>b.s-a.s);
    if (scores[0].t === seat) wins++;
    ppgSum += scores.find(x=>x.t===seat).s;

    /* count the position at each of the first four picks separately */
    teams[seat].slice(0,4).forEach((p, i) => {
      (shapes[i] ??= {})[p.pos] = ((shapes[i] ??= {})[p.pos] || 0) + 1;
    });
  }

  /* The label has to agree with the rows underneath it. Taking the single most common
   * four-pick SEQUENCE gave "RB-RB-RB-TE" for a seat whose own pick-15 row showed a receiver
   * 56% of the time — the joint mode can disagree with every marginal mode, and a header that
   * contradicts the table under it is worse than no header. Position by position instead. */
  const avg = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
  OUTC[seat] = mine.map((pk, i) => ({
    pick: pk,
    rb: +avg(cliff[i].RB).toFixed(1), wr: +avg(cliff[i].WR).toFixed(1),
    te: +avg(cliff[i].TE).toFixed(1), qb: +avg(cliff[i].QB).toFixed(1),
  }));

  const topShape = [0,1,2,3]
    .map(i => Object.entries(shapes[i] || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || '?')
    .join('-');
  OUT[seat] = {
    strategy: topShape,
    ppw: +(ppgSum/W).toFixed(1),
    winPct: Math.round(100*wins/W),
    picks: mine.map((pk, i) => ({
      pick: pk,
      opts: Object.entries(landed[i]).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .filter(([,c]) => c/W >= 0.05)
        .map(([n,c]) => [n, Math.round(100*c/W)]),
    })),
  };
  console.log(`\nSEAT ${seat}  —  ${OUT[seat].strategy}   ${OUT[seat].ppw} pts/wk   wins the league ${OUT[seat].winPct}% of the time`);
  for (const p of OUT[seat].picks)
    console.log(`   pick ${String(p.pick).padStart(3)}:  ${p.opts.map(([n,c])=>`${n} ${c}%`).join('  ·  ') || '—'}`);
}
writeFileSync(CACHE + 'plans.json', JSON.stringify(OUT, null, 2));
writeFileSync(CACHE + 'cliff.json', JSON.stringify(OUTC, null, 2));
console.log(`\nwrote .simcache/plans.json  (${W.toLocaleString()} leagues per seat, all 12 teams scored)\n`);
