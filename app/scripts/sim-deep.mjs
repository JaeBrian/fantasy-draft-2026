/* Deep study for slots 6 and 10:
   A) expanded strategy set with confidence intervals
   B) "who should I actually take first?" — force each candidate, measure the FINAL roster
   C) head-to-head: all three tool users in the same league at once */
process.env.RISK = '1';
const src = require('fs').readFileSync('/Users/brianlee/.claude/jobs/142115c6/tmp/draft_mc.js', 'utf8');
const mod = { exports: {} };
const log = console.log; console.log = () => {};
new Function('module', 'exports', 'require', 'process',
  src.replace(/const N = parseInt[\s\S]*$/, 'module.exports = { simulate, lineup, TEMPLATES, POOL, snap };')
)(mod, mod.exports, require, process);
console.log = log;
const { lineup, POOL, snap } = mod.exports;

const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NEED = t => { const c = { QB: 0, RB: 0, WR: 0, TE: 0 }; t.forEach(x => c[x.pos]++); return c; };

function oppPick(avail, team) {
  const c = NEED(team); let best = null, bs = Infinity;
  for (const p of avail) {
    let s = p.mkt + randn() * p.sig * 0.8;
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
  const order = ['RB', 'WR', 'TE', 'QB'].filter(pos =>
    pos === 'QB' ? c.QB < 2 : pos === 'TE' ? c.TE < 2 : c[pos] < 6);
  const cands = avail.filter(p => order.includes(p.pos));
  return (cands.length ? cands : avail).sort((a, b) => a.ourRank - b.ourRank)[0];
}
/** run one draft; `forced` maps my pick-number -> player name I must take if available */
function run(mySlot, tpl, forced = {}, otherBots = {}) {
  const avail = POOL.slice();
  const teams = {}; for (let t = 1; t <= 12; t++) teams[t] = [];
  for (let pick = 1; pick <= 192; pick++) {
    if (!avail.length) break;
    const t = snap(pick), round = Math.ceil(pick / 12);
    let p;
    if (t === mySlot) {
      const want = forced[pick];
      p = (want && avail.find(x => x.name === want)) || myPick(avail, teams[t], tpl, round);
    } else if (otherBots[t]) {
      p = myPick(avail, teams[t], otherBots[t], round);
    } else p = oppPick(avail, teams[t]);
    if (!p) break;
    teams[t].push(p);
    avail.splice(avail.indexOf(p), 1);
  }
  return teams;
}

const TPL = {
  'RB-RB-WR-WR':      ['RB','RB','WR','WR','TE','QB'],
  'RB-RB-WR-RB':      ['RB','RB','WR','RB','TE','QB'],
  'RB-WR-RB-WR':      ['RB','WR','RB','WR','TE','QB'],
  'RB-WR-WR-RB':      ['RB','WR','WR','RB','TE','QB'],
  'WR-RB-RB-WR':      ['WR','RB','RB','WR','TE','QB'],
  'WR-RB-WR-RB':      ['WR','RB','WR','RB','TE','QB'],
  'WR-WR-RB-RB':      ['WR','WR','RB','RB','TE','QB'],
  'RB-RB-RB-WR':      ['RB','RB','RB','WR','TE','QB'],
  'RB-TE-RB-WR':      ['RB','TE','RB','WR','WR','QB'],
  'RB-RB-QB-WR':      ['RB','RB','QB','WR','WR','TE'],
  'RB-RB-WR-TE':      ['RB','RB','WR','TE','WR','QB'],
  'RB-WR-RB-TE':      ['RB','WR','RB','TE','WR','QB'],
};
const N = 900;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const se = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length); };

for (const slot of [6, 10]) {
  const who = slot === 6 ? 'BRIAN JK (pick 6)' : 'EMILY (pick 10)';
  console.log(`\n${'='.repeat(74)}\n${who} — A) EXPANDED STRATEGY SET, ${N} drafts each (±  = standard error)`);
  const rows = [];
  for (const [label, tpl] of Object.entries(TPL)) {
    const s = [];
    for (let i = 0; i < N; i++) s.push(lineup(run(slot, tpl)[slot]));
    rows.push({ label, m: mean(s), e: se(s) });
  }
  rows.sort((a, b) => b.m - a.m);
  const top = rows[0];
  rows.forEach(r => {
    const diff = r.m - top.m;
    const sig = Math.abs(diff) > 2 * Math.sqrt(r.e ** 2 + top.e ** 2) ? '' : '  (tied with best)';
    console.log('  ' + r.label.padEnd(16) + r.m.toFixed(2).padStart(7) + ' ±' + r.e.toFixed(2) + (diff ? ('  ' + diff.toFixed(2)).padStart(8) : '   —     ') + sig);
  });

  console.log(`\n${who} — B) WHO TO TAKE FIRST (forced first pick, best strategy, ${N} drafts each)`);
  const firstPick = slot === 6 ? 6 : 10;
  const bestTpl = TPL[rows[0].label];
  const cands = POOL.filter(p => p.mkt >= firstPick - 9 && p.mkt <= firstPick + 12).slice(0, 12);
  const res = [];
  for (const c of cands) {
    const s = [];
    let got = 0;
    for (let i = 0; i < N; i++) {
      const teams = run(slot, bestTpl, { [firstPick]: c.name });
      if (teams[slot][0] && teams[slot][0].name === c.name) got++;
      s.push(lineup(teams[slot]));
    }
    res.push({ name: c.name, pos: c.pos, m: mean(s), e: se(s), avail: got / N * 100 });
  }
  res.sort((a, b) => b.m - a.m);
  console.log('  player'.padEnd(24) + 'final roster   avail at your pick');
  res.forEach(r => console.log('  ' + (r.name + ' (' + r.pos + ')').padEnd(24) + r.m.toFixed(2).padStart(8) + ' ±' + r.e.toFixed(2) + r.avail.toFixed(0).padStart(12) + '%'));
}

/* C) all three tool users in the same league */
console.log(`\n${'='.repeat(74)}\nC) HEAD-TO-HEAD — Ashley(1), Brian(6), Emily(10) all drafting with the tool`);
const bots = { 1: TPL['RB-RB-WR-WR'], 6: TPL['RB-RB-WR-WR'], 10: TPL['RB-WR-WR-RB'] };
const tally = { 1: [], 6: [], 10: [], field: [] };
for (let i = 0; i < 700; i++) {
  const teams = run(1, bots[1], {}, { 6: bots[6], 10: bots[10] });
  const sc = {}; for (let t = 1; t <= 12; t++) sc[t] = lineup(teams[t]);
  [1, 6, 10].forEach(s => tally[s].push(sc[s]));
  for (let t = 1; t <= 12; t++) if (![1, 6, 10].includes(t)) tally.field.push(sc[t]);
}
[1, 6, 10].forEach(s => {
  const nm = s === 1 ? 'Ashley  ' : s === 6 ? 'Brian JK' : 'Emily   ';
  const wins = tally[s].filter((v, i) => v >= Math.max(tally[1][i], tally[6][i], tally[10][i])).length;
  console.log(`  ${nm} avg ${mean(tally[s]).toFixed(1)}  |  best of the three ${(wins / tally[s].length * 100).toFixed(0)}% of drafts`);
});
console.log(`  rest of the league avg ${mean(tally.field).toFixed(1)}`);
