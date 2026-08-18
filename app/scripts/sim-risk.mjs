/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-risk.mjs
 * sim-build.mjs transpiles src/data.ts and src/sleeper.ts into .simcache/.
 * Opponents are priced off Sleeper's real half-PPR ADP (SLP[name].adp). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
/* RISK SIMULATION on the corrected model.
 *
 * Two sources of randomness, not one:
 *   1. DRAFT luck  — who falls to you, opponents priced off REAL Sleeper half-PPR ADP
 *   2. SEASON luck — how each player actually performs vs his projection, plus games missed
 *
 * Earlier runs only had (1), which is why every "floor" and "ceiling" looked absurdly tight
 * (108.0 to 109.2). Real fantasy outcomes are dominated by (2). Reporting a mean without it
 * makes a 0.3-point strategy edge look decisive when it is noise.
 */
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');

const PPG = {
  QB: r => Math.max(14, 23.5 - 0.32 * r),
  RB: r => 12.5 * Math.exp(-(r - 1) / 20) + 5.8,
  WR: r => 11.5 * Math.exp(-(r - 1) / 26) + 6.2,
  TE: r => 8.5 * Math.exp(-(r - 1) / 7) + 5,
};
const RISK = { buy: 1.02, solid: 1, risk: 0.93, avoid: 0.86 };

/* Season-outcome spread. Coefficient of variation on realised PPG vs projection.
   QBs are the most predictable, RBs the least (workload + injury). Widened for players our
   research already flags as risky, and for anyone carrying an injury designation. */
const BASE_CV = { QB: 0.26, RB: 0.44, WR: 0.40, TE: 0.42 };
const RISK_CV = { buy: 0.95, solid: 1.0, risk: 1.22, avoid: 1.32 };
/* Probability of losing a meaningful chunk of the season, by position and flag. */
const BASE_MISS = { QB: 0.14, RB: 0.30, WR: 0.22, TE: 0.24 };

const POOL = [];
{
  const c = { QB: 0, RB: 0, WR: 0, TE: 0 };
  P.forEach((r, i) => {
    if (c[r[1]] === undefined) return;
    const pr = ++c[r[1]];
    const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
    const s = SLP[r[0]] || {};
    const sadp = s.adp;
    const mkt = sadp !== undefined ? 0.75 * sadp + 0.25 * ffc : ffc;
    const hurt = ['O', 'IR', 'PUP', 'SUS'].includes(s.inj) ? 0.85 : s.inj === 'D' ? 0.95 : 1;
    const tag = r[4];
    POOL.push({
      name: r[0], pos: r[1], team: r[2], ourRank: i + 1,
      proj: PPG[r[1]](pr) * (RISK[tag] || 1) * hurt,
      cv: BASE_CV[r[1]] * (RISK_CV[tag] || 1) * (s.inj ? 1.15 : 1),
      pMiss: BASE_MISS[r[1]] * (tag === 'risk' ? 1.3 : tag === 'avoid' ? 1.5 : 1) * (s.inj ? 1.4 : 1),
      mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0,
    });
  });
}
const snap = p => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = rnd => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NEED = t => { const c = { QB: 0, RB: 0, WR: 0, TE: 0 }; t.forEach(x => c[x.pos]++); return c; };

/* One season for one player: lognormal on PPG (fantasy outcomes are right-skewed — the
   upside tail is fatter than the downside), times the share of the season he is available. */
function realise(p, rnd) {
  const s = Math.sqrt(Math.log(1 + p.cv * p.cv));
  const ppg = p.proj * Math.exp(gauss(rnd) * s - (s * s) / 2);
  let share = 1;
  if (rnd() < p.pMiss) share = 0.35 + 0.5 * rnd();   // missed time: 35-85% of the season
  return ppg * share;
}
function oppPick(avail, team, rnd) {
  const c = NEED(team); let best = null, bs = Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd) * p.sig * 0.8;
    if (p.pos === 'QB' && c.QB >= 1) s += 60;
    if (p.pos === 'TE' && c.TE >= 1) s += 50;
    if (p.pos === 'RB' && c.RB >= 5) s += 25;
    if (p.pos === 'WR' && c.WR >= 5) s += 25;
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
function myPick(avail, team, tpl, round, tilt) {
  const c = NEED(team);
  const want = tpl[round - 1];
  const key = p => p.ourRank - (tilt ? tilt * p.cv * 22 : 0);   // tilt>0 chases variance
  if (want) {
    const k = avail.filter(p => p.pos === want);
    if (k.length) return k.sort((a, b) => key(a) - key(b))[0];
  }
  const ok = ['RB', 'WR', 'TE', 'QB'].filter(pos => pos === 'QB' ? c.QB < 2 : pos === 'TE' ? c.TE < 2 : c[pos] < 6);
  const cands = avail.filter(p => ok.includes(p.pos));
  return (cands.length ? cands : avail).sort((a, b) => key(a) - key(b))[0];
}
function season(slot, tpl, seed, tilt) {
  const rnd = mul(seed);
  const avail = POOL.slice();
  const teams = {}; for (let t = 1; t <= 12; t++) teams[t] = [];
  for (let pick = 1; pick <= 168; pick++) {
    if (!avail.length) break;
    const t = snap(pick);
    const p = t === slot ? myPick(avail, teams[t], tpl, Math.ceil(pick / 12), tilt) : oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p), 1);
  }
  const mine = teams[slot].map(p => ({ ...p, real: realise(p, rnd) }));
  const by = pos => mine.filter(x => x.pos === pos).sort((a, b) => b.real - a.real);
  const qb = by('QB'), rb = by('RB'), wr = by('WR'), te = by('TE');
  const used = new Set(); let pts = 0;
  const take = (a, n) => a.slice(0, n).forEach(x => { pts += x.real; used.add(x.name); });
  take(qb, 1); take(rb, 2); take(wr, 2); take(te, 1);
  take([...rb, ...wr, ...te].filter(x => !used.has(x.name)).sort((a, b) => b.real - a.real), 2);
  return pts;
}

const FIN = {
  1:  { 'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'], 'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
        'RB-WR-WR-RB': ['RB','WR','WR','RB','TE','QB'], 'RB-RB-WR-RB': ['RB','RB','WR','RB','TE','QB'],
        'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'] },
  6:  { 'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'], 'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'],
        'WR-RB-WR-RB': ['WR','RB','WR','RB','TE','QB'], 'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
        'RB-RB-QB-WR': ['RB','RB','QB','WR','WR','TE'] },
  10: { 'RB-WR-WR-RB': ['RB','WR','WR','RB','TE','QB'], 'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
        'WR-RB-WR-RB': ['WR','RB','WR','RB','TE','QB'], 'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'],
        'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'] },
};
const WORLDS = 6000;
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

/* A league-average team is the yardstick for "did I win my week?" */
for (const slot of [1, 6, 10]) {
  const who = slot === 1 ? 'ASHLEY (1)' : slot === 6 ? 'BRIAN JK (6)' : 'EMILY (10)';
  const T = FIN[slot];
  console.log(`\n${'='.repeat(92)}\n${who} — ${WORLDS.toLocaleString()} seasons, real Sleeper half-PPR ADP opponents`);
  console.log(`points are your STARTING LINEUP per week (1QB/2RB/2WR/1TE/2FLEX)\n`);
  console.log('  strategy          floor(p10)   typical(p50)   ceiling(p90)    mean    swing(p90-p10)');
  const rows = [];
  for (const [label, tpl] of Object.entries(T)) {
    const out = [];
    for (let w = 0; w < WORLDS; w++) out.push(season(slot, tpl, 7000 + w, 0));
    rows.push({ label, p10: pct(out, 0.1), p50: pct(out, 0.5), p90: pct(out, 0.9), m: mean(out) });
  }
  rows.sort((a, b) => b.m - a.m).forEach(r => console.log(
    `  ${r.label.padEnd(16)} ${r.p10.toFixed(1).padStart(8)} ${r.p50.toFixed(1).padStart(14)} ${r.p90.toFixed(1).padStart(14)} ${r.m.toFixed(1).padStart(8)} ${(r.p90 - r.p10).toFixed(1).padStart(13)}`));
  const spread = rows[0].m - rows[rows.length - 1].m;
  const noise = rows[0].p90 - rows[0].p10;
  console.log(`\n  best-vs-worst strategy gap: ${spread.toFixed(2)} pts/wk`);
  console.log(`  season randomness on ONE strategy: ${noise.toFixed(1)} pts/wk  →  luck is ${(noise / spread).toFixed(0)}x the strategy edge`);

  /* Explicit risk dial on the seat's best structure */
  const best = rows[0].label;
  console.log(`\n  RISK DIAL on ${best} — same structure, different appetite for variance:`);
  console.log('  approach            floor(p10)   typical(p50)   ceiling(p90)    mean');
  for (const [name, tilt] of [['safe (steady picks)', -1], ['balanced (our board)', 0], ['swing (high variance)', 1]]) {
    const out = [];
    for (let w = 0; w < WORLDS; w++) out.push(season(slot, T[best], 7000 + w, tilt));
    console.log(`  ${name.padEnd(21)} ${pct(out,0.1).toFixed(1).padStart(7)} ${pct(out,0.5).toFixed(1).padStart(14)} ${pct(out,0.9).toFixed(1).padStart(14)} ${mean(out).toFixed(1).padStart(8)}`);
  }
}
