/* Run from app/:  node scripts/sim-build.mjs && node scripts/audit-forecast.mjs
 *
 * The live run forecast is the feature people will lean on hardest during the draft, and it is
 * the one whose output is least checkable by eye — a survival percentage looks equally
 * plausible whether it is right or badly wrong. So check the things that must hold.
 *
 * The strongest is conservation. Exactly `picksAhead` players come off the board before your
 * turn, so the survival probabilities must sum to exactly that many disappearances. If they do
 * not, the simulation is either double-counting picks or losing them, and every number it
 * produces is wrong by the same factor. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const app = new URL("../", import.meta.url).pathname;
const tmp = mkdtempSync(path.join(tmpdir(), "fc-"));
execFileSync("npx", ["esbuild", "src/lib/forecast.ts", "--bundle", "--format=cjs",
  `--outfile=${tmp}/fc.cjs`, "--log-level=error"], { cwd: app, stdio: "pipe" });
const { runForecast } = require(`${tmp}/fc.cjs`);
const CACHE = new URL("../.simcache/", import.meta.url).pathname;
const { P } = require(CACHE + "data.cjs");
const { SLP } = require(CACHE + "sleeper.cjs");

let fails = 0, warns = 0;
const ok = (t, d = "") => console.log(`  PASS  ${t}${d ? "  — " + d : ""}`);
const warn = (t, d = "") => { warns++; console.log(`  WARN  ${t}${d ? "  — " + d : ""}`); };
const fail = (t, d = "") => { fails++; console.log(`  FAIL  ${t}${d ? "  — " + d : ""}`); };
const snap = (p) => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };

/* build a plausible board state: the first `n` players by ADP are gone */
function stateAfter(n) {
  const order = P.filter((r) => ["QB", "RB", "WR", "TE"].includes(r[1]))
    .map((r) => r[0])
    .sort((a, b) => (SLP[a]?.adp ?? 400) - (SLP[b]?.adp ?? 400));
  const DS = {}, ord = [];
  for (let i = 0; i < n; i++) { DS[order[i]] = "gone"; ord.push(order[i]); }
  return { DS, ord };
}

const cases = [
  { label: "seat 10, waiting (9 picks made)", slot: 10, made: 9 },
  { label: "seat 6, waiting (20 picks made)", slot: 6, made: 20 },
  { label: "seat 1, on the clock (24 made)", slot: 1, made: 24 },
  { label: "seat 6, mid-draft (60 made)", slot: 6, made: 60 },
];

for (const c of cases) {
  const { DS, ord } = stateAfter(c.made);
  const f = await runForecast(DS, ord, c.slot, 3000);
  console.log(`\n=== ${c.label} ===`);
  const onClock = snap(c.made + 1) === c.slot;

  /* 1. conservation — the sum of disappearances must equal the picks that happen */
  const expectedGone = Object.values(f.survive).reduce((a, b) => a + (1 - b), 0);
  const err = Math.abs(expectedGone - f.picksAhead);
  if (f.picksAhead === 0) ok("no picks ahead, nothing to conserve");
  else if (err > 0.15) fail("survival odds do not conserve picks",
    `model loses ${expectedGone.toFixed(2)} players over ${f.picksAhead} picks`);
  else ok("survival odds conserve picks exactly",
    `${expectedGone.toFixed(2)} expected gone over ${f.picksAhead} picks`);

  /* 2. on the clock it must still answer something useful */
  if (onClock) {
    const allOne = Object.values(f.survive).every((v) => v > 0.999);
    if (allOne) fail("on the clock the forecast returns 100% for everyone — useless exactly when it matters");
    else ok("on the clock it forecasts to your NEXT turn", `${f.picksAhead} picks between your turns`);
  }

  /* 3. probabilities in range */
  const bad = Object.entries(f.survive).filter(([, v]) => !(v >= 0 && v <= 1));
  bad.length ? fail(`${bad.length} survival values outside [0,1]`) : ok("all survival values are probabilities");

  /* 4. it must respect ADP: a player the market takes immediately cannot be likelier to
        survive than one the market ignores */
  const live = Object.keys(f.survive).filter((n) => SLP[n]?.adp !== undefined);
  const early = live.filter((n) => SLP[n].adp <= c.made + 3).sort((a, b) => SLP[a].adp - SLP[b].adp);
  const late = live.filter((n) => SLP[n].adp >= c.made + 45);
  if (early.length && late.length) {
    const mEarly = early.reduce((a, n) => a + f.survive[n], 0) / early.length;
    const mLate = late.reduce((a, n) => a + f.survive[n], 0) / late.length;
    mEarly < mLate
      ? ok("players the market wants survive less often", `${(mEarly * 100).toFixed(0)}% vs ${(mLate * 100).toFixed(0)}%`)
      : fail("survival ignores ADP", `sought-after ${(mEarly * 100).toFixed(0)}% vs ignored ${(mLate * 100).toFixed(0)}%`);
  }

  /* 5. expected taken by position must add up to the picks ahead */
  const sumTaken = ["QB", "RB", "WR", "TE"].reduce((a, k) => a + f.taken[k], 0);
  Math.abs(sumTaken - f.picksAhead) > 0.15
    ? fail("position counts do not sum to the picks ahead", `${sumTaken.toFixed(2)} vs ${f.picksAhead}`)
    : ok("position counts sum to the picks ahead", `${sumTaken.toFixed(2)}`);

  /* 6. nobody already drafted may appear as survivable */
  const ghosts = Object.keys(f.survive).filter((n) => DS[n]);
  ghosts.length ? fail(`${ghosts.length} already-drafted players appear in the forecast`) : ok("drafted players are excluded");

  /* 7. run probabilities must be probabilities, and consistent with the expected counts */
  const badRun = f.runs.filter((r) => !(r.p >= 0 && r.p <= 1) || r.expected < 0);
  badRun.length ? fail("run figures out of range") : ok("run probabilities are well formed");
  const contradiction = f.runs.filter((r) => r.p > 0.5 && r.expected < 1.5);
  contradiction.length
    ? warn("a run is called likely on fewer than 1.5 expected picks", contradiction.map((r) => r.pos).join(", "))
    : ok("run calls are consistent with expected counts");
}

console.log(`\n${"=".repeat(70)}\nRESULT: ${fails} FAIL, ${warns} WARN\n`);
