/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-seats.mjs [worlds]
 *
 * Seats 1, 6 and 10, rerun against everything that changed on Aug 19:
 *
 *   - sourced injury news moves availability (Higgins out, Kamara ~4wk, Hall ~3wk, Tyson ~9wk)
 *   - measured replacement level  QB12 / RB31 / WR40 / TE13, not the old assumed QB14/RB32/WR34
 *   - measured teammate correlation in the lineup variance, QB-WR +0.34 / QB-TE +0.24
 *   - fresh Sleeper half-PPR ADP
 *
 * The correlation matters for the SPREAD, not the average: two lineups with the same players
 * score the same on average whether or not the quarterback throws to one of them. It changes
 * how often you win a week, which is why the win-rate column is here and not just the mean.
 *
 * Every number carries a standard error, and no two numbers are compared unless the gap
 * clears both. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 20000);
const SEATS = [1, 6, 10];
const TEAMS = 12, ROUNDS = 14;

/* measured, scripts/sim-replacement.mjs — not the old assumption */
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };
/* measured, scripts/sim-correlation.mjs — everything else came back at zero against control */
const RHO = { 'QB-WR': 0.342, 'QB-TE': 0.236, 'QB-RB': 0.071 };
const rhoOf = (a, b) => (a.team !== b.team ? 0 : RHO[[a.pos, b.pos].sort().join('-')] ?? 0);

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2], idx: POOL.length,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(p => p.proj).sort((a,b) => b-a);
  REPL[pos] = v[Math.min(REPL_RANK[pos] - 1, v.length - 1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, p.proj - REPL[p.pos]); });

const snap = (pk) => { const r = Math.ceil(pk / TEAMS), i = pk - (r - 1) * TEAMS; return r % 2 ? i : TEAMS + 1 - i; };
const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = (rnd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NEED = (t) => { const c = { QB:0, RB:0, WR:0, TE:0 }; t.forEach(x => c[x.pos]++); return c; };

/* opponents draft to market with noise and light positional sanity */
function oppPick(avail, team, rnd) {
  const c = NEED(team); let b = null, bs = Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd) * p.sig * 0.8;
    if (p.pos === 'QB' && c.QB >= 1) s += 60;
    if (p.pos === 'TE' && c.TE >= 1) s += 50;
    if (p.pos === 'RB' && c.RB >= 5) s += 25;
    if (p.pos === 'WR' && c.WR >= 5) s += 25;
    if (s < bs) { bs = s; b = p; }
  }
  return b;
}
/* our policy: value over replacement, with the roster needs that actually bind */
function ourPick(avail, team, rnd, force) {
  if (force) { const f = avail.find(p => p.name === force); if (f) return f; }
  const c = NEED(team), n = team.length; let b = null, bs = -Infinity;
  for (const p of avail) {
    let s = p.vorp;
    if (p.pos === 'QB') s *= c.QB === 0 ? (n >= 8 ? 1 : 0.5) : 0.05;
    if (p.pos === 'TE') s *= c.TE === 0 ? (n >= 6 ? 1 : 0.8) : 0.07;
    if (p.pos === 'RB' && c.RB >= 5) s *= 0.3;
    if (p.pos === 'WR' && c.WR >= 5) s *= 0.3;
    if (team.some(x => x.bye === p.bye && p.bye)) s *= 0.9;
    s += gauss(rnd) * 0.15;
    if (s > bs) { bs = s; b = p; }
  }
  return b;
}

/* season score: 17 weeks, byes live, best legal lineup, teammate correlation in the draw */
const LINEUP = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 };
function seasonWeeks(roster, rnd) {
  const out = [];
  const sd = roster.map(p => p.proj * p.cv);
  for (let wk = 1; wk <= 17; wk++) {
    /* one shared shock per team present on this roster drives the QB-to-pass-catcher link;
       loadings chosen so QB x WR reproduces the measured +0.34 and WR x WR stays ~0 */
    const shock = {};
    const real = roster.map((p, i) => {
      if (p.bye === wk) return { p, v: 0 };
      if (rnd() < p.pMiss / 17) return { p, v: 0 };
      shock[p.team] ??= gauss(rnd);
      const load = p.pos === 'QB' ? 0.585 : p.pos === 'WR' ? 0.585 : p.pos === 'TE' ? 0.40 : 0.12;
      const z = load * shock[p.team] + Math.sqrt(Math.max(0, 1 - load * load)) * gauss(rnd);
      return { p, v: Math.max(0, p.proj + z * sd[i]) };
    });
    const by = (ps) => real.filter(x => x.p.pos === ps).sort((a, b) => b.v - a.v);
    const used = new Set(); let tot = 0;
    const take = (arr, n) => arr.slice(0, n).forEach(x => { tot += x.v; used.add(x.p.name); });
    take(by('QB'), LINEUP.QB); take(by('RB'), LINEUP.RB);
    take(by('WR'), LINEUP.WR); take(by('TE'), LINEUP.TE);
    take(real.filter(x => !used.has(x.p.name) && x.p.pos !== 'QB').sort((a, b) => b.v - a.v), LINEUP.FLEX);
    out.push(tot);
  }
  return out;
}

function runSeat(seat, force, worlds, seed) {
  const tot = [], wkAll = [];
  for (let w = 0; w < worlds; w++) {
    const rnd = mul(seed + w * 7919);
    const avail = POOL.slice(), teams = {};
    for (let t = 1; t <= TEAMS; t++) teams[t] = [];
    let myFirst = null;
    for (let pk = 1; pk <= TEAMS * ROUNDS; pk++) {
      if (!avail.length) break;
      const t = snap(pk);
      const mine = t === seat;
      const p = mine
        ? ourPick(avail, teams[t], rnd, teams[t].length === 0 ? force : null)
        : oppPick(avail, teams[t], rnd);
      if (!p) break;
      if (mine && teams[t].length === 0) myFirst = p.name;
      teams[t].push(p);
      avail.splice(avail.indexOf(p), 1);
    }
    if (force && myFirst !== force) continue;          // he was gone — that world does not count
    const wks = seasonWeeks(teams[seat], rnd);
    tot.push(wks.reduce((s, x) => s + x, 0) / 17);
    wkAll.push(wks);
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const se = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length); };
  const flat = wkAll.flat().sort((a, b) => a - b);
  return {
    n: tot.length, ppg: mean(tot), se: se(tot),
    floor: flat[Math.floor(0.10 * (flat.length - 1))],
    ceil: flat[Math.floor(0.90 * (flat.length - 1))],
  };
}

console.log(`\nSEATS 1 / 6 / 10 — ${W.toLocaleString()} worlds each, fresh Aug 19 data`);
console.log(`news-adjusted availability, measured replacement QB12/RB31/WR40/TE13, teammate correlation live\n`);

for (const seat of SEATS) {
  const base = runSeat(seat, null, W, 1000 + seat * 13);
  console.log(`${'='.repeat(78)}`);
  console.log(`  SEAT ${seat}   free choice: ${base.ppg.toFixed(2)} ±${base.se.toFixed(2)} pts/wk   weekly floor ${base.floor.toFixed(0)} / ceiling ${base.ceil.toFixed(0)}`);
  console.log(`${'='.repeat(78)}`);

  /* who can he actually get at this seat? anyone whose ADP does not rule it out */
  /* Anyone who might still be on the board when this seat is on the clock. The window has to
   * widen as the seat gets later — at pick 10 almost nobody priced inside the top 10 survives,
   * and a narrow filter leaves the seat with a single "choice", which is not a choice. */
  const cands = POOL.filter(p => p.mkt <= seat + 18).sort((a, b) => a.mkt - b.mkt).slice(0, 12);
  const res = cands.map(c => ({ name: c.name, pos: c.pos, adp: c.mkt, ...runSeat(seat, c.name, Math.round(W / 2), 5000 + seat * 31) }))
    .filter(r => r.n >= 200)
    .sort((a, b) => b.ppg - a.ppg);
  console.log(`  open with            pos   adp     pts/wk            floor  ceiling   worlds`);
  console.log('  ' + '-'.repeat(74));
  const top = res[0];
  for (const r of res) {
    const d = r.ppg - top.ppg;
    const sed = Math.sqrt(r.se ** 2 + top.se ** 2);
    const mark = r === top ? '  <-- best' : Math.abs(d) < 2 * sed ? '  (tied)' : '';
    console.log(`  ${r.name.padEnd(20)} ${r.pos.padEnd(5)} ${r.adp.toFixed(1).padStart(5)}  ${r.ppg.toFixed(2)} ±${r.se.toFixed(2)}   ${r.floor.toFixed(0).padStart(5)}  ${r.ceil.toFixed(0).padStart(6)}   ${String(r.n).padStart(6)}${mark}`);
  }
  console.log('');
}
console.log('  "tied" = the gap does not clear two combined standard errors. Treat those as equal.\n');
