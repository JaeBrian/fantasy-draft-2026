/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-tendency.mjs
 *
 * The "Room" setting claims a league takes backs earlier than ADP says. Two things have to be
 * true for that setting to be worth having:
 *
 *   1. the levels mean what the label says — "15 of 24" really is 15 of 24
 *   2. it changes WHO IS THERE at your pick, by enough to change a decision
 *
 * Both are measured here rather than asserted. The shift values in src/lib/tendency.ts were
 * read off the first table. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const adp = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  POOL.push({ name: r[0], pos: r[1], adp, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * adp) });
});

const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = (rnd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const snap = (pk) => { const r = Math.ceil(pk / 12), i = pk - (r - 1) * 12; return r % 2 ? i : 13 - i; };

/** one draft to `upto`, returning who went and who is left */
function draft(shift, seed, upto) {
  const rnd = mul(seed);
  const gone = new Set(), taken = [];
  const c = {}; for (let t = 1; t <= 12; t++) c[t] = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (let pk = 1; pk <= upto; pk++) {
    const t = snap(pk);
    let best = null, bs = Infinity;
    for (const p of POOL) {
      if (gone.has(p.name)) continue;
      let s = p.adp + gauss(rnd) * p.sig * 0.8;
      if (p.pos === 'QB' && c[t].QB >= 1) s += 60;
      if (p.pos === 'TE' && c[t].TE >= 1) s += 50;
      if (p.pos === 'RB' && c[t].RB >= 5) s += 25;
      if (p.pos === 'WR' && c[t].WR >= 5) s += 25;
      if (p.pos === 'RB' && pk <= 24) s -= shift;   // the room's early-round appetite
      if (s < bs) { bs = s; best = p; }
    }
    if (!best) break;
    gone.add(best.name); c[t][best.pos]++; taken.push(best);
  }
  return { gone, taken };
}

const W = 6000;
const LEVELS = [['Market', 0], ['RB-heavy', 8], ['Very RB-heavy', 15]];

console.log('\n1. DOES EACH LEVEL MEAN WHAT ITS LABEL SAYS?\n');
console.log('  setting            backs in the first 24 picks     receivers');
console.log('  ' + '-'.repeat(62));
for (const [label, sh] of LEVELS) {
  let rb = 0, wr = 0;
  for (let w = 0; w < W; w++) {
    const { taken } = draft(sh, 4000 + w, 24);
    rb += taken.filter(p => p.pos === 'RB').length;
    wr += taken.filter(p => p.pos === 'WR').length;
  }
  console.log(`  ${label.padEnd(18)} ${(rb / W).toFixed(1).padStart(8)} of 24            ${(wr / W).toFixed(1).padStart(6)}`);
}

console.log('\n\n2. DOES IT CHANGE WHO IS THERE AT YOUR PICK?\n');
console.log('   Survival at pick 18 (seat 6, round 2) — how the setting moves each player.\n');
const surv = {};
for (const [label, sh] of LEVELS) {
  surv[label] = {};
  for (let w = 0; w < W; w++) {
    const { gone } = draft(sh, 7000 + w, 17);
    for (const p of POOL) if (!gone.has(p.name)) surv[label][p.name] = (surv[label][p.name] || 0) + 1;
  }
}
const rows = POOL
  .map(p => ({ p, m: (surv['Market'][p.name] || 0) / W, h: (surv['RB-heavy'][p.name] || 0) / W, x: (surv['Very RB-heavy'][p.name] || 0) / W }))
  .filter(r => Math.max(r.m, r.h, r.x) > 0.03 && Math.min(r.m, r.h, r.x) < 0.97)
  .map(r => ({ ...r, d: r.x - r.m }))
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  .slice(0, 16);
console.log('  player               pos   adp    market   heavy   very     change');
console.log('  ' + '-'.repeat(68));
for (const r of rows)
  console.log(`  ${r.p.name.padEnd(20)} ${r.p.pos.padEnd(5)} ${r.p.adp.toFixed(1).padStart(5)}  ${(r.m * 100).toFixed(0).padStart(5)}%  ${(r.h * 100).toFixed(0).padStart(5)}%  ${(r.x * 100).toFixed(0).padStart(5)}%   ${r.d > 0 ? '+' : ''}${(r.d * 100).toFixed(0)} pts`);
console.log('\n  Positive = the setting makes him MORE likely to reach you (the room is busy taking');
console.log('  backs). Negative = less likely, because the room is taking him.\n');
