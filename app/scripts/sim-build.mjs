/* Transpiles everything the simulations need into .simcache/ so they can require it as plain
 * CommonJS. Run from app/ before any scripts/sim-*.mjs or scripts/audit-*.mjs:
 *
 *   node scripts/sim-build.mjs && node scripts/sim-paired.mjs
 *
 * Keep this in step with what the sims require. It has already broken once: risk.ts and
 * projections.ts were added to the sims while this still built only data.ts and sleeper.ts,
 * which would have failed the scheduled pre-draft reruns rather than any local run, because
 * local runs had the older files lying around. The check at the bottom is there to make that
 * impossible to repeat quietly. */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const out = new URL("../.simcache/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

/* plain modules — no imports of their own worth inlining */
execFileSync(
  "npx",
  ["esbuild", "src/data.ts", "src/sleeper.ts", "src/projections.ts",
   "--format=cjs", "--out-extension:.js=.cjs", `--outdir=${out}`, "--log-level=error"],
  { stdio: "inherit", cwd: root },
);
/* risk.ts pulls in data and sleeper, so it needs bundling rather than a bare transpile */
execFileSync(
  "npx",
  ["esbuild", "src/lib/risk.ts", "--bundle", "--format=cjs",
   `--outfile=${out}risk.cjs`, "--log-level=error"],
  { stdio: "inherit", cwd: root },
);

/* Every module any sim or audit requires must now exist. Fail loudly here rather than
 * halfway through a two-minute study, or worse, inside a scheduled run nobody is watching. */
const scripts = readdirSync(new URL("./", import.meta.url).pathname)
  .filter((f) => /^(sim|audit)-.*\.mjs$/.test(f));
const needed = new Set();
for (const f of scripts) {
  const body = readFileSync(new URL(`./${f}`, import.meta.url).pathname, "utf8");
  for (const m of body.matchAll(/require\(CACHE \+ ['"]([\w.]+)['"]\)/g)) needed.add(m[1]);
}
const missing = [...needed].filter((n) => !existsSync(out + n));
if (missing.length) {
  console.error(`\nsim-build is out of step with the scripts. Missing: ${missing.join(", ")}`);
  console.error("Add the source file to the esbuild calls above.");
  process.exit(1);
}
console.log(`transpiled ${[...needed].sort().join(", ")} -> ${out}`);
