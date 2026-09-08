import test from 'node:test';
import assert from 'node:assert/strict';
import {defenderPerformance,estimateMatchups} from './estimated-coverage.mjs';
const opts={season:2026,week:2};
const identities=[{pfr_id:'p',gsis_id:'g',position:'CB'}];
const row=(overrides={})=>({pfr_player_id:'p',season:2025,week:1,game_type:'REG',def_targets:40,def_completions_allowed:20,def_yards_allowed:200,def_receiving_td_allowed:1,...overrides});
test('coverage uses weighted totals, deduplicates games and excludes future and postseason',()=>{
 const r=defenderPerformance([row(),row(),row({week:2,def_targets:10,def_completions_allowed:8,def_yards_allowed:100}),row({season:2026,week:2}),row({game_type:'POST',week:3}),row({week:4,def_targets:''})],identities,opts).g;
 assert.equal(r.targets,50);assert.equal(r.games,2);assert.equal(r.yardsPerTarget,6);assert.equal(r.completionRate,.56);assert.equal(r.lowerYardagePercentile,null);
});
test('current sample needs 30 targets before replacing prior context; unknown IDs stay missing',()=>{
 assert.equal(defenderPerformance([row(),row({season:2026,def_targets:20})],identities,opts).g.season,2025);
 assert.equal(defenderPerformance([row(),row({season:2026,def_targets:30})],identities,opts).g.season,2026);
 assert.deepEqual(defenderPerformance([row()],[],opts),{});
});
test('percentile compares qualifying corners and preserves small-sample uncertainty',()=>{
 const ids=Array.from({length:20},(_,i)=>({pfr_id:'p'+i,gsis_id:'g'+i,position:'CB'}));
 const rows=ids.map((p,i)=>row({pfr_player_id:p.pfr_id,def_yards_allowed:200+i*10}));
 assert.equal(defenderPerformance(rows,ids,opts).g0.lowerYardagePercentile,95);
 assert.equal(defenderPerformance(rows.slice(1),ids,opts).g1.lowerYardagePercentile,null);
});
const schedule={events:[{season:{year:2026,type:2},week:{number:2},competitions:[{competitors:[{team:{abbreviation:'MIN'}},{team:{abbreviation:'GB'}}]}]}]};
const people={wr:{team:'MIN',position:'WR'},te:{team:'MIN',position:'TE'},rb:{team:'MIN',position:'RB'}};
const teams={GB:{status:'available',observedAt:'2026-09-07',defensivePersonnel:[{name:'Left',gsisId:'l',position:'LCB',rank:1},{name:'Right',position:'RCB',rank:1},{name:'Nickel',position:'NB',rank:1},{name:'Backup',position:'LCB',rank:2}]}};
test('scenarios separate boundary and nickel roles without inventing receiver assignments',()=>{
 const r=estimateMatchups(people,teams,schedule,{},opts);assert.deepEqual(Object.keys(r),['wr','te']);
 assert.deepEqual(r.wr.scenarios[0].defenders.map(d=>d.name),['Left','Right']);assert.deepEqual(r.wr.scenarios[1].defenders.map(d=>d.name),['Nickel']);assert.equal(r.wr.confidence,'low');assert.equal(r.wr.scenarios[0].defenders[0].performance,null);
});
test('stale personnel and wrong-week schedules withhold estimates',()=>{
 assert.deepEqual(estimateMatchups(people,{GB:{...teams.GB,status:'stale'}},schedule,{},opts),{});
 assert.deepEqual(estimateMatchups(people,teams,schedule,{}, {...opts,week:3}),{});
});
