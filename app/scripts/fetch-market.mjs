// Refresh the independent mock-draft market; missing players use the existing board fallback.
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../src/data.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const names = [...source.matchAll(/^\["((?:[^"\\]|\\.)*)",/gm)].map(m => m[1]);
import { playerNameKey as norm } from "./player-name.mjs";
const response = await fetch('https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=2026');
if (!response.ok) throw new Error(`FFC HTTP ${response.status}`);
const data = await response.json();
if (data.meta?.teams !== 12 || data.meta?.type !== 'Half-PPR' || !Array.isArray(data.players)) throw new Error('Unexpected FFC format');
const byName = new Map(data.players.filter(p => ['QB','RB','WR','TE'].includes(p.position)).map(p => [norm(p.name), p]));
const market = {};
for (const name of names) {
  const p = byName.get(norm(name));
  if (!p) continue;
  const values = [p.adp, p.stdev, p.high, p.low];
  if (!values.every(Number.isFinite) || p.adp <= 0 || p.stdev < 0 || p.high > p.low) throw new Error(`Invalid market: ${name}`);
  market[name] = values;
}
if (Object.keys(market).length < names.length * 0.7) throw new Error('FFC coverage fell below 70%; keeping previous market');
const pattern = /^export const MKT:.*$/m;
if (!pattern.test(source)) throw new Error('MKT declaration missing');
writeFileSync(path, source.replace(pattern, `export const MKT: Record<string, [number, number, number, number]> = ${JSON.stringify(market)};`));
console.log(`FFC ${data.meta.start_date} to ${data.meta.end_date}: ${data.meta.total_drafts} drafts; matched ${Object.keys(market).length}/${names.length}`);
console.log(`Missing: ${names.filter(n => !market[n]).join(', ')}`);
