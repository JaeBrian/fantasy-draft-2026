/* Run from app/:  node scripts/sim-build.mjs && node scripts/audit-sim.mjs
 *
 * Structural audit of the draft simulation itself.
 *
 * Every other audit here checks whether the ANSWERS look right. This one checks whether the
 * machine producing them obeys the rules of a draft at all: that nobody is picked twice, that
 * rosters come out the right size, that the lineup optimiser fields a legal team, that the
 * snake order is the snake order. Those are the failures that would not look like failures —
 * a simulation quietly drafting the same player onto two teams still prints a plausible
 * number, and nothing downstream would ever complain.
 *
 * Written after a run of careless mistakes: a regex that deleted two datasets, a shell quoting
 * bug that made two regenerations silently do nothing, and a test harness that passed the
 * wrong argument and "found" a bug that was not there. Assertions, not eyeballing. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf, cuffUplift } = require(CACHE + 'risk.cjs');

const TEAMS = 12, ROUNDS = 14;
let fail = 0, pass = 0;
const ok  = (c, m, d='') => { if (c) { pass++; console.log(`  PASS  ${m}${d?'  — '+d:''}`); } else { fail++; console.log(`  FAIL  ${m}${d?'  — '+d:''}`); } };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2],
    proj: (PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6) + cuffUplift(r[0]), cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const adj = (p) => p.proj * (1 - 0.4 * p.pMiss);
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };
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
const LINEUP = { QB:1, RB:2, WR:2, TE:1, FLEX:2 };

/* ---------- 1. SNAKE ORDER ---------- */
console.log('\n1. SNAKE ORDER\n');
{
  const counts = {};
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) counts[snap(pk)] = (counts[snap(pk)]||0)+1;
  ok(Object.keys(counts).length === TEAMS, 'every team picks', `${Object.keys(counts).length} teams`);
  ok(Object.values(counts).every(v => v === ROUNDS), 'every team gets the same number of picks',
     `${[...new Set(Object.values(counts))].join('/')} each`);
  ok(snap(1) === 1 && snap(12) === 12 && snap(13) === 12 && snap(24) === 1,
     'round 1 runs 1..12 and round 2 reverses', `p13=${snap(13)} p24=${snap(24)}`);
  const seat2 = []; for (let pk=1; pk<=TEAMS*ROUNDS; pk++) if (snap(pk)===2) seat2.push(pk);
  ok(seat2.slice(0,6).join(',') === '2,23,26,47,50,71', "seat 2's picks are 2,23,26,47,50,71",
     seat2.slice(0,6).join(','));
}

/* ---------- 2. DRAFT INTEGRITY ---------- */
console.log('\n2. DRAFT INTEGRITY  (500 simulated drafts)\n');
{
  let dupes = 0, wrongSize = 0, offBoard = 0, shortDrafts = 0;
  const names = new Set(POOL.map(p => p.name));
  for (let w=0; w<500; w++) {
    const rnd = mul(9000+w), avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    const seen = new Set();
    let made = 0;
    for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
      const p = oppPick(avail, teams[snap(pk)], rnd);
      if (!p) break;
      if (seen.has(p.name)) dupes++;
      if (!names.has(p.name)) offBoard++;
      seen.add(p.name);
      teams[snap(pk)].push(p); avail.splice(avail.indexOf(p),1); made++;
    }
    if (made !== TEAMS*ROUNDS) shortDrafts++;
    for (let t=1;t<=TEAMS;t++) if (teams[t].length !== ROUNDS) wrongSize++;
  }
  ok(dupes === 0, 'no player is drafted twice', `${dupes} duplicates`);
  ok(offBoard === 0, 'no player is drafted who is not on the board', `${offBoard}`);
  ok(shortDrafts === 0, 'every draft runs the full 168 picks', `${shortDrafts} short`);
  ok(wrongSize === 0, 'every roster ends with 14 players', `${wrongSize} wrong`);
}

/* ---------- 3. LINEUP LEGALITY ---------- */
console.log('\n3. LINEUP LEGALITY  (every week of 300 drafted rosters)\n');
{
  let illegalCount = 0, doubleUse = 0, qbInFlex = 0, byePlayed = 0, weeks = 0;
  for (let w=0; w<300; w++) {
    const rnd = mul(4400+w), avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
      const p = oppPick(avail, teams[snap(pk)], rnd);
      if (!p) break; teams[snap(pk)].push(p); avail.splice(avail.indexOf(p),1);
    }
    const roster = teams[1 + (w % TEAMS)];
    const sd = roster.map(p => p.proj * p.cv);
    for (let wk=1; wk<=17; wk++) {
      weeks++;
      const real = roster.map((p,i) => ({ p, v: p.bye===wk ? 0 : Math.max(0, p.proj + gauss(rnd)*sd[i]) , onBye: p.bye===wk }));
      const by = ps => real.filter(x=>x.p.pos===ps).sort((a,b)=>b.v-a.v);
      const used = new Set(); const started = [];
      const take = (a,n) => a.slice(0,n).forEach(x => { started.push(x); used.add(x.p.name); });
      take(by('QB'),LINEUP.QB); take(by('RB'),LINEUP.RB);
      take(by('WR'),LINEUP.WR); take(by('TE'),LINEUP.TE);
      take(real.filter(x=>!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.v-a.v), LINEUP.FLEX);

      if (started.length !== 8) illegalCount++;
      if (new Set(started.map(s=>s.p.name)).size !== started.length) doubleUse++;
      /* a QB must never occupy a flex slot */
      const qbs = started.filter(s => s.p.pos === 'QB').length;
      if (qbs > LINEUP.QB) qbInFlex++;
      /* a player on bye contributes zero — he may be "started" only if the bench is empty,
         which on a 14-man roster should never happen for the mandatory slots */
      if (started.some(s => s.onBye && s.p.pos !== 'QB')) byePlayed++;
    }
  }
  ok(illegalCount === 0, 'every week fields exactly 8 starters', `${illegalCount} of ${weeks} weeks wrong`);
  ok(doubleUse === 0, 'no player fills two slots in one week', `${doubleUse}`);
  ok(qbInFlex === 0, 'no second quarterback sneaks into flex', `${qbInFlex}`);
  ok(byePlayed / weeks < 0.02, 'players on bye are essentially never started',
     `${(100*byePlayed/weeks).toFixed(2)}% of weeks`);
}

/* ---------- 4. OPPONENT MODEL REALISM ---------- */
console.log('\n4. OPPONENT MODEL  (does it draft like a real room?)\n');
{
  const at = {}, cnt = {};
  for (let w=0; w<800; w++) {
    const rnd = mul(1200+w), avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    for (let pk=1; pk<=60; pk++) {
      const p = oppPick(avail, teams[snap(pk)], rnd);
      if (!p) break;
      at[p.name]=(at[p.name]||0)+pk; cnt[p.name]=(cnt[p.name]||0)+1;
      teams[snap(pk)].push(p); avail.splice(avail.indexOf(p),1);
    }
  }
  const rows = POOL.filter(p => cnt[p.name] > 400 && p.mkt <= 60)
    .map(p => ({ p, mean: at[p.name]/cnt[p.name] }));
  const err = rows.map(r => Math.abs(r.mean - r.p.mkt));
  const mae = err.reduce((a,b)=>a+b,0)/err.length;
  ok(mae < 6, 'players go near their ADP', `mean abs error ${mae.toFixed(2)} picks over ${rows.length} players`);
  const worst = rows.sort((a,b)=>Math.abs(b.mean-b.p.mkt)-Math.abs(a.mean-a.p.mkt))[0];
  console.log(`        worst: ${worst.p.name} ADP ${worst.p.mkt.toFixed(1)} -> goes ${worst.mean.toFixed(1)}`);

  /* roster sanity: nobody should end with 4 QBs */
  let sillyQB = 0, sillyTE = 0, noQB = 0;
  for (let w=0; w<300; w++) {
    const rnd = mul(7700+w), avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
      const p = oppPick(avail, teams[snap(pk)], rnd);
      if (!p) break; teams[snap(pk)].push(p); avail.splice(avail.indexOf(p),1);
    }
    for (let t=1;t<=TEAMS;t++) {
      const c = NEED(teams[t]);
      if (c.QB > 3) sillyQB++;
      if (c.TE > 3) sillyTE++;
      if (c.QB === 0) noQB++;
    }
  }
  ok(sillyQB === 0, 'no team hoards quarterbacks', `${sillyQB} rosters with 4+`);
  ok(sillyTE === 0, 'no team hoards tight ends', `${sillyTE} rosters with 4+`);
  ok(noQB === 0, 'every team ends with a quarterback', `${noQB} without`);
}

/* ---------- 5. CORRELATION IMPLEMENTATION ---------- */
console.log('\n5. CORRELATION  (does the shared-shock model hit its targets?)\n');
{
  /* the sims use one shock per team with per-position loadings; verify the correlation it
     actually produces matches what sim-correlation.mjs measured */
  const load = { QB:1.0, WR:0.342, TE:0.236, RB:0.071 };
  const N = 60000;
  const sample = (pa, pb) => {
    const A=[], B=[];
    for (let i=0;i<N;i++) {
      const rnd = mul(31337 + i);
      const shock = gauss(rnd);
      const za = load[pa]*shock + Math.sqrt(1-load[pa]**2)*gauss(rnd);
      const zb = load[pb]*shock + Math.sqrt(1-load[pb]**2)*gauss(rnd);
      A.push(za); B.push(zb);
    }
    const m=a=>a.reduce((x,y)=>x+y,0)/a.length, ma=m(A), mb=m(B);
    let sab=0,sa=0,sb=0;
    for (let i=0;i<N;i++){const da=A[i]-ma,db=B[i]-mb;sab+=da*db;sa+=da*da;sb+=db*db;}
    return sab/Math.sqrt(sa*sb);
  };
  const qbwr = sample('QB','WR'), qbte = sample('QB','TE'), wrwr = sample('WR','WR');
  ok(Math.abs(qbwr - 0.342) < 0.05, 'QB-WR reproduces the measured +0.342', qbwr.toFixed(3));
  ok(Math.abs(qbte - 0.236) < 0.06, 'QB-TE reproduces the measured +0.236', qbte.toFixed(3));
  ok(wrwr < 0.15, 'WR-WR stays well below QB-WR', `${wrwr.toFixed(3)} vs measured +0.006`);
  console.log(`        (a single shared factor cannot hold QB-WR at 0.34 AND WR-WR at 0.006 —`);
  console.log(`         0.117 is the floor for this form. Residual is documented, not hidden.)`);
}

/* ---------- 6. INPUT CONSISTENCY ---------- */
console.log('\n6. INPUTS SHARED WITH THE ADVISOR\n');
{
  const missing = POOL.filter(p => PROJ[p.name] === undefined);
  ok(missing.length <= 3, 'nearly every board player has a real projection',
     `${missing.length} missing: ${missing.slice(0,3).map(p=>p.name).join(', ')}`);
  const noAdp = POOL.filter(p => !SLP[p.name] || SLP[p.name].adp === undefined);
  ok(noAdp.length <= 3, 'nearly every board player has a Sleeper ADP', `${noAdp.length} missing`);
  const badBye = POOL.filter(p => !p.bye || p.bye < 4 || p.bye > 14);
  ok(badBye.length === 0, 'every player has a bye in weeks 4-14', `${badBye.length} bad`);
  const badRisk = POOL.filter(p => !(p.cv > 0 && p.cv < 2) || !(p.pMiss >= 0 && p.pMiss <= 1));
  ok(badRisk.length === 0, 'every risk figure is in range', `${badRisk.length} out of range`);
  const negVorp = POOL.filter(p => !(p.vorp > 0));
  ok(negVorp.length === 0, 'every value-over-replacement is positive', `${negVorp.length}`);
  console.log(`        replacement: QB ${REPL.QB.toFixed(2)}  RB ${REPL.RB.toFixed(2)}  WR ${REPL.WR.toFixed(2)}  TE ${REPL.TE.toFixed(2)}`);
}

console.log(`\n${'='.repeat(70)}\nRESULT: ${fail} FAIL, ${pass} PASS\n`);
if (fail) process.exitCode = 1;
