/* Regenerates src/projections.ts — Sleeper's per-player 2026 half-PPR projections, WEEK BY WEEK.
 *
 * Two earlier versions of this were wrong in instructive ways.
 *
 * First the model had no projections at all: value came from a curve on a player's board rank,
 * so the simulations were largely restating our own board.
 *
 * Then it used the season-total endpoint and divided by `gp`, which Sleeper reports as 18 for
 * every player — that is weeks in the season, not games he plays. Justin Jefferson came out at
 * 11.41 pts/wk when Sleeper's own week-1 number for him is 13.84. Brian spotted it. Dividing a
 * season total that already prices in missed time by the full 18 weeks charges availability
 * twice, and charges it hardest to exactly the players our risk flags already penalise.
 *
 * So take the weekly projections directly. This gives the number the app shows, byes for free
 * (a player has no row in his bye week), and — the reason it matters most — a real projection
 * for weeks 15-17, the bracket that decides the league.
 *
 * Run from app/:  node scripts/fetch-projections.mjs                                        */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { scoreStats, leagueScoring } from "./league-scoring.mjs";
const scoring = await leagueScoring();
const discrepancies = [];
import { playerNameKey as norm } from "./player-name.mjs";

const dataTs = readFileSync(new URL("../src/data.ts", import.meta.url), "utf8");
const byeMatch = dataTs.match(/export const BYE:[^=]+=(\s*\{[^}]+\})/);
if (!byeMatch) throw new Error("Team bye map missing");
const byes = Object.fromEntries([...byeMatch[1].matchAll(/([A-Z]{2,3}):\s*(\d+)/g)].map(m=>[m[1],Number(m[2])]));
const boardNames = [...dataTs.matchAll(/^\["((?:[^"\\]|\\.)*)",/gm)].map((m) => m[1]);
console.log(`board names: ${boardNames.length}`);

const players = await (await fetch("https://api.sleeper.app/v1/players/nfl")).json();
/* Two people can share a name — there is a Vikings WR and a Browns LB both called Justin
   Jefferson. Resolve to the id our board means: a skill player on a team, preferring the one
   with more NFL experience when it is still ambiguous. */
const idByName = new Map();
for (const [id, p] of Object.entries(players)) {
  if (!p || !p.full_name || !p.team) continue;
  if (!["QB", "RB", "WR", "TE"].includes(p.position)) continue;
  const k = norm(p.full_name);
  const prev = idByName.get(k);
  if (!prev || (p.years_exp ?? 0) > (players[prev].years_exp ?? 0)) idByName.set(k, id);
}

const WEEKS = 18;
const byId = {};   // player_id -> { [week]: points }
for (let wk = 1; wk <= WEEKS; wk++) {
  const rows = await (await fetch(
    `https://api.sleeper.com/projections/nfl/2026/${wk}?season_type=regular`,
  )).json();
  if (!Array.isArray(rows) || rows.length < 100) throw new Error(`Week ${wk}: invalid or incomplete projection response`);
  let n = 0;
  for (const r of rows) {
    if (!r?.stats || !r.stats.gp) continue;
    const pts = scoreStats(r.stats, scoring);
    if (Math.abs(pts - (r.stats.pts_half_ppr ?? pts)) > 0.25) discrepancies.push({week:wk, player:r.player_id, name:r.player?.full_name, pos:r.player?.position, provider:r.stats.pts_half_ppr, calculated:+pts.toFixed(3)});
    if (pts <= 0) continue;
    (byId[r.player_id] ??= {})[wk] = Math.round(pts * 100) / 100;
    n++;
  }
  process.stdout.write(`  week ${wk}: ${n} projected\r`);
}
console.log(`\nfetched ${WEEKS} weeks for ${Object.keys(byId).length} players`);

const PLAYOFF = [15, 16, 17];
const out = {};
let hit = 0;
for (const name of boardNames) {
  const id = idByName.get(norm(name));
  const wks = id ? byId[id] : undefined;
  if (!wks) continue;
  const vals = Object.values(wks);
  if (!vals.length) continue;
  const played = vals.length;                       // weeks he has a projection = weeks he plays
  const total = vals.reduce((a, b) => a + b, 0);
  const po = PLAYOFF.map((w) => wks[w]).filter((v) => typeof v === "number");
  out[name] = {
    ppg: Math.round((total / played) * 100) / 100,
    total: Math.round(total * 10) / 10,
    games: played,
    po: po.length ? Math.round((po.reduce((a, b) => a + b, 0) / po.length) * 100) / 100 : null,
    bye: byes[players[id]?.team] ?? null,
  };
  hit++;
}
const miss = boardNames.filter((n) => out[n] === undefined);
if (hit < boardNames.length * 0.95) throw new Error('Projection coverage below 95%; keeping previous file');
// A board player with no projection gets zero, rather than an invented rank-curve score.
for (const name of miss) out[name] = {ppg:0,total:0,games:0,po:null,bye:null};
mkdirSync(new URL('../.simcache/', import.meta.url), {recursive:true});
writeFileSync(new URL('../.simcache/projection-audit.json', import.meta.url), JSON.stringify({scoring,missing:miss,discrepancies},null,2));
console.log(`matched ${hit}/${boardNames.length}${miss.length ? ` — unmatched: ${miss.join(", ")}` : ""}`);

const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
writeFileSync(
  new URL("../src/projections.ts", import.meta.url),
  `/** Generated by scripts/fetch-projections.mjs — 2026 projections recalculated from Sleeper statistics using live league scoring,\n` +
  ` *  taken WEEK BY WEEK and summarised. Refreshed ${stamp} UTC.\n` +
  ` *\n` +
  ` *    ppg    points in a week he plays (total / weeks projected), NOT total/18 — Sleeper\n` +
  ` *           reports gp as 18 for everyone, which is weeks in the season rather than games,\n` +
  ` *           and dividing by it charges every player for availability a second time\n` +
  ` *    total  full-season projected points\n` +
  ` *    games  weeks he is projected to play\n` +
  ` *    po     average across weeks 15-17 — the bracket that decides this league\n` +
  ` *    bye    verified team bye week */\n` +
  `export type Projection = { ppg: number; total: number; games: number; po: number | null; bye: number | null };\n` +
  `export const PROJW: Record<string, Projection> = ${JSON.stringify(out, null, 0)};\n\n` +
  `/** Points per week played. What the rest of the app means by "projection". */\n` +
  `export const PROJ: Record<string, number> = Object.fromEntries(\n` +
  `  Object.entries(PROJW).map(([k, v]) => [k, v.ppg]),\n` +
  `);\n`,
);
console.log(`wrote src/projections.ts — ${hit} players, weeks 1-${WEEKS}`);
