/* Pull the league's ACTUAL scoring and roster rules from Sleeper, and diff them against
   what the simulations currently assume. */
const DRAFT_ID = '1389372699129700353';
const ASSUMED_STARTERS = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 };

(async () => {
  const draft = await (await fetch(`https://api.sleeper.app/v1/draft/${DRAFT_ID}`)).json();
  console.log(`draft: ${draft.type}, ${draft.settings?.rounds} rounds, ${draft.settings?.teams} teams, status=${draft.status}`);
  console.log(`scoring flavour on the draft object: ${draft.metadata?.scoring_type}`);
  const leagueId = draft.league_id;
  if (!leagueId) { console.log('no league_id on draft object'); return; }

  const lg = await (await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)).json();
  console.log(`\nleague: "${lg.name}"  (${lg.season}, ${lg.status})`);
  console.log(`total rosters: ${lg.total_rosters}`);

  const rp = lg.roster_positions || [];
  const count = {};
  rp.forEach(p => count[p] = (count[p] || 0) + 1);
  console.log(`\nROSTER POSITIONS (${rp.length} total):`);
  Object.entries(count).forEach(([k, v]) => console.log(`   ${k.padEnd(12)} ${v}`));

  const starters = rp.filter(p => p !== 'BN' && p !== 'IR' && p !== 'TAXI');
  console.log(`\n   starters: ${starters.length}  ->  ${starters.join(', ')}`);
  console.log(`   bench:    ${count.BN || 0}`);

  console.log('\nWHAT THE SIMULATIONS ASSUME:');
  Object.entries(ASSUMED_STARTERS).forEach(([k, v]) => console.log(`   ${k.padEnd(12)} ${v}`));
  const assumedTotal = Object.values(ASSUMED_STARTERS).reduce((a, b) => a + b, 0);
  console.log(`   total starters ${assumedTotal}`);
  console.log(`\n   >>> ${starters.length === assumedTotal ? 'MATCH on starter count' : 'MISMATCH: league starts ' + starters.length + ', sims assume ' + assumedTotal}`);
  const hasK = starters.includes('K'), hasDEF = starters.includes('DEF');
  console.log(`   >>> kicker in lineup: ${hasK ? 'YES — sims ignore kickers entirely' : 'no'}`);
  console.log(`   >>> defense in lineup: ${hasDEF ? 'YES — sims ignore defenses entirely' : 'no'}`);

  const sc = lg.scoring_settings || {};
  const KEYS = [
    ['rec', 'points per reception'],
    ['rec_td', 'receiving TD'], ['rush_td', 'rushing TD'], ['pass_td', 'passing TD'],
    ['rush_yd', 'per rushing yard'], ['rec_yd', 'per receiving yard'], ['pass_yd', 'per passing yard'],
    ['pass_int', 'interception thrown'], ['fum_lost', 'fumble lost'],
    ['bonus_rec_te', 'TE PREMIUM (bonus per TE reception)'],
    ['bonus_rush_yd_100', '100-yard rush bonus'], ['bonus_rec_yd_100', '100-yard rec bonus'],
    ['pass_2pt', '2pt pass'], ['rush_2pt', '2pt rush'], ['rec_2pt', '2pt rec'],
  ];
  console.log('\nSCORING (the settings that move player values):');
  KEYS.forEach(([k, label]) => {
    if (sc[k] !== undefined) console.log(`   ${label.padEnd(38)} ${sc[k]}`);
  });

  console.log('\nCHECKS AGAINST OUR MODEL:');
  console.log(`   rec = ${sc.rec} ${sc.rec === 0.5 ? '-> half-PPR, matches our projections' : '-> NOT half-PPR, our projections are built for 0.5'}`);
  console.log(`   pass_td = ${sc.pass_td} ${sc.pass_td === 4 ? '(standard 4pt)' : sc.pass_td === 6 ? '(6pt passing TD — raises QB value materially)' : ''}`);
  const tePrem = sc.bonus_rec_te;
  console.log(`   TE premium: ${tePrem ? tePrem + ' per TE catch — RAISES every TE, our board does not model this' : 'none'}`);

  const other = Object.keys(sc).filter(k => !KEYS.some(([kk]) => kk === k) && sc[k] !== 0);
  console.log(`\n   all other non-zero settings (mostly K/DEF/IDP): ${other.join(', ') || 'none'}`);
})();
