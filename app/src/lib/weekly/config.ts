// Real league only. These are owner IDs, never draft seats or test-mode settings.
export const WEEKLY_LEAGUE_ID = '1389372699129700352';
export const WEEKLY_DRAFT_ID = '1389372699129700353';
export const WEEKLY_SEASON = '2026';
export const MANAGERS = [
  { name: 'Emily', userId: '1257818921076002816' },
  { name: 'Ashley', userId: '1133862962869055488' },
  { name: 'Brian', userId: '1133884337847582720' },
] as const;
export const EXPECTED_SLOTS = ['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF',...Array(6).fill('BN')];
