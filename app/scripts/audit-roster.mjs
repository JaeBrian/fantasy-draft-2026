/* Is every player on our board an ACTIVE 2026 NFL player on the team we list?
   Cross-checks all 170 board entries against Sleeper's live player database. */
const { P } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');

const norm = (s) =>
  s.toLowerCase().replace(/[.'-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();

(async () => {
  const players = await (await fetch('https://api.sleeper.app/v1/players/nfl')).json();
  const byName = new Map();
  for (const [pid, p] of Object.entries(players)) {
    if (!p || !p.full_name) continue;
    if (!['QB', 'RB', 'WR', 'TE'].includes(p.position)) continue;
    const k = norm(p.full_name);
    const prev = byName.get(k);
    /* prefer the record that has a team and active status */
    if (!prev || (p.team && p.status === 'Active')) byName.set(k, { pid, ...p });
  }

  const problems = { missing: [], inactive: [], noTeam: [], teamMismatch: [], posMismatch: [], old: [] };
  P.forEach((r) => {
    const [name, pos, team] = r;
    const s = byName.get(norm(name));
    if (!s) { problems.missing.push(name); return; }
    if (!s.team) problems.noTeam.push(`${name} — Sleeper has no team (FA/retired?)`);
    else if (s.team !== team) problems.teamMismatch.push(`${name}: board says ${team}, Sleeper says ${s.team}`);
    if (s.position !== pos) problems.posMismatch.push(`${name}: board ${pos}, Sleeper ${s.position}`);
    const st = (s.status || '').toLowerCase();
    if (st && !['active', 'questionable', 'doubtful', 'out'].includes(st) && st !== 'injured reserve' && st !== 'physically unable to perform')
      problems.inactive.push(`${name} — status: ${s.status}`);
    if (s.years_exp !== undefined && s.years_exp !== null && s.years_exp > 14)
      problems.old.push(`${name} — ${s.years_exp} years exp`);
  });

  const show = (label, arr) => {
    if (!arr.length) { console.log(`  ✓ ${label}: none`); return 0; }
    console.log(`  ❌ ${label}: ${arr.length}`);
    arr.slice(0, 12).forEach((x) => console.log('       ' + x));
    return arr.length;
  };

  console.log(`\n=== BOARD ROSTER AUDIT (${P.length} players vs live Sleeper DB) ===`);
  let bad = 0;
  bad += show('not found in Sleeper', problems.missing);
  bad += show('no NFL team (free agent / retired)', problems.noTeam);
  bad += show('team mismatch', problems.teamMismatch);
  bad += show('position mismatch', problems.posMismatch);
  bad += show('inactive status', problems.inactive);
  show('veterans with 15+ years exp (sanity only)', problems.old);
  console.log(`\n${bad === 0 ? '✅ every board player is an active 2026 NFL player on the listed team' : `⚠️  ${bad} entries need review`}`);
})();
