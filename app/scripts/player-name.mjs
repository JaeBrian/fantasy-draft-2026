// Preserve board display names while joining provider aliases to one player.
export const playerNameKey = s => s.toLowerCase().replace(/[.'-]/g, ' ')
  .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^kenneth gainwell$/, 'kenny gainwell');

const SKILL = ['QB', 'RB', 'WR', 'TE'];
export function skillPosition(player) {
  return [player?.position, ...(player?.fantasy_positions ?? [])].find(pos => SKILL.includes(pos));
}

export function skillDepthOrder(player) {
  const pos = skillPosition(player);
  const chart = player?.depth_chart_position;
  // A two-way player's defensive depth order says nothing about his offensive role.
  const samePosition = pos && (player.position === pos || chart === pos ||
    (pos === 'WR' && ['LWR', 'RWR', 'SWR'].includes(chart)));
  return samePosition && typeof player.depth_chart_order === 'number' ? player.depth_chart_order : undefined;
}
