/* Run from app/:  node scripts/audit-advisor.mjs
 *
 * Drives the REAL advisor through complete simulated drafts and asserts the things that must
 * never happen. Bugs here reach the draft room, so this checks behaviour rather than numbers. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const app = new URL("../", import.meta.url).pathname;
const out = mkdtempSync(path.join(tmpdir(), "audit-adv-"));
execFileSync("npx", ["esbuild", "src/lib/advisor.ts", "--bundle", "--format=cjs",
  `--outfile=${out}/adv.cjs`, "--log-level=error"], { cwd: app, stdio: "pipe" });
const { advise } = require(`${out}/adv.cjs`);
const { P } = require(new URL("../.simcache/data.cjs", import.meta.url).pathname);
const { SLP } = require(new URL("../.simcache/sleeper.cjs", import.meta.url).pathname);

let fails = 0, warns = 0;
const ok = (t, d = "") => console.log(`  PASS  ${t}${d ? "  — " + d : ""}`);
const warn = (t, d = "") => { warns++; console.log(`  WARN  ${t}${d ? "  — " + d : ""}`); };
const fail = (t, d = "") => { fails++; console.log(`  FAIL  ${t}${d ? "  — " + d : ""}`); };

const ORD = ["Ashley","Zach","Jeff","Brandon","Duy","Brian JK","Michelle","Aaron","Matt","Emily","Josh","Brian V"];
const snap = p => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };
const adp = n => { const s = SLP[n]; return s && s.adp !== undefined ? s.adp : 400; };

/* Play a full 14-round draft: our seat always takes the advisor's top pick, everyone else
   takes the best remaining by Sleeper ADP. Assert invariants at every one of our turns. */
function playDraft(slot) {
  const DS = {}, ord = [];
  const taken = new Set();
  const problems = [];
  let myPicks = 0;
  for (let pick = 1; pick <= 168; pick++) {
    const t = snap(pick);
    if (t === slot) {
      const a = advise(DS, slot, ord);
      if (!a.cands.length) { problems.push(`pick ${pick}: advisor returned no candidates`); break; }
      /* --- invariants --- */
      if (!a.onClock) problems.push(`pick ${pick}: advisor says it is NOT our turn when it is`);
      for (const c of a.cands) {
        if (taken.has(c.now.r[0])) problems.push(`pick ${pick}: recommended ${c.now.r[0]}, already drafted`);
        if (!(c.pReach >= 0 && c.pReach <= 1)) problems.push(`pick ${pick}: pReach out of range for ${c.now.r[0]} (${c.pReach})`);
        if (!Number.isFinite(c.score)) problems.push(`pick ${pick}: non-finite score for ${c.now.r[0]}`);
      }
      const top = a.cands[0];
      /* roster caps: never a 3rd QB or 3rd TE */
      if (top.p === "QB" && a.qb >= 2) problems.push(`pick ${pick}: recommended a 3rd QB`);
      if (top.p === "TE" && a.te >= 2) problems.push(`pick ${pick}: recommended a 3rd TE`);
      DS[top.now.r[0]] = "mine"; ord.push(top.now.r[0]); taken.add(top.now.r[0]); myPicks++;
    } else {
      const nxt = P.map(r => r[0]).filter(n => !taken.has(n)).sort((x, y) => adp(x) - adp(y))[0];
      if (!nxt) break;
      DS[nxt] = "gone"; ord.push(nxt); taken.add(nxt);
    }
  }
  const a = advise(DS, slot, ord);
  const unexpected = a.warnings.filter(w => !/kicker and defense/i.test(w));
  return { problems, myPicks, roster: { qb: a.qb, rb: a.rb, wr: a.wr, te: a.te }, unexpected };
}

console.log("\n=== 1. FULL-DRAFT INVARIANTS (advisor drafts for itself, 14 rounds) ===");
for (const slot of [1, 2, 3, 10, 12]) {
  const r = playDraft(slot);
  const tag = `seat ${slot}`;
  if (r.problems.length) fail(`${tag}: ${r.problems.length} invariant breaches`, r.problems.slice(0, 3).join(" | "));
  else ok(`${tag}: no illegal recommendations across 14 rounds`,
    `roster QB${r.roster.qb} RB${r.roster.rb} WR${r.roster.wr} TE${r.roster.te}`);
  if (r.myPicks !== 14) fail(`${tag}: made ${r.myPicks} picks, expected 14`);
  /* a finished roster must be able to field a legal lineup */
  const { qb, rb, wr, te } = r.roster;
  if (qb < 1 || rb < 2 || wr < 2 || te < 1)
    fail(`${tag}: cannot field a legal lineup`, `QB${qb} RB${rb} WR${wr} TE${te}`);
  else ok(`${tag}: roster fills every starting slot`);
  /* the K/DST reminder is intentional once 14 skill picks are in — only flag anything else */
  if (r.unexpected.length) warn(`${tag}: unexpected warning on a clean draft`, r.unexpected.join(" | "));
}

console.log("\n=== 2. ROSTER ACCOUNTING: does the advisor read the pick order correctly? ===");
{
  /* hand-build a state where seat 6 owns picks 6 and 19 */
  const ord = [], DS = {};
  const names = P.map(r => r[0]);
  for (let i = 0; i < 19; i++) { ord.push(names[i]); DS[names[i]] = snap(i + 1) === 6 ? "mine" : "gone"; }
  const a = advise(DS, 6, ord);
  const mineCount = Object.values(DS).filter(v => v === "mine").length;
  const seen = a.qb + a.rb + a.wr + a.te;
  seen === mineCount ? ok("advisor's roster count matches the picks marked mine", `${seen}`)
    : fail("roster count disagrees with the draft state", `advisor ${seen}, state ${mineCount}`);
  a.cur === 20 ? ok("pick counter is correct", `cur=${a.cur} after 19 picks`)
    : fail("pick counter is wrong", `cur=${a.cur}, expected 20`);
}

console.log("\n=== 3. BLOCKLIST ===");
{
  /* Block whoever the advisor currently recommends, rather than a hard-coded name — a fixed
     name goes stale the moment the value model changes, and then the test reports a defect
     that is really just its own premise rotting. */
  const before = advise({}, 10, ORD);
  const target = before.cands[0]?.now.r[0];
  if (!target) fail("no candidates to test the blocklist against");
  else {
    const a = advise({}, 10, ORD, new Set([target]));
    a.cands.some(c => c.now.r[0] === target)
      ? fail(`blocked player still recommended`, target)
      : ok("blocked player is excluded from recommendations", target);
    advise({}, 10, ORD).cands.some(c => c.now.r[0] === target)
      ? ok("and he returns when not blocked", target)
      : fail("player vanished even unblocked", target);
  }
}

console.log("\n=== 4. NOT-MY-TURN BEHAVIOUR ===");
{
  const a = advise({}, 6, ORD);           // pick 1 is Ashley's, so seat 6 is waiting
  a.onClock ? fail("advisor thinks it is our turn at pick 1 when we hold pick 6")
    : ok("advisor knows it is waiting", `next pick #${a.nextPick}`);
  const bad = a.cands.filter(c => c.pReach > 0.999 && adp(c.now.r[0]) < 3);
  bad.length ? warn("a near-certain-to-be-gone player is shown as certain to reach us", bad.map(c => c.now.r[0]).join(", "))
    : ok("survival odds are applied to players who will not reach us");
}

console.log(`\n${"=".repeat(70)}\nRESULT: ${fails} FAIL, ${warns} WARN\n`);
