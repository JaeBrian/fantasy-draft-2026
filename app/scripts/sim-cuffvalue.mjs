/* Run from app/:  node scripts/sim-cuffvalue.mjs
 *
 * What is a backup running back worth when his starter is out? Until now: nothing. A
 * handcuff's projection was his projection, whatever the starter's injury risk, and the
 * advisor only boosted him for the starter's own owner. So Josh Jacobs' suspension risk moved
 * Jacobs and nobody else, and the room's biggest 24h add (MarShawn Lloyd, 162,000 adds) was
 * priced as a 3.9 pts/wk bench body.
 *
 * Measured from 2025 weekly game logs instead of guessed. Rosters are reconstructed the same
 * way sim-correlation.mjs does it — Sleeper's stats rows carry no team field, but they carry
 * the TEAM's offensive/defensive/special-teams snap counts for the week, and two players who
 * share all three were on the same field. Two backs who share it in 75% of the weeks both
 * played were teammates.
 *
 * For each pair: the starter is whichever back scores more when both play (season carries
 * alone get it backwards when the starter missed time — Kimani Vidal out-carried Omarion
 * Hampton in 2025). Then the backup's half-PPR points in the weeks the starter played against
 * the weeks he did not. The pooled ratio
 *
 *     k = (RB2 pts with RB1 out − RB2 pts with RB1 in) / RB1 pts when in
 *
 * is what a backup inherits, as a share of the starter's own production. risk.ts prices a
 * handcuff at  0.4 × pMiss(starter) × k × proj(starter)  — 0.4 because a "missed" season in
 * the simulation keeps 0.35–0.85 of its weeks (mean 0.6), the same arithmetic the advisor's
 * availability multiplier uses. */
import { writeFileSync } from "node:fs";

const players = await (await fetch("https://api.sleeper.app/v1/players/nfl")).json();
const pos = (id) => players[id]?.position;
const name = (id) => players[id]?.full_name ?? id;

/* week -> pid -> {fp, pts, att, snp} */
const weeks = [];
for (let wk = 1; wk <= 18; wk++) {
  const rows = await (await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/2025/${wk}`)).json();
  const w = {};
  for (const [pid, st] of Object.entries(rows)) {
    if (!st.tm_off_snp) continue;
    w[pid] = { fp: `${st.tm_off_snp}|${st.tm_def_snp}|${st.tm_st_snp}`, pts: st.pts_half_ppr || 0,
      att: st.rush_att || 0, snp: st.off_snp || 0 };
  }
  weeks.push(w);
  process.stdout.write(`  week ${wk}: ${Object.keys(w).length} rows\r`);
}
console.log("");

/* Running backs with a real workload, and which of them were teammates: two backs who share
 * the fingerprint in at least 75% of the weeks both played. Pairwise on purpose — a union-find
 * over every shared fingerprint merged teams on a single coincidental collision (it put Saquon
 * Barkley behind Jonathan Taylor). */
const rbs = Object.keys(players).filter((id) => pos(id) === "RB")
  .map((id) => ({ id, att: weeks.reduce((s, w) => s + (w[id]?.att || 0), 0), gp: weeks.filter((w) => w[id]?.snp > 0).length }))
  .filter((r) => r.att >= 40);
const together = (a, b) => {
  let both = 0, same = 0;
  for (const w of weeks) if (w[a]?.snp > 0 && w[b]?.snp > 0) { both++; if (w[a].fp === w[b].fp) same++; }
  return both >= 4 && same / both >= 0.75;
};

const out = [];
let sumGain = 0, sumBase = 0, nOut = 0, nIn = 0, sumOutPts = 0;
const used = new Set();
for (let rb1 of rbs.filter((r) => r.att >= 120).sort((a, b) => b.att - a.att)) {
  if (used.has(rb1.id)) continue;
  const mates = rbs.filter((r) => r.id !== rb1.id && !used.has(r.id) && together(rb1.id, r.id)).sort((a, b) => b.att - a.att);
  let rb2 = mates[0];
  if (!rb2) continue;
  used.add(rb1.id); used.add(rb2.id);
  const split = (s1, s2) => {
    const inW = [], outW = [];
    for (const w of weeks) {
      if (!w[s2.id] || w[s2.id].snp === 0) continue;                      // need the backup on the field
      const r1 = w[s1.id];
      const s1In = r1 && r1.snp >= 10 && r1.fp === w[s2.id].fp;
      (s1In ? inW : outW).push({ rb2: w[s2.id].pts, rb1: s1In ? r1.pts : null });
    }
    return { inW, outW };
  };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  let { inW, outW } = split(rb1, rb2);
  /* the starter is the one who scores more when both play */
  if (inW.length >= 4 && mean(inW.map((x) => x.rb2)) > mean(inW.map((x) => x.rb1))) {
    [rb1, rb2] = [rb2, rb1];
    ({ inW, outW } = split(rb1, rb2));
  }
  if (inW.length < 4) continue;
  const rb1In = mean(inW.map((x) => x.rb1)), rb2In = mean(inW.map((x) => x.rb2));
  const rb2Out = outW.length ? mean(outW.map((x) => x.rb2)) : null;
  out.push({ rb1: name(rb1.id), rb2: name(rb2.id), rb1In: +rb1In.toFixed(1), rb2In: +rb2In.toFixed(1),
    rb2Out: rb2Out === null ? null : +rb2Out.toFixed(1), nIn: inW.length, nOut: outW.length });
  if (outW.length) {
    /* pooled by week, so a back with eight starter-less weeks counts eight times */
    sumGain += outW.length * (rb2Out - rb2In); sumBase += outW.length * rb1In;
    sumOutPts += outW.length * rb2Out; nOut += outW.length;
  }
  nIn += inW.length;
}
out.sort((a, b) => b.nOut - a.nOut);
console.log("\n  starter                  backup                   RB1 in   RB2 in   RB2 out   wks in/out");
for (const r of out) console.log(`  ${r.rb1.padEnd(24)} ${r.rb2.padEnd(24)} ${String(r.rb1In).padStart(6)} ${String(r.rb2In).padStart(8)} ${String(r.rb2Out ?? "—").padStart(9)}   ${r.nIn}/${r.nOut}`);

const k = sumGain / sumBase, share = sumOutPts / sumBase;
const perPair = out.filter((r) => r.nOut).map((r) => (r.rb2Out - r.rb2In) / r.rb1In).sort((a, b) => a - b);
console.log(`  per-pair k, median ${perPair[perPair.length >> 1].toFixed(3)}  (${perPair.map((x) => x.toFixed(2)).join(" ")})`);
console.log(`\n  starter/backup pairs: ${out.length}   pairs with a starter-less week: ${out.filter((r) => r.nOut).length}   starter-less weeks pooled: ${nOut}   (weeks with starter: ${nIn})`);
console.log(`  backup gains k = ${k.toFixed(3)} of the starter's own pts/wk when the starter is out`);
console.log(`  (backup scores ${share.toFixed(2)} of what the starter scores when in)`);
writeFileSync(new URL("../.simcache/cuffvalue.json", import.meta.url).pathname,
  JSON.stringify({ k: +k.toFixed(3), share: +share.toFixed(3), starterlessWeeks: nOut, teams: out }, null, 2));
console.log("  wrote .simcache/cuffvalue.json");
