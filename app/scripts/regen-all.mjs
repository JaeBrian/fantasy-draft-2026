/* Run from app/:  node scripts/regen-all.mjs
 * Rebuilds the sim cache, then runs every study in sequence and writes each one's stdout to
 * .simcache/out-<name>.txt. Sequential on purpose: these are CPU-bound and fight each other. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const dir = new URL("./", import.meta.url).pathname;
const cache = new URL("../.simcache/", import.meta.url).pathname;
const app = new URL("../", import.meta.url).pathname;

execFileSync("node", [dir + "sim-build.mjs"], { cwd: app, stdio: "inherit" });
for (const name of ["sim-all", "sim-paired", "sim-first", "sim-tree"]) {
  process.stdout.write(`running ${name} ... `);
  const t0 = process.hrtime.bigint();
  const out = execFileSync("node", ["--max-old-space-size=4096", dir + name + ".mjs"],
    { cwd: app, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`${cache}out-${name}.txt`, out);
  console.log(`done in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(0)}s`);
}
writeFileSync(cache + "regen.done", new Date === null ? "" : "ok");
console.log("all studies regenerated into .simcache/");
