/* Run from app/:  node scripts/sim-correlation.mjs
 *
 * "If someone has Puka, they shouldn't take Kyren." Both Rams. The intuition is that
 * teammates eat from one plate, so rostering two of them is worse than rostering two
 * strangers with the same projections.
 *
 * That is a claim about CORRELATION, and everything in this app treats correlation as zero.
 * Every simulation draws each player's week independently. If teammates actually move
 * together — or against each other — then every lineup floor and ceiling we have printed is
 * wrong, in a direction that depends on the roster.
 *
 * So measure it instead of assuming it. 2025 weekly half-PPR game logs, real teammates,
 * real weeks.
 *
 * Getting the rosters is the trick: Sleeper's stats rows carry no team field, and the players
 * endpoint only knows where someone plays NOW, which is wrong for anyone who moved. But every
 * row carries tm_off_snp / tm_def_snp / tm_st_snp — the TEAM's snap counts that week. Two
 * players on the same team in the same week share all three exactly. That triple is a
 * fingerprint, and it reconstructs 2025 rosters week by week from the stats alone.
 *
 * The control matters as much as the result: if a league-wide weekly effect existed (scoring
 * up in shootout weeks, say) it would show as positive correlation for EVERY pair, teammate
 * or not. So the same statistic is computed for random non-teammates. Read the difference. */

const WK = 18, MINW = 8;

const players = await (await fetch("https://api.sleeper.app/v1/players/nfl")).json();
const posOf = {}, nameOf = {};
for (const [id, p] of Object.entries(players)) {
  if (!p || !["QB", "RB", "WR", "TE"].includes(p.position)) continue;
  posOf[id] = p.position;
  nameOf[id] = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
}

/* week -> fingerprint -> [ids];  id -> {week: pts} */
const pts = {}, teamWeek = [];
for (let wk = 1; wk <= WK; wk++) {
  const rows = await (await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/2025/${wk}`)).json();
  const groups = new Map();
  for (const [id, st] of Object.entries(rows)) {
    if (!posOf[id] || !st?.gp || typeof st.pts_half_ppr !== "number") continue;
    const fp = `${st.tm_off_snp}|${st.tm_def_snp}|${st.tm_st_snp}`;
    if (!st.tm_off_snp) continue;                       // no snap data, cannot place him
    (groups.get(fp) ?? groups.set(fp, []).get(fp)).push(id);
    (pts[id] ??= {})[wk] = st.pts_half_ppr;
  }
  teamWeek.push(groups);
  process.stdout.write(`  week ${wk}: ${groups.size} team-groups\r`);
}
console.log(`\ncollected ${WK} weeks, ${Object.keys(pts).length} players with game logs`);

/* how often did a given pair share a fingerprint? that is how often they were teammates */
const together = new Map();
for (const groups of teamWeek) {
  for (const ids of groups.values()) {
    if (ids.length > 14) continue;                      // a bad fingerprint collision, skip
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        together.set(k, (together.get(k) || 0) + 1);
      }
  }
}

const pearson = (a, b) => {
  const n = a.length;
  if (n < MINW) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    sab += da * db; sa += da * da; sb += db * db;
  }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : null;
};
const paired = (x, y) => {
  const A = [], B = [];
  for (const w of Object.keys(pts[x] || {})) if (pts[y]?.[w] !== undefined) { A.push(pts[x][w]); B.push(pts[y][w]); }
  return [A, B];
};
const key = (p, q) => [p, q].sort().join("-");

/* ---- teammates ---- */
const buckets = {};
const add = (bk, r) => (buckets[bk] ??= []).push(r);
for (const [k, n] of together) {
  if (n < MINW) continue;
  const [x, y] = k.split("|");
  const [A, B] = paired(x, y);
  const r = pearson(A, B);
  if (r === null) continue;
  add(key(posOf[x], posOf[y]), r);
}

/* ---- the control: pairs who were never teammates ---- */
const ids = Object.keys(pts).filter((i) => posOf[i] && Object.keys(pts[i]).length >= 12);
const ctrl = {};
const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = mul(20260819);
for (let n = 0; n < 40000; n++) {
  const x = ids[Math.floor(rnd() * ids.length)], y = ids[Math.floor(rnd() * ids.length)];
  if (x === y) continue;
  const k = x < y ? `${x}|${y}` : `${y}|${x}`;
  if (together.has(k)) continue;                        // teammates at some point — not a control
  const [A, B] = paired(x, y);
  const r = pearson(A, B);
  if (r === null) continue;
  (ctrl[key(posOf[x], posOf[y])] ??= []).push(r);
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const se = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length); };

console.log(`\n\nTEAMMATE CORRELATION OF WEEKLY HALF-PPR SCORES — 2025, pairs sharing ${MINW}+ weeks\n`);
console.log("  pair      n     teammates        non-teammates      difference");
console.log("  " + "-".repeat(68));
const ORDER = ["QB-WR", "QB-TE", "QB-RB", "RB-WR", "RB-TE", "WR-WR", "WR-TE", "RB-RB", "TE-TE", "QB-QB"];
const OUT = {};
for (const bk of ORDER) {
  const t = buckets[bk], c = ctrl[bk];
  if (!t || t.length < 12 || !c || c.length < 12) continue;
  const mt = mean(t), mc = mean(c), d = mt - mc;
  const sed = Math.sqrt(se(t) ** 2 + se(c) ** 2);
  const sig = Math.abs(d) > 2 * sed ? (d > 0 ? "  <== together" : "  <== against each other") : "";
  OUT[bk] = { r: +mt.toFixed(4), delta: +d.toFixed(4), n: t.length, sig: Math.abs(d) > 2 * sed };
  console.log(`  ${bk.padEnd(8)} ${String(t.length).padStart(4)}   ${mt >= 0 ? "+" : ""}${mt.toFixed(3)} ±${se(t).toFixed(3)}   ${mc >= 0 ? "+" : ""}${mc.toFixed(3)} ±${se(c).toFixed(3)}   ${d >= 0 ? "+" : ""}${d.toFixed(3)} ±${sed.toFixed(3)}${sig}`);
}
console.log("\n  A pair is called only when the gap clears two combined standard errors.");
console.log("  Positive = they boom in the same weeks (a stack: higher ceiling, lower floor).");
console.log("  Negative = one eats the other's lunch (steadier, but a capped ceiling).\n");
console.log("MEASURED:", JSON.stringify(OUT));
