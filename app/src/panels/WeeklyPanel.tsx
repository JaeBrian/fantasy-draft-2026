import { useEffect, useState } from 'react';
import { collectWeeklySnapshot, type WeeklySnapshot } from '../lib/weekly/snapshot';
import { MANAGERS } from '../lib/weekly/config';

export function WeeklyPanel() {
  const [selected,setSelected]=useState<string>(MANAGERS[0].userId);
  const [snapshot,setSnapshot]=useState<WeeklySnapshot | null>(null);
  const [error,setError]=useState('');
  const [checking,setChecking]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [now,setNow]=useState(Date.now);
  useEffect(() => {
    let stopped=false, timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let failures=0;
    async function update() {
      controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000);
      setChecking(true);
      try {
        const next=await collectWeeklySnapshot(controller.signal);
        if (!stopped) { setSnapshot(next); setError(''); failures=0; }
      } catch (e) {
        if (!stopped) {setError(e instanceof Error ? e.message : 'Could not check Sleeper');failures++;}
      } finally {
        clearTimeout(timeout);
        if (!stopped) {setChecking(false);timer=setTimeout(update,Math.min(300000,60000*2**failures));}
      }
    }
    void update();
    return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
  },[refresh]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const manager=snapshot?.managers.find(m=>m.userId===selected);
  const age=snapshot ? Math.max(0,Math.floor((now-Date.parse(snapshot.checkedAt))/1000)) : null;
  const stale=age !== null && age>120;
  const ready=snapshot?.stage==='rosters-ready';
  const title=!snapshot ? 'Checking your league' : snapshot.stage==='waiting' ? 'Waiting for your draft' : snapshot.stage==='drafting' ? 'Your draft is in progress' : ready ? 'Your rosters are connected' : 'Roster sync needs attention';
  return <div className="weekly-workspace">
    <div className="workspace-title"><div><span className="section-caption">Weekly lineup · Real league</span><h1>Your week starts here</h1></div></div>
    <div className="weekly-managers" role="group" aria-label="Weekly manager">{MANAGERS.map(m=><button className="btn" type="button" key={m.userId} aria-pressed={selected===m.userId} onClick={()=>setSelected(m.userId)}>{m.name}</button>)}</div>
    <section className={`live-sync-card ${error ? 'error' : stale || !snapshot ? 'waiting' : 'current'}`} aria-label="Weekly roster connection">
      <div className="live-sync-heading"><strong role="status"><span className="sync-dot" />{error ? 'Roster check failed' : stale ? 'Roster data is stale' : checking ? 'Checking Sleeper…' : 'Roster connection checked'}</strong><button className="btn" type="button" onClick={()=>setRefresh(n=>n+1)}>Check rosters</button></div>
      <p>{snapshot ? `${snapshot.leagueName} · ${snapshot.rosteredPlayers} players rostered across the league` : 'Connecting to the real Sleeper league.'}</p>
      <small>{age===null ? 'Waiting for the first successful check.' : `Last successful check ${age}s ago · Checks every minute while this page is open`}</small>
      {error && <p role="alert">{error}. {snapshot ? 'Showing the last successful snapshot.' : 'Retrying automatically.'}</p>}
      <small>Roster connection only. Weekly projections and matchup analysis are still in development.</small>
    </section>
    <section className="weekly-section">
      <span className="section-caption">{manager?.name ?? MANAGERS.find(m=>m.userId===selected)?.name}</span>
      <h2>{title}</h2>
      {snapshot?.stage==='waiting' && <><p>Your draft is planned for September 8 at 8 p.m. Pacific. This page checks the real league and will show your roster once Sleeper publishes it.</p><p>Start/sit and trade recommendations will become available as their models are completed and validated.</p></>}
      {snapshot?.stage==='drafting' && <p>Picks are still being made. Weekly decisions will use the completed roster, including your bench, kicker and defense.</p>}
      {ready && <p>The completed draft roster is available. Weekly projections, start/sit comparisons and trade targets are the next phase; this page currently shows roster status.</p>}
      {snapshot?.stage==='incomplete' && <p>The completed rosters or account mappings are incomplete. Recommendations stay unavailable until the league data is reconciled.</p>}
      {manager?.issue && <p role="alert">{manager.issue}. Your account must map to exactly one roster.</p>}
      {manager && <dl className="weekly-facts"><div><dt>Sleeper account</dt><dd>{manager.username ?? 'Unresolved'}</dd></div><div><dt>Roster</dt><dd>{manager.rosterId ?? 'Unresolved'}</dd></div><div><dt>Players</dt><dd>{manager.players.length}</dd></div><div><dt>Current starters</dt><dd>{manager.starters.length}</dd></div></dl>}
      {manager && manager.players.length>0 && <ul className="weekly-roster">{manager.players.map(id=><li key={id}><strong>{snapshot?.playerDetails[id]?.name ?? `Unmapped player ${id}`}</strong><span>{snapshot?.playerDetails[id]?.position ?? 'Unknown position'} · {snapshot?.playerDetails[id]?.team ?? 'No team'}{manager.starters.includes(id) ? ' · Current starter' : ' · Bench / reserve'}</span></li>)}</ul>}
    </section>
    {snapshot && <section className="weekly-section"><h2>Your league rules</h2><p>{snapshot.slots.filter(s=>s!=='BN').join(' · ')} · Six bench spots</p><p>Half-PPR · {snapshot.scoring.pass_td} points per passing touchdown</p><details><summary>All scoring rules from Sleeper</summary><dl className="weekly-facts">{Object.entries(snapshot.scoring).map(([key,value])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{value}</dd></div>)}</dl></details></section>}
    <section className="weekly-section"><h2>What comes next</h2><p>Weekly projections and legal lineup comparisons, then tested matchup adjustments and trade packages based on both teams’ roster needs. The model will show its evidence and uncertainty before asking you to change a starter.</p><p>This page uses the real league. Temporary test-draft picks and settings stay separate.</p></section>
  </div>;
}
