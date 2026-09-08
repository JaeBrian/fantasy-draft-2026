import test from 'node:test';
import assert from 'node:assert/strict';
import {exactScore,easternKickoff,csvRows,validateProjections} from './data.mjs';
import {makePlayer} from './project.mjs';
import {evaluate} from './backtest.mjs';
test('exact components and incomplete kicker scoring',()=>{
 assert.equal(exactScore({rec:4,rec_yd:60,rec_td:1},{rec:.5,rec_yd:.1,rec_td:6},'WR').mean,14);
 assert.equal(exactScore({fgm:1.63,fgm_20_29:.25,fgm_30_39:.44,fgm_40_49:.4},{fgm_20_29:3,fgm_30_39:3,fgm_40_49:4,fgm_50_59:5,fgm_60p:6},'K').mean,null);
 assert.equal(exactScore({fgm:2,fga:3,fgm_50_59:1,fgm_60p:1},{fgm_50_59:5,fgm_60p:6,fgmiss:-1},'K').mean,10);
 assert.equal(exactScore({pts_allow_1_6:1,sack:3},{pts_allow_1_6:7,sack:1},'DEF').mean,10);
});
test('injury applies only current week; missing stays null; explicit bye zero',()=>{
 const p={position:'WR',team:'BUF',injury_status:'IR'},row={stats:{rec:4}};
 const make=(r,w,bye=false)=>makePlayer('x',p,r,{opponent:'NYJ'},bye,w,1,{rec:.5},{WR:[-1,0,1]});
 assert.equal(make(row,1).mean,0);assert.equal(make(row,2).mean,2);assert.equal(make(null,2).mean,null);assert.equal(make(null,2,true).mean,0);
});
test('Eastern kickoff DST and CSV quoting',()=>{
 assert.equal(easternKickoff('2026-09-09','20:20'),Date.parse('2026-09-10T00:20:00Z'));
 assert.equal(easternKickoff('2026-12-01','20:20'),Date.parse('2026-12-02T01:20:00Z'));assert.equal(easternKickoff('2026-12-01',''),null);
 assert.deepEqual(csvRows('a,b\n1,"a,b"\n'),[{a:'1',b:'a,b'}]);
});
test('reject truncated response',()=>assert.throws(()=>validateProjections([],'2026',1),/Incomplete/));
test('heldout outlier excluded from calibration',()=>{
 const result=evaluate([...Array.from({length:30},()=>({position:'WR',week:1,prediction:10,actual:11,trailing:null})),{position:'WR',week:11,prediction:10,actual:100,trailing:5}]);
 assert.deepEqual(result.residuals.WR,Array(30).fill(1));assert.equal(result.baseline.mae,90);assert.equal(result.ablation.trailingThreeGames.mae,95);
});
test('kicker bounds preserve unknown distance split',async()=>{
 const {kickerBounds}=await import('./data.mjs');const rules={fgm_0_19:3,fgm_20_29:3,fgm_30_39:3,fgm_40_49:4,fgm_50_59:5,fgm_60p:6,xpm:1,xpmiss:-1,fgmiss:-1};
 const stats={fgm:1.63,fga:1.98,fgm_0_19:.05,fgm_20_29:.25,fgm_30_39:.44,fgm_40_49:.4,xpm:2.39,xpmiss:.12};const bound=kickerBounds(stats,rules);
 assert.ok(Math.abs(bound.high-bound.low-.49)<1e-9);assert.equal(bound.components.fgmiss,1.98-1.63);
 delete stats.fgm_0_19;const broader=kickerBounds(stats,rules);assert.ok(Math.abs(broader.high-broader.low-1.62)<1e-9);
 const player=makePlayer('k',{position:'K',team:'NE'}, {stats}, {opponent:'SEA'},false,1,1,rules,{});assert.equal(player.mean,broader.low);assert.equal(player.projectionBounds.high,broader.high);assert.equal(player.p90,null);
});
test('mismatched projection team remains unknown',()=>{
 const p=makePlayer('x',{position:'WR',team:'BUF'},{team:'NYJ',stats:{rec:5}},{opponent:'MIA'},false,1,1,{rec:.5},{});
 assert.equal(p.mean,null);assert.match(p.evidence.join(' '),/differs/);
});
