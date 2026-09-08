import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ROOT,atomicJSON,source} from './data.mjs';
import {collectEnvironment,matchOfficialInjury} from './environment.mjs';
import {collectCoverage} from './coverage.mjs';
import {collectResearchStats} from './research-stats.mjs';
const modelSummary=v=>v?.pairedComparison?.candidate?.mae>v?.pairedComparison?.provider?.mae?'The usage-based research model was less accurate than Sleeper in the historical comparison. Lineup choices keep Sleeper’s forecast; the research forecast highlights disagreements to review.':v?.reason||'The research model is unavailable for this source set.';
const unique=a=>[...new Set(a.filter(x=>typeof x==='string'&&x.trim()))];
const num=n=>Number.isFinite(n)?n:null;
const signal=(label,n,suffix='',decimals=1,note)=>Number.isFinite(n)?{label,value:n.toFixed(decimals)+suffix,...(note?{note}:{})}:null;
export function normalizeSources(rows,generatedAt){return rows.map(s=>({name:s.name||'Research source',url:s.url,fetchedAt:s.fetchedAt||s.observedAt||generatedAt,status:['ok','available'].includes(s.status)?'ok':s.status==='stale'?'stale':'missing',note:s.note||s.reason||(!s.fetchedAt&&!s.observedAt?'No successful observation timestamp.':'')}));}
const fields=[['targets','Targets / game',''],['carries','Carries / game',''],['target_share','Target share','%',100],['offense_pct','Offensive snap share','%',100],['receiving_air_yards','Air yards / game',' yd'],['redZoneTargets','Red-zone targets / game',''],['redZoneCarries','Red-zone carries / game',''],['inside5Carries','Inside-five carries / game',''],['opponent_defensivePassEPA','Opponent pass EPA allowed','',1,3],['opponent_defensiveRushEPA','Opponent rush EPA allowed','',1,3],['opponent_defensiveSackRate','Opponent sack rate','%',100],['opponent_defensiveQBHitRate','Opponent QB-hit proxy','%',100],['opponent_scheduleAdjustedPassEPA','Schedule-adjusted pass EPA','',1,3],['opponent_scheduleAdjustedRushEPA','Schedule-adjusted rush EPA','',1,3]];
export function researchChanges(previous,current,week){
 if(previous?.research?.week!==week)return [];
 const changes=[];for(const[id,p]of Object.entries(current)){const old=previous.weeks?.[week]?.players[id];if(!old)continue;
 const a=old.research?.officialStatus,b=p.research?.officialStatus;
 if(JSON.stringify(a)!==JSON.stringify(b)&&[a?.status,a?.practice,b?.status,b?.practice].some(Boolean))changes.push({playerId:id,title:p.name,detail:`Official report changed: ${a?.status||a?.practice||'unavailable'} → ${b?.status||b?.practice||'unavailable'}.`});
 if(Number.isFinite(old.mean)&&Number.isFinite(p.mean)&&Math.abs(p.mean-old.mean)>=.5)changes.push({playerId:id,title:p.name,detail:`Lineup forecast ${old.mean.toFixed(1)} → ${p.mean.toFixed(1)} points.`});
 }return changes.slice(0,40);
}
export function combineResearch(dataset,{environment,coverage,stats},previous=null,now=Date.now()){
 const week=dataset.currentWeek,season=Number(dataset.season),generatedAt=new Date(now).toISOString();
 if(!Number.isInteger(week)||!dataset.weeks[week])throw new Error('Current regular-season week is unverified');
 for(const part of [environment,coverage,stats])if(Number(part.season)!==season||part.week!==week)throw new Error('Research season/week mismatch');
 const players=dataset.weeks[week].players;
 const games=environment.games.map(g=>{
  const market=coverage.market?.games?.find(m=>m.home===g.homeTeam&&m.away===g.awayTeam);
  return{gameId:g.gameId,homeTeam:g.homeTeam,awayTeam:g.awayTeam,kickoff:g.kickoff,venue:g.venue?.name||'Venue unverified',roof:g.roof,
   weather:g.weather?[signal('Temperature',g.weather.temperatureF,' °F'),signal('Wind',g.weather.windMph,' mph'),signal('Gusts',g.weather.gustMph,' mph'),signal('Precipitation chance',g.weather.precipitationProbability,'%',0)].filter(Boolean):[],
   notes:unique([...g.evidence,...(g.travel||[]).map(t=>t.note),...(g.restDays?.home!==null&&g.restDays?.home!==undefined?[`${g.homeTeam}: ${g.restDays.home} days since prior kickoff; ${g.awayTeam}: ${g.restDays.away??'unknown'} days.`]:[])]),
   market:market?[{label:'Game total',value:String(market.total),note:`${market.provider}; observed ${market.observedAt}`},...(market.details?[{label:'Spread',value:market.details,note:'Game market, not a player forecast or trade price.'}]:[])]:[]};
 });
 for(const p of Object.values(players)){
  const s=stats.players?.[p.id],c=coverage.players?.[p.id],ngs=c?.receivingContext;
  const official=matchOfficialInjury(p,environment.injuries||[]),game=games.find(g=>g.homeTeam===p.team||g.awayTeam===p.team);
  const notes=[...(s?.evidence||[]).filter(n=>!n.startsWith('Identity joined')&&!n.startsWith('Research candidate')),...(stats.teams?.[p.opponent]?.evidence||[])];
  const signals=fields.map(([key,label,suffix,multiplier=1,decimals=1])=>signal(label,num(s?.features?.[key])===null?null:s.features[key]*multiplier,suffix,decimals)).filter(Boolean);
  if(ngs){for(const[key,label]of [['avgSeparation','Receiving separation'],['avgCushion','Defender cushion'],['avgIntendedAirYards','Target depth'],['avgYacAboveExpectation','YAC above expectation']]){const x=signal(label,ngs[key],' yd',1,`${ngs.dataSeason} tracking sample`);if(x)signals.push(x);}notes.push(`${ngs.dataSeason} NGS receiving sample: ${ngs.targets} targets across ${ngs.weeks.length} qualifying games. ${ngs.method} This does not identify the defender on future routes.`);}
  const defense=coverage.teams?.[p.opponent];if(defense){if(defense.status==='stale')notes.push(defense.note||'Opponent depth chart is stale.');const starters=defense.defensivePersonnel.filter(d=>d.rank===1).map(d=>`${d.name} (${d.position})`);if(starters.length)notes.push(`${p.opponent} listed defensive personnel as of ${defense.observedAt}: ${starters.join(', ')}. ${defense.rotationWarning}`);}
  if(c?.licensedCoverage)notes.push(`Supplied coverage scenarios (${c.licensedCoverage.observedAt}): ${c.licensedCoverage.coverageAssignments.map(a=>`${a.defenderId} ${Math.round(a.weight*100)}% ${a.alignment}: ${a.support}`).join('; ')}. Assignment evidence alone does not establish a calibrated scoring penalty.`);
  else if(c?.estimatedMatchup)notes.push('Estimated outside and slot defender groups are shown with observed individual coverage results. Receiver alignment and shadow assignments remain uncertain.');
  const absences=(environment.injuries||[]).filter(i=>(i.team===p.opponent||i.team===p.team)&&i.playerName!==p.name&&['out','doubtful','questionable'].includes(String(i.status).toLowerCase()));
  if(absences.length)notes.push(`Official game-status context: ${absences.map(i=>`${i.team} ${i.playerName} (${i.position}): ${i.status}`).join('; ')}. No unmeasured workload redistribution is assumed.`);
  if(game){notes.push(`${game.awayTeam} at ${game.homeTeam}, ${game.venue}; ${game.roof}.`);for(const x of game.weather)if(['Wind','Gusts'].includes(x.label))signals.push({...x,note:'Kickoff forecast; separate from the point model.'});}
  const candidate=s&&Number.isFinite(s.candidateMean)&&p.availability==='available'&&!['out','inactive'].includes(String(official?.status).toLowerCase())?s.candidateMean:null;
  if(candidate!==null&&Number.isFinite(p.mean))notes.push(`Independent research forecast differs from lineup forecast by ${(candidate-p.mean).toFixed(1)} points. ${modelSummary(stats.validation)}`);
  p.research={...(c?.estimatedMatchup?{matchup:c.estimatedMatchup}:{}),basis:s?`${s.seasonBasis} ${Number(s.seasonBasis)===season?'current-season evidence':'prior-season evidence'} through week ${s.throughWeek}`:'No usable historical sample; the lineup uses the provider forecast.',sampleGames:s?.sampleGames??null,candidateMean:candidate,signals,notes:unique(notes),officialStatus:official?{status:official.status,practice:official.practice,injury:official.injury,sourceUrl:official.sourceUrl,reportedAt:official.reportedAt}:null};
  if(official){p.evidence.push(`Official NFL practice: ${official.practice??'unassigned'}; game status: ${official.status??'unassigned'}.`);if(official.status){p.status=official.status;if(['out','inactive'].includes(official.status.toLowerCase())&&p.availability!=='bye'){p.availability='out';p.mean=0;p.median=0;p.p10=0;p.p90=0;}}}
 }
 const v=stats.validation||{},m=v.pairedComparison||{},metrics={};for(const[key,value]of Object.entries({matched_player_games:m.candidate?.n,research_model_MAE:m.candidate?.mae,provider_MAE:m.provider?.mae,trailing_baseline_MAE:m.trailing?.mae,independent_holdout_MAE:v.selectedTest?.mae,independent_holdout_sample:v.selectedTest?.n}))if(Number.isFinite(value))metrics[key]=value;
 const sources=normalizeSources([...(environment.sources||[]),...(coverage.sources||[]),...(stats.sources||[])],generatedAt);
 dataset.research={schemaVersion:1,season:dataset.season,week,generatedAt,games,sources,limitations:unique([...(environment.limitations||[]),...(coverage.limitations||[]),...(stats.limitations||[]),...(v.limitations||[])]),model:{name:v.selected||'Research model',summary:modelSummary(v),admitted:!!v.admitted,metrics},changes:researchChanges(previous,players,week)};
 const replaced=new Set(['Weather','Official availability','Odds']);dataset.sources=dataset.sources.filter(s=>!replaced.has(s.name));dataset.sources.push(...sources);
 dataset.weeks[week].warnings=dataset.weeks[week].warnings.filter(x=>!x.startsWith('Official inactive lists and practice reports are unavailable.'));
 dataset.weeks[week].warnings.push('Official practice reports are included where published. Final inactive lists and last-minute changes still require a game-day check.');
 dataset.modelVersion='weekly-research-v2';return dataset;
}
async function safe(label,collect,season,week){try{return await collect();}catch(e){return{season,week,sources:[{name:label,url:'https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html',fetchedAt:new Date().toISOString(),status:'missing',note:e.message}],players:{},teams:{},games:[],injuries:[],limitations:[`${label}: ${e.message}`]};}}
export async function research(){
 const dataset=JSON.parse(await readFile(new URL('public/weekly/latest.json',ROOT),'utf8'));
 const state=await source('https://api.sleeper.app/v1/state/nfl',{ttl:3600000});if(String(state.data.season)!==dataset.season||!Number.isInteger(state.data.week)||state.data.week<1||state.data.week>18)throw new Error('Current NFL regular-season week unavailable');
 dataset.currentWeek=state.data.week;const season=Number(dataset.season),week=dataset.currentWeek;
 const environment=await safe('Game environment',()=>collectEnvironment({season:String(season),week}),season,week);
 const coverage=await safe('Receiving and coverage',()=>collectCoverage({season,week}),season,week);
 const stats=await safe('Opportunity model',()=>collectResearchStats({season,week}),season,week);
 let previous=null;try{previous=JSON.parse(await readFile(new URL('.simcache/weekly/last-good-dataset.json',ROOT),'utf8'));}catch{}
 combineResearch(dataset,{environment,coverage,stats},previous);
 await atomicJSON(new URL('public/weekly/research/latest.json',ROOT),{...dataset.research,environment,coverage,stats});
 await atomicJSON(new URL('public/weekly/latest.json',ROOT),dataset);
 console.log(JSON.stringify({week,games:dataset.research.games.length,playerEvidence:Object.values(dataset.weeks[week].players).filter(p=>p.research.signals.length).length,model:dataset.research.model,missingSources:dataset.research.sources.filter(s=>s.status==='missing').map(s=>s.name)}));
 return dataset;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await research();
