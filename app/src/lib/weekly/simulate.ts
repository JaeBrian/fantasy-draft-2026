import { optimizeLineup, type LineupInput } from './lineup';
import type { LineupResult, WeeklyPlayer } from './types';

type Summary = {mean:number;median:number;p10:number;p90:number};
export type LineupComparison = {
  status:'experimental'|'unavailable'; draws:number; expectedGain:number|null;
  probabilityImproves:number|null; probabilityTies:number|null;
  gain:Summary|null; baseline:Summary|null; recommended:Summary|null;
  opponentWin:{baseline:number;recommended:number;delta:number;monteCarloSE:number}|null;
  monteCarloSE:number|null; limitations:string[];
};
const ids = (lineup:LineupResult) => lineup.assignments.flatMap(a => a.playerId ? [a.playerId] : []);
function summary(values:number[]):Summary {
  const ordered = [...values].sort((a,b) => a-b);
  const quantile = (p:number) => {
    const index = (ordered.length-1)*p, lower = Math.floor(index);
    return ordered[lower]+(ordered[Math.ceil(index)]-ordered[lower])*(index-lower);
  };
  return {mean:values.reduce((a,b)=>a+b,0)/values.length,median:quantile(.5),p10:quantile(.1),p90:quantile(.9)};
}

/** Paired residual-bootstrap sensitivity analysis. Each player's draw is shared across
 * alternatives. Players draw independently: empirical NFL dependence is unavailable.
 * Residuals are centered to preserve the supplied forecast means. No residual evidence
 * means no probability output. Monte Carlo error describes sampling precision only. */
export function compareLineups({players,baseline,recommended,residuals,opponent,seed=2026,draws=20000}:{
  players:Record<string,WeeklyPlayer>; baseline:LineupResult; recommended:LineupResult;
  residuals:Record<string,number[]>; opponent?:LineupResult; seed?:number; draws?:number;
}):LineupComparison {
  const limitations = [
    'Experimental residual bootstrap; weekly decision calibration and superiority are unproven.',
    'Independent player residuals omit NFL game and team dependence. Win probabilities are sensitivity estimates.',
    'Injury, weather and individual coverage adjustments require validated inputs; unavailable inputs receive no invented adjustment.',
    'Monte Carlo precision excludes projection and model uncertainty.',
  ];
  const result:LineupComparison = {status:'unavailable',draws:0,expectedGain:baseline.complete && recommended.complete && Number.isFinite(recommended.total-baseline.total) ? recommended.total-baseline.total : null,probabilityImproves:null,probabilityTies:null,gain:null,baseline:null,recommended:null,opponentWin:null,monteCarloSE:null,limitations};
  const beforeIds = new Set(ids(baseline)), afterIds = new Set(ids(recommended));
  if ([...new Set([...beforeIds,...afterIds])].some(id=>beforeIds.has(id)!==afterIds.has(id) && players[id]?.projectionBounds)) {
    result.expectedGain = null;
    limitations.push('A changed player has scoring bounds; the difference between lower bounds is not an expected-point gain.');
  }
  const valid = (lineup:LineupResult) => lineup.complete && lineup.assignments.length > 0 && !lineup.assignments.some(a=>a.locked) && new Set(ids(lineup)).size === lineup.assignments.length;
  if (!valid(baseline) || !valid(recommended) || baseline.assignments.length !== recommended.assignments.length || baseline.assignments.some((row,index)=>row.slot !== recommended.assignments[index].slot)) {
    limitations.push('A lineup is incomplete, duplicated, locked, or uses different slots; actual scoring is required for locked games.');
    return result;
  }
  let compareOpponent = opponent && valid(opponent) ? opponent : undefined;
  if (opponent && !compareOpponent) limitations.push('Opponent comparison unavailable: incomplete or locked lineup.');
  const samples = new Map<string,{mean:number;residuals:number[]}>();
  const shared = new Set(ids(baseline).filter(id=>ids(recommended).includes(id)));
  let absoluteDistributions = true;
  function prepare(playerId:string):boolean {
    if (samples.has(playerId)) return true;
    const player = players[playerId];
    const history = player?.positions.map(position=>residuals[position === 'DST' ? 'DEF' : position]).find(values=>values?.length >= 2 && values.every(Number.isFinite));
    if (!player || !Number.isFinite(player.mean) || player.availability !== 'available') return false;
    const bounds = player.projectionBounds;
    if (!history || (bounds && bounds.high > bounds.low)) {
      if (!shared.has(playerId)) return false;
      absoluteDistributions = false;
      samples.set(playerId,{mean:player.mean!,residuals:[0]});
      return true;
    }
    const center = history.reduce((a,b)=>a+b,0)/history.length;
    samples.set(playerId,{mean:player.mean!,residuals:history.map(value=>value-center)});
    return true;
  }
  for (const id of new Set([...ids(baseline),...ids(recommended)])) if (!prepare(id)) {
    limitations.push(`${players[id]?.name ?? id}: projection, availability or residual evidence unavailable.`);
    return result;
  }
  if (!absoluteDistributions) {
    limitations.push('An unchanged player lacks calibrated scoring. Their score cancels from the paired gain; absolute team intervals and matchup probabilities are unavailable.');
    compareOpponent = undefined;
  }
  if (compareOpponent && ids(compareOpponent).some(id=>!prepare(id))) {
    limitations.push('Opponent comparison unavailable: projection or residual evidence missing.');
    compareOpponent = undefined;
  }
  if (compareOpponent && ids(compareOpponent).some(id=>ids(baseline).includes(id) || ids(recommended).includes(id))) {
    limitations.push('Opponent comparison unavailable: a player appears on both teams.');
    compareOpponent = undefined;
  }
  draws = Number.isFinite(draws) ? Math.min(100000,Math.max(20000,Math.floor(draws))) : 20000;
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525,state)+1013904223) >>> 0; return state/4294967296; };
  const baselineIds = ids(baseline), recommendedIds = ids(recommended), opponentIds = compareOpponent ? ids(compareOpponent) : [];
  const entries = [...samples].sort(([a],[b])=>a.localeCompare(b));
  const baselineScores:number[] = [], recommendedScores:number[] = [], gains:number[] = [];
  let improves=0,ties=0,baselineWins=0,recommendedWins=0,winDifferenceSquares=0;
  for (let draw=0;draw<draws;draw++) {
    const world = new Map(entries.map(([id,player])=>[id,player.mean+player.residuals[Math.floor(random()*player.residuals.length)]]));
    const score = (playerIds:string[]) => playerIds.reduce((total,id)=>total+world.get(id)!,0);
    const before = score(baselineIds), after = score(recommendedIds), gain = after-before;
    baselineScores.push(before); recommendedScores.push(after); gains.push(gain);
    if (gain > 1e-9) improves++; else if (Math.abs(gain) <= 1e-9) ties++;
    if (compareOpponent) {
      const other = score(opponentIds);
      const win = (points:number) => Math.abs(points-other) <= 1e-9 ? .5 : Number(points>other);
      const a = win(before), b = win(after);
      baselineWins+=a; recommendedWins+=b; winDifferenceSquares+=(b-a)**2;
    }
  }
  const probabilityImproves = improves/draws;
  const delta = (recommendedWins-baselineWins)/draws;
  return {...result,status:'experimental',draws,probabilityImproves,probabilityTies:ties/draws,
    baseline:absoluteDistributions ? summary(baselineScores) : null,recommended:absoluteDistributions ? summary(recommendedScores) : null,gain:summary(gains),
    monteCarloSE:Math.sqrt(probabilityImproves*(1-probabilityImproves)/draws),
    opponentWin:compareOpponent ? {baseline:baselineWins/draws,recommended:recommendedWins/draws,delta,monteCarloSE:Math.sqrt(Math.max(0,winDifferenceSquares/draws-delta**2)/draws)} : null};
}

/** Conditional on a player being inactive; assigns no invented inactivity probability.
 * Deadline is the earliest kickoff of any player whose slot assignment must change. */
export function createContingencies(input:LineupInput & {lineup:LineupResult}) {
  return input.lineup.assignments.flatMap(assignment => {
    const player = assignment.playerId ? input.players[assignment.playerId] : undefined;
    if (!player || assignment.locked) return [];
    const lineup = optimizeLineup({...input,players:{...input.players,[player.id]:{...player,availability:'out'}}});
    const affected = lineup.assignments.flatMap((next,index) => next.playerId === input.lineup.assignments[index].playerId ? [] : [next.playerId,input.lineup.assignments[index].playerId]);
    const times = affected.flatMap(id => id && Number.isFinite(input.players[id]?.kickoff) ? [input.players[id].kickoff!] : []);
    const deadline = times.length ? Math.min(...times) : null;
    return [{playerId:player.id,lineup,deadline,note:lineup.complete ? `If ${player.name} is inactive, use this lineup before the earliest affected kickoff. Recheck availability and game locks.` : `If ${player.name} is inactive, available roster data cannot fill every slot safely.`}];
  });
}
