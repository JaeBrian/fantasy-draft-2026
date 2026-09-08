import {teamCode} from './data.mjs';
const number=x=>x!==''&&x!=null&&Number.isFinite(Number(x))?Number(x):null;
const corner=p=>/CB|NB/.test(p||'');
export function defenderPerformance(rows,identities,{season,week}){
 const ids=new Map(identities.filter(r=>r.pfr_id&&r.gsis_id).map(r=>[r.pfr_id,r]));const groups=new Map();const seen=new Set();
 for(const r of rows){const y=Number(r.season),w=Number(r.week);if(r.game_type!=='REG'||y<season-1||y>season||w<1||w>18||(y===season&&w>=week))continue;const person=ids.get(r.pfr_player_id);if(!person)continue;
 const fields=['def_targets','def_completions_allowed','def_yards_allowed','def_receiving_td_allowed'];if(fields.some(k=>number(r[k])===null)||+r.def_targets<0||+r.def_completions_allowed<0||+r.def_receiving_td_allowed<0||+r.def_completions_allowed>+r.def_targets)continue;
 const gameKey=person.gsis_id+':'+y+':'+(r.game_id||w);if(seen.has(gameKey))continue;seen.add(gameKey);
 const key=person.gsis_id+':'+y;const g=groups.get(key)||{gsisId:person.gsis_id,position:person.position,season:y,games:0,targets:0,completions:0,yards:0,touchdowns:0};g.games++;g.targets+=+r.def_targets;g.completions+=+r.def_completions_allowed;g.yards+=+r.def_yards_allowed;g.touchdowns+=+r.def_receiving_td_allowed;groups.set(key,g);
 }
 const result={};for(const id of new Set([...groups.values()].map(g=>g.gsisId))){const current=groups.get(id+':'+season),prior=groups.get(id+':'+(season-1));const g=current?.targets>=30?current:prior??current;if(!g||g.targets<=0)continue;
 const cohort=[...groups.values()].filter(x=>x.season===g.season&&corner(x.position)&&x.targets>=30);const yardsPerTarget=g.yards/g.targets;
 const percentile=g.targets>=30&&corner(g.position)&&cohort.length>=20?100*cohort.filter(x=>x.yards/x.targets>yardsPerTarget).length/cohort.length:null;
 result[id]={season:g.season,games:g.games,targets:g.targets,completionRate:g.completions/g.targets,yardsPerTarget,touchdowns:g.touchdowns,lowerYardagePercentile:percentile,cohortSize:cohort.length,currentSeasonTargets:current?.targets??0,interpretation:'Percentile compares yards allowed per targeted pass among corners with at least 30 targets. Higher is lower yardage allowed. This is observed coverage performance, not an overall talent grade; assignments, opponents and scheme affect it.'};
 }return result;
}
export function estimateMatchups(people,teams,schedule,performance,{season,week}){
 const opponents=new Map();for(const e of schedule.events||[]){if(e.season?.year!==season||e.season?.type!==2||e.week?.number!==week)continue;const t=e.competitions?.[0]?.competitors?.map(c=>teamCode(c.team?.abbreviation));if(t?.length===2&&t.every(Boolean)&&t[0]!==t[1]){opponents.set(t[0],t[1]);opponents.set(t[1],t[0]);}}
 const result={};for(const[id,p]of Object.entries(people)){if(!['WR','TE'].includes(p.position))continue;const opponent=opponents.get(teamCode(p.team)),defense=teams[opponent];if(!opponent||defense?.status!=='available')continue;
 const starters=defense.defensivePersonnel.filter(d=>d.rank===1);const candidates=starters.filter(d=>corner(d.position));if(!candidates.length)continue;
 const scenarios=[{label:'If aligned outside',roles:['LCB','RCB','CB'],explanation:'Outside routes can encounter either boundary corner; motion, sides and zone responsibilities change the matchup.'},{label:'If aligned in the slot',roles:['NB','NCB','SCB'],explanation:'Interior routes can encounter the nickel corner, with safety/linebacker help and zone handoffs.'}].map(s=>({label:s.label,explanation:s.explanation,defenders:candidates.filter(d=>s.roles.includes(d.position)).map(d=>({name:d.name,position:d.position,gsisId:d.gsisId,performance:performance[d.gsisId]??null}))}));
 result[id]={opponent,confidence:'low',method:'Depth-chart alignment scenarios',observedAt:defense.observedAt,receiverAlignment:'Receiver route shares are unverified',shadow:'No verified current shadow assignment',scenarios,notes:['WR1/WR2 is a team role, not a one-to-one coverage assignment.','These are estimated defender groups conditional on receiver alignment. Route-share probabilities and numerical fantasy adjustments are not estimated.','A missing nickel listing does not imply that an outside corner will cover every slot route.']};
 }return result;
}
