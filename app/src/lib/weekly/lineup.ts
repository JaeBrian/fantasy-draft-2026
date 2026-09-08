import type { LineupResult, WeeklyPlayer } from './types';

const normalize = (position:string) => position === 'DST' ? 'DEF' : position;
export function eligible(player:WeeklyPlayer, slot:string):boolean {
  const positions = player.positions.map(normalize);
  const allowed:Record<string,string[]> = {
    FLEX:['RB','WR','TE'], SUPER_FLEX:['QB','RB','WR','TE'],
    WRRB_FLEX:['WR','RB'], REC_FLEX:['WR','TE'], IDP_FLEX:['DL','LB','DB'],
  };
  return (allowed[slot] ?? [normalize(slot)]).some(position => positions.includes(position));
}

export type LineupInput = {
  players:Record<string,WeeklyPlayer>; rosterIds:string[]; slots:string[];
  currentStarters?:string[]; now?:number;
};

/** Exact maximum expected points; ties leave later players in flexible slots. */
export function optimizeLineup({players,rosterIds,slots,currentStarters=[],now=Date.now()}:LineupInput):LineupResult {
  const issues:string[] = [];
  const assignments:LineupResult['assignments'] = slots.map((slot,index) => ({index,slot,playerId:null,mean:null,locked:false}));
  const used = new Set<string>();
  for (const [index,id] of currentStarters.entries()) {
    if (!id || id === '0' || index >= slots.length) continue;
    const player = players[id];
    if (!player || !Number.isFinite(player.kickoff) || player.kickoff! <= now) {
      assignments[index] = {index,slot:slots[index],playerId:id,mean:Number.isFinite(player?.mean) ? player.mean : null,locked:true};
      if (used.has(id)) issues.push(`Duplicate current starter ${id}.`);
      used.add(id);
      if (!player || !Number.isFinite(player.kickoff)) issues.push(`${player?.name ?? id}: kickoff unknown; current slot frozen until verified.`);
      else issues.push(`${player.name}: game locked; displayed projection excludes live/final scoring.`);
      if (!rosterIds.includes(id) || (player && !eligible(player,slots[index]))) issues.push(`${id}: current starter ownership or eligibility invalid.`);
    }
  }
  const open = assignments.filter(assignment => !assignment.locked);
  if (open.length > 20) throw new Error('Weekly lineup supports at most 20 open starting slots.');
  const size = 1 << open.length;
  const totals = new Float64Array(size).fill(-Infinity), flexibility = new Float64Array(size);
  const picks = new Int32Array(size*open.length).fill(-1);
  totals[0] = 0;
  const candidates = [...new Set(rosterIds)].sort();
  for (let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++) {
    const id = candidates[candidateIndex];
    if (used.has(id)) continue;
    const player = players[id];
    if (!player) { issues.push(`${id}: player data unavailable.`); continue; }
    if (player.availability === 'unknown') issues.push(`${player.name}: availability unknown.`);
    if (player.availability === 'available' && !Number.isFinite(player.mean)) issues.push(`${player.name}: projection unavailable.`);
    if (player.availability !== 'available' || !Number.isFinite(player.mean)) continue;
    if (!Number.isFinite(player.kickoff)) { issues.push(`${player.name}: kickoff unknown; excluded from new starts.`); continue; }
    if (player.kickoff! <= now) continue;
    let allowed = 0;
    for (let i=0;i<open.length;i++) if (eligible(player,open[i].slot)) allowed |= 1 << i;
    // Descending masks prevent using this player twice without copying the state table.
    for (let mask=size-1;mask>=0;mask--) {
      if (totals[mask] === -Infinity) continue;
      let available = allowed & ~mask;
      while (available) {
        const bit = available & -available, i = 31-Math.clz32(bit), next = mask | bit;
        available ^= bit;
        const total = totals[mask]+player.mean!;
        const flex = flexibility[mask]+(open[i].slot.includes('FLEX') ? player.kickoff! : 0);
        if (total > totals[next] || (total === totals[next] && flex > flexibility[next])) {
          totals[next] = total; flexibility[next] = flex;
          picks.copyWithin(next*open.length,mask*open.length,(mask+1)*open.length);
          picks[next*open.length+i] = candidateIndex;
        }
      }
    }
  }
  const count = (mask:number) => { let n=0; while(mask) {mask &= mask-1; n++;} return n; };
  let best = 0;
  for (let mask=1;mask<size;mask++) if (totals[mask] !== -Infinity &&
    (count(mask)>count(best) || (count(mask)===count(best) && (totals[mask]>totals[best] || (totals[mask]===totals[best] && flexibility[mask]>flexibility[best]))))) best=mask;
  for (let i=0;i<open.length;i++) if (best & (1<<i)) {
    const assignment = assignments[open[i].index];
    assignment.playerId = candidates[picks[best*open.length+i]]; assignment.mean = players[assignment.playerId].mean;
  }
  for (const assignment of assignments) if (!assignment.playerId || !Number.isFinite(assignment.mean)) issues.push(`${assignment.slot} ${assignment.index+1}: valid projection or eligible starter missing.`);
  const total = assignments.reduce((sum,assignment) => sum+(Number.isFinite(assignment.mean) ? assignment.mean! : 0),0);
  if (!Number.isFinite(total)) issues.push('Lineup total invalid: projection sum exceeds numeric limits.');
  return {assignments,total:Number.isFinite(total) ? total : 0,complete:assignments.every(a => a.playerId && Number.isFinite(a.mean)) && !issues.some(issue => /frozen|invalid|Duplicate|player data unavailable|projection unavailable|availability unknown/.test(issue)),issues};
}
