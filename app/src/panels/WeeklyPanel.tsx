import {useEffect,useMemo,useState} from 'react';
import {WeeklyControls} from '../components/WeeklyControls';
import {WeeklyResearch,PlayerResearchCard} from '../components/WeeklyResearch';
import {WeeklyEvidence} from '../components/WeeklyEvidence';
import {useWeeklyWorkspace} from '../lib/weekly/workspace';
import {analysisBlock} from '../lib/weekly/readiness';
import {useAnalysis} from '../lib/weekly/useAnalysis';
import {MANAGERS} from '../lib/weekly/config';
import type {buildLineupReport} from '../lib/weekly/report';
import type {LineupResult,WeeklyPlayer} from '../lib/weekly/types';
const points=(v:number|null|undefined)=>v==null?'—':v.toFixed(1);
export function LineupTable({lineup,players}:{lineup:LineupResult;players:Record<string,WeeklyPlayer>}) {
 return <><div className="weekly-table"><table><thead><tr><th>Slot</th><th>Player / matchup</th><th>Forecast</th></tr></thead><tbody>{lineup.assignments.map(a=>{const p=a.playerId?players[a.playerId]:null;return <tr key={a.index}><td>{a.slot}{a.locked?' · Locked':''}</td><td>{p?.name??a.playerId??'Empty slot'}{p&&<small>{p.team} vs {p.opponent??'TBD'} · {p.kickoff?new Date(p.kickoff).toLocaleString():'Kickoff unknown'} · {p.status??p.availability}</small>}{p?.research&&<details><summary>Why this forecast?</summary><PlayerResearchCard player={p}/></details>}</td><td>{points(a.mean)}{p?.projectionBounds&&<small>Bound {points(p.projectionBounds.low)}–{points(p.projectionBounds.high)}</small>}</td></tr>})}</tbody></table></div>{!lineup.complete&&<p role="status">Incomplete forecast: {lineup.issues.join(' ')}</p>}</>;
}
export function WeeklyPanel(){
 const w=useWeeklyWorkspace();const[selected,setSelected]=useState<string>(MANAGERS[0].userId);
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const tick=()=>setNow(Date.now());const timer=setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 const manager=w.saved?.snapshot.managers.find(m=>m.userId===selected);
 const block=analysisBlock(w.saved,w.dataset,w.week,now);
 const input=useMemo(()=>{
  if(block||!w.saved||!w.dataset||manager?.rosterId==null)return null;
  const matchup=w.saved.matchupWeek===w.week?w.saved.matchups.find(m=>m.rosterId===manager.rosterId):undefined;
  const opponent=matchup?.matchupId!=null?w.saved.matchups.find(m=>m.matchupId===matchup.matchupId&&m.rosterId!==manager.rosterId):undefined;
  const snapshot={...w.saved.snapshot,rosters:w.saved.snapshot.rosters.map(r=>({...r,starterSlots:w.saved!.matchupWeek===w.week?w.saved!.matchups.find(m=>m.rosterId===r.rosterId)?.starters??[]:[]}))};
  return{dataset:w.dataset,snapshot,rosterId:manager.rosterId,week:w.week,now,currentStarters:matchup?.starters??[],opponentRosterId:opponent?.rosterId};
 },[block,w.saved,w.dataset,w.week,manager?.rosterId,now]);
 const {result:r,busy,error}=useAnalysis<ReturnType<typeof buildLineupReport>>('lineup',input);
 const players=w.dataset?.weeks[w.week]?.players??{};const name=(id:string|null)=>id?players[id]?.name??id:'Empty slot';
 return <div className="weekly-workspace"><h2>Weekly lineup</h2><p>Choose the strongest legal lineup for Emily, Ashley or Brian using your league’s scoring and the latest published weekly forecasts.</p><WeeklyControls workspace={w} selected={selected} onSelect={setSelected}/>{block&&<section className="weekly-section"><h3>Before recommendations</h3><p>{block}</p></section>}{w.saved?.warning&&<p>{w.saved.warning}</p>}{busy&&<p role="status">Comparing legal lineups and running 20,000 paired simulations…</p>}{error&&<p role="alert">{error}</p>}
 {r&&<><div className="weekly-grid"><section className="weekly-section"><h3>Recommended lineup · {r.recommended.complete?points(r.recommended.total):'Incomplete'} projected points</h3><p>Projection totals exclude live scoring. Confirm official inactive reports before kickoff.</p><LineupTable lineup={r.recommended} players={players}/></section><section className="weekly-section"><h3>Saved starting lineup</h3><LineupTable lineup={r.current} players={players}/></section></div>
 <section className="weekly-section"><h3>Start / sit decisions</h3>{r.swaps.length?r.swaps.map(s=><p key={s.index}><strong>{s.startId?`Set ${s.slot} to ${name(s.startId)}`:`No safe eligible starter for ${s.slot}`}</strong>; previous player in this slot: {name(s.sitId)}. {s.expectedGain!==null?`${s.expectedGain>=0?'+':''}${points(s.expectedGain)} projected points.`:'Point gain unavailable: current lineup or scoring is incomplete.'}</p>):<p>Your saved lineup matches the recommended assignment.</p>}
 <p>Simulation status: {r.comparison.status}. {r.comparison.probabilityImproves!==null?`${(r.comparison.probabilityImproves*100).toFixed(1)}% of simulated outcomes favor the recommended lineup (${r.comparison.draws.toLocaleString()} draws).`:''}</p>{r.comparison.opponentWin&&<p>Experimental matchup win estimate: {(100*r.comparison.opponentWin.baseline).toFixed(1)}% → {(100*r.comparison.opponentWin.recommended).toFixed(1)}%.</p>}{r.pairwise&&<p>Closest bench comparison: {name(r.pairwise.startId)} versus {name(r.pairwise.sitId)}. {r.pairwise.comparison.probabilityImproves!==null?`${(100*r.pairwise.comparison.probabilityImproves).toFixed(1)}% simulated probability the recommended starter outscores the bench alternative.`:'Probability unavailable.'}</p>}{r.comparison.limitations.map(t=><p key={t}><small>{t}</small></p>)}</section>
 <div className="weekly-grid"><section className="weekly-section"><h3>Bench evidence</h3>{r.bench.map(p=><details key={p.id}><summary>{p.name} · {points(p.mean)} points · {p.availability}</summary><p>{p.team} vs {p.opponent??'TBD'} · {p.status??'No injury designation'}</p><ul>{p.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul></details>)}</section><section className="weekly-section"><h3>Injury backup plans</h3>{r.contingencies.length?r.contingencies.map(c=><details key={c.playerId}><summary>If {name(c.playerId)} is inactive</summary><p>{c.note} {c.deadline?`Decide before ${new Date(c.deadline).toLocaleString()}.`:''}</p><LineupTable lineup={c.lineup} players={players}/></details>):<p>No flagged starter contingency in the current feed. Check official game-day status before kickoff.</p>}<h3>Waiver alternatives</h3>{r.waivers.map(a=><p key={a.player.id}>{a.player.name}: {points(a.expectedGain)} potential lineup points. Requires an available roster spot or a separate drop decision.</p>)}{!r.waivers.length&&<p>No eligible improvement found in the evaluated waiver shortlist.</p>}</section></div><details className="weekly-section"><summary>Recommendation notes</summary>{r.warnings.map((t,i)=><p key={i}>{t}</p>)}</details></>}
 {w.dataset&&<><WeeklyResearch dataset={w.dataset} week={w.week} rosterIds={manager?.players}/><WeeklyEvidence dataset={w.dataset}/></>}</div>;
}
