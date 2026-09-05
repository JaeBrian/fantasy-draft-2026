import assert from 'node:assert/strict';
import { playerNameKey } from './player-name.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { PROJ } = require(CACHE + 'projections.cjs');
const { P } = require(CACHE + 'data.cjs');
const { riskOf, cuffUplift, missShareOf, seasonAvailability, unavailableInWeek } = require(CACHE + 'risk.cjs');
let failures = 0;
assert.equal(new Set(P.map(r => playerNameKey(r[0]))).size, P.length, "Duplicate provider aliases on board");
assert.equal(playerNameKey("Kenneth Gainwell"), playerNameKey("Kenny Gainwell"));
for (const file of ['sim-all', 'sim-risk']) {
  const body = readFileSync(new URL(`./${file}.mjs`, import.meta.url), 'utf8');
  const prefix = body.slice(body.indexOf('const PPG'), body.indexOf('const snap'));
  const context = { require, CACHE, ...require(CACHE + 'data.cjs'), ...require(CACHE + 'sleeper.cjs'), PROJ, riskOf, cuffUplift, missShareOf, seasonAvailability, unavailableInWeek };
  const pool = vm.runInNewContext(prefix + '\nPOOL', context);
  try {
    for (const p of pool.filter(p => PROJ[p.name] !== undefined)) {
      const row = P.find(r => r[0] === p.name);
      assert.equal(p.proj, PROJ[p.name] + cuffUplift(p.name), `${p.name}: projection drift`);
      assert.equal(p.pMiss, riskOf(p.name, p.pos, row[4]).pMiss, `${p.name}: risk drift`);
    }
    console.log(`PASS ${file}: shared projections and risk`);
  } catch (e) { failures++; console.log(`FAIL ${file}: ${e.message}`); }
}
// Exercise the actual weekly season functions with constant performance. At pMiss=1,
// the shared season model loses 40% of production on average, rather than one game.
for (const file of ['sim-plans', 'sim-priority', 'sim-rbrun']) {
  const body = readFileSync(new URL(`./${file}.mjs`, import.meta.url), 'utf8');
  const start = body.indexOf('function season(');
  let end = body.indexOf('{', start), depth = 1;
  for (end++; depth; end++) { if (body[end] === '{') depth++; if (body[end] === '}') depth--; }
  let seed = 17;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2**32; };
  const season = vm.runInNewContext(body.slice(start, end) + ';season', {
    gauss: () => 0, missShareOf, unavailableInWeek, LINEUP: { QB:1, RB:2, WR:2, TE:1, FLEX:2 },
  });
  let sum = 0;
  for (let n=0; n<10000; n++) { const result = season([{name:'Test', pos:'QB', team:'TEST', proj:10, cv:0, pMiss:1, bye:0}], rnd); sum += typeof result === 'number' ? result : result.ppg; }
  const mean = sum / 10000;
  try { assert.ok(Math.abs(mean - 6) < 0.06, `expected 6, received ${mean.toFixed(3)}`); console.log(`PASS ${file}: expected missed production`); }
  catch(e) { failures++; console.log(`FAIL ${file}: ${e.message}`); }
}
// A mid-draft comparison must preserve the opponents' already-drafted positions.
{
  const body = readFileSync(new URL('./audit-agreement.mjs', import.meta.url), 'utf8');
  const start = body.indexOf('function playFrom(');
  let end = body.indexOf('{', start), depth = 1;
  for (end++; depth; end++) { if (body[end] === '{') depth++; if (body[end] === '}') depth--; }
  let seen = -1;
  const player = {name:'Remaining', pos:'RB'};
  const play = vm.runInNewContext(body.slice(start,end) + ';playFrom', {
    mul:()=>()=>0.5, POOL:[player], P:[], IDX:new Map(), snap:()=>3,
    oppPick:(avail, team)=>{seen=team.length;return avail[0];}, weekly:()=>0,
  });
  const prior = Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,[]]));
  prior[3] = [{name:'Already drafted QB',pos:'QB'}];
  play({Earlier:'gone'},1,'Remaining',0,prior);
  try { assert.equal(seen,1); console.log('PASS agreement: opponent rosters preserved'); }
  catch(e) { failures++; console.log(`FAIL agreement: opponent roster size ${seen}, expected 1`); }
}
// Bench selection must not see the realized scores.
{
  const source = readFileSync(new URL('./sim-all.mjs', import.meta.url), 'utf8');
  const start=source.indexOf('function lineup('), end=source.indexOf('/* Seat 2',start);
  const lineup=vm.runInNewContext(source.slice(start,end)+';lineup',{missShareOf});
  const roster=Array.from({length:6},(_,i)=>({name:`WR${i}`,pos:'WR',proj:10-i,pMiss:0,real:i<4?0:100}));
  const points=lineup(roster);
  try{assert.equal(points,0);console.log('PASS lineup: bench selection uses projections');}
  catch(e){failures++;console.log(`FAIL lineup: scored ${points} by selecting breakout bench results after the fact`);}
}
console.log(`RESULT: ${failures} FAIL`);
process.exitCode = failures ? 1 : 0;
