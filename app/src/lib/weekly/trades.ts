import type { WeeklyDataset, LineupResult } from './types';
import { eligible, optimizeLineup } from './lineup';

export type TradeRoster = { rosterId:number; owner:string; playerIds:string[]; reserveIds?:string[] };
export type TradeInput = {
  dataset:WeeklyDataset; rosters:TradeRoster[]; managerRosterId:number; slots:string[];
  selectedWeek:number; currentWeek:number; tradeDeadline:number|null; rosterLimit:number;
  seasonEndWeek?:number; processingDays?:number; now?:number; maxResults?:number;
};
type WeekValue = { week:number; before:LineupResult; after:LineupResult; gain:number };
export type TradeSide = {
  rosterId:number; owner:string; weeks:WeekValue[]; next3Gain:number; rosGain:number;
  waiverGain:number; gainOverWaivers:number; drops:string[]; additions:string[]; needs:string[]; baselineDrops:string[];
};
export type TradePlayer = { id:string; name:string; owner:string; modelPoints:number; marketValue:null; researchNotes?:string[] };
export type TradeOffer = {
  id:string; category:'buy-low'|'buy-high'|'sell-high'|'roster-fit'; categoryEvidence:string;
  outgoing:TradePlayer[]; incoming:TradePlayer[]; manager:TradeSide; counterparty:TradeSide;
  sensitivity:{ assumption:string; low:number; high:number };
  maxPrice:{ playerIds:string[]; modelPoints:number; explanation:string }; risks:string[];
};
export type TradeReport = { offers:TradeOffer[]; watch:{playerId:string;name:string;owner:string;category:'hold/watch';reason:string}[]; blockedReasons:string[]; timing:string; weeks:number[] };
const sum = (values:number[]) => values.reduce((a,b)=>a+b,0);

export function generateTradeTargets(input:TradeInput):TradeReport {
  const {dataset,managerRosterId,slots,currentWeek,tradeDeadline,rosterLimit}=input;
  let rosters=input.rosters;
  const start=Math.max(input.selectedWeek,currentWeek+1), end=input.seasonEndWeek??17;
  const weeks=Array.from({length:Math.max(0,end-start+1)},(_,i)=>start+i);
  const report:TradeReport={offers:[],watch:[],blockedReasons:[],weeks,
    timing:`Values begin in week ${start}; current-week points are excluded because game locks and trade processing can prevent same-week use.`};
  let manager=rosters.find(r=>r.rosterId===managerRosterId);
  if(!manager) report.blockedReasons.push('Manager roster identity is unresolved.');
  if(tradeDeadline===null || !Number.isFinite(tradeDeadline)) report.blockedReasons.push('Trade deadline is unverified.');
  else if(tradeDeadline>0 && currentWeek>tradeDeadline) report.blockedReasons.push('The actionable trade window has closed.');
  if(!Number.isInteger(rosterLimit)||rosterLimit<slots.length) report.blockedReasons.push('Roster limit is invalid.');
  if(!weeks.length) report.blockedReasons.push('No future scoring weeks remain.');
  if(rosters.some(r=>(r.reserveIds??[]).some(id=>!r.playerIds.includes(id))||new Set(r.reserveIds??[]).size!==(r.reserveIds??[]).length)) report.blockedReasons.push('Reserve placement must reference unique owned players.');
  const owned=rosters.flatMap(r=>r.playerIds);
  if(new Set(owned).size!==owned.length) report.blockedReasons.push('Duplicate player ownership must be resolved.');
  if(weeks.some(w=>!dataset.weeks[w])) report.blockedReasons.push('Complete future weekly forecasts are required for rest-of-season valuation.');
  if(report.blockedReasons.length||!manager) return report;
  const processingEnd=(input.now??Date.now())+(input.processingDays??0)*86400000;
  if(input.processingDays && weeks.some(w=>Object.values(dataset.weeks[w].players).some(p=>p.kickoff!==null&&p.kickoff<=processingEnd&&p.availability==='available'))){
    report.blockedReasons.push('Trade processing overlaps the valuation horizon; select a later week.');return report;
  }
  const first=dataset.weeks[start].players;
  const known=(ids:string[])=>ids.every(id=>weeks.every(w=>{
    const p=dataset.weeks[w].players[id];
    return p && Number.isFinite(p.mean) && p.availability!=='unknown' && (p.availability==='bye'||p.availability==='out'||p.kickoff!==null);
  }));
  const model=(ids:string[])=>sum(weeks.flatMap(w=>ids.map(id=>dataset.weeks[w].players[id]?.mean??0)));
  const allFree=Object.keys(first).filter(id=>!owned.includes(id)&&known([id]));
  const cache=new Map<string,LineupResult[]>();
  const evaluate=(ids:string[])=>{
    const key=[...ids].sort().join(',');
    if(!cache.has(key)) cache.set(key,weeks.map(w=>{
      const players=dataset.weeks[w].players;
      const value=optimizeLineup({players,rosterIds:ids,slots,now:0});
      const empty=value.assignments.filter(a=>a.playerId===null);
      if(!empty.length)return value;
      const streamers=[...new Set(empty.flatMap(a=>allFree.filter(id=>players[id].availability==='available'&&eligible(players[id],a.slot)).sort((x,y)=>players[y].mean!-players[x].mean!).slice(0,empty.length)))];
      const fill=optimizeLineup({players,rosterIds:streamers,slots:empty.map(a=>a.slot),now:0});
      for(const [i,a] of fill.assignments.entries()) if(a.playerId)value.assignments[empty[i].index]={...a,index:empty[i].index};
      value.total+=fill.total;value.complete=fill.complete;
      value.issues.push('Empty slots assume weekly free-agent streaming; availability and retaining or reacquiring dropped players are unverified.');
      return value;
    }));
    return cache.get(key)!;
  };
  const total=(ids:string[])=>known(ids)?sum(evaluate(ids).map(v=>v.total)):Number.NEGATIVE_INFINITY;
  const usable=(ids:string[])=>known(ids)&&evaluate(ids).every(v=>v.complete);
  const free=[...allFree].sort((a,b)=>model([b])-model([a])).slice(0,8);
  const reserve=(r:TradeRoster)=>r.reserveIds?.filter(id=>weeks.every(w=>dataset.weeks[w].players[id]?.availability==='out'))??[];
  const activeCount=(ids:string[],reserveIds:string[])=>ids.filter(id=>!reserveIds.includes(id)).length;
  const normalize=(ids:string[],protectedIds:string[]=[],reserveIds:string[]=[])=>{
    let roster=[...ids]; const drops:string[]=[];
    while(activeCount(roster,reserveIds)>rosterLimit){
      const started=new Set(evaluate(roster).flatMap(v=>v.assignments.map(a=>a.playerId)));
      const bench=roster.filter(id=>!protectedIds.includes(id)&&!reserveIds.includes(id)&&!started.has(id)).sort((a,b)=>model([a])-model([b]));
      const candidates=bench.length?bench:roster.filter(id=>!protectedIds.includes(id)&&!reserveIds.includes(id)).sort((a,b)=>total(roster.filter(id=>id!==b))-total(roster.filter(id=>id!==a))||a.localeCompare(b));
      if(!candidates.length) break;
      drops.push(candidates[0]);roster=roster.filter(id=>id!==candidates[0]);
    }
    return {roster,drops};
  };
  const baselineDrops=new Map<number,string[]>();
  rosters=rosters.map(r=>{
    if(!known(r.playerIds))return r;
    const normalized=normalize(r.playerIds,[],reserve(r));
    baselineDrops.set(r.rosterId,normalized.drops);
    return {...r,playerIds:normalized.roster,reserveIds:reserve(r)};
  });
  manager=rosters.find(r=>r.rosterId===managerRosterId)!;
  if(!usable(manager.playerIds)) {report.blockedReasons.push('Manager roster has incomplete forecasts or cannot fill a legal lineup in every future week.');return report;}
  const waiver=(ids:string[],reserveIds:string[]=[])=>{
    let best={roster:ids,drops:[] as string[],additions:[] as string[],gain:0};
    for(const id of free){
      const option=normalize([...ids,id],[id],reserveIds);
      const gain=total(option.roster)-total(ids);
      if(gain>best.gain&&usable(option.roster)) best={...option,additions:[id],gain};
    }
    return best;
  };
  const managerWaiver=waiver(manager.playerIds,manager.reserveIds);
  const packages=(ids:string[])=>{
    const top=ids.filter(id=>!first[id].positions.some(p=>['K','DEF','DST'].includes(p))).sort((a,b)=>model([b])-model([a])).slice(0,6);
    const pairs=top.flatMap((a,i)=>top.slice(i+1).map(b=>[a,b]));
    // Spread the pair shortlist across the range so depth packages remain represented.
    return [...top.map(id=>[id]),...pairs.filter((_,i)=>i%3===0)];
  };
  const cards=(ids:string[],owner:string):TradePlayer[]=>ids.map(id=>({id,name:first[id].name,owner,modelPoints:model([id]),marketValue:null,researchNotes:dataset.weeks[dataset.currentWeek??currentWeek]?.players[id]?.research?.notes.slice(0,4)??[]}));
  const side=(roster:TradeRoster,afterIds:string[],drops:string[],additions:string[],waiverGain:number):TradeSide=>{
    const before=evaluate(roster.playerIds), after=evaluate(afterIds);
    const values=weeks.map((week,i)=>({week,before:before[i],after:after[i],gain:after[i].total-before[i].total}));
    const needs=[...new Set(values.flatMap(v=>v.after.assignments.filter(a=>a.playerId&&!v.before.assignments.some(b=>b.playerId===a.playerId)).map(a=>a.slot)))];
    const rosGain=sum(values.map(v=>v.gain));
    return {rosterId:roster.rosterId,owner:roster.owner,weeks:values,next3Gain:sum(values.slice(0,3).map(v=>v.gain)),rosGain,waiverGain,gainOverWaivers:rosGain-waiverGain,drops,additions,needs,baselineDrops:baselineDrops.get(roster.rosterId)??[]};
  };
  const classify=(incoming:string[],outgoing:string[]):Pick<TradeOffer,'category'|'categoryEvidence'>=>{
    const evidence=(id:string)=>{const p=first[id];return Number.isFinite(p.recentMean)&&Number.isFinite(p.recentUsage)&&Number.isFinite(p.previousUsage)?p:null;};
    for(const id of outgoing){const p=evidence(id);if(p&&p.recentMean!>p.mean!*1.1&&p.recentUsage!<=p.previousUsage!)return {category:'sell-high',categoryEvidence:`${p.name}: recent scoring exceeds the forecast by over 10% while measured usage is flat or lower. Market price is unavailable.`};}
    for(const id of incoming){const p=evidence(id);if(p&&p.recentUsage!>=p.previousUsage!&&p.recentMean!<p.mean!*.9)return {category:'buy-low',categoryEvidence:`${p.name}: recent scoring trails the forecast by over 10% with stable or rising measured usage. Market discount is unverified.`};if(p&&p.recentUsage!>p.previousUsage!&&p.recentMean!>=p.mean!)return {category:'buy-high',categoryEvidence:`${p.name}: recent scoring and rising measured usage support interest. Market premium is unverified.`};}
    return {category:'roster-fit',categoryEvidence:'Legal lineup improvement supports this package. Verified usage or market evidence is insufficient for a price label.'};
  };
  for(const opponent of rosters.filter(r=>r.rosterId!==managerRosterId)){
    if(!usable(opponent.playerIds)){report.blockedReasons.push(`${opponent.owner}: incomplete forecasts or future lineup coverage; valuation withheld.`);continue;}
    const opponentWaiver=waiver(opponent.playerIds,opponent.reserveIds);
    const rough=(ids:string[])=>sum(slots.map(slot=>Math.max(0,...ids.filter(id=>eligible(first[id],slot)).map(id=>model([id])/weeks.length))));
    const candidates=packages(manager.playerIds).flatMap(outgoing=>packages(opponent.playerIds).map(incoming=>{
      const a=[...manager.playerIds.filter(id=>!outgoing.includes(id)),...incoming];
      const b=[...opponent.playerIds.filter(id=>!incoming.includes(id)),...outgoing];
      const gainA=rough(a)-rough(manager.playerIds),gainB=rough(b)-rough(opponent.playerIds);
      return {outgoing,incoming,score:Math.min(gainA,gainB)+.05*(gainA+gainB)};
    })).sort((a,b)=>b.score-a.score).slice(0,20);
    for(const {outgoing,incoming} of candidates){
      const a=normalize([...manager.playerIds.filter(id=>!outgoing.includes(id)),...incoming],incoming,manager.reserveIds);
      const b=normalize([...opponent.playerIds.filter(id=>!incoming.includes(id)),...outgoing],outgoing,opponent.reserveIds);
      if(!usable(a.roster)||!usable(b.roster))continue;
      // A team giving up an extra player may fill the open bench place with an available player.
      const aw=activeCount(a.roster,manager.reserveIds??[])<rosterLimit?waiver(a.roster,manager.reserveIds):{...a,additions:[],gain:0};
      const bw=activeCount(b.roster,opponent.reserveIds??[])<rosterLimit?waiver(b.roster,opponent.reserveIds):{...b,additions:[],gain:0};
      if(aw.additions.some(id=>bw.additions.includes(id)))continue;
      const me=side(manager,aw.roster,[...a.drops,...(aw.additions.length?aw.drops:[])],aw.additions,managerWaiver.gain);
      const them=side(opponent,bw.roster,[...b.drops,...(bw.additions.length?bw.drops:[])],bw.additions,opponentWaiver.gain);
      if(me.weeks.some((w,i)=>w.after.assignments.some(a=>a.playerId&&!owned.includes(a.playerId)&&them.weeks[i].after.assignments.some(b=>b.playerId===a.playerId))))continue;
      if(me.gainOverWaivers<=0.1||them.gainOverWaivers<=0.1)continue;
      const swing=.1*(model(incoming)+model(outgoing));
      report.offers.push({id:`${managerRosterId}:${opponent.rosterId}:${outgoing.join(',')}:${incoming.join(',')}`,...classify(incoming,outgoing),outgoing:cards(outgoing,manager.owner),incoming:cards(incoming,opponent.owner),manager:me,counterparty:them,
        sensitivity:{assumption:'Stress bound assuming traded-player forecasts each move by ±10%; this is an assumption, not a confidence interval.',low:me.rosGain-swing,high:me.rosGain+swing},
        maxPrice:{playerIds:outgoing,modelPoints:model(outgoing),explanation:'Most costly tested package for these incoming players that improves both lineups beyond the available waiver baseline. Search is bounded; do not extrapolate to untested prices.'},
        risks:[...(input.rosters.some(r=>r.reserveIds?.length)?['Existing reserve placement is retained only for players projected out throughout the horizon. Projected returns require baseline active-roster space and may force drops. Incoming players require active space; new IR placement is unverified.']:[]),'Waiver availability and claim priority can change; additions are conditional. Empty slots assume weekly streaming, including the ability to retain or reacquire players dropped to make room.','No acceptance, matchup-win, playoff, or championship probabilities are estimated.',...(me.drops.length||them.drops.length?['Required drops are included in both teams’ lineup values.']:[])]});
    }
  }
  for(const offer of report.offers){
    const candidates=report.offers.filter(o=>o.counterparty.rosterId===offer.counterparty.rosterId&&o.incoming.map(p=>p.id).sort().join()===offer.incoming.map(p=>p.id).sort().join());
    const boundary=candidates.sort((a,b)=>model(b.outgoing.map(p=>p.id))-model(a.outgoing.map(p=>p.id)))[0];
    offer.maxPrice={...offer.maxPrice,playerIds:boundary.outgoing.map(p=>p.id),modelPoints:model(boundary.outgoing.map(p=>p.id))};
  }
  report.offers.sort((a,b)=>b.manager.gainOverWaivers-a.manager.gainOverWaivers);
  report.offers=report.offers.slice(0,input.maxResults??12);
  report.watch=manager.playerIds.filter(id=>!report.offers.some(o=>o.outgoing.some(p=>p.id===id))).map(id=>({playerId:id,name:first[id].name,owner:manager.owner,category:'hold/watch',reason:'No tested bilateral package improves both teams beyond holding and the current waiver baseline.'}));
  return report;
}
