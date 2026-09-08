import {source, SCHEDULE_URL, csvRows, teamCode, easternKickoff} from './data.mjs';
export const STADIUM_URL='https://raw.githubusercontent.com/greerreNFL/stadiums/master/data/stadiums.csv';
export const scoreboardURL=(season,week)=>`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}&limit=1000`;
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&amp;/g,'&').replace(/&(?:nbsp|#160);/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const teams=Object.fromEntries('Cardinals:ARI Falcons:ATL Ravens:BAL Bills:BUF Panthers:CAR Bears:CHI Bengals:CIN Browns:CLE Cowboys:DAL Broncos:DEN Lions:DET Packers:GB Texans:HOU Colts:IND Jaguars:JAX Chiefs:KC Raiders:LV Chargers:LAC Rams:LAR Dolphins:MIA Vikings:MIN Patriots:NE Saints:NO Giants:NYG Jets:NYJ Eagles:PHI Steelers:PIT 49ers:SF Seahawks:SEA Buccaneers:TB Titans:TEN Commanders:WAS'.split(' ').map(x=>x.split(':')));
export function parseInjuries(html,{season,week,sourceUrl}) {
  const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(!title.includes(`Week ${week} of the ${season} Season`))throw new Error('Official injury report season/week mismatch');
  const injuries=[];let team=null,sections=0;
  const tokens=html.matchAll(/<div class="d3-o-section-sub-title">([\s\S]*?)<\/div>|<table\b[^>]*>([\s\S]*?)<\/table>/g);
  for(const token of tokens){if(token[1]){team=teams[clean(token[1])]||null;if(team)sections++;continue;}
    if(!team||!clean(token[2]).includes('Practice Status'))continue;
    for(const row of token[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>clean(x[1]));if(cells.length!==5)continue;
      if(!cells[0]||!cells[1])throw new Error('Malformed official injury row');
      injuries.push({team,playerName:cells[0],position:cells[1],injury:cells[2]||null,practice:cells[3]||null,status:cells[4]||null,sourceUrl,reportedAt:null});
    }
  }
  if(!sections)throw new Error('Official injury report team sections missing');
  return injuries;
}
// Identity joins require a unique same-team, same-position match; suffixes remain significant.
export const normalizePlayerName=name=>String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchOfficialInjury(player,injuries){const hits=injuries.filter(r=>r.team===teamCode(player.team)&&normalizePlayerName(r.playerName)===normalizePlayerName(player.name)&&(player.positions||[player.position]).includes(r.position));return hits.length===1?hits[0]:null;}
export function roofFor(venue,stadiumId){
  if(['HOU00','IND00','ATL97','DAL00','DAL09','PHO00','ARI00'].includes(stadiumId))return 'retractable-unknown';
  if(stadiumId==='LAX01'||/SoFi/i.test(venue?.fullName||''))return 'covered-open-sides';
  if(venue?.indoor===false)return 'outdoors';
  if(venue?.indoor===true&&['DET00','MIN01','VEG00','NOR00'].includes(stadiumId))return 'indoor';
  return 'unknown';
}
export function kickoffWeather(data,kickoff,roof){
  if(roof==='indoor')return null;
  const h=data?.hourly;if(!Array.isArray(h?.time))return null;
  const target=Math.round(kickoff/3600000)*3600000;
  const i=h.time.findIndex(t=>(typeof t==='number'?t*1000:Date.parse(t.endsWith('Z')?t:t+'Z'))===target);
  const keys=['temperature_2m','precipitation','precipitation_probability','wind_speed_10m','wind_gusts_10m'];
  if(i<0||keys.some(k=>!Number.isFinite(h[k]?.[i])))return null;
  return {forecastAt:new Date(target).toISOString(),temperatureF:h.temperature_2m[i],precipitationIn:h.precipitation[i],precipitationProbability:h.precipitation_probability[i],windMph:h.wind_speed_10m[i],gustMph:h.wind_gusts_10m[i],exposure:roof==='outdoors'?'outdoor':'roof/exposure uncertain',reportedAt:null};
}
export async function collectEnvironment({season,week,now,fetchSource=source}){
  const explicitCutoff=now!==undefined;
  if(explicitCutoff&&(!Number.isFinite(now)||now<Date.now()-60000||now>Date.now()))throw new Error('Historical or future cutoff requires an archived environment snapshot');
  now??=Date.now();
  season=String(season);week=Number(week);if(!/^20\d{2}$/.test(season)||!Number.isInteger(week)||week<1||week>18)throw new Error('Invalid environment season/week');
  const generatedAt=new Date(now).toISOString(),sources=[],limitations=[];
  async function get(name,url,options={}){try{const r=await fetchSource(url,options);const cutoff=explicitCutoff?now:Date.now();const fetchedAt=Date.parse(r.fetchedAt);if(!Number.isFinite(fetchedAt)||fetchedAt>cutoff)throw new Error('Source observation is invalid or after the requested cutoff');sources.push({name,url,fetchedAt:r.fetchedAt,status:cutoff-fetchedAt>(options.ttl||21600000)?'stale':'ok'});return r;}catch(e){sources.push({name,url,fetchedAt:generatedAt,status:'missing',note:`Collection attempted; no usable observation: ${e.message}`});limitations.push(`${name} unavailable.`);return null;}}
  const sched=await get('nflverse game schedule',SCHEDULE_URL,{text:true});
  const board=await get(`ESPN week ${week} game venues`,scoreboardURL(season,week),{ttl:3600000});
  const stadiums=await get('Stadium coordinate registry',STADIUM_URL,{text:true,ttl:30*86400000});
  const rows=sched?csvRows(sched.data).filter(g=>g.season===season&&g.game_type==='REG'):[];
  const coordinates=stadiums?csvRows(stadiums.data):[];
  let events=board?.data?.events||[];
  if(board&&(Number(board.data.season?.year)!==Number(season)||board.data.week?.number!==week||events.some(e=>e.season?.year!==Number(season)||e.week?.number!==week))){sources.find(s=>s.url===board.url).status='missing';limitations.push('ESPN returned a different season/week; venue observations rejected.');events=[];}
  const games=[];
  for(const row of rows.filter(g=>Number(g.week)===week)){
    const event=events.find(e=>String(e.id)===row.espn),competition=event?.competitions?.[0];
    const homeTeam=teamCode(row.home_team),awayTeam=teamCode(row.away_team);
    const verified=competition&&competition.competitors?.some(t=>t.homeAway==='home'&&teamCode(t.team?.abbreviation)===homeTeam)&&competition.competitors?.some(t=>t.homeAway==='away'&&teamCode(t.team?.abbreviation)===awayTeam);
    const venue=verified?competition.venue:null;
    // Join coordinates to the scheduled stadium ID, then require the event city to agree.
    const place=coordinates.find(s=>s.stadium_id===row.stadium_id);
    const cityAgrees=venue&&place&&clean(venue.address?.city||'').toLowerCase()===clean(place.city||'').toLowerCase();
    const nameAgrees=venue&&place&&clean(venue.fullName).toLowerCase()===clean(place.stadium_name).toLowerCase();
    const located=!!(place&&(cityAgrees||nameAgrees)&&place.lat&&place.lon&&Number.isFinite(Number(place.lat))&&Number.isFinite(Number(place.lon))&&Math.abs(Number(place.lat))<=90&&Math.abs(Number(place.lon))<=180);
    const kickoff=verified&&Number.isFinite(Date.parse(event.date))?Date.parse(event.date):easternKickoff(row.gameday,row.gametime);
    const roof=roofFor(venue,row.stadium_id);
    const game={gameId:row.game_id,homeTeam,awayTeam,kickoff,venue:{name:venue?.fullName||row.stadium||null,city:venue?.address?.city||null,country:venue?.address?.country||null,latitude:located?Number(place.lat):null,longitude:located?Number(place.lon):null,neutralSite:verified?competition.neutralSite:row.location==='Neutral'},roof,weather:null,restDays:{home:null,away:null},evidence:[]};
    for(const [side,team]of [['home',homeTeam],['away',awayTeam]]){const prior=rows.filter(g=>Number(g.week)<week&&[teamCode(g.home_team),teamCode(g.away_team)].includes(team)).map(g=>easternKickoff(g.gameday,g.gametime)).filter(t=>t!==null&&t<kickoff).sort((a,b)=>b-a)[0];if(prior)game.restDays[side]=Number(((kickoff-prior)/86400000).toFixed(2));}
    game.evidence.push(`Venue ${verified?'verified against ESPN event':'unverified'}; roof classification ${roof}.`, 'Rest is elapsed days since previous regular-season kickoff; week 1 has no comparable prior game.');
    if(game.venue.neutralSite)game.evidence.push('Neutral-site game. Both teams travel; see any separately sourced arrival report. Individual acclimatization is unmeasured.');
    if(!located)game.evidence.push('Stadium coordinates unverified; weather unavailable.');
    if(roof==='indoor')game.evidence.push('Indoor venue: outdoor weather omitted.');
    else if(located&&kickoff>=now&&kickoff-now<15*86400000){
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=GMT&timeformat=unixtime&forecast_days=16`;
      const forecast=await get(`Kickoff weather ${awayTeam} at ${homeTeam}`,url,{ttl:3600000});
      if(forecast){game.weather=kickoffWeather(forecast.data,kickoff,roof);if(game.weather)Object.assign(game.weather,{sourceUrl:url,fetchedAt:forecast.fetchedAt});else {sources.find(s=>s.url===url).status='missing';game.evidence.push('Forecast does not contain complete kickoff-hour values.');}}
    }else if(roof!=='indoor')game.evidence.push('Kickoff outside live forecast window; historical or long-range weather remains unknown.');
    if(game.weather)game.evidence.push('Nearest kickoff hour forecast; precipitation is the preceding hour. Roof operation and field-level wind may differ. No numeric fantasy adjustment.');
    games.push(game);
  }
  if(season==='2026'&&week===1){
    const url='https://www.nfl.com/news/niners-arrive-melbourne-historic-nfl-game-rams';
    const travel=await get('NFL Melbourne travel report',url,{text:true});
    const game=games.find(g=>g.awayTeam==='SF'&&g.homeTeam==='LAR'&&g.venue.neutralSite);
    if(travel&&game&&clean(travel.data).includes('touched down on Friday morning after a 15-hour')){
      const reportedAt=travel.data.match(/"datePublished":"([^"]+)"/)?.[1]||null;
      game.travel=[{team:'SF',note:'49ers arrived September 4 following a 15-hour flight; individual acclimatization remains unmeasured.',sourceUrl:url,reportedAt,fetchedAt:travel.fetchedAt}];
      game.evidence.push(game.travel[0].note);
    }
  }
  if(!games.length)limitations.push('Requested week game schedule unavailable.');
  const injuryUrl=`https://www.nfl.com/injuries/league/${season}/reg${week}`;
  const report=await get(`NFL official week ${week} injury report`,injuryUrl,{text:true,ttl:3600000});let injuries=[];
  if(report){try{injuries=parseInjuries(report.data,{season,week,sourceUrl:injuryUrl});sources.find(s=>s.url===injuryUrl).note='Page fetched successfully. Individual report publication timestamps unavailable; reportedAt stays null. Blank game status does not establish availability.';}catch(e){sources.find(s=>s.url===injuryUrl).status='missing';sources.find(s=>s.url===injuryUrl).note=e.message;limitations.push(e.message);}}
  limitations.push('Official report rows retain blank details as unknown. Absence from this table does not establish health or active status. Final inactive lists require a separate game-day check.','Retractable roof operation is unknown. Stadium coordinate registry contains roof errors and is used only for coordinates; ESPN event roof evidence takes precedence.','Weather is forecast context, not a calibrated fantasy effect. Provider model issuance timestamps are unavailable; fetchedAt records collection only.','Travel evidence is limited to explicitly sourced reports. Other itineraries and individual acclimatization remain unavailable; no travel penalty inferred.');
  return {season,week,generatedAt:explicitCutoff?generatedAt:new Date().toISOString(),sources,games,injuries,limitations};
}
