/* Monte Carlo draft simulator. Compile the TS first, then run:
 *   npx tsc src/data.ts src/sleeper.ts --ignoreConfig --outDir /tmp/fdsim --module commonjs --target es2022 --skipLibCheck
 *   node scripts/draft-sim.mjs <slot> <iterations>   (set RISK=1 to weight by our verdicts + injury flags)
 */
/* Monte Carlo draft simulator for the 2026 half-PPR league.
   Opponents draft off the blended market board with realistic noise; we follow a
   strategy template; teams are scored on their best starting lineup (1QB/2RB/2WR/1TE/2FLEX). */
const { P, MKT, BYE } = require('../src/data.ts');
const { SLP } = require('../src/sleeper.ts');

const PPG = {
  QB: r => Math.max(14, 23.5 - 0.32 * r),
  RB: r => 12.5 * Math.exp(-(r - 1) / 20) + 5.8,
  WR: r => 11.5 * Math.exp(-(r - 1) / 26) + 6.2,
  TE: r => 8.5 * Math.exp(-(r - 1) / 7) + 5,
};
const POOL = [];
{
  const c = { QB: 0, RB: 0, WR: 0, TE: 0 };
  P.forEach((r, i) => {
    if (c[r[1]] === undefined) return;
    const pr = ++c[r[1]];
    const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
    const srk = SLP[r[0]] ? SLP[r[0]].rk : undefined;
    const mkt = srk !== undefined ? 0.55 * srk + 0.45 * ffc : ffc;
    POOL.push({
      name: r[0], pos: r[1], team: r[2], ourRank: i + 1, verdict: r[4],
      proj: PPG[r[1]](pr) * (process.env.RISK ? ({buy:1.02, solid:1, risk:0.93, avoid:0.86}[r[4]] || 1) * ((SLP[r[0]] && ['O','IR','PUP','SUS'].includes(SLP[r[0]].inj)) ? 0.85 : (SLP[r[0]] && SLP[r[0]].inj === 'D') ? 0.95 : 1) : 1), mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt),
      bye: BYE[r[2]] || 0,
    });
  });
}
const randn = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const snap = p => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };

/** best starting lineup score: 1QB 2RB 2WR 1TE 2FLEX */
function lineup(team) {
  const by = p => team.filter(x => x.pos === p).sort((a, b) => b.proj - a.proj);
  const qb = by('QB'), rb = by('RB'), wr = by('WR'), te = by('TE');
  const used = new Set();
  let pts = 0;
  const take = (arr, n) => arr.slice(0, n).forEach(x => { pts += x.proj; used.add(x.name); });
  take(qb, 1); take(rb, 2); take(wr, 2); take(te, 1);
  const flex = [...rb, ...wr, ...te].filter(x => !used.has(x.name)).sort((a, b) => b.proj - a.proj);
  take(flex, 2);
  /* bye-week penalty: stacking starters on one bye costs you a real week */
  const byes = {};
  [...qb.slice(0,1), ...rb.slice(0,2), ...wr.slice(0,2), ...te.slice(0,1)].forEach(x => { byes[x.bye] = (byes[x.bye]||0)+1; });
  const worst = Math.max(0, ...Object.values(byes));
  return pts - Math.max(0, worst - 2) * 1.2;
}

const NEED = t => {
  const c = { QB: 0, RB: 0, WR: 0, TE: 0 };
  t.forEach(x => c[x.pos]++);
  return c;
};

/** what an opponent does: best available on the market board, with noise + light need logic */
function oppPick(avail, team) {
  const c = NEED(team);
  let best = null, bestScore = Infinity;
  for (const p of avail) {
    let s = p.mkt + randn() * p.sig * 0.8;
    if (p.pos === 'QB' && c.QB >= 1) s += 60;
    if (p.pos === 'TE' && c.TE >= 1) s += 50;
    if (p.pos === 'RB' && c.RB >= 5) s += 25;
    if (p.pos === 'WR' && c.WR >= 5) s += 25;
    if (s < bestScore) { bestScore = s; best = p; }
  }
  return best;
}

/** our pick: first unfilled position in the template, best available there by our rank */
function myPick(avail, team, template, round) {
  const c = NEED(team);
  const want = template[round - 1];
  const tryPos = pos => {
    const cand = avail.filter(p => p.pos === pos);
    return cand.length ? cand.sort((a, b) => a.ourRank - b.ourRank)[0] : null;
  };
  if (want) {
    const p = tryPos(want);
    if (p) return p;
  }
  /* default: best available that still helps the lineup */
  const order = ['RB', 'WR', 'TE', 'QB'].filter(pos => {
    if (pos === 'QB') return c.QB < 2;
    if (pos === 'TE') return c.TE < 2;
    return c[pos] < 6;
  });
  const cands = avail.filter(p => order.includes(p.pos));
  return (cands.length ? cands : avail).sort((a, b) => a.ourRank - b.ourRank)[0];
}

function simulate(mySlot, template) {
  const avail = POOL.slice();
  const teams = {};
  for (let t = 1; t <= 12; t++) teams[t] = [];
  for (let pick = 1; pick <= 16 * 12; pick++) {
    const t = snap(pick);
    if (!avail.length) break;
    const round = Math.ceil(pick / 12);
    const p = t === mySlot ? myPick(avail, teams[t], template, round) : oppPick(avail, teams[t]);
    if (!p) break;
    teams[t].push(p);
    avail.splice(avail.indexOf(p), 1);
  }
  return { mine: teams[mySlot], all: Object.values(teams).map(lineup) };
}

const TEMPLATES = {
  'RB-RB (double)':      ['RB','RB','WR','WR','TE','QB'],
  'RB-WR-RB':            ['RB','WR','RB','WR','TE','QB'],
  'WR-RB-RB':            ['WR','RB','RB','WR','TE','QB'],
  'WR-WR (zero RB)':     ['WR','WR','RB','RB','TE','QB'],
  'RB-RB-RB':            ['RB','RB','RB','WR','TE','QB'],
  'Hero RB (RB-WR-WR)':  ['RB','WR','WR','RB','TE','QB'],
  'Elite TE early':      ['RB','TE','RB','WR','WR','QB'],
  'Early QB (rd 3)':     ['RB','RB','QB','WR','WR','TE'],
};

const N = parseInt(process.argv[3] || '400', 10);
const slot = parseInt(process.argv[2] || '10', 10);
console.log(`\n=== SLOT ${slot} — ${N} simulated drafts per strategy ===`);
console.log('strategy'.padEnd(22), 'starters/wk   vs field   win%   typical first 4 picks');
const rows = [];
for (const [label, tpl] of Object.entries(TEMPLATES)) {
  let tot = 0, wins = 0, edge = 0;
  const firstPicks = {};
  for (let i = 0; i < N; i++) {
    const { mine, all } = simulate(slot, tpl);
    const me = lineup(mine);
    const others = all.filter((_, idx) => idx + 1 !== slot);
    tot += me;
    edge += me - others.reduce((a, b) => a + b, 0) / others.length;
    if (me >= Math.max(...all)) wins++;
    mine.slice(0, 4).forEach((p, k) => {
      const key = `${k}:${p.name}`;
      firstPicks[key] = (firstPicks[key] || 0) + 1;
    });
  }
  const common = [0, 1, 2, 3].map(k => {
    const at = Object.entries(firstPicks).filter(([kk]) => kk.startsWith(`${k}:`)).sort((a, b) => b[1] - a[1])[0];
    return at ? `${at[0].slice(2)} (${Math.round(at[1] / N * 100)}%)` : '—';
  });
  rows.push({ label, avg: tot / N, edge: edge / N, win: wins / N * 100, common });
}
rows.sort((a, b) => b.avg - a.avg);
rows.forEach(r =>
  console.log(r.label.padEnd(22), r.avg.toFixed(1).padStart(6), '  ', (r.edge >= 0 ? '+' : '') + r.edge.toFixed(1), '   ', r.win.toFixed(0) + '%', '  ', r.common.join(' → '))
);
