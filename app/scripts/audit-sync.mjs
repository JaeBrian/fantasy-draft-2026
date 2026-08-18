/* Draft-night critical: can we match Sleeper's pick payloads to our board names?
   Sleeper sends metadata.first_name / last_name. Test every board player against
   Sleeper's real player database using the app's exact normalizer. */
const { P } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');

const normName = (s) =>
  s.toLowerCase().replace(/[.'-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();

(async () => {
  const res = await fetch('https://api.sleeper.app/v1/players/nfl');
  const players = await res.json();
  const lookup = new Map(P.map((r) => [normName(r[0]), r[0]]));
  const byLast = new Map();
  P.forEach((r) => { const parts=normName(r[0]).split(' '); const key=parts[parts.length-1]+'|'+parts[0][0]; byLast.set(key,[...(byLast.get(key)??[]),r[0]]); });
  const teamOf=new Map(P.map(r=>[r[0],r[2]]));
const resolve=(raw,team)=>{ const k=normName(raw); const e=lookup.get(k); if(e) return e; const parts=k.split(' '); if(parts.length<2||!parts[0]||!team) return undefined; const c=byLast.get(parts[parts.length-1]+'|'+parts[0][0]); if(!c||c.length!==1) return undefined; return teamOf.get(c[0])===team?c[0]:undefined; };

  let matched = 0;
  const misses = [];
  const boardSeen = new Set();

  for (const [, p] of Object.entries(players)) {
    if (!p || !p.first_name || !p.last_name) continue;
    if (!['QB', 'RB', 'WR', 'TE'].includes(p.position)) continue;
    const key = normName(`${p.first_name} ${p.last_name}`);
    const hit = resolve(key, p.team);
    if (hit) { matched++; boardSeen.add(hit); }
  }

  P.forEach((r) => { if (!boardSeen.has(r[0])) misses.push(`${r[0]} (${r[1]}, ${r[2]})`); });

  console.log(`Sleeper players matched to our board: ${boardSeen.size}/${P.length}`);
  if (misses.length) {
    console.log('\n❌ THESE WOULD NOT AUTO-MARK during a live draft:');
    misses.forEach((m) => console.log('   ', m));
  } else {
    console.log('✓ every board player is reachable from a Sleeper pick payload');
  }

  // also: what fraction of a real draft would be off-board (K/DST/deep guys)?
  console.log(`\nSleeper skill players total: ${matched} matched of the board's ${P.length}`);
})();
