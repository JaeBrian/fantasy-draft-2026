import { EXPECTED_SLOTS, MANAGERS, WEEKLY_DRAFT_ID, WEEKLY_LEAGUE_ID, WEEKLY_SEASON } from './config';

type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Sleeper response');
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('Invalid Sleeper list');
  return value.map(object);
}
function ids(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string')) throw new Error('Invalid player or owner IDs');
  return value;
}
export type WeeklySnapshot = ReturnType<typeof parseWeeklySnapshot>;
export function parseWeeklySnapshot(raw: {draft: unknown; league: unknown; rosters: unknown; users: unknown}, checkedAt: string) {
  const draft=object(raw.draft), league=object(raw.league), rosters=rows(raw.rosters), users=rows(raw.users);
  if (draft.draft_id !== WEEKLY_DRAFT_ID || draft.league_id !== WEEKLY_LEAGUE_ID || league.league_id !== WEEKLY_LEAGUE_ID)
    throw new Error('Weekly reports require the real league; test drafts are excluded');
  const scoring=object(league.scoring_settings), settings=object(league.settings);
  const slots=ids(league.roster_positions);
  if (league.season !== WEEKLY_SEASON || league.total_rosters !== 12 || scoring.rec !== 0.5 || scoring.pass_td !== 4 ||
      JSON.stringify([...slots].sort()) !== JSON.stringify([...EXPECTED_SLOTS].sort()) ||
      Object.values(scoring).some(x => typeof x !== 'number' || !Number.isFinite(x)))
    throw new Error('League format changed; review weekly scoring before continuing');
  if (rosters.length !== 12) throw new Error('Expected all 12 league rosters');
  const rosterIds=new Set<number>(), owned=new Set<string>();
  const normalized=rosters.map(r => {
    const rosterId=r.roster_id;
    if (typeof rosterId !== 'number' || !Number.isInteger(rosterId) || rosterId < 1) throw new Error('Invalid roster ID');
    if (rosterIds.has(rosterId)) throw new Error('Duplicate roster ID');
    rosterIds.add(rosterId);
    const players=ids(r.players), starters=ids(r.starters).filter(id => id !== '0'), reserve=ids(r.reserve);
    for (const id of players) {
      if (owned.has(id)) throw new Error('Player appears on multiple rosters');
      owned.add(id);
    }
    if ([...starters,...reserve].some(id => !players.includes(id))) throw new Error('Roster references an unowned player');
    if (new Set(starters).size !== starters.length) throw new Error('Duplicate starter');
    const owners=[r.owner_id,...ids(r.co_owners)].filter((id): id is string => typeof id === 'string');
    return {rosterId,owners,players,starters,reserve};
  });
  const managers=MANAGERS.map(manager => {
    const matching=normalized.filter(r => r.owners.includes(manager.userId));
    const user=users.find(u => u.user_id === manager.userId);
    const roster=matching.length === 1 && user ? matching[0] : null;
    return {...manager, username: typeof user?.display_name === 'string' ? user.display_name : null,
      rosterId: roster?.rosterId ?? null, players: roster?.players ?? [], starters: roster?.starters ?? [], reserve: roster?.reserve ?? [],
      issue: !user ? 'Account missing from league' : matching.length !== 1 ? 'Account needs a unique roster mapping' : null};
  });
  const status=typeof draft.status === 'string' ? draft.status : 'unknown';
  const stage = status === 'pre_draft' ? 'waiting' : status === 'drafting' || status === 'paused' ? 'drafting' :
    status === 'complete' && managers.every(m => !m.issue && m.players.length > 0) ? 'rosters-ready' : 'incomplete';
  return {version:1, checkedAt, leagueId:WEEKLY_LEAGUE_ID, season:WEEKLY_SEASON,
    leagueName:typeof league.name === 'string' ? league.name : 'Real league', stage,
    draftStatus:status, draftStart:typeof draft.start_time === 'number' ? draft.start_time : null,
    slots, scoring:scoring as Record<string,number>, settings, managers, rosters:normalized,
    rosteredPlayers:owned.size, playerDetails:{} as Record<string,{name:string;position:string;team:string | null}>};
}

let playerCache: {expires:number; players:Row} | undefined;

export async function collectWeeklySnapshot(signal?: AbortSignal) {
  const get=async (path:string) => {
    const response=await fetch(`https://api.sleeper.app/v1/${path}`,{signal});
    if (!response.ok) throw new Error(`Sleeper returned ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const [draft,league,rosters,users]=await Promise.all([
    get(`draft/${WEEKLY_DRAFT_ID}`),get(`league/${WEEKLY_LEAGUE_ID}`),
    get(`league/${WEEKLY_LEAGUE_ID}/rosters`),get(`league/${WEEKLY_LEAGUE_ID}/users`),
  ]);
  const snapshot=parseWeeklySnapshot({draft,league,rosters,users},new Date().toISOString());
  if (snapshot.rosteredPlayers > 0) {
    if (!playerCache || playerCache.expires < Date.now()) {
      playerCache={players:object(await get('players/nfl')),expires:Date.now()+86400000};
    }
    for (const id of snapshot.rosters.flatMap(r=>r.players)) {
      const raw=playerCache.players[id];
      if (!raw || typeof raw !== 'object') continue;
      const p=object(raw);
      snapshot.playerDetails[id]={name:typeof p.full_name==='string' ? p.full_name : `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || id,
        position:typeof p.position==='string' ? p.position : 'Unknown',team:typeof p.team==='string' ? p.team : null};
    }
  }
  return snapshot;
}
