import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInjuries,matchOfficialInjury,roofFor,kickoffWeather,collectEnvironment} from './environment.mjs';
const html=`<title>Official NFL Injury Report for Players - Week 1 of the 2026 Season | NFL.com</title><div class="d3-o-section-sub-title"><span>Patriots</span></div><table><thead><tr><th>Practice Status</th></tr></thead><tbody><tr><td><a>A.J. Example</a></td><td>RB</td><td></td><td>Limited Participation in Practice</td><td></td></tr></tbody></table>`;
const config={season:2026,week:1,sourceUrl:'https://www.nfl.com/injuries/league/2026/reg1'};
test('official report preserves unknown game status, injury and publication date',()=>{assert.deepEqual(parseInjuries(html,config),[{team:'NE',playerName:'A.J. Example',position:'RB',status:null,injury:null,practice:'Limited Participation in Practice',sourceUrl:config.sourceUrl,reportedAt:null}]);});
test('official page from a different week or year is rejected',()=>{assert.throws(()=>parseInjuries(html,{...config,week:2}),/mismatch/);assert.throws(()=>parseInjuries(html,{...config,season:2025}),/mismatch/);});
test('same name on different teams or ambiguous same-team rows cannot leak',()=>{const rows=parseInjuries(html,config),p={name:'AJ Example',team:'NE',positions:['RB']};assert.equal(matchOfficialInjury(p,rows),rows[0]);assert.equal(matchOfficialInjury({...p,team:'NYJ'},rows),null);assert.equal(matchOfficialInjury({...p,positions:['WR']},rows),null);assert.equal(matchOfficialInjury(p,[...rows,...rows]),null);assert.equal(matchOfficialInjury({...p,name:'AJ Example Jr.'},rows),null);});
test('Melbourne outdoor event overrides erroneous dome metadata; retractable operation remains unknown',()=>{assert.equal(roofFor({fullName:'Melbourne Cricket Ground',indoor:false},'MEL00'),'outdoors');assert.equal(roofFor({indoor:true},'IND00'),'retractable-unknown');assert.equal(roofFor({indoor:false},'LAX01'),'covered-open-sides');assert.equal(roofFor({},'NEW00'),'unknown');assert.equal(roofFor({indoor:true},'NEW00'),'unknown');assert.equal(roofFor({indoor:true},'DAL00'),'retractable-unknown');});
const kickoff=Date.parse('2026-09-10T00:20:00Z');
const data={hourly:{time:[Date.parse('2026-09-10T00:00:00Z')/1000],temperature_2m:[63],precipitation:[0],precipitation_probability:[10],wind_speed_10m:[6],wind_gusts_10m:[11]}};
test('weather selects UTC kickoff hour with explicit units and handles zero rainfall',()=>{assert.equal(kickoffWeather(data,kickoff,'outdoors').temperatureF,63);assert.equal(kickoffWeather(data,kickoff,'outdoors').precipitationIn,0);assert.equal(kickoffWeather(data,kickoff,'retractable-unknown').exposure,'roof/exposure uncertain');});
test('indoor weather suppressed and missing/out-of-range hourly observations stay unknown',()=>{assert.equal(kickoffWeather(data,kickoff,'indoor'),null);assert.equal(kickoffWeather(data,kickoff+86400000,'outdoors'),null);assert.equal(kickoffWeather({hourly:{...data.hourly,wind_gusts_10m:[null]}},kickoff,'outdoors'),null);assert.equal(kickoffWeather(null,kickoff,'outdoors'),null);});

test('historical or future cutoffs require an archived snapshot before any live request',async()=>{
  let fetched=false;const fetchSource=async()=>{fetched=true;throw new Error('unexpected fetch');};
  await assert.rejects(collectEnvironment({season:2026,week:1,now:Date.now()-120000,fetchSource}),/archived/);
  await assert.rejects(collectEnvironment({season:2026,week:1,now:Date.now()+120000,fetchSource}),/archived/);
  assert.equal(fetched,false);
});
test('explicit cutoff rejects source observations even one millisecond after cutoff',async()=>{
  const now=Date.now();const result=await collectEnvironment({season:2026,week:2,now,fetchSource:async()=>({fetchedAt:new Date(now+1).toISOString(),data:''})});
  assert.equal(result.games.length,0);assert.equal(result.injuries.length,0);
  assert.ok(result.sources.every(s=>s.status==='missing'&&s.note.includes('after the requested cutoff')));
});
test('ordinary collection accepts observations collected after collection starts',async()=>{
  const before=Date.now();const fetchSource=async(url)=>{
    await new Promise(resolve=>setTimeout(resolve,3));
    return {url,fetchedAt:new Date().toISOString(),data:url.includes('scoreboard')?{season:{year:2026},week:{number:2},events:[]}:url.includes('injuries')?html.replace('Week 1','Week 2'):''};
  };
  const result=await collectEnvironment({season:2026,week:2,fetchSource});
  assert.ok(result.sources.every(s=>s.status==='ok'));
  assert.ok(result.sources.every(s=>Date.parse(s.fetchedAt)>before&&Date.parse(s.fetchedAt)<=Date.parse(result.generatedAt)));
});
