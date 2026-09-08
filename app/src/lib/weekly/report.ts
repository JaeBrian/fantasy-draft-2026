import { eligible, optimizeLineup } from './lineup';
import { compareLineups, createContingencies } from './simulate';
import type { WeeklySnapshot } from './snapshot';
import type { LineupResult, WeeklyDataset, WeeklyPlayer } from './types';

export function buildLineupReport({dataset,snapshot,rosterId,week,now,opponentRosterId,currentStarters}:{
  dataset:WeeklyDataset; snapshot:WeeklySnapshot; rosterId:number; week:number; now:number;
  opponentRosterId?:number; currentStarters?:string[];
}) {
  const roster = snapshot.rosters.find(row=>row.rosterId===rosterId);
  if (!roster) throw new Error(`Roster ${rosterId} unavailable.`);
  const slots = snapshot.slots.filter(slot=>!['BN','IR'].includes(slot));
  const weekly = dataset.weeks[String(week)];
  const warnings = [...(weekly?.warnings ?? [`Week ${week} projections unavailable.`])];
  const compatible = dataset.season === snapshot.season && JSON.stringify(Object.entries(dataset.scoring).sort()) === JSON.stringify(Object.entries(snapshot.scoring).sort());
  const players = compatible ? weekly?.players ?? {} : {};
  if (!compatible) warnings.push('Dataset season or scoring differs from the current league; recommendations blocked.');
  const rosterIds = roster.players.filter(id=>!roster.reserve.includes(id));
  const starterIds = currentStarters ?? roster.starterSlots;
  const input = {players,slots,rosterIds,currentStarters:starterIds,now};
  const recommended = optimizeLineup(input);
  for (const assignment of recommended.assignments) {
    const player = assignment.playerId ? players[assignment.playerId] : undefined;
    if (player?.projectionBounds) warnings.push(`${player.name}: lineup ranking uses a conservative scoring lower bound. ${player.projectionBounds.reason}`);
  }
  for (const id of roster.reserve) if (!players[id]) {
    recommended.complete = false;
    recommended.issues.push(`${id}: reserve player data unavailable.`);
  }
  // Current means the submitted slot order, including blanks; it is never optimized.
  function submitted(ids:string[],ownedIds:string[]):LineupResult {
    const issues:string[] = [];
    const seen = new Set<string>();
    const assignments = slots.map((slot,index)=>{
      const id = ids[index] && ids[index] !== '0' ? ids[index] : null;
      const player = id ? players[id] : undefined;
      const mean = Number.isFinite(player?.mean) ? player!.mean : null;
      const locked = !!id && (!Number.isFinite(player?.kickoff) || player!.kickoff! <= now);
      if (!id) issues.push(`${slot} ${index+1}: current slot empty.`);
      else {
        if (seen.has(id)) issues.push(`${id}: duplicate current starter.`);
        if (!ownedIds.includes(id)) issues.push(`${id}: current starter unavailable on active roster.`);
        if (!player || mean === null) issues.push(`${id}: current projection unavailable.`);
        if (player && !eligible(player,slot)) issues.push(`${player.name}: current slot ineligible.`);
        if (player && player.availability !== 'available') issues.push(`${player.name}: ${player.availability}.`);
        if (!Number.isFinite(player?.kickoff)) issues.push(`${player?.name ?? id}: kickoff unknown.`);
        else if (locked) issues.push(`${player!.name}: locked game requires actual scoring.`);
        seen.add(id);
      }
      return {index,slot,playerId:id,mean,locked};
    });
    const total = assignments.reduce((sum,row)=>sum+(row.mean ?? 0),0);
    return {assignments,total:Number.isFinite(total) ? total : 0,complete:issues.length===0 && Number.isFinite(total),issues};
  }
  const current = submitted(starterIds,rosterIds);
  const opponentRoster = snapshot.rosters.find(row=>row.rosterId===opponentRosterId);
  const opponent = opponentRoster ? submitted(opponentRoster.starterSlots,opponentRoster.players.filter(id=>!opponentRoster.reserve.includes(id))) : undefined;
  if (opponentRosterId !== undefined && !opponentRoster) warnings.push('Opponent roster unavailable.');
  const comparison = compareLineups({players,baseline:current,recommended,residuals:dataset.calibration.residuals,opponent});
  const starterSet = new Set(recommended.assignments.map(row=>row.playerId));
  const rank = (a:WeeklyPlayer,b:WeeklyPlayer) => (Number.isFinite(b.mean) ? b.mean! : -Infinity)-(Number.isFinite(a.mean) ? a.mean! : -Infinity) || a.id.localeCompare(b.id);
  const bench = roster.players.filter(id=>!starterSet.has(id)).flatMap(id=>players[id] ? [players[id]] : []).sort(rank);
  const swaps = recommended.assignments.flatMap((row,index)=>{
    const before = current.assignments[index];
    return row.playerId === before.playerId ? [] : [{index,slot:row.slot,startId:row.playerId,sitId:before.playerId,
      expectedGain:current.complete && recommended.complete && row.mean !== null && before.mean !== null && !players[row.playerId!]?.projectionBounds && !players[before.playerId!]?.projectionBounds ? row.mean-before.mean : null}];
  });
  const contingencies = createContingencies({...input,lineup:recommended}).filter(row=>/questionable|doubtful|injur/i.test(players[row.playerId].status ?? ''));
  const owned = new Set(snapshot.rosters.flatMap(row=>row.players));
  const candidates = Object.values(players).filter(player=>!owned.has(player.id) && player.availability==='available' && Number.isFinite(player.mean) && Number.isFinite(player.kickoff) && player.kickoff!>now && slots.some(slot=>eligible(player,slot))).sort(rank);
  const shortlist = [...new Set(slots.flatMap(slot=>candidates.filter(player=>eligible(player,slot)).slice(0,3)))];
  const waivers = shortlist.map(player=>{
    const lineup = optimizeLineup({...input,rosterIds:[...rosterIds,player.id]});
    const after = new Set(lineup.assignments.map(row=>row.playerId));
    const changedBound = [...new Set([...starterSet,...after])].some(id=>id && starterSet.has(id)!==after.has(id) && players[id]?.projectionBounds);
    return {player,lineup,expectedGain:recommended.complete && lineup.complete && !changedBound ? lineup.total-recommended.total : null};
  }).filter(row=>row.lineup.assignments.some(assignment=>assignment.playerId===row.player.id))
    .sort((a,b)=>(b.expectedGain ?? -Infinity)-(a.expectedGain ?? -Infinity) || rank(a.player,b.player)).slice(0,5);
  const alternatives = recommended.assignments.flatMap(assignment=>{
    const start = assignment.playerId ? players[assignment.playerId] : undefined;
    if (!start || assignment.locked) return [];
    return bench.filter(player=>rosterIds.includes(player.id) && player.availability==='available' && Number.isFinite(player.mean) && Number.isFinite(player.kickoff) && player.kickoff!>now && eligible(player,assignment.slot))
      .map(player=>({start,player,slot:assignment.slot,gap:start.mean!-player.mean!}));
  }).sort((a,b)=>a.gap-b.gap || a.player.id.localeCompare(b.player.id));
  const alternative = alternatives[0];
  const single = (player:WeeklyPlayer,slot:string):LineupResult => ({assignments:[{index:0,slot,playerId:player.id,mean:player.mean,locked:false}],total:player.mean!,complete:true,issues:[]});
  const pairwise = alternative ? {startId:alternative.start.id,sitId:alternative.player.id,
    comparison:compareLineups({players,baseline:single(alternative.player,alternative.slot),recommended:single(alternative.start,alternative.slot),residuals:dataset.calibration.residuals})} : null;
  warnings.push(...recommended.issues,...current.issues);
  if (roster.reserve.length) warnings.push('Reserve players require activation and a legal roster move before starting.');
  if (waivers.length) warnings.push('Waiver alternatives require acquisition and any necessary drop; costs and claim timing are unavailable.');
  return {recommended,current,comparison,bench,swaps,contingencies,waivers,pairwise,warnings:[...new Set(warnings)]};
}
