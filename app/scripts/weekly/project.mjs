import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ROOT,POSITIONS,SCHEDULE_URL,source,realScoring,scheduleFor,teamCode,validateProjections,exactScore,kickerBounds,atomicJSON,quantile} from './data.mjs';
export function makePlayer(id,person,row,game,bye,week,currentWeek,scoring,residuals) {
  const eligible=(person.fantasy_positions||[]).filter(p=>POSITIONS.includes(p));const positions=eligible.length?eligible:[person.position].filter(p=>POSITIONS.includes(p));const pos=positions[0];
  const status=person.injury_status||person.status||null;const out=week===currentWeek&&['OUT','IR','PUP','SUS','SUSPENDED'].includes(String(status).toUpperCase());
  const teamMismatch=row?.team&&person.team&&teamCode(row.team)!==teamCode(person.team);
  const score=teamMismatch?{mean:null,reason:'Projection team differs from current player team; forecast requires a refresh.'}:row?exactScore(row.stats,scoring,pos):{mean:null,reason:'Weekly projection missing.'};
  const bounds=!teamMismatch&&pos==='K'&&score.mean===null&&row?kickerBounds(row.stats,scoring):null;
  const mean=bye||out?0:bounds?bounds.low:score.mean;const rs=residuals[pos]||[];
  const evidence=[`Sleeper weekly component forecast, scored using this league's rules.`];
  if(score.reason)evidence.push(score.reason);
  if(bounds)evidence.push('Conservative scoring bound, not a full point forecast. '+bounds.reason);
  if(bye)evidence.push('Bye verified against complete NFL schedule.');
  if(out)evidence.push(`Current Sleeper ${status} tag applies to current week only; official game status is unverified.`);
  if(week!==currentWeek&&status&&!['ACTIVE','INACTIVE'].includes(String(status).toUpperCase()))evidence.push(`Current status: ${status}. Future projection is conditional on availability; current injury tag does not establish return timing.`);
  if(row?.stats?.rec_tgt!=null)evidence.push(`Projected targets: ${row.stats.rec_tgt}.`);
  if(row?.stats?.rush_att!=null)evidence.push(`Projected carries: ${row.stats.rush_att}.`);
  if(pos==='DEF')evidence.push('Provider scoring-allowed bands are scored as supplied; no independent band probability model.');
  const point=p=>mean===null?null:bye||out?0:rs.length>=30?mean+quantile(rs,p):null;
  return {id,name:person.full_name||[person.first_name,person.last_name].filter(Boolean).join(' ')||id,positions,team:teamCode(person.team)||null,opponent:game?.opponent||null,kickoff:game?.kickoff??null,gameId:game?.gameId||null,status,availability:bye?'bye':out?'out':!game?'unknown':'available',mean,median:point(.5),p10:point(.1),p90:point(.9),components:Object.fromEntries(Object.entries(bounds?.components||score.components||row?.stats||{}).filter(([k])=>k in scoring||['rec_tgt','rush_att','off_snp','tm_off_snp','fga','fgm'].includes(k))),evidence,...(bounds?{projectionBounds:{low:bounds.low,high:bounds.high,reason:bounds.reason}}:{})};
}
export function validateDataset(data) {
  if(data.schemaVersion!==1||Object.keys(data.weeks).length!==18)throw new Error('Dataset requires 18 weeks');
  for(let week=1;week<=18;week++){const w=data.weeks[week];if(!w||w.week!==week||Object.keys(w.players).length<300)throw new Error('Incomplete weekly mapping');for(const [id,p]of Object.entries(w.players)){if(p.id!==id||!p.positions.length||[p.mean,p.median,p.p10,p.p90,p.kickoff].some(x=>x!==null&&!Number.isFinite(x)))throw new Error(`Invalid player ${id}`);}}
  return data;
}
export async function project() {
  const {scoring,sources:leagueSources}=await realScoring();const state=await source('https://api.sleeper.app/v1/state/nfl');const season='2026';if(state.data.season!==season)throw new Error('Season changed; review weekly pipeline');
  const currentWeek=state.data.week;const people=await source('https://api.sleeper.app/v1/players/nfl',{ttl:2*3600000});if(Object.keys(people.data).length<1000)throw new Error('Incomplete player mapping');
  const scheduleSource=await source(SCHEDULE_URL,{text:true});const schedule=scheduleFor(scheduleSource.data,season);
  let validation;try{validation=JSON.parse(await readFile(new URL('public/weekly/validation.json',ROOT),'utf8'));}catch{throw new Error('Run weekly backtest first to create disclosed calibration');}
  if(JSON.stringify(validation.scoring)!==JSON.stringify(scoring))throw new Error('Scoring changed; rerun calibration');
  const recentStats=[];
  for(let recentWeek=Math.max(1,currentWeek-6);recentWeek<currentWeek;recentWeek++){const actual=await source(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${recentWeek}`);if(!actual.data||Object.keys(actual.data).length<300)throw new Error('Incomplete recent actual stats');recentStats.push({...actual,week:recentWeek});}
  const sources=[...recentStats,...leagueSources,state,people,scheduleSource].map(s=>({name:s.url===SCHEDULE_URL?'nflverse schedule':'Sleeper league/player state',url:s.url,fetchedAt:s.fetchedAt,status:'ok'}));
  const dataset={schemaVersion:1,season,generatedAt:new Date().toISOString(),modelVersion:'weekly-provider-components-v1',scoring,weeks:{},sources,calibration:{residuals:validation.residuals,note:'Experimental empirical position residuals from retrospective 2025 weeks 1–10. Historical projections may be revised after kickoff. K residuals use the conservative scoring-bound baseline. Independent residual sampling is a scenario approximation; correlation unvalidated.'},validation:{status:'baseline',summary:'Provider baseline retained. Retrospective diagnostics do not establish prospective accuracy or a matchup-model advantage.',metrics:{historicalMAE:validation.baseline.mae,historicalRMSE:validation.baseline.rmse,historicalSample:validation.baseline.n},limitations:[...validation.limitations,'Current kicker values are conservative scoring lower bounds, not complete point forecasts. Upper bounds show ambiguity from missing distance buckets.']}};
  const mapping=Object.entries(people.data).filter(([,p])=>p.team&&(p.fantasy_positions||[p.position]).some(x=>POSITIONS.includes(x)));
  for(let week=1;week<=18;week++) {
    const raw=await source(`https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=regular`);const rows=validateProjections(raw.data,season,week);const byId=new Map(rows.map(r=>[r.player_id,r]));
    const upstream=Math.max(...rows.map(r=>r.updated_at||r.last_modified||0));
    sources.push({name:`Sleeper week ${week} projections`,url:raw.url,fetchedAt:raw.fetchedAt,status:upstream&&Date.now()-upstream>7*86400000?'stale':'ok',note:`Provider last change ${upstream?new Date(upstream).toISOString():'unavailable'}. Collection time is separate from upstream freshness.`});
    const players={};for(const[id,p]of mapping){const team=teamCode(p.team);const game=schedule.weeks[week][team];players[id]=makePlayer(id,p,byId.get(id),game,schedule.teams.has(team)&&!game,week,currentWeek,scoring,validation.residuals);}
    // Keep new provider IDs visible if player metadata publication lags behind projections.
    for(const row of rows){if(!players[row.player_id]&&POSITIONS.includes(row.player?.position)&&((exactScore(row.stats,scoring,row.player.position).mean??0)>0||(row.stats.fgm??0)>0)){const p=row.player,team=teamCode(p.team),game=schedule.weeks[week][team];players[row.player_id]=makePlayer(row.player_id,p,row,game,schedule.teams.has(team)&&!game,week,currentWeek,scoring,validation.residuals);}}
    for(const p of Object.values(players)){const observed=recentStats.filter(s=>s.data[p.id]).map(s=>({week:s.week,stats:s.data[p.id]}));const recent=observed.slice(-3),previous=observed.slice(-6,-3);const average=(a,key)=>{const values=a.map(r=>key(r.stats));return values.length&&values.every(Number.isFinite)?values.reduce((sum,v)=>sum+v,0)/values.length:null;};p.recentMean=average(recent,s=>exactScore(s,scoring,p.positions[0]).mean);p.recentUsage=average(recent,s=>(s.rec_tgt||0)+(s.rush_att||0));p.previousUsage=average(previous,s=>(s.rec_tgt||0)+(s.rush_att||0));if(recent.length)p.evidence.push(`Observed ${recent.length} completed current-season games: targets plus carries ${p.recentUsage.toFixed(1)} per game. Usage is evidence only; no fitted adjustment.`);}
    const missing=Object.values(players).filter(p=>p.team&&p.mean===null).length;
    dataset.weeks[week]={week,players,warnings:[`${missing} team-associated players lack complete exact-scoring projections. Missing values remain unknown.`, 'Kickers use conservative scoring lower bounds because source distance buckets are incomplete; displayed bounds are scoring ambiguity, not outcome intervals.','Official inactive lists and practice reports are unavailable. Recheck Sleeper before setting a lineup.']};
    console.log(`Projected week ${week}: ${Object.keys(players).length} mapped players, ${missing} missing`);
  }
  for(const[name,url,note]of[['Individual coverage','https://www.pff.com/dfs','WR/CB alignment, assignments and coverage unavailable; no numeric adjustment.'],['Weather','https://www.weather.gov/documentation/services-web-api','No game-specific weather observations collected; no numeric adjustment.'],['Official availability','https://www.nfl.com/injuries/','Official practice reports and inactive lists not collected; Sleeper status is supplementary.'],['Odds','https://sportsdata.io/nfl-api','No licensed timestamped odds or prop feed configured; no numeric adjustment.']])sources.push({name,url,fetchedAt:dataset.generatedAt,status:'missing',note});
  validateDataset(dataset);
  const target=new URL('public/weekly/latest.json',ROOT);try{const previous=JSON.parse(await readFile(target,'utf8'));await atomicJSON(new URL('.simcache/weekly/last-good-dataset.json',ROOT),previous);}catch(e){if(e.code!=='ENOENT')throw e;}
  await atomicJSON(target,dataset);return dataset;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await project();
