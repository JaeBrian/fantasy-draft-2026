import test from 'node:test';
import assert from 'node:assert/strict';
import {receivingContexts, validateCoverageInput, defensivePersonnel, marketContext} from './coverage.mjs';
const now=Date.parse('2026-09-07T20:00:00Z');
test('NGS maps stable identifiers and excludes current/future weeks and aggregate rows',()=>{
 const rows=[{season:'2025',week:'1',season_type:'REG',player_gsis_id:'g1',targets:'10',avg_separation:'3'},{season:'2026',week:'1',season_type:'REG',player_gsis_id:'g1',targets:'5',avg_separation:'9'},{season:'2025',week:'0',season_type:'REG',player_gsis_id:'g1',targets:'100',avg_separation:'99'}];
 const result=receivingContexts(rows,[{gsis_id:'g1',espn_id:'e1'}],{'s1':{espn_id:'e1',position:'WR'}},{season:2026,week:1});
 assert.equal(result.s1.receivingContext.avgSeparation,3);assert.equal(result.s1.receivingContext.contextType,'prior-season');assert.equal(result.s1.receivingContext.targets,10);
 assert.deepEqual(receivingContexts(rows,[],{}, {season:2026,week:1}),{});
});
test('licensed assignments require fresh dated evidence, known IDs and normalized weights',()=>{
 const input={season:2026,week:1,source:'https://example.com/licensed',observedAt:'2026-09-07T12:00:00Z',players:[{playerId:'s1',coverageAssignments:[{defenderId:'d1',weight:1,support:'Charted alignment',alignment:'outside'}]}]};
 const opts={season:2026,week:1,now,people:{s1:{position:'WR',team:'MIN'},d1:{position:'CB',team:'GB'}},schedule:{events:[{season:{year:2026,type:2},week:{number:1},competitions:[{competitors:[{team:{abbreviation:'MIN'}},{team:{abbreviation:'GB'}}]}]}]}};
 assert.equal(validateCoverageInput(input,opts).players.length,1);
 for(const change of [{observedAt:'2026-08-01T00:00:00Z'},{observedAt:'2026-09-08T00:00:00Z'},{week:2},{players:[{playerId:'missing',coverageAssignments:[]}]}])assert.throws(()=>validateCoverageInput({...input,...change},opts));
 const bad=structuredClone(input);bad.players[0].coverageAssignments[0].weight=.5;assert.throws(()=>validateCoverageInput(bad,opts));
});
test('depth chart selects latest pre-cutoff observation and does not assert coverage assignment',()=>{
 const rows=[{dt:'2026-09-07T10:00:00Z',team:'LA',pos_abb:'LCB',player_name:'Corner',pos_rank:'1',pos_grp:'Base 3-4 D'},{dt:'2026-09-08T00:00:00Z',team:'LA',pos_abb:'LCB',player_name:'Future',pos_rank:'1'}];
 assert.equal(defensivePersonnel(rows,now).LAR.defensivePersonnel[0].name,'Corner');assert.equal(defensivePersonnel(rows,now).LAR.projectedAssignmentsAvailable,false);
});
test('market excludes wrong week and returns explicit absence',()=>{
 assert.equal(marketContext({events:[]},{season:2026,week:1,now}).available,false);
 const game={id:'1',season:{year:2026,type:2},week:{number:2},competitions:[{odds:[{overUnder:45}]}]};assert.equal(marketContext({events:[game]},{season:2026,week:1,now}).games.length,0);
});
test('collector tolerates unavailable feeds and rejects future source observations',async()=>{
 const {collectCoverage}=await import('./coverage.mjs');
 const missing=await collectCoverage({season:2026,week:1,now,coverageInput:null,fetchSource:async()=>{throw new Error('offline');}});
 assert.deepEqual(missing.players,{});assert.equal(missing.sources.length,5);assert.equal(missing.market.available,false);
 const future=await collectCoverage({season:2026,week:1,now,coverageInput:null,fetchSource:async()=>({fetchedAt:'2026-09-09T00:00:00Z',data:''})});
 assert.ok(future.sources.every(s=>s.status==='unavailable'));
});

test('licensed assignments reject self, offensive defenders, teammates and unscheduled opponents',()=>{
 const input={season:2026,week:1,source:'https://example.com/coverage',observedAt:'2026-09-07T12:00:00Z',players:[{playerId:'wr',coverageAssignments:[{defenderId:'cb',weight:1,alignment:'outside',support:'Charted matchup'}]}]};
 const people={wr:{position:'WR',team:'MIN'},cb:{position:'CB',team:'GB'}};
 const schedule={events:[{season:{year:2026,type:2},week:{number:1},competitions:[{competitors:[{team:{abbreviation:'MIN'}},{team:{abbreviation:'GB'}}]}]}]};
 const opts={season:2026,week:1,now,people,schedule};assert.equal(validateCoverageInput(input,opts).players.length,1);
 for(const cb of [{position:'WR',team:'GB'},{position:'CB',team:'MIN'},{position:'CB',team:'CHI'}])assert.throws(()=>validateCoverageInput(input,{...opts,people:{...people,cb}}));
 assert.throws(()=>validateCoverageInput(input,{...opts,schedule:{events:[]}}));
 assert.throws(()=>validateCoverageInput(input,{...opts,people:{...people,wr:{position:'QB',team:'MIN'}}}));
 const self=structuredClone(input);self.players[0].coverageAssignments[0].defenderId='wr';assert.throws(()=>validateCoverageInput(self,opts));
});
test('depth observations older than 48 hours are stale and withhold personnel',()=>{
 const result=defensivePersonnel([{dt:'2026-09-04T12:00:00Z',team:'GB',pos_abb:'CB',pos_grp:'Base 4-3 D',player_name:'Old corner',pos_rank:'1'}],now);
 assert.equal(result.GB.status,'stale');assert.deepEqual(result.GB.defensivePersonnel,[]);assert.match(result.GB.note,/48 hours/);
});
