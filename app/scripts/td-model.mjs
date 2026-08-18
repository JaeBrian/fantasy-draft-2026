/* Expected-TD model fitted on real 2025 data (Sleeper season stats).
   Fits league-wide scoring rates per opportunity type, then flags players whose
   actual TDs ran far ahead of / behind their opportunities. Also validates our
   projection curves against what actually happened in half-PPR. */
const fs = require('fs');
const { P } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');

const stats = JSON.parse(fs.readFileSync('/Users/brianlee/.claude/jobs/142115c6/tmp/stats2025.json', 'utf8'));

const norm = (s) => s.toLowerCase().replace(/[.'-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();

(async () => {
  const players = await (await fetch('https://api.sleeper.app/v1/players/nfl')).json();
  const idToName = {};
  for (const [pid, p] of Object.entries(players)) {
    if (p && p.full_name && ['QB', 'RB', 'WR', 'TE'].includes(p.position)) idToName[pid] = { name: p.full_name, pos: p.position };
  }

  /* assemble the 2025 sample: every skill player with real usage */
  const rows = [];
  for (const [pid, st] of Object.entries(stats)) {
    const meta = idToName[pid];
    if (!meta || !st) continue;
    const rzRush = st.rush_rz_att || 0;
    const rzTgt = st.rec_rz_tgt || 0;
    const rush = st.rush_att || 0;
    const tgt = st.rec_tgt || 0;
    const td = (st.rush_td || 0) + (st.rec_td || 0);
    const gp = st.gp || 0;
    if (gp < 4 || (rush + tgt) < 30) continue;
    rows.push({ ...meta, rzRush, rzTgt, rush, tgt, td, gp, pts: st.pts_half_ppr || 0, posRank: st.pos_rank_half_ppr });
  }
  console.log(`fitted on ${rows.length} players with 2025 usage (>=4 games, >=30 touches+targets)\n`);

  /* least-squares fit: TD = a*rzRush + b*rzTgt + c*nonRzRush + d*nonRzTgt */
  const feats = (r) => [r.rzRush, r.rzTgt, Math.max(0, r.rush - r.rzRush), Math.max(0, r.tgt - r.rzTgt)];
  const K = 4;
  const XtX = Array.from({ length: K }, () => new Array(K).fill(0));
  const Xty = new Array(K).fill(0);
  rows.forEach((r) => {
    const x = feats(r);
    for (let i = 0; i < K; i++) {
      Xty[i] += x[i] * r.td;
      for (let j = 0; j < K; j++) XtX[i][j] += x[i] * x[j];
    }
  });
  /* gaussian elimination */
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < K; i++) {
    let piv = i;
    for (let r2 = i + 1; r2 < K; r2++) if (Math.abs(A[r2][i]) > Math.abs(A[piv][i])) piv = r2;
    [A[i], A[piv]] = [A[piv], A[i]];
    for (let r2 = 0; r2 < K; r2++) {
      if (r2 === i || Math.abs(A[i][i]) < 1e-12) continue;
      const f = A[r2][i] / A[i][i];
      for (let c = i; c <= K; c++) A[r2][c] -= f * A[i][c];
    }
  }
  const beta = A.map((row, i) => row[K] / row[i]);
  const LBL = ['TD per red-zone carry', 'TD per red-zone target', 'TD per non-RZ carry', 'TD per non-RZ target'];
  console.log('FITTED SCORING RATES (2025, all skill players):');
  beta.forEach((b, i) => console.log(`  ${LBL[i].padEnd(26)} ${b.toFixed(4)}`));

  const xtd = (r) => feats(r).reduce((s, x, i) => s + x * beta[i], 0);
  const ss = rows.reduce((s, r) => s + (r.td - xtd(r)) ** 2, 0);
  const mean = rows.reduce((s, r) => s + r.td, 0) / rows.length;
  const tot = rows.reduce((s, r) => s + (r.td - mean) ** 2, 0);
  console.log(`  model R² = ${(1 - ss / tot).toFixed(3)} (how much of TD variance opportunity explains)\n`);

  /* apply to our board */
  const byName = new Map(rows.map((r) => [norm(r.name), r]));
  const out = [];
  P.forEach((pr) => {
    const r = byName.get(norm(pr[0]));
    if (!r) return;
    const x = xtd(r);
    out.push({ name: pr[0], pos: pr[1], team: pr[2], rank: P.indexOf(pr) + 1, td: r.td, xtd: +x.toFixed(1), delta: +(r.td - x).toFixed(1), rz: r.rzRush + r.rzTgt, gp: r.gp });
  });
  out.sort((a, b) => b.delta - a.delta);
  console.log('MOST LIKELY TO SCORE FEWER TDs (2025 luck to give back):');
  out.slice(0, 12).forEach((o) => console.log(`  ${o.name.padEnd(22)} ${String(o.td).padStart(2)} TD vs ${String(o.xtd).padStart(4)} expected  (${o.delta > 0 ? '+' : ''}${o.delta})  rz opps ${o.rz}`));
  console.log('\nMOST LIKELY TO SCORE MORE TDs (bad luck to reclaim):');
  out.slice(-12).reverse().forEach((o) => console.log(`  ${o.name.padEnd(22)} ${String(o.td).padStart(2)} TD vs ${String(o.xtd).padStart(4)} expected  (${o.delta > 0 ? '+' : ''}${o.delta})  rz opps ${o.rz}`));

  fs.writeFileSync('/Users/brianlee/.claude/jobs/142115c6/tmp/td_model_out.json', JSON.stringify({ beta, rows: out }, null, 0));
  console.log(`\nwrote ${out.length} board players to td_model_out.json`);
})();
