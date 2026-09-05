/* One command for the pre-draft refresh. Run from app/:  node scripts/predraft.mjs
 *
 * Written for the scheduled runs on the 28th and 29th, where nobody is watching. Those
 * prompts used to list five commands to run in order, which meant every new script or moved
 * dependency was a chance for a silent divergence between what the sims need and what the
 * scheduled job actually does. One entry point instead, and it stops on the first failure.
 *
 * Mechanical work only. Reading the fresh numbers back into data.ts and fixing any prose they
 * contradict is judgement, and stays with whoever runs this. */
import { execFileSync } from "node:child_process";

const app = new URL("../", import.meta.url).pathname;
const dir = new URL("./", import.meta.url).pathname;
const run = (label, file, args = []) => {
  process.stdout.write(`\n=== ${label} ===\n`);
  execFileSync("node", ["--max-old-space-size=4096", dir + file, ...args], { cwd: app, stdio: "inherit" });
};

/* 1. fresh market, projections and the news wire (fetch-sleeper chains fetch-projections) */
run("refreshing the draftable depth pool", "fetch-depth.mjs");
run("refreshing Sleeper data and projections", "fetch-sleeper.mjs");
run("refreshing mock-draft ADP", "fetch-market.mjs");
run("refreshing measured scoring spread", "fetch-ceilings.mjs");
run("refreshing the news wire", "fetch-news.mjs");

/* 2. compile what the studies read */
run("building the sim cache", "sim-build.mjs");

for (const test of ["league-scoring.test", "availability.test", "round-robin.test", "sleeper-draft.test"]) run(test, `${test}.mjs`);

const started = Date.now();
/* 3. the studies whose output is published */
for (const s of ["sim-all", "sim-paired", "sim-first", "sim-tree", "sim-plans", "sim-risk", "sim-priority", "sim-rbrun"])
  run(s, `${s}.mjs`);

/* 4. gates. These decide whether the numbers above are safe to publish, so a failure here
 *    must stop the run rather than be noted and passed over. */
const gates = ["audit-model-inputs", "audit-sim", "audit-logic", "audit-advisor", "audit-agreement", "audit-forecast", "audit-draftday", "audit-full-draft", "audit-results"];
const failed = [];
for (const g of gates) {
  process.stdout.write(`\n=== ${g} ===\n`);
  let out = "", exitedCleanly = true;
  try {
    out = execFileSync("node", ["--max-old-space-size=4096", dir + `${g}.mjs`], { cwd: app, encoding: "utf8" });
  } catch (e) {
    exitedCleanly = false;
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }
  process.stdout.write(out);
  const m = out.match(/RESULT:\s*(\d+)\s*FAIL/);
  if (!exitedCleanly || !m || Number(m[1]) > 0) failed.push(g);
}

console.log(`\n${"=".repeat(70)}`);
if (failed.length) {
  console.error(`GATE FAILED: ${failed.join(", ")}`);
  console.error("Published simulation results remain unchanged. Fresh results are in app/.simcache/*.json; report the failed gate,");
  console.error("Fix the failed gate and rerun before publishing.");
  process.exit(1);
}
console.log("All gates passed — writing results into src/data.ts and src/panels/SimPanel.tsx.");
run("loading results", "load-sims.mjs", ["--since", String(started)]);
console.log("Now `npm run build`, and re-check the prose against the fresh numbers.");
