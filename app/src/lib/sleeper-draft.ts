import type { PlayerRow, Pos } from '../data';
import type { DraftState } from './advisor';

export type SleeperPick = { pick_no: number; draft_slot: number; metadata?: { first_name?: string; last_name?: string; team?: string; position?: string } };
const keyOf = (s: string) => s.toLowerCase().replace(/[.'-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim().replace(/^kenneth gainwell$/, 'kenny gainwell');

export function offBoardPick(key: string): { name: string; pos: Pos | 'OTHER' } | null {
  const m = /^\[Sleeper:\d+:(QB|RB|WR|TE|K|DST|OTHER)\] (.+)$/.exec(key);
  return m ? { name: m[2], pos: m[1] as Pos | 'OTHER' } : null;
}

export function externalPickKey(pickNo: number, pos: Pos | 'OTHER', name: string) {
  if (!Number.isInteger(pickNo) || pickNo < 1 || pickNo > 192 || !name.trim()) throw new Error('Enter a name and a valid draft pick');
  return `[Sleeper:${pickNo}:${pos}] ${name.trim()}`;
}

/** Replace one authoritative snapshot atomically, including picks outside the skill board. */
export function sleeperSnapshot(picks: SleeperPick[], slot: number, board: PlayerRow[]) {
  const exact = new Map(board.map(r => [keyOf(r[0]), r]));
  const DS: DraftState = {}, ord: string[] = [];
  let offBoard = 0;
  for (const pick of picks.slice().sort((a,b) => a.pick_no-b.pick_no)) {
    if (pick.pick_no !== ord.length + 1 || !Number.isInteger(pick.draft_slot) || pick.draft_slot < 1 || pick.draft_slot > 12)
      throw new Error('Incomplete or invalid Sleeper pick sequence');
    const raw = `${pick.metadata?.first_name ?? ''} ${pick.metadata?.last_name ?? ''}`.trim();
    const key = keyOf(raw), parts = key.split(' ');
    const matches = board.filter(r => {
      const p = keyOf(r[0]).split(' ');
      return parts.length >= 2 && p.at(-1) === parts.at(-1) && p[0][0] === parts[0][0] && r[2] === pick.metadata?.team;
    });
    const row = exact.get(key) ?? (matches.length === 1 ? matches[0] : undefined);
    const rawPos = pick.metadata?.position === 'DEF' ? 'DST' : pick.metadata?.position;
    const pos = ['QB','RB','WR','TE','K','DST'].includes(rawPos ?? '') ? rawPos : 'OTHER';
    const name = row?.[0] ?? externalPickKey(pick.pick_no, pos as Pos | 'OTHER', raw || pick.metadata?.team || 'Unknown player');
    if (DS[name]) throw new Error(`Duplicate Sleeper player: ${name}`);
    if (!row) offBoard++;
    DS[name] = pick.draft_slot === slot ? 'mine' : 'gone';
    ord.push(name);
  }
  return { DS, ord, offBoard };
}
