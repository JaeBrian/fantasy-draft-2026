import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
execFileSync('npx',['esbuild','src/lib/weekly/snapshot.ts','--bundle','--platform=node','--format=cjs','--outfile=.simcache/weekly-snapshot.cjs','--log-level=error']);
const {parseWeeklySnapshot}=require('../../.simcache/weekly-snapshot.cjs');
const ownerIds=['1257818921076002816','1133862962869055488','1133884337847582720'];
function fixture(){return {
 draft:{draft_id:'1389372699129700353',league_id:'1389372699129700352',status:'pre_draft'},
 league:{league_id:'1389372699129700352',season:'2026',name:'League',total_rosters:12,roster_positions:['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF',...Array(6).fill('BN')],scoring_settings:{rec:0.5,pass_td:4},settings:{playoff_week_start:15}},
 rosters:Array.from({length:12},(_,i)=>({roster_id:i+1,owner_id:ownerIds[i]??'owner'+i,players:null,starters:[],reserve:[]})),
 users:ownerIds.map((id,i)=>({user_id:id,display_name:i===2?'Brian':'user'+i})),
 };}
let f=fixture(),s=parseWeeklySnapshot(f,'2026-09-07T00:00:00Z');
assert.equal(s.stage,'waiting');assert.equal(s.managers[2].rosterId,3);
f.users.push({user_id:'different-brian',display_name:'Brian'});
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').managers[2].userId,ownerIds[2]);
f.rosters[2].owner_id='other';f.rosters[2].co_owners=[ownerIds[2]];
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').managers[2].rosterId,3);
f.rosters[0].players=['a'];f.draft.status='drafting';
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').stage,'drafting');
f.draft.status='complete';
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').stage,'incomplete');
f.rosters.forEach((r,i)=>{r.players=['p'+i]});
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').stage,'rosters-ready');
f.rosters[2].co_owners=[];
assert.equal(parseWeeklySnapshot(f,'2026-09-07T00:00:00Z').stage,'incomplete');
f=fixture();f.draft.league_id='test';assert.throws(()=>parseWeeklySnapshot(f,''),/real league/);
f=fixture();f.league.scoring_settings.rec=1;assert.throws(()=>parseWeeklySnapshot(f,''),/format/);
f=fixture();f.rosters.pop();assert.throws(()=>parseWeeklySnapshot(f,''),/12/);
f=fixture();f.rosters[1].roster_id=1;assert.throws(()=>parseWeeklySnapshot(f,''),/Duplicate/);
f=fixture();f.rosters[0].players=['x'];f.rosters[1].players=['x'];assert.throws(()=>parseWeeklySnapshot(f,''),/multiple rosters/);
f=fixture();f.rosters[0].players=['a'];f.rosters[0].starters=['b'];assert.throws(()=>parseWeeklySnapshot(f,''),/unowned/);
console.log('PASS: real league boundary, owner identity/co-owners, incomplete drafts, duplicate IDs and roster validation');
