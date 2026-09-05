// Score component statistics under the real league rules; provider totals may use different inputs.
export function scoreStats(stats, rules) {
  let points = 0;
  for (const [key, weight] of Object.entries(rules)) {
    const value = stats[key] ?? 0;
    if (!Number.isFinite(weight) || !Number.isFinite(value)) throw new Error(`Invalid scoring component: ${key}`);
    points += value * weight;
  }
  return points;
}
export function validateLeague(draft, league) {
  const roster = ['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF',...Array(6).fill('BN')];
  if (draft.type !== 'snake' || draft.settings?.rounds !== 16 || draft.settings?.teams !== 12 ||
      league.season !== '2026' || league.total_rosters !== 12 || league.scoring_settings?.rec !== 0.5 ||
      JSON.stringify([...(league.roster_positions ?? [])].sort()) !== JSON.stringify(roster.sort()))
    throw new Error('League format changed; review the model before refreshing');
}
export async function leagueScoring() {
  const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r.json(); };
  const draft = await get('https://api.sleeper.app/v1/draft/1389372699129700353');
  if (!draft?.league_id) throw new Error('Draft has no league');
  const league = await get(`https://api.sleeper.app/v1/league/${draft.league_id}`);
  validateLeague(draft, league);
  return league.scoring_settings;
}
