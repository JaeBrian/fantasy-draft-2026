/* Transpiles src/data.ts and src/sleeper.ts into .simcache/ so the sim scripts can require
 * them as plain CommonJS. Run from app/ before any scripts/sim-*.mjs:
 *   node scripts/sim-build.mjs && node scripts/sim-paired.mjs                              */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const out = new URL("../.simcache/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
execFileSync(
  "npx",
  ["esbuild", "src/data.ts", "src/sleeper.ts", "--format=cjs", "--out-extension:.js=.cjs", `--outdir=${out}`, "--log-level=error"],
  { stdio: "inherit", cwd: root },
);
console.log(`transpiled data.ts + sleeper.ts -> ${out}`);
