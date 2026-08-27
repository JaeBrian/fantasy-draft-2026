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

/* 1. fresh market and projections (fetch-sleeper chains fetch-projections) */
run("refreshing Sleeper data and projections", "fetch-sleeper.mjs");

/* 2. compile what the studies read */
run("building the sim cache", "sim-build.mjs");

/* 3. the studies whose output is published */
for (const s of ["sim-all", "sim-paired", "sim-first", "sim-tree"]) run(s, `${s}.mjs`);

/* 4. gates. These decide whether the numbers above are safe to publish, so a failure here
 *    must stop the run rather than be noted and passed over. */
const gates = ["audit-logic", "audit-advisor", "audit-agreement", "audit-forecast"];
const failed = [];
for (const g of gates) {
  process.stdout.write(`\n=== ${g} ===\n`);
  let out = "";
  try {
    out = execFileSync("node", ["--max-old-space-size=4096", dir + `${g}.mjs`], { cwd: app, encoding: "utf8" });
  } catch (e) {
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }
  process.stdout.write(out);
  const m = out.match(/RESULT:\s*(\d+)\s*FAIL/);
  if (!m || Number(m[1]) > 0) failed.push(g);
}

console.log(`\n${"=".repeat(70)}`);
if (failed.length) {
  console.error(`GATE FAILED: ${failed.join(", ")}`);
  console.error("Do NOT publish these numbers. Report which gate failed and what it said.");
  process.exit(1);
}
console.log("All gates passed. Fresh results are in app/.simcache/*.json:");
console.log("  sim_all.json  final_sim.json  first_pick.json  tree.json");
console.log("Run scripts/load-sims.mjs to write them into src/data.ts and src/panels/SimPanel.tsx, then re-check the prose.");
