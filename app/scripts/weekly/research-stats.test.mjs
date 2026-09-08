import test from 'node:test';
import assert from 'node:assert/strict';
import {beforeCutoff,playerMapping,snapshotFeatures,teamFeatures,leaguePoints} from './research-stats.mjs';
const game={home_score:'10',away_score:'20',gameday:'2025-09-07',gametime:'13:00'};
test('event cutoff excludes target week, unfinished scores and same-day games',()=>{
 const games=new Map([['g',game]]),row={season:'2025',week:'1',season_type:'REG',game_id:'g'};
 assert.equal(beforeCutoff(row,{season:2025,week:2,now:'2025-09-09'},games),true);
 assert.equal(beforeCutoff(row,{season:2025,week:2,now:'2025-09-09'},new Map([['g',{...game,gametime:''}]])),false);
 assert.equal(beforeCutoff(row,{season:2025,week:1,now:'2025-09-09'},games),false);
 assert.equal(beforeCutoff(row,{season:2025,week:2,now:'2025-09-07T18:00:00Z'},games),false);
 assert.equal(beforeCutoff(row,{season:2025,week:2,now:'2025-09-09'},new Map([['g',{...game,home_score:''}]])),false);
});
test('mapping requires stable identifier and birthday, never just a name',()=>{
 const people={a:{espn_id:123,birth_date:'2000-01-01',position:'WR'},b:{espn_id:456,birth_date:'2000-01-01',position:'WR'}};
 assert.deepEqual([...playerMapping(people,[{gsis_id:'gsis',espn_id:'123',birth_date:'2000-01-01',position:'WR'},{gsis_id:'wrong',espn_id:'456',birth_date:'1990-01-01',position:'WR'}])],[['gsis','a']]);
});
test('future outcomes cannot alter historical player features',()=>{
 const base={season:'2025',week:'1',season_type:'REG',game_id:'g',player_id:'p',team:'BUF',targets:'5'};
 const future={...base,week:'2',targets:'9999'};const input={games:new Map([['g',game]]),teamRows:[],playerRows:[base,future]};
 const s=snapshotFeatures(input,{season:2025,week:2,now:'2025-09-20'},{});assert.equal(s.players.p.features.targets,5);assert.equal(s.players.p.throughWeek,1);
 const prior=snapshotFeatures(input,{season:2026,week:1,now:'2026-09-01'},{});assert.equal(prior.players.p.seasonBasis,2025);assert.match(prior.players.p.evidence[0],/prior-season/);
});
test('opponent adjustment uses pregame offensive EPA only',()=>{
 const oppPrior={team:'B',opponent_team:'C',season:2025,week:1,game_id:'one',passing_epa:10,attempts:10,sacks_suffered:0,carries:10,rushing_epa:0};
 const defense={team:'A',opponent_team:'B',season:2025,week:2,game_id:'two'};const against={...oppPrior,week:2,game_id:'two',passing_epa:20};const future={...oppPrior,week:3,passing_epa:999};
 const a=teamFeatures([defense],[oppPrior,defense,against,future]);assert.equal(a.scheduleAdjustedPassEPA,1);assert.equal(a.defensivePassEPA,2);assert.equal(a.pressureRate,null);
});
test('league scoring maps receptions, turnovers, yards and touchdowns',()=>{assert.equal(leaguePoints({receptions:4,receiving_yards:70,receiving_tds:1,fumbles_lost_total:1},{rec:.5,rec_yd:.1,rec_td:6,fum_lost:-2}),13);});
