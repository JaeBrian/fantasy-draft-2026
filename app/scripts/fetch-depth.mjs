// Keep enough real, projected skill players for twelve legal 14-player rosters.
// Curated rows retain their order; source-backed depth is refreshed separately.
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../src/data.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const block = source.match(/export const P: PlayerRow\[\] = \[\n([\s\S]*?)\n\];/);
if (!block) throw Error('Player board not found');
const rawRows = new Map(block[1].split("\n").filter(l=>l.startsWith('["')).map(l=>{const raw=l.replace(/,$/, "");return [JSON.parse(raw)[0],raw];}));
const rows = JSON.parse(`[${block[1]}]`).filter(p => !p[8].includes('depth'));
import { playerNameKey as norm } from "./player-name.mjs";
const response = await fetch('https://api.sleeper.com/projections/nfl/2026?season_type=regular');
if (!response.ok) throw Error(`Projection source ${response.status}`);
const projections = await response.json();
const existing = new Set(rows.map(p => norm(p[0])));
const depth = projections.filter(r => {
  const p = r.player, s = r.stats;
  return p && ['QB','RB','WR','TE'].includes(p.position) && p.team &&
    s?.adp_half_ppr > 0 && s.adp_half_ppr < 400 && s.pts_half_ppr > 0;
}).sort((a,b) => a.stats.adp_half_ppr - b.stats.adp_half_ppr);
for (const r of depth) {
  const p = r.player, name = p.full_name || `${p.first_name} ${p.last_name}`;
  if (existing.has(norm(name))) continue;
  rows.push([name,p.position,p.team,r.stats.adp_half_ppr,'solid',7,['QB','TE'].includes(p.position)?5:6,
    'Source-backed depth option. Compare current projections, role and availability before drafting.', ['depth']]);
  existing.add(norm(name));
  if (rows.length >= 240) break;
}
if (rows.length < 220) throw Error(`Insufficient projected depth: ${rows.length}`);
writeFileSync(path, source.replace(block[0], `export const P: PlayerRow[] = [\n${rows.map(p=>p[8].includes('depth')?JSON.stringify(p):rawRows.get(p[0])??JSON.stringify(p)).join(',\n')}\n];`));
console.log(`Refreshed ${rows.length} skill players, including ${rows.filter(p=>p[8].includes('depth')).length} source-backed depth options`);
