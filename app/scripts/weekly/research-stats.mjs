import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT,source,csvRows,teamCode,SCHEDULE_URL,easternKickoff,realScoring,atomicJSON} from './data.mjs';
import {validateResearchModel,predictResearch} from './research-model.mjs';
export const numeric=v=>v===''||v==null||!Number.isFinite(Number(v))?null:Number(v);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const avg=(rows,key)=>mean(rows.map(r=>numeric(r[key])).filter(v=>v!==null));
const sum=(rows,key)=>rows.reduce((s,r)=>s+(numeric(r[key])||0),0);
const ratio=(a,b)=>b?a/b:null;
const kickoffCache=new WeakMap();
export function beforeCutoff(row,{season,week,now},games) {
  const y=Number(row.season),w=Number(row.week),g=games.get(row.game_id);
  if(row.season_type!=='REG'||!(y<season||(y===season&&w<week))||y<season-1||!g||g.home_score===''||g.away_score===''||numeric(g.home_score)===null||numeric(g.away_score)===null)return false;
  if(!kickoffCache.has(g))kickoffCache.set(g,easternKickoff(g.gameday,g.gametime));
  const kickoff=kickoffCache.get(g);return kickoff!==null&&kickoff+8*3600000<new Date(now).getTime();
}
// ESPN and GSIS identifiers, plus matching birthday and position, avoid name-only joins.
export function playerMapping(people,registry,crosswalk=[]) {
  const gsis=new Map(),espn=new Map();for(const r of registry){if(r.gsis_id)gsis.set(r.gsis_id,r);if(r.espn_id){const a=espn.get(r.espn_id)||[];a.push(r);espn.set(r.espn_id,a);}}
  const result=new Map(),used=new Set();const direct=new Map(crosswalk.filter(r=>r.sleeper_id&&r.sleeper_id!=='NA'&&r.gsis_id&&r.gsis_id!=='NA').map(r=>[r.sleeper_id,r.gsis_id]));
  for(const[id,p]of Object.entries(people)){
    let r=gsis.get(direct.get(id))||(p.gsis_id?gsis.get(p.gsis_id):null);
    if(!r&&p.espn_id){const candidates=espn.get(String(p.espn_id))||[];if(candidates.length===1)r=candidates[0];}
    if(!r||!p.birth_date||r.birth_date!==p.birth_date||r.position!==p.position||used.has(r.gsis_id))continue;
    result.set(r.gsis_id,id);used.add(r.gsis_id);
  }return result;
}
const components={pass_yd:'passing_yards',pass_td:'passing_tds',pass_int:'passing_interceptions',pass_2pt:'passing_2pt_conversions',rush_yd:'rushing_yards',rush_td:'rushing_tds',rush_2pt:'rushing_2pt_conversions',rec:'receptions',rec_yd:'receiving_yards',rec_td:'receiving_tds',rec_2pt:'receiving_2pt_conversions',fum_lost:'fumbles_lost_total',st_td:'special_teams_tds',fum_rec_td:'fumble_recovery_tds'};
export function leaguePoints(row,scoring){return Object.entries(components).reduce((s,[k,v])=>s+(scoring[k]||0)*(numeric(row[v])||0),0);}
export function playerFeatures(rows,scoring){
 const recent=rows.slice(-6),last=recent.slice(-3),previous=rows.slice(-6,-3);const f={};
 for(const k of ['attempts','carries','targets','receptions','receiving_air_yards','target_share','air_yards_share','rushing_yards','receiving_yards','passing_yards','passing_tds','rushing_tds','receiving_tds','offense_pct','offense_snaps','redZoneTargets','redZoneCarries','inside5Carries'])f[k]=avg(recent,k);
 f.recentTargets=avg(last,'targets');f.recentCarries=avg(last,'carries');f.previousTargets=avg(previous,'targets');f.previousCarries=avg(previous,'carries');f.pointsMean=mean(recent.map(r=>leaguePoints(r,scoring)));f.sampleGames=recent.length;return f;
}
export function teamFeatures(rows,allRows){
 const recent=rows.slice(-6),byGame=new Map(allRows.map(r=>[`${r.game_id}:${teamCode(r.team)}`,r]));
 const against=recent.map(r=>byGame.get(`${r.game_id}:${teamCode(r.opponent_team)}`)).filter(Boolean);
 const pass=sum(against,'attempts')+sum(against,'sacks_suffered'),rush=sum(against,'carries');
 const adjusted=(type,den)=>mean(recent.map(r=>{const opp=byGame.get(`${r.game_id}:${teamCode(r.opponent_team)}`);if(!opp)return null;const prior=allRows.filter(x=>x.team===opp.team&&Number(x.season)===Number(r.season)&&Number(x.week)<Number(r.week)).slice(-6);if(!prior.length)return null;const rate=ratio(sum(prior,`${type}_epa`),den(prior));const current=ratio(numeric(opp[`${type}_epa`]),den([opp]));return rate===null||current===null?null:current-rate;}).filter(v=>v!==null));
 return {offensiveDropbacks:avg(recent,'attempts')===null?null:(sum(recent,'attempts')+sum(recent,'sacks_suffered'))/recent.length,offensiveCarries:avg(recent,'carries'),defensivePassEPA:ratio(sum(against,'passing_epa'),pass),defensiveRushEPA:ratio(sum(against,'rushing_epa'),rush),defensiveSackRate:ratio(sum(recent,'def_sacks'),pass),defensiveQBHitRate:ratio(sum(recent,'def_qb_hits'),pass),defensivePassExplosiveRate:ratio(sum(against,'passing_20'),sum(against,'attempts')),defensiveRushExplosiveRate:ratio(sum(against,'rushing_10'),rush),scheduleAdjustedPassEPA:adjusted('passing',a=>sum(a,'attempts')+sum(a,'sacks_suffered')),scheduleAdjustedRushEPA:adjusted('rushing',a=>sum(a,'carries')),pressureRate:null};
}
const pbpProgram=String.raw`import csv,gzip,io,json,urllib.request,sys
out={}
with urllib.request.urlopen(sys.argv[1],timeout=90) as response:
 for r in csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=response))):
  if r.get('season_type')!='REG' or r.get('play_type')=='no_play': continue
  try: yard=float(r.get('yardline_100') or 999)
  except ValueError: continue
  if yard>20: continue
  for field,stat in [('receiver_player_id','redZoneTargets'),('rusher_player_id','redZoneCarries')]:
   pid=r.get(field)
   if not pid: continue
   if field=='receiver_player_id' and r.get('pass_attempt')!='1':continue
   if field=='rusher_player_id' and r.get('rush_attempt')!='1':continue
   key=r['game_id']+':'+pid
   a=out.setdefault(key,{'redZoneTargets':0,'redZoneCarries':0,'inside5Carries':0})
   a[stat]+=1
   if stat=='redZoneCarries' and yard<=5:a['inside5Carries']+=1
print(json.dumps(out,separators=(',',':')))
`;
async function redZone(season){const url=`https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${season}.csv.gz`,path=new URL(`.simcache/weekly/research-pbp-${season}.json`,ROOT);try{const old=JSON.parse(await readFile(path,'utf8'));if(Date.now()-Date.parse(old.fetchedAt)<86400000)return old;}catch{}
 const data=await new Promise((resolve,reject)=>{const child=spawn('python3',['-c',pbpProgram,url]);let out='',err='';const timer=setTimeout(()=>child.kill(),180000);child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code)reject(new Error(err.slice(-500)));else{try{resolve(JSON.parse(out));}catch(e){reject(e);}}});});const result={url,fetchedAt:new Date().toISOString(),data};await atomicJSON(path,result);return result;}
export async function loadResearchInputs(season,week,now){
 const sources=[],limitations=[];const get=async(url,text=true)=>{const s=await source(url,{text,ttl:86400000});sources.push({name:'nflverse research',url,fetchedAt:s.fetchedAt,status:'ok'});return text?csvRows(s.data):s.data;};
 const schedule=await get(SCHEDULE_URL),games=new Map(schedule.map(g=>[g.game_id,g]));const registry=await get('https://github.com/nflverse/nflverse-data/releases/download/players/players.csv');const people=await get('https://api.sleeper.app/v1/players/nfl',false);
 const crosswalk=await get('https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv');const playerRows=[],teamRows=[];const pfr=new Map(registry.filter(r=>r.pfr_id).map(r=>[r.pfr_id,r.gsis_id]));
 for(let year=2022;year<=season;year++){
  if(year===season&&week<=1)continue;
  const opt={season:year,week:year===season?week:19,now};
  let players,teams;try{players=await get(`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${year}.csv`);teams=await get(`https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${year}.csv`);}catch(e){if(year!==season)throw e;limitations.push(`Current ${year} stats unavailable: ${e.message}`);continue;}
  players=players.filter(r=>['QB','RB','WR','TE'].includes(r.position)&&beforeCutoff(r,opt,games));teams=teams.filter(r=>beforeCutoff(r,opt,games));
  const expected=schedule.filter(g=>Number(g.season)===year&&g.game_type==='REG'&&beforeCutoff({...g,season_type:'REG'},opt,games)).length*2;
  if(teams.length!==expected||new Set(teams.map(r=>r.game_id+':'+r.team)).size!==teams.length||players.length<teams.length)throw new Error(`Incomplete ${year} research statistics: ${teams.length}/${expected} team-games, ${players.length} player-games`);
  try{const snaps=await get(`https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${year}.csv`);const map=new Map(snaps.map(s=>[`${s.game_id}:${pfr.get(s.pfr_player_id)}`,s]));for(const r of players){const s=map.get(`${r.game_id}:${r.player_id}`);if(s){r.offense_pct=s.offense_pct;r.offense_snaps=s.offense_snaps;}}}catch(e){limitations.push(`${year} snaps unavailable: ${e.message}`);}
  try{const rz=await redZone(year);sources.push({name:`nflverse ${year} red-zone play-by-play`,url:rz.url,fetchedAt:rz.fetchedAt,status:'ok'});for(const r of players)Object.assign(r,rz.data[`${r.game_id}:${r.player_id}`]||{redZoneTargets:0,redZoneCarries:0,inside5Carries:0});}catch(e){limitations.push(`${year} red-zone data unavailable: ${e.message}`);}
  playerRows.push(...players);teamRows.push(...teams);
 }
 return {playerRows,teamRows,people,registry,crosswalk,games,schedule,sources,limitations};
}
export function snapshotFeatures(input,{season,week,now},scoring){
 const allowed=r=>beforeCutoff(r,{season,week,now},input.games),pr=input.playerRows.filter(allowed).sort((a,b)=>Number(a.season)-Number(b.season)||Number(a.week)-Number(b.week)),tr=input.teamRows.filter(allowed).sort((a,b)=>Number(a.season)-Number(b.season)||Number(a.week)-Number(b.week));
 const group=(rows,key)=>{const m=new Map();for(const r of rows){const id=key(r);if(!m.has(id))m.set(id,[]);m.get(id).push(r);}return m;};
 const players={},teams={};for(const[id,rows]of group(pr,r=>r.player_id)){const current=rows.filter(r=>Number(r.season)===season),used=current.length?current:rows.filter(r=>Number(r.season)===season-1);players[id]={features:playerFeatures(used,scoring),sampleGames:Math.min(6,used.length),throughWeek:Math.max(...used.map(r=>Number(r.week))),seasonBasis:current.length?season:season-1,evidence:[`${current.length?'Current-season observations':`${season-1} prior-season observations; role and team may have changed`}; last ${Math.min(6,used.length)} played games. Missing games are excluded; this is conditional on participation.`]};}
 for(const[id,rows]of group(tr,r=>teamCode(r.team))){const current=rows.filter(r=>Number(r.season)===season),used=current.length?current:rows.filter(r=>Number(r.season)===season-1);teams[id]={features:teamFeatures(used,tr),sampleGames:Math.min(6,used.length),throughWeek:Math.max(...used.map(r=>Number(r.week))),seasonBasis:current.length?season:season-1,evidence:[`${current.length?'Current season':`${season-1} prior season`}, last ${Math.min(6,used.length)} games. Schedule-adjusted EPA subtracts each prior opponent's pregame offensive EPA rate; week-one opponents lack that baseline. QB hits are a pressure proxy, not charted pressure rate. Pass explosives: 20+ yards; rush explosives: 10+ yards.`]};}
 return {players,teams};
}
export async function collectResearchStats({season=2026,week=1,now=new Date().toISOString()}={}){
 season=Number(season);week=Number(week);if(!Number.isInteger(season)||!Number.isInteger(week)||week<1||week>18||!Number.isFinite(new Date(now).getTime()))throw new Error('Invalid research cutoff');
 const input=await loadResearchInputs(season,week,now),{scoring}=await realScoring();const fit=await validateResearchModel(input,scoring,now);const snap=snapshotFeatures(input,{season,week,now},scoring),mapping=playerMapping(input.people,input.registry,input.crosswalk),players={};
 for(const[gsis,p]of Object.entries(snap.players)){const id=mapping.get(gsis);if(!id)continue;const person=input.people[id],game=input.schedule.find(g=>Number(g.season)===season&&Number(g.week)===week&&g.game_type==='REG'&&[teamCode(g.home_team),teamCode(g.away_team)].includes(teamCode(person.team)));const opp=game?(teamCode(game.home_team)===teamCode(person.team)?teamCode(game.away_team):teamCode(game.home_team)):null;const candidateMean=predictResearch(fit.model,{position:person.position,features:p.features,opponentFeatures:snap.teams[opp]?.features||{}});players[id]={...p,gsisId:gsis,opponent:opp,features:{...p.features,...Object.fromEntries(Object.entries(snap.teams[opp]?.features||{}).map(([k,v])=>[`opponent_${k}`,v]))},candidateMean,modelMean:fit.validation.admitted?candidateMean:null,evidence:[...p.evidence,'Identity joined by verified GSIS/Sleeper crosswalk or ESPN identifier, with matching birthday and position.',`Research candidate ${candidateMean===null?'unavailable':candidateMean.toFixed(2)+' points'}; ${fit.validation.admitted?'admitted':'experimental; provider remains primary'}.`]};}
 const result={season,week,generatedAt:new Date().toISOString(),sources:input.sources,players,teams:snap.teams,validation:fit.validation,limitations:[...input.limitations,'No route participation, coverage assignments, charted pressure/blitz or defensive injury adjustments.','Historical nflverse values include later official corrections; feature events precede target weeks, but this is not a timestamped vintage backtest.','QB hit rate is a proxy; pressureRate remains null. Snap percentages are PFR observations.','Research means are conditional on playing; historical samples omit games with no recorded stats. Rookie and changed-role uncertainty is substantial.','K/DST research models are outside this skill-position candidate.']};
 await atomicJSON(new URL('public/weekly/research-model.json',ROOT),result);return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=await collectResearchStats({season:Number(process.argv[2]||2026),week:Number(process.argv[3]||1)});console.log(JSON.stringify({players:Object.keys(result.players).length,teams:Object.keys(result.teams).length,validation:result.validation,limitations:result.limitations},null,2));}
