/* Run from app/:  node scripts/load-sims.mjs [--dry]
 *
 * Reads every study result in .simcache/ back into src/data.ts and src/panels/SimPanel.tsx.
 * Mechanical on purpose: the Aug 24 refresh did this by hand with a one-off regex that ran past
 * its own block and deleted DRAFT_TREE and ARBITRAGE. Each dataset here is replaced in place,
 * one at a time, and the script refuses to touch a line that is not shaped the way it expects.
 * Missing studies fail the refresh before any published file is changed.
 *
 * Reading the fresh numbers and fixing prose they contradict is still judgement — this only
 * moves the numbers. */
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";

const app = new URL("../", import.meta.url).pathname;
const cache = `${app}.simcache/`;
const dry = process.argv.includes("--dry");
const sinceAt = process.argv.indexOf("--since");
const since = sinceAt >= 0 ? Number(process.argv[sinceAt + 1]) : 0;
if (!Number.isFinite(since)) throw new Error("Invalid --since timestamp");
const json = f => {
  if (!existsSync(cache + f)) return null;
  if (statSync(cache + f).mtimeMs < since) throw new Error(`Stale study: ${f}`);
  return JSON.parse(readFileSync(cache + f, "utf8"));
};
/* data.ts keeps its JSON blobs ASCII-only */
const ascii = (s) => s.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/* `export const NAME: T =` on one line and the JSON on the next, or both on one line */
function setLine(src, name, value) {
  const lines = src.split("\n");
  const i = lines.findIndex((l) => new RegExp(`^(export )?const ${name}\\b`).test(l));
  if (i < 0) throw new Error(`${name}: not found`);
  /* the value is either on the declaration line, or on the line after the one ending in `=`
   * (a type annotation can span several lines — PRIORITY's does) */
  const inline = /^(?:export )?const \w+\b[^=]*= (?=[[{])/.exec(lines[i]);
  const j = inline ? i : lines.findIndex((l, k) => k >= i && l.trimEnd().endsWith("=")) + 1;
  const head = inline ? inline[0] : "  ";
  if (j === 0 || j - i > 8 || !lines[j].endsWith(";") || !/^[[{]/.test(lines[j].slice(head.length)))
    throw new Error(`${name}: could not find a single-line value under line ${i + 1}`);
  lines[j] = head + ascii(JSON.stringify(value)) + ";";
  return lines.join("\n");
}

/* a hand-formatted block: from `export const NAME` down to the first bare `};` or `];` */
function setBlock(src, name, body) {
  const lines = src.split("\n");
  const i = lines.findIndex((l) => new RegExp(`^(export )?const ${name}\\b`).test(l));
  if (i < 0) throw new Error(`${name}: not found`);
  const end = lines.findIndex((l, k) => k > i && /^[\]}];$/.test(l));
  if (end < 0 || end - i > 60) throw new Error(`${name}: block end not found`);
  lines.splice(i + 1, end - i - 1, ...body);
  return lines.join("\n");
}

const row = (o) => "  { " + Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ") + " },";

const done = [], missing = [];
const take = (file, label, fn) => { const v = json(file); if (v) { fn(v); done.push(label); } else missing.push(`${label} (${file})`); };

let data = readFileSync(`${app}src/data.ts`, "utf8");
let panel = readFileSync(`${app}src/panels/SimPanel.tsx`, "utf8");

take("plans.json", "SIM_PLANS", (v) => (data = setLine(data, "SIM_PLANS", v)));
take("cliff.json", "CLIFF_MAP", (v) => (data = setLine(data, "CLIFF_MAP", v)));
take("final_sim.json", "PAIRED_SIM", (v) => (data = setLine(data, "PAIRED_SIM", v)));
take("riskdial.json", "RISK_DIAL", (v) => (data = setLine(data, "RISK_DIAL", v)));
take("tree.json", "DRAFT_TREE", (v) => (data = setLine(data, "DRAFT_TREE", v)));
take("priority.json", "PRIORITY", (v) => (data = setLine(data, "PRIORITY", v)));
take("rbloss.json", "RB_LOSS", (v) => (data = setLine(data, "RB_LOSS", v)));
take("first_pick.json", "FIRST_PICK", (v) => (panel = setLine(panel, "FIRST_PICK", v)));
take("sim_all.json", "ARBITRAGE + RUN_TIMING + HEAD_TO_HEAD", (v) => {
  const arb = ({ tag, ...r }) => "  " + row(r); // ArbRow has no `tag`
  data = setBlock(data, "ARBITRAGE", [
    "  falls: [", ...v.arbitrage.falls.map(arb), "  ],",
    "  traps: [", ...v.arbitrage.traps.map(arb), "  ],",
  ]);
  data = setBlock(data, "RUN_TIMING", v.runTiming.map(row));
  panel = setBlock(panel, "HEAD_TO_HEAD", v.h2h.map(row));
});

if (missing.length) throw new Error(`Missing required studies: ${missing.join(", ")}`);
if (!dry) {
  writeFileSync(`${app}src/data.ts`, data);
  writeFileSync(`${app}src/panels/SimPanel.tsx`, panel);
}
console.log(`${dry ? "would update" : "updated"}: ${done.join(", ") || "nothing"}`);
if (missing.length) console.log(`SKIPPED (no result in .simcache): ${missing.join(", ")}`);
