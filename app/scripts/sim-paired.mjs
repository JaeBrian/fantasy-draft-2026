/* Paired-world simulation: for each random "draft world" (fixed opponent behaviour via a
   seeded RNG), run all five finalist strategies through THE SAME world and compare within it.
   This removes draft randomness from the comparison and makes small edges measurable. */
const { P, MKT, BYE } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');
const { SLP } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/sleeper.js');

const PPG = {
  QB: r => Math.max(14, 23.5 - 0.32 * r),
  RB: r => 12.5 * Math.exp(-(r - 1) / 20) + 5.8,
  WR: r => 11.5 * Math.exp(-(r - 1) / 26) + 6.2,
  TE: r => 8.5 * Math.exp(-(r - 1) / 7) + 5,
};
const RISK = { buy: 1.02, solid: 1, risk: 0.93, avoid: 0.86 };
const POOL = [];
{
  const c = { QB: 0, RB: 0, WR: 0, TE: 0 };
  P.forEach((r, i) => {
    if (c[r[1]] === undefined) return;
    const pr = ++c[r[1]];
    const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
    const srk = SLP[r[0]] ? SLP[r[0]].rk : undefined;
    const mkt = srk !== undefined ? 0.55 * srk + 0.45 * ffc : ffc;
    const inj = SLP[r[0]] && ['O', 'IR', 'PUP', 'SUS'].includes(SLP[r[0]].inj) ? 0.85
      : SLP[r[0]] && SLP[r[0]].inj === 'D' ? 0.95 : 1;
    POOL.push({ name: r[0], pos: r[1], team: r[2], ourRank: i + 1,
      proj: PPG[r[1]](pr) * (RISK[r[4]] || 1) * inj,
      mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
  });
}
const snap = p => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = rnd => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NEED = t => { const c = { QB: 0, RB: 0, WR: 0, TE: 0 }; t.forEach(x => c[x.pos]++); return c; };

function lineup(team) {
  const by = p => team.filter(x => x.pos === p).sort((a, b) => b.proj - a.proj);
  const qb = by('QB'), rb = by('RB'), wr = by('WR'), te = by('TE');
  const used = new Set(); let pts = 0;
  const take = (arr, n) => arr.slice(0, n).forEach(x => { pts += x.proj; used.add(x.name); });
  take(qb, 1); take(rb, 2); take(wr, 2); take(te, 1);
  const flex = [...rb, ...wr, ...te].filter(x => !used.has(x.name)).sort((a, b) => b.proj - a.proj);
  take(flex, 2);
  const byes = {};
  [...qb.slice(0, 1), ...rb.slice(0, 2), ...wr.slice(0, 2), ...te.slice(0, 1)].forEach(x => { byes[x.bye] = (byes[x.bye] || 0) + 1; });
  const worst = Math.max(0, ...Object.values(byes));
  return { pts: pts - Math.max(0, worst - 2) * 1.2, rb, wr, te, qb };
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
function myPick(avail, team, tpl, round) {
  const c = NEED(team);
  const want = tpl[round - 1];
  const at = pos => { const k = avail.filter(p => p.pos === pos); return k.length ? k.sort((a, b) => a.ourRank - b.ourRank)[0] : null; };
  if (want) { const p = at(want); if (p) return p; }
  const order = ['RB', 'WR', 'TE', 'QB'].filter(pos => pos === 'QB' ? c.QB < 2 : pos === 'TE' ? c.TE < 2 : c[pos] < 6);
  const cands = avail.filter(p => order.includes(p.pos));
  return (cands.length ? cands : avail).sort((a, b) => a.ourRank - b.ourRank)[0];
}
function runWorld(slot, tpl, seed) {
  const rnd = mulberry32(seed);
  const avail = POOL.slice();
  const teams = {}; for (let t = 1; t <= 12; t++) teams[t] = [];
  for (let pick = 1; pick <= 192; pick++) {
    if (!avail.length) break;
    const t = snap(pick);
    const p = t === slot ? myPick(avail, teams[t], tpl, Math.ceil(pick / 12)) : oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p);
    avail.splice(avail.indexOf(p), 1);
  }
  return teams;
}

const FINALISTS = {
  6: {
    'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'],
    'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'],
    'WR-RB-WR-RB': ['WR','RB','WR','RB','TE','QB'],
    'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
    'RB-RB-QB-WR': ['RB','RB','QB','WR','WR','TE'],
  },
  10: {
    'RB-WR-WR-RB': ['RB','WR','WR','RB','TE','QB'],
    'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
    'WR-RB-WR-RB': ['WR','RB','WR','RB','TE','QB'],
    'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'],
    'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'],
  },
  1: {
    'RB-RB-WR-WR': ['RB','RB','WR','WR','TE','QB'],
    'RB-WR-RB-WR': ['RB','WR','RB','WR','TE','QB'],
    'RB-WR-WR-RB': ['RB','WR','WR','RB','TE','QB'],
    'RB-RB-WR-RB': ['RB','RB','WR','RB','TE','QB'],
    'WR-RB-RB-WR': ['WR','RB','RB','WR','TE','QB'],
  },
};

const WORLDS = 2500;
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

for (const slot of [1, 6, 10]) {
  const who = slot === 1 ? 'ASHLEY (1)' : slot === 6 ? 'BRIAN JK (6)' : 'EMILY (10)';
  const T = FINALISTS[slot];
  const labels = Object.keys(T);
  const res = Object.fromEntries(labels.map(l => [l, []]));
  const compo = Object.fromEntries(labels.map(l => [l, { rb1: [], wr1: [], te1: [], starters: [] }]));
  const h2h = {};
  labels.forEach(a => { h2h[a] = {}; labels.forEach(b => h2h[a][b] = 0); });

  for (let w = 0; w < WORLDS; w++) {
    const seed = 1000 + w;
    const byLabel = {};
    labels.forEach(l => {
      const teams = runWorld(slot, T[l], seed);
      const L = lineup(teams[slot]);
      byLabel[l] = L.pts;
      res[l].push(L.pts);
      compo[l].rb1.push(L.rb[0] ? L.rb[0].proj : 0);
      compo[l].wr1.push(L.wr[0] ? L.wr[0].proj : 0);
      compo[l].te1.push(L.te[0] ? L.te[0].proj : 0);
    });
    labels.forEach(a => labels.forEach(b => { if (a !== b && byLabel[a] > byLabel[b]) h2h[a][b]++; }));
  }

  console.log(`\n${'='.repeat(76)}\n${who} — ${WORLDS} PAIRED WORLDS (same opponents, five finalists)\n`);
  const table = labels.map(l => ({
    l, m: mean(res[l]), p10: pct(res[l], 0.1), p90: pct(res[l], 0.9),
    rb1: mean(compo[l].rb1), wr1: mean(compo[l].wr1), te1: mean(compo[l].te1),
  })).sort((a, b) => b.m - a.m);
  console.log('  strategy'.padEnd(18) + 'mean    floor   ceiling |  your RB1  WR1   TE1');
  table.forEach(r => console.log('  ' + r.l.padEnd(16) + r.m.toFixed(2).padStart(7) + r.p10.toFixed(1).padStart(8) + r.p90.toFixed(1).padStart(9) +
    '  | ' + r.rb1.toFixed(1).padStart(7) + r.wr1.toFixed(1).padStart(6) + r.te1.toFixed(1).padStart(6)));

  console.log('\n  HEAD-TO-HEAD (how often the row strategy beats the column, same draft):');
  const short = l => l.replace(/-/g, '').slice(0, 6);
  console.log('        ' + labels.map(l => short(l).padStart(8)).join(''));
  labels.forEach(a => {
    console.log('  ' + short(a).padEnd(6) + labels.map(b => (a === b ? '   —   ' : ((h2h[a][b] / WORLDS * 100).toFixed(0) + '%').padStart(8))).join(''));
  });
  const best = table[0].l;
  const beats = labels.filter(l => l !== best).map(l => h2h[best][l] / WORLDS * 100);
  console.log(`\n  ${best} beats the other four in ${Math.min(...beats).toFixed(0)}-${Math.max(...beats).toFixed(0)}% of identical drafts`);
}
