/* Run from app/:  node scripts/sim-build.mjs && node scripts/audit-agreement.mjs
 *
 * Does the draft algorithm actually recommend what the simulation says is best?
 *
 * Brian asked directly, and it is the question that matters most: the advisor is what gets
 * used on the night, the simulations are the evidence behind it, and nothing has been checking
 * that they agree. They are different code doing different jobs — the advisor ranks in
 * milliseconds using value-over-replacement plus a scarcity term, the simulation plays out
 * thousands of full seasons — so agreement is a real result, not a tautology.
 *
 * For each draft state: take the advisor's top candidates, force each one in a full simulation,
 * play the season out, and see whether the advisor's first choice is the simulation's. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const app = new URL("../", import.meta.url).pathname;
const CACHE = new URL("../.simcache/", import.meta.url).pathname;
const tmp = mkdtempSync(path.join(tmpdir(), "agree-"));
execFileSync("npx", ["esbuild", "src/lib/advisor.ts", "--bundle", "--format=cjs",
  `--outfile=${tmp}/adv.cjs`, "--log-level=error"], { cwd: app, stdio: "pipe" });
const { advise } = require(`${tmp}/adv.cjs`);
const { P, MKT, BYE } = require(CACHE + "data.cjs");
const { SLP } = require(CACHE + "sleeper.cjs");
const { PROJ } = require(CACHE + "projections.cjs");
const { riskOf } = require(CACHE + "risk.cjs");

const POOL = [];
P.forEach((r, i) => {
  if (!["QB", "RB", "WR", "TE"].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({
    name: r[0], pos: r[1], ourRank: i + 1, idx: POOL.length,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6,
    cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0,
  });
});
const IDX = new Map(POOL.map((p) => [p.name, p]));
const REPL = {};
for (const pos of ["QB", "RB", "WR", "TE"]) {
  const v = POOL.filter((p) => p.pos === pos).map((p) => p.proj).sort((a, b) => b - a);
  REPL[pos] = v[Math.min({ QB: 12, RB: 31, WR: 40, TE: 13 }[pos] - 1, v.length - 1)] || 0;
}
POOL.forEach((p) => { p.vorp = Math.max(0.2, p.proj - REPL[p.pos]); });

const snap = (p) => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };
const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = (rnd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NEED = (t) => { const c = { QB: 0, RB: 0, WR: 0, TE: 0 }; t.forEach((x) => c[x.pos]++); return c; };
const cache = new Map();
function realise(p, w) {
  const k = w * 100000 + p.idx; let v = cache.get(k); if (v !== undefined) return v;
  const rnd = mul(w * 7919 + p.idx * 104729 + 13); rnd(); rnd();
  const s = Math.sqrt(Math.log(1 + p.cv * p.cv));
  v = p.proj * Math.exp(gauss(rnd) * s - (s * s) / 2) * (rnd() < p.pMiss ? 0.35 + 0.5 * rnd() : 1);
  cache.set(k, v); return v;
}
function oppPick(avail, team, rnd) {
  const c = NEED(team); let b = null, bs = Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd) * p.sig * 0.8;
    if (p.pos === "QB" && c.QB >= 1) s += 60;
    if (p.pos === "TE" && c.TE >= 1) s += 50;
    if (p.pos === "RB" && c.RB >= 5) s += 25;
    if (p.pos === "WR" && c.WR >= 5) s += 25;
    if (s < bs) { bs = s; b = p; }
  }
  return b;
}
function bestAvail(avail, team) {
  const c = NEED(team);
  const ok = ["RB", "WR", "TE", "QB"].filter((pos) => pos === "QB" ? c.QB < 2 : pos === "TE" ? c.TE < 2 : c[pos] < 6);
  const cs = avail.filter((p) => ok.includes(p.pos));
  return (cs.length ? cs : avail).sort((a, b) => b.vorp - a.vorp)[0];
}
function weekly(R) {
  let tot = 0;
  for (let wk = 1; wk <= 17; wk++) {
    const live = R.filter((x) => x.bye !== wk);
    const by = (pos) => live.filter((x) => x.pos === pos).sort((a, b) => b.real - a.real);
    const rb = by("RB"), wr = by("WR"), te = by("TE"), qb = by("QB");
    const used = new Set(); let pts = 0;
    const take = (a, n) => a.slice(0, n).forEach((x) => { pts += x.real; used.add(x.name); });
    take(qb, 1); take(rb, 2); take(wr, 2); take(te, 1);
    take([...rb, ...wr, ...te].filter((x) => !used.has(x.name)).sort((a, b) => b.real - a.real), 2);
    tot += pts;
  }
  return tot / 17;
}
/* play from a given draft state, forcing our next pick, then best-available */
function playFrom(DS, slot, force, w) {
  const rnd = mul(30000 + w);
  const avail = POOL.filter((p) => !DS[p.name]);
  const teams = {}; for (let t = 1; t <= 12; t++) teams[t] = [];
  P.forEach((r) => { const st = DS[r[0]]; if (st === "mine") { const p = IDX.get(r[0]); if (p) teams[slot].push(p); } });
  let first = true;
  for (let pick = Object.keys(DS).length + 1; pick <= 168; pick++) {
    if (!avail.length) break;
    const t = snap(pick); let p;
    if (t === slot) {
      if (first) { p = IDX.get(force); first = false; if (!p || !avail.includes(p)) return null; }
      else p = bestAvail(avail, teams[t]);
    } else p = oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p), 1);
  }
  return weekly(teams[slot].map((p) => ({ ...p, real: realise(p, w) })));
}

const ORD = ["Ashley","Brian JK","Jeff","Brandon","Duy","Zach","Michelle","Aaron","Matt","Emily","Josh","Brian V"];
/* 2,500 left several comparisons sitting on the two-standard-error line, where the verdict
   flips between runs and tells you nothing. 7,000 tightens the error bar enough that a
   failure means something. */
const W = 7000;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
let fails = 0, warns = 0;

/* build a realistic mid-draft state by letting ADP run to a given pick */
function stateAt(target, slot) {
  const DS = {}; const rnd = mul(4242);
  const avail = POOL.slice(); const teams = {}; for (let t = 1; t <= 12; t++) teams[t] = [];
  for (let pick = 1; pick < target; pick++) {
    const t = snap(pick);
    const p = t === slot ? bestAvail(avail, teams[t]) : oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p), 1);
    DS[p.name] = t === slot ? "mine" : "gone";
  }
  return DS;
}

console.log("\nDoes the advisor recommend what the simulation says is best?\n");
console.log(`${W.toLocaleString()} seasons per candidate, scored week by week with byes live.\n`);
for (const slot of [1, 2, 10]) {
  const who = slot === 1 ? "ASHLEY (1)" : slot === 2 ? "BRIAN JK (2)" : "EMILY (10)";
  for (const round of [1, 3, 6]) {
    const target = (round - 1) * 12 + (round % 2 ? slot : 13 - slot);
    /* Ask the advisor about the SAME board the simulation is about to play from. Round 1 used
     * to be special-cased to an empty board, which is right for seat 1 and wrong for everyone
     * else: seat 10 was being asked "who do you want?" with all 170 players showing, then
     * judged on a simulation that ran picks 1-9 first. It duly recommended James Cook, who is
     * gone before pick 10 in four worlds out of five, and the audit recorded a disagreement
     * that was really just the two halves looking at different boards. */
    const DS = stateAt(target, slot);
    const a = advise(DS, slot, ORD);
    const cands = a.cands.slice(0, 5).map((c) => c.now.r[0]);
    if (!cands.length) continue;
    const scored = [];
    for (const n of cands) {
      const out = [];
      for (let w = 0; w < W; w++) { const v = playFrom(DS, slot, n, w); if (v !== null) out.push(v); }
      if (out.length > W * 0.2) {
        const m = mean(out);
        const sd = Math.sqrt(out.reduce((a, b) => a + (b - m) * (b - m), 0) / (out.length - 1));
        scored.push({ n, m, se: sd / Math.sqrt(out.length) });
      }
    }
    if (!scored.length) continue;
    scored.sort((x, y) => y.m - x.m);
    const advisorPick = cands[0];
    const simBest = scored[0].n;
    const advisorScore = scored.find((s) => s.n === advisorPick);
    const gap = advisorScore ? scored[0].m - advisorScore.m : Infinity;
    /* Judge against the actual error bars, not a round number. A fixed threshold either
       flags noise as a defect or hides a real one depending on how noisy the state happens
       to be; two combined standard errors is the same bar the precision study uses. */
    const se = advisorScore ? Math.sqrt(scored[0].se ** 2 + advisorScore.se ** 2) : 0;
    const agree = advisorPick === simBest;
    const tag = `${who} round ${round}`;
    /* "We could not evaluate this" is not "this is catastrophically wrong". Before, a pick the
       simulation never got to score came out as a gap of Infinity against a threshold of zero,
       which reads like the worst failure on the board and means nothing. */
    if (!advisorScore) {
      warns++;
      console.log(`  WARN  ${tag}: advisor says ${advisorPick}, but he survived to this pick in under 20% of worlds — not enough to score him`);
      continue;
    }
    if (agree) console.log(`  PASS  ${tag}: both say ${advisorPick}`);
    else if (gap <= 2 * se) { warns++; console.log(`  WARN  ${tag}: advisor says ${advisorPick}, sim leans ${simBest} by ${gap.toFixed(2)} (±${se.toFixed(2)}) — inside noise`); }
    else { fails++; console.log(`  FAIL  ${tag}: advisor says ${advisorPick}, sim prefers ${simBest} by ${gap.toFixed(2)} pts/wk, which clears ${(2 * se).toFixed(2)}`); }
    console.log(`        ${scored.map((s) => `${s.n} ${s.m.toFixed(2)}`).join("  ·  ")}`);
  }
}
console.log(`\n${"=".repeat(70)}\nRESULT: ${fails} FAIL, ${warns} WARN\n`);
