import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {scoreStats, validateLeague} from '../league-scoring.mjs';
export const ROOT = new URL('../../', import.meta.url);
export const POSITIONS = ['QB','RB','WR','TE','K','DEF'];
export const SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const cache = new URL('.simcache/weekly/', ROOT);
export async function atomicJSON(path, value) {
  await mkdir(new URL('.', path), {recursive:true});
  const tmp = new URL(`${path.pathname}.${process.pid}.tmp`, path);
  await writeFile(tmp, JSON.stringify(value)); await rename(tmp, path);
}
// Call sequentially: bounded requests, conditional cache lifetime and retained raw observations.
export async function source(url, {ttl=21600000,text=false,refresh=false}={}) {
  await mkdir(cache,{recursive:true});
  const file=new URL(createHash('sha256').update(url).digest('hex')+'.json',cache);
  let old; try {old=JSON.parse(await readFile(file,'utf8'));} catch {}
  if(!refresh && old && Date.now()-Date.parse(old.fetchedAt)<ttl) return old;
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
      if(!r.ok) {const e=new Error(`HTTP ${r.status}: ${url}`);e.retryAfter=Number(r.headers.get('retry-after'))*1000;throw e;}
      const data=text?await r.text():await r.json();
      const result={url,fetchedAt:new Date().toISOString(),data};
      if(old) await atomicJSON(new URL(`${file.pathname.split('/').pop().slice(0,-5)}-${old.fetchedAt.replaceAll(':','-')}.json`,cache),old);
      await atomicJSON(file,result);return result;
    } catch(e) {if(attempt===3)throw e;await new Promise(resolve=>setTimeout(resolve,Math.min(30000,e.retryAfter||500*2**attempt+Math.random()*250)));}
  }
}
export async function realScoring() {
  const draft=await source('https://api.sleeper.app/v1/draft/1389372699129700353');
  const league=await source('https://api.sleeper.app/v1/league/1389372699129700352');
  if(draft.data.league_id!==league.data.league_id)throw new Error('Real league identity mismatch');
  validateLeague(draft.data,league.data);return {scoring:league.data.scoring_settings,sources:[draft,league]};
}
export function csvRows(text) {
  const records=[];let row=[],field='',quote=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(field);field='';}else if(c==='\n'&&!quote){row.push(field.replace(/\r$/,''));records.push(row);row=[];field='';}else field+=c;}
  if(field||row.length){row.push(field);records.push(row);}const keys=records.shift();return records.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]??''])));
}
export const teamCode=t=>({LA:'LAR',WSH:'WAS',OAK:'LV',SD:'LAC',STL:'LAR'}[t]||t);
// nfldata documents gametime in Eastern time. Resolve offset using IANA zone, including DST.
export function easternKickoff(day,time) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))return null;
  const naive=Date.parse(`${day}T${time}:00Z`);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'longOffset'}).formatToParts(new Date(naive)).map(p=>[p.type,p.value]));
  const offset=parts.timeZoneName.match(/GMT([+-])(\d{2}):(\d{2})/);if(!offset)return null;
  return naive-(offset[1]==='+'?1:-1)*(Number(offset[2])*60+Number(offset[3]))*60000;
}
export function scheduleFor(csv,season) {
  const games=csvRows(csv).filter(g=>g.season===String(season)&&g.game_type==='REG');
  const teams=new Set(games.flatMap(g=>[teamCode(g.home_team),teamCode(g.away_team)]));
  if(games.length!==272||teams.size!==32)throw new Error(`Incomplete ${season} schedule: ${games.length} games/${teams.size} teams`);
  const counts={}; const weeks={};
  for(const g of games){const w=Number(g.week);if(w<1||w>18)throw new Error('Invalid schedule week');weeks[w]??={};
    for(const [team,opponent]of[[g.home_team,g.away_team],[g.away_team,g.home_team]]){const t=teamCode(team);if(weeks[w][t])throw new Error('Duplicate team game');weeks[w][t]={opponent:teamCode(opponent),kickoff:easternKickoff(g.gameday,g.gametime),gameId:g.game_id};counts[t]=(counts[t]||0)+1;}}
  if(Object.values(counts).some(c=>c!==17)||Object.keys(weeks).length!==18)throw new Error('Incomplete team schedule');return {weeks,teams};
}
export function validateProjections(rows,season,week) {
  if(!Array.isArray(rows)||rows.length<300)throw new Error(`Incomplete projections week ${week}`);
  const ids=new Set();const positionCounts={};
  for(const r of rows){if(!r.player_id||!r.stats||String(r.season)!==String(season)||r.week!==week||ids.has(r.player_id))throw new Error(`Invalid projection week ${week}`);ids.add(r.player_id);if(Object.values(r.stats).some(x=>!Number.isFinite(x)))throw new Error('Non-finite component');const p=r.player?.position;positionCounts[p]=(positionCounts[p]||0)+1;}
  if(POSITIONS.some(p=>(positionCounts[p]||0)<10))throw new Error(`Missing position feed week ${week}`);return rows;
}
export function exactScore(stats,rules,position) {
  if(!stats||!Object.keys(stats).some(k=>k in rules))return {mean:null,reason:'Scoring components unavailable.'};
  const components={...stats};
  if(position==='K') {
    const bucketSum=['fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p'].reduce((s,k)=>s+(stats[k]||0),0);
    if(stats.fgm==null||Math.abs(stats.fgm-bucketSum)>0.06)return {mean:null,reason:'Kicker distance buckets incomplete; exact league scoring unavailable.'};
    if(components.fgmiss==null&&Number.isFinite(stats.fga))components.fgmiss=Math.max(0,stats.fga-stats.fgm);
  }
  return {mean:scoreStats(components,rules),components};
}
export function quantile(a,p){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor((s.length-1)*p)];}
// Bounds retain unknown distance allocation. Never infer a 50/60-yard split.
export function kickerBounds(stats,rules) {
  if(!stats||!Number.isFinite(stats.fgm)||!Number.isFinite(stats.fga))return null;
  const buckets=['fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p'];
  const unallocated=stats.fgm-buckets.reduce((sum,k)=>sum+(stats[k]||0),0);if(unallocated<-.06)return null;
  const missing=buckets.filter(k=>stats[k]===undefined);if(!missing.length&&unallocated>.06)return null;
  const components={...stats,fgmiss:stats.fgmiss??Math.max(0,stats.fga-stats.fgm)};
  const base=scoreStats(components,rules),weights=missing.map(k=>rules[k]??0),gap=Math.max(0,unallocated);
  return {low:base+gap*(weights.length?Math.min(...weights):0),high:base+gap*(weights.length?Math.max(...weights):0),reason:`${gap.toFixed(2)} projected field goals have unavailable distance buckets. Bounds assign them the minimum and maximum league weight among missing buckets; missed field goals use attempts minus makes.`,components};
}
