import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ROOT,source,exactScore,atomicJSON,csvRows,SCHEDULE_URL} from './data.mjs';
const directory=new URL('public/weekly/shadow/',ROOT);
export function forecastArchive(dataset,week,now=Date.now()) {
  const section=dataset.weeks[String(week)];if(dataset.schemaVersion!==1||!section||section.week!==week)throw new Error('Invalid shadow dataset');
  const players=Object.values(section.players);const kickoffs=players.map(p=>p.kickoff).filter(Number.isFinite);if(!kickoffs.length)throw new Error('No verified kickoff');
  const firstKickoff=Math.min(...kickoffs),lastKickoff=Math.max(...kickoffs);
  if(now>=firstKickoff)return null;
  if(!Number.isFinite(Date.parse(dataset.generatedAt))||Date.parse(dataset.generatedAt)>now||now-Date.parse(dataset.generatedAt)>24*3600000)throw new Error('Shadow forecast must be current and available before archive time');
  const projections=dataset.sources.filter(s=>s.name===`Sleeper week ${week} projections`);if(projections.length!==1||projections[0].status!=='ok')throw new Error('Shadow requires a fresh projection source');
  const predictions=players.filter(p=>Number.isFinite(p.mean)&&p.mean>0&&p.kickoff!==null).map(p=>({id:p.id,position:p.positions[0],mean:p.mean,...(p.projectionBounds?{projectionBounds:p.projectionBounds}:{})}));
  if(predictions.length<100)throw new Error('Incomplete shadow forecast');
  return {schemaVersion:1,season:dataset.season,week,archivedAt:new Date(now).toISOString(),forecastGeneratedAt:dataset.generatedAt,firstKickoff,lastKickoff,scoring:dataset.scoring,predictions,modelVersion:dataset.modelVersion,source:projections[0],note:'Immutable pre-first-kickoff forecast. K means are conservative scoring bounds. Archive does not establish accuracy.'};
}
export function scoreArchive(archive,actual,now=Date.now()) {
  if(archive.schemaVersion!==1||!Array.isArray(archive.predictions)||!archive.predictions.length||!Number.isFinite(archive.firstKickoff)||!Number.isFinite(archive.lastKickoff)||Date.parse(archive.archivedAt)>=archive.firstKickoff||!Number.isFinite(Date.parse(archive.archivedAt)))throw new Error('Invalid prospective archive');
  // Conservatively wait 24 hours after the last scheduled kickoff before scoring.
  if(now<archive.lastKickoff+24*3600000)return null;
  if(!actual||Array.isArray(actual)||Object.keys(actual).length<300)throw new Error('Incomplete actual stats');
  const residuals=[];let missingActual=0,incompleteScoring=0;
  for(const p of archive.predictions){if(!p.id||!Number.isFinite(p.mean)||!p.position)throw new Error('Invalid archived prediction');if(!actual[p.id]){missingActual++;continue;}const score=exactScore(actual[p.id],archive.scoring,p.position).mean;if(score===null){incompleteScoring++;continue;}residuals.push({id:p.id,position:p.position,prediction:p.mean,actual:score,error:score-p.mean});}
  const n=residuals.length;return {schemaVersion:1,season:archive.season,week:archive.week,archivedAt:archive.archivedAt,scoredAt:new Date(now).toISOString(),status:'shadow',n,mae:n?residuals.reduce((s,r)=>s+Math.abs(r.error),0)/n:null,rmse:n?Math.sqrt(residuals.reduce((s,r)=>s+r.error*r.error,0)/n):null,missingActual,incompleteScoring,limitations:['Prospective shadow observations only. No automatic model promotion or performance conclusion.','Missing actual rows excluded, never treated as zero; inactive-game risk is underrepresented.','Actual stats may receive later corrections. K values are scoring lower bounds.'],results:residuals};
}
export async function shadow() {
  await mkdir(directory,{recursive:true});const dataset=JSON.parse(await readFile(new URL('public/weekly/latest.json',ROOT),'utf8'));const now=Date.now();const index={schemaVersion:1,updatedAt:new Date(now).toISOString(),status:'shadow',archives:[],note:'Forecasts archive before the first kickoff. Scores appear after completed weeks; no automatic model validation.'};
  // Archive the nearest upcoming week only; future weeks will receive fresher forecasts later.
  const upcoming=Object.values(dataset.weeks).filter(w=>Object.values(w.players).some(p=>Number.isFinite(p.kickoff))).sort((a,b)=>a.week-b.week).find(w=>Math.min(...Object.values(w.players).map(p=>p.kickoff).filter(Number.isFinite))>now);
  if(upcoming){const archive=forecastArchive(dataset,upcoming.week,now);if(archive){try{await writeFile(new URL(`${dataset.season}-${upcoming.week}.json`,directory),JSON.stringify(archive),{flag:'wx'});console.log(`Archived prospective week ${upcoming.week}`);}catch(e){if(e.code!=='EEXIST')throw e;}}}
  for(let week=1;week<=18;week++){const name=`${dataset.season}-${week}.json`;let archive;try{archive=JSON.parse(await readFile(new URL(name,directory),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}let scored=false;
    if(now>=archive.lastKickoff+24*3600000){const schedule=await source(SCHEDULE_URL,{text:true});const games=csvRows(schedule.data).filter(g=>g.season===archive.season&&g.game_type==='REG'&&Number(g.week)===week);const complete=games.length>=10&&games.every(g=>g.home_score!==''&&g.away_score!==''&&Number.isFinite(Number(g.home_score))&&Number.isFinite(Number(g.away_score)));if(!complete){index.archives.push({season:archive.season,week,archivedAt:archive.archivedAt,forecast:name,scored:false});continue;}const stats=await source(`https://api.sleeper.app/v1/stats/nfl/regular/${archive.season}/${week}`);const report=scoreArchive(archive,stats.data,now);if(report){await atomicJSON(new URL(`${dataset.season}-${week}-results.json`,directory),{...report,actualSource:{url:stats.url,fetchedAt:stats.fetchedAt}});scored=true;}}
    index.archives.push({season:archive.season,week,archivedAt:archive.archivedAt,forecast:name,scored});
  }
  await atomicJSON(new URL('index.json',directory),index);return index;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await shadow();
