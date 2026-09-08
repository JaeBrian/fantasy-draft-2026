import { MANAGERS } from '../lib/weekly/config';
import type { useWeeklyWorkspace } from '../lib/weekly/workspace';
export function WeeklyControls({workspace:w,selected,onSelect}:{workspace:ReturnType<typeof useWeeklyWorkspace>;selected:string;onSelect:(id:string)=>void}) {
  return <>
    <div className="weekly-controls"><div className="weekly-managers" role="group" aria-label="Manager">{MANAGERS.map(m=><button className="btn" type="button" key={m.userId} aria-pressed={selected===m.userId} onClick={()=>onSelect(m.userId)}>{m.name}</button>)}</div><label>Week <select aria-label="NFL week" value={w.week} onChange={e=>w.setWeek(Number(e.target.value))}>{Array.from({length:18},(_,i)=><option value={i+1} key={i+1}>{i+1}</option>)}</select></label></div>
    <section className="live-sync-card" aria-label="Roster and forecast status"><div className="live-sync-heading"><strong role="status">{w.checking ? 'Updating roster…' : w.error ? 'Roster update failed' : w.saved ? 'Saved roster snapshot' : 'Load your roster'}</strong><button type="button" className="btn" disabled={w.checking} onClick={w.updateRoster}>Update roster</button></div>
      <p>{w.saved ? `Roster checked ${new Date(w.saved.snapshot.checkedAt).toLocaleString()} · ${w.saved.snapshot.rosteredPlayers} players across the league` : 'Click Update roster to load Emily, Ashley and Brian’s real league.'}</p>
      <small>Roster updates are manual only. The saved snapshot stays on this device until you update it.</small>
      {w.error&&<p role="alert">{w.error}. Click Update roster to retry.</p>}
      <div className="weekly-feed-row"><span>{w.dataset ? `Forecast data: ${new Date(w.dataset.generatedAt).toLocaleString()} · ${w.dataset.modelVersion}` : w.loading ? 'Loading forecast data…' : 'Forecast data unavailable'}</span><button className="btn subtle" type="button" disabled={w.loading} onClick={w.reloadAnalysis}>Reload forecasts</button></div>
      {w.dataset?.sources.some(s=>s.status==='stale')&&<p>Some upstream forecasts have older update dates. Future-week and trade results are exploratory scenarios; review the source dates below.</p>}
      <small>Reload forecasts reads the latest published model file. It does not update your roster.</small>
      {w.dataError&&<p role="alert">{w.dataError}</p>}
    </section>
  </>;
}
