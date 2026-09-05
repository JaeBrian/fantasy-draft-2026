import assert from 'node:assert/strict';
import { scoreStats, validateLeague } from './league-scoring.mjs';
const rules={pass_yd:0.04,pass_td:4,pass_int:-2,rush_yd:0.1,rush_td:6,rec_yd:0.1,rec_td:6,rec:0.5,fum_lost:-2,pass_2pt:2,rush_2pt:2,rec_2pt:2};
const purdy={pass_yd:255.92,pass_td:1.74,pass_int:0.82,rush_yd:13.76,rush_td:0.19,fum_lost:0.18,pass_2pt:0.1,rush_2pt:0.01,pts_half_ppr:21.23};
assert.ok(Math.abs(scoreStats(purdy,rules)-17.9328)<1e-8);
assert.equal(scoreStats({pass_yd:250,pass_td:2,pass_int:1,rush_yd:20},rules),18);
assert.equal(scoreStats({rec:5,rec_yd:70,rec_td:1,fum_lost:1},rules),13.5);
assert.equal(scoreStats({rec:5,rec_yd:70,rec_td:1,fum_lost:1},{...rules,rec:1}),16);
assert.equal(scoreStats({},rules),0);
assert.throws(()=>scoreStats({pass_yd:NaN},rules));
console.log('PASS: league scoring, missing stats, format changes, invalid values');

const draft={type:'snake',settings:{rounds:16,teams:12}};
const league={season:'2026',total_rosters:12,scoring_settings:rules,roster_positions:['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF',...Array(6).fill('BN')]};
validateLeague(draft,league);
assert.throws(()=>validateLeague({...draft,type:'auction'},league));
assert.throws(()=>validateLeague(draft,{...league,roster_positions:[...league.roster_positions,'SUPER_FLEX']}));
