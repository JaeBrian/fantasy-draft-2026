import {useMemo,useState} from 'react';
import {WeeklyControls} from '../components/WeeklyControls';
import {WeeklyResearch} from '../components/WeeklyResearch';
import {WeeklyEvidence} from '../components/WeeklyEvidence';
import {useWeeklyWorkspace} from '../lib/weekly/workspace';
import {analysisBlock} from '../lib/weekly/readiness';
import {useAnalysis} from '../lib/weekly/useAnalysis';
import {MANAGERS} from '../lib/weekly/config';
import type {TradeInput,TradeReport} from '../lib/weekly/trades';
export function TradesPanel(){
 const w=useWeeklyWorkspace();const[selected,setSelected]=useState<string>(MANAGERS[0].userId);
 const block=analysisBlock(w.saved,w.dataset,w.week);
 const input=useMemo<TradeInput|null>(()=>{
  if(block||!w.saved||!w.dataset)return null;
  const s=w.saved.snapshot,manager=s.managers.find(m=>m.userId===selected);if(manager?.rosterId==null)return null;
  const now=Date.now();const currentWeek=Number(Object.keys(w.dataset.weeks).find(week=>Object.values(w.dataset!.weeks[week].players).some(p=>p.kickoff!==null&&p.kickoff+4*3600000>now))??18);
  return{dataset:w.dataset,rosters:s.rosters.map(r=>({rosterId:r.rosterId,owner:s.managers.find(m=>m.rosterId===r.rosterId)?.name??`Team ${r.rosterId}`,playerIds:r.players,reserveIds:r.reserve})),managerRosterId:manager.rosterId,slots:s.slots.filter(slot=>!['BN','IR'].includes(slot)),selectedWeek:w.week,currentWeek,tradeDeadline:typeof s.settings.trade_deadline==='number'?s.settings.trade_deadline:null,rosterLimit:s.slots.length,processingDays:typeof s.settings.trade_review_days==='number'?s.settings.trade_review_days:0,now,maxResults:6};
 },[block,w.saved,w.dataset,w.week,selected]);
 const {result:r,busy,error}=useAnalysis<TradeReport>('trades',input);
 const name=(id:string)=>w.dataset?.weeks[w.week]?.players[id]?.name??id;
 return <div className="weekly-workspace"><header className="weekly-title"><h2>Find your next upgrade.</h2><p>Trade ideas that address both teams’ needs. Review each package before making an offer.</p></header><WeeklyControls workspace={w} selected={selected} onSelect={setSelected}/>{block&&<section className="weekly-section"><p>{block}</p></section>}{busy&&<p role="status">Evaluating trade packages across future weeks. This may take a minute…</p>}{error&&<p role="alert">{error}</p>}
 {r&&<><p>{r.timing}</p>{r.blockedReasons.map(t=><p key={t} role="status">{t}</p>)}{!r.offers.length&&!r.blockedReasons.length&&<section className="weekly-section"><h3>No qualifying package</h3><p>No evaluated offer improves both teams beyond their waiver alternatives. The search uses a bounded shortlist, so this does not rule out every possible trade.</p></section>}
 {r.offers.map(o=><section className="weekly-section" key={o.id}><p className="eyebrow">{o.category.replaceAll('-',' ')} · {o.counterparty.owner}</p><h3>Receive {o.incoming.map(p=>p.name).join(' + ')}</h3><p>Offer {o.outgoing.map(p=>p.name).join(' + ')}</p><p>{o.categoryEvidence}</p><details><summary>Current-week evidence for this package</summary>{[...o.incoming,...o.outgoing].map(p=><div key={p.id}><strong>{p.name}</strong>{p.researchNotes?.length?p.researchNotes.map((n,i)=><p key={i}>{n}</p>):<p>Current research evidence unavailable.</p>}</div>)}</details><div className="weekly-grid">{[o.manager,o.counterparty].map(side=><div key={side.rosterId}><h4>{side.owner}</h4><p><strong>+{side.next3Gain.toFixed(1)}</strong> next 3 weeks · <strong>+{side.rosGain.toFixed(1)}</strong> remaining-season lineup points</p><p>{side.gainOverWaivers.toFixed(1)} points beyond evaluated waivers.</p><p>{side.needs.join(' · ')}</p>{side.baselineDrops.length>0&&<p>Activation drops also needed if holding: {side.baselineDrops.map(name).join(', ')}</p>}{side.drops.length>0&&<p>Required drops: {side.drops.map(name).join(', ')}</p>}{side.additions.length>0&&<p>Assumed additions: {side.additions.map(name).join(', ')}</p>}<details><summary>Weekly before / after</summary><div className="weekly-table"><table><thead><tr><th>Week</th><th>Before</th><th>After</th><th>Gain</th></tr></thead><tbody>{side.weeks.map(v=><tr key={v.week}><td>{v.week}</td><td>{v.before.total.toFixed(1)}</td><td>{v.after.total.toFixed(1)}</td><td>{v.gain.toFixed(1)}</td></tr>)}</tbody></table></div></details></div>)}</div><p>Tested price boundary: {o.maxPrice.playerIds.map(name).join(' + ')}. {o.maxPrice.explanation}</p><p>Sensitivity range: {o.sensitivity.low.toFixed(1)} to {o.sensitivity.high.toFixed(1)} points. {o.sensitivity.assumption}</p><details><summary>Trade assumptions and risks</summary>{o.risks.map(t=><p key={t}>{t}</p>)}</details></section>)}
 {r.watch.length>0&&<section className="weekly-section"><h3>Watch list</h3>{r.watch.map(p=><p key={p.playerId}><strong>{p.name}</strong> · {p.owner}: {p.reason}</p>)}</section>}</>}{w.dataset&&<><WeeklyResearch dataset={w.dataset} week={w.week} rosterIds={w.saved?.snapshot.managers.find(m=>m.userId===selected)?.players}/><WeeklyEvidence dataset={w.dataset}/></>}</div>;
}
