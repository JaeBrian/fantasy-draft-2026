import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {defenderPerformance,estimateMatchups} from './estimated-coverage.mjs';
import {ROOT,csvRows,teamCode} from './data.mjs';
const base='https://github.com/nflverse/nflverse-data/releases/download/';
const numeric=x=>x!==''&&x!=null&&Number.isFinite(Number(x))?Number(x):null;
// One overwritten compressed cache per URL; network failures remain explicit.
async function fetchFeed(url,{now,text=true,ttl=21600000}={}) {
 const dir=new URL('.simcache/weekly/coverage/',ROOT), file=new URL(createHash('sha256').update(url).digest('hex')+'.json.gz',dir);
 try {const old=JSON.parse(gunzipSync(await readFile(file)));if(Date.parse(old.fetchedAt)<=now&&now-Date.parse(old.fetchedAt)<ttl)return old;}catch{}
 if(Date.now()-now>60000)throw new Error('Historical cutoff requires an archived source snapshot');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
 let bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>64000000)throw new Error('Source exceeds 64 MB limit');
 if(url.endsWith('.gz'))bytes=gunzipSync(bytes,{maxOutputLength:64000000});
 const data=text?bytes.toString():JSON.parse(bytes.toString());const result={url,fetchedAt:new Date(now).toISOString(),data};
 await mkdir(dir,{recursive:true});await writeFile(file,gzipSync(JSON.stringify(result)));return result;
}
export function receivingContexts(rows,identities,sleeper,{season,week}) {
 const espn=new Map(),gsis=new Map();
 for(const [id,p] of Object.entries(sleeper)){if(p.espn_id)espn.set(String(p.espn_id),id);if(p.gsis_id)gsis.set(p.gsis_id,id);}
 for(const p of identities)if(p.gsis_id&&espn.has(String(p.espn_id)))gsis.set(p.gsis_id,espn.get(String(p.espn_id)));
 const groups={};for(const r of rows){const s=Number(r.season),w=Number(r.week);if(r.season_type!=='REG'||w<1||s<season-1||s>season||(s===season&&w>=week))continue;
 const id=gsis.get(r.player_gsis_id);if(!id||!['WR','TE','RB'].includes(sleeper[id]?.position))continue;(groups[id]??=[]).push(r);}
 const players={};for(const [id,all] of Object.entries(groups)){
 const dataSeason=Math.max(...all.map(r=>Number(r.season)));const selected=all.filter(r=>Number(r.season)===dataSeason);const latestWeek=Math.max(...selected.map(r=>Number(r.week)));
 const sample=dataSeason===season?selected.filter(r=>Number(r.week)>latestWeek-4):selected;
 const targets=sample.reduce((a,r)=>a+(numeric(r.targets)||0),0);if(!targets)continue;
 const metrics={};for(const [field,name] of [['avg_separation','avgSeparation'],['avg_cushion','avgCushion'],['avg_intended_air_yards','avgIntendedAirYards'],['avg_yac_above_expectation','avgYacAboveExpectation']]){
 const weight=field==='avg_yac_above_expectation'?'receptions':'targets';const valid=sample.filter(r=>numeric(r[field])!==null&&numeric(r[weight])>0);const denominator=valid.reduce((a,r)=>a+Number(r[weight]),0);metrics[name]=denominator?valid.reduce((a,r)=>a+Number(r[field])*Number(r[weight]),0)/denominator:null;}
 players[id]={receivingContext:{source:'nflverse NGS',dataSeason,weeks:sample.map(r=>Number(r.week)).sort((a,b)=>a-b),contextType:dataSeason===season?'recent-completed':'prior-season',targets,...metrics,method:'Target-weighted separation/cushion/air yards; reception-weighted YAC above expectation. Targeted plays only, not all routes.',alignmentAvailable:false,coverageAssignmentsAvailable:false}};
 }return players;
}
export function defensivePersonnel(rows,now) {
 const latest={};for(const r of rows){const t=Date.parse(r.dt);if(Number.isFinite(t)&&t<=now&&t>(latest[r.team]??-Infinity))latest[r.team]=t;}
 const teams={};for(const r of rows){if(Date.parse(r.dt)!==latest[r.team]||!/(CB|FS|SS|NB|DB|SAF)/.test(r.pos_abb)||!r.pos_grp?.includes('D'))continue;
 const team=teamCode(r.team);teams[team]??={observedAt:r.dt,defensivePersonnel:[],projectedAssignmentsAvailable:false,rotationWarning:'Depth-chart positions describe personnel. Nickel packages, motion and rotations change actual coverage assignments.'};
 teams[team].defensivePersonnel.push({name:r.player_name,gsisId:r.gsis_id||null,espnId:r.espn_id||null,position:r.pos_abb,rank:numeric(r.pos_rank),baseGroup:r.pos_grp});}
 for(const team of Object.values(teams)){team.status=now-Date.parse(team.observedAt)>48*3600000?'stale':'available';if(team.status==='stale'){team.defensivePersonnel=[];team.note='Latest depth chart exceeds 48 hours; current personnel withheld.';}}
 return teams;
}
export function validateCoverageInput(input,{season,week,now,people={},schedule={}}) {
 if(input?.season!==season||input?.week!==week||!/^https:\/\//.test(input.source||'')||!Array.isArray(input.players))throw new Error('Coverage input requires matching season/week, HTTPS source and players');
 const observed=Date.parse(input.observedAt);if(!Number.isFinite(observed)||observed>now||now-observed>7*86400000)throw new Error('Coverage input observation must be within the previous seven days');
 const opponents=new Map();for(const event of schedule.events||[]){if(event.season?.year!==season||event.season?.type!==2||event.week?.number!==week)continue;const teams=event.competitions?.[0]?.competitors?.map(c=>teamCode(c.team?.abbreviation));if(teams?.length===2&&teams.every(Boolean)&&teams[0]!==teams[1]){opponents.set(teams[0],teams[1]);opponents.set(teams[1],teams[0]);}}
 const seen=new Set();for(const p of input.players){if(!people[p.playerId]||seen.has(p.playerId))throw new Error('Unknown or duplicate coverage player ID');seen.add(p.playerId);
 const receiver=people[p.playerId];if(!['WR','TE','RB'].includes(receiver.position)||!receiver.team||!opponents.has(teamCode(receiver.team)))throw new Error('Coverage receiver must be WR/TE/RB with a verified scheduled opponent');
 if(!Array.isArray(p.coverageAssignments)||!p.coverageAssignments.length)throw new Error('Coverage assignments are required');
 let sum=0;const defenders=new Set();for(const a of p.coverageAssignments){if(!people[a.defenderId]||defenders.has(a.defenderId)||typeof a.weight!=='number'||!Number.isFinite(a.weight)||a.weight<=0||a.weight>1||typeof a.support!=='string'||!a.support.trim()||!['slot','outside','mixed','zone'].includes(a.alignment))throw new Error('Invalid assignment ID, weight, alignment or supporting evidence');const defender=people[a.defenderId];if(a.defenderId===p.playerId||!['CB','DB','S','FS','SS','LB','ILB','OLB','MLB'].includes(defender.position)||teamCode(defender.team)!==opponents.get(teamCode(receiver.team)))throw new Error('Coverage defender must be a defensive back or linebacker on the scheduled opposing team');sum+=a.weight;defenders.add(a.defenderId);}
 if(Math.abs(sum-1)>1e-6)throw new Error('Coverage assignment weights must sum to one');}
 return input;
}
export function marketContext(data,{season,week,now}) {
 const games=[];for(const event of data.events||[]){if(event.season?.year!==season||event.season?.type!==2||event.week?.number!==week)continue;
 const c=event.competitions?.[0],odds=c?.odds?.[0];if(!odds||numeric(odds.overUnder)===null)continue;
 games.push({gameId:event.id,kickoff:event.date,observedAt:new Date(now).toISOString(),provider:odds.provider?.name||'ESPN listed provider',total:numeric(odds.overUnder),spread:numeric(odds.spread),details:odds.details||null,home:teamCode(c.competitors?.find(t=>t.homeAway==='home')?.team?.abbreviation),away:teamCode(c.competitors?.find(t=>t.homeAway==='away')?.team?.abbreviation)});}
 return {available:games.length>0,games,interpretation:'Market totals and spreads describe game expectations. They are not player prop prices or measured fantasy trade value.'};
}
export async function collectCoverage({season,week,now=Date.now(),fetchSource=fetchFeed,coverageInput}={}) {
 if(!Number.isInteger(season)||!Number.isInteger(week)||week<1||week>18||!Number.isFinite(now))throw new Error('Valid season, regular-season week and cutoff required');
 const sources=[],limitations=['Public NGS separation and cushion measure targeted plays; route participation, receiver alignment, man/zone splits and shadow assignments require charting.','Public FTN participation data for the ongoing season arrives after postseason. Base defensive depth charts cannot establish WR-to-CB assignment.'];
 async function get(name,url,text=true){try{const r=await fetchSource(url,{now,text,ttl:name==='ESPN game market'?1800000:21600000});if(Date.parse(r.fetchedAt)>now)throw new Error('Observation is after cutoff');sources.push({name,url,observedAt:r.fetchedAt,status:'available'});return text?csvRows(r.data):r.data;}catch(e){sources.push({name,url,status:'unavailable',reason:e.message});limitations.push(`${name}: ${e.message}`);return text?[]:{};}}
 const identities=await get('nflverse player IDs',base+'players/players.csv');
 const sleeper=await get('Sleeper player IDs','https://api.sleeper.app/v1/players/nfl',false);
 const ngs=await get('NFL Next Gen receiving',base+'nextgen_stats/ngs_receiving.csv.gz');
 const depths=await get('nflverse ESPN depth charts',base+`depth_charts/depth_charts_${season}.csv`);
 const scoreboard=await get('ESPN game market',`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`,false);
 const priorDefense=await get('PFR prior-season individual coverage',base+`pfr_advstats/advstats_week_def_${season-1}.csv`);
 const currentDefense=week>1?await get('PFR current-season individual coverage',base+`pfr_advstats/advstats_week_def_${season}.csv`):[];
 const performance=defenderPerformance([...priorDefense,...currentDefense],identities,{season,week});
 const players=receivingContexts(ngs,identities,sleeper,{season,week}),teams=defensivePersonnel(depths,now),market=marketContext(scoreboard,{season,week,now:Date.parse(sources.find(s=>s.name==='ESPN game market')?.observedAt)||now});
 const estimates=estimateMatchups(sleeper,teams,scoreboard,performance,{season,week});for(const[id,estimatedMatchup]of Object.entries(estimates)){players[id]??={};players[id].estimatedMatchup=estimatedMatchup;}
 for(const [team,value] of Object.entries(teams))if(value.status==='stale')limitations.push(`${team}: ${value.note}`);
 let input=coverageInput;if(input===undefined)try{input=JSON.parse(await readFile(new URL('public/weekly/coverage-input.json',ROOT),'utf8'));}catch(e){if(e.code!=='ENOENT')limitations.push(`Coverage input: ${e.message}`);}
 if(input)try{validateCoverageInput(input,{season,week,now,people:sleeper,schedule:scoreboard});for(const p of input.players){players[p.playerId]??={};players[p.playerId].licensedCoverage={source:input.source,observedAt:input.observedAt,season,week,coverageAssignments:p.coverageAssignments};}sources.push({name:'User supplied coverage charting',url:input.source,observedAt:input.observedAt,status:'available'});}catch(e){limitations.push(`Coverage input rejected: ${e.message}`);}
 if(!input)limitations.push('Optional licensed coverage import: app/public/weekly/coverage-input.json. No matchup scoring adjustment is applied without a validated and calibrated model.');
 return {season,week,generatedAt:new Date(now).toISOString(),sources,players,teams,market,limitations};
}
