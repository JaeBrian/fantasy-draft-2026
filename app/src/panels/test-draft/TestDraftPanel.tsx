import { useEffect, useState } from 'react';
import { P } from '../../data';
import { rosterSlots, snapTeam } from '../../lib/advisor';
import { offBoardPick } from '../../lib/sleeper-draft';
import { usePersistent } from '../../lib/store';
import { startSleeperSync, type SyncedDraft } from './sleeper-sync';
import './test-draft.css';

const DRAFT_ID = '1402785901897109504';
const DRAFT_URL = `https://sleeper.app/draft/nfl/${DRAFT_ID}`;
const ENDPOINT = `https://api.sleeper.app/v1/draft/${DRAFT_ID}/picks`;
const EMPTY: SyncedDraft = { DS: {}, ord: [], offBoard: 0, syncedAt: 0 };
const displayName = (name: string) => offBoardPick(name)?.name ?? name;
const parseSeat = (raw: string) => /^(?:[1-9]|1[0-2])$/.test(raw) ? Number(raw) : 0;

/** Disposable live integration harness. Never receives or writes the real draft's state. */
export function TestDraftPanel() {
  const [seat, setSeat] = usePersistent(`fd26-test-${DRAFT_ID}-seat`, 0, parseSeat, String);
  const [snapshot, setSnapshot] = useState<SyncedDraft>(EMPTY);
  const [error, setError] = useState('');
  useEffect(() => {
    setSnapshot(EMPTY); setError('');
    return startSleeperSync(DRAFT_URL, seat, P, next => {
      setSnapshot(next); setError('');
    }, setError);
  }, [seat]);
  const { DS, ord, syncedAt } = snapshot;
  const slots = rosterSlots(DS);
  const mine = Object.values(DS).filter(mark => mark === 'mine').length;
  const complete = ord.length >= 192;

  return <div className="test-draft-mode">
    <div className="workspace-title"><div><span className="section-caption">Temporary · Test league only</span><h1>Test draft mode</h1><p>Make picks in Sleeper and watch them arrive here.</p></div><a className="btn primary" href={DRAFT_URL} target="_blank" rel="noreferrer">Open test draft in Sleeper</a></div>
    <div className="test-draft-notice">This tab uses a separate test connection and seat setting. Test picks stay in this tab’s memory. Draft room keeps your real league.</div>
    <div className="test-draft-controls"><label htmlFor="test-draft-seat">Your seat in the test league</label><select id="test-draft-seat" value={seat} onChange={e => setSeat(Number(e.target.value))}><option value={0}>Choose your seat…</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Seat {i + 1}</option>)}</select></div>
    <div className={`sync-status ${error ? 'sync-error' : ''}`} role="status">{error || (syncedAt ? `${ord.length ? 'Live' : 'Waiting for the first pick'} · ${ord.length} picks synced` : 'Connecting to the test draft…')}{syncedAt > 0 && <span> · Last successful sync: {new Date(syncedAt).toLocaleTimeString()}</span>}</div>
    <div className="draft-clock"><div><span className="section-caption">{complete ? 'Test draft complete' : 'On the clock'}</span><h2>{complete ? '192 picks' : `Pick ${ord.length + 1} · Seat ${snapTeam(ord.length + 1)}`}</h2></div><span>{seat ? `Seat ${seat}: ${mine} / 16 rostered` : 'Select your test seat to identify your picks'}</span></div>
    <div className="test-draft-columns">
      <section className="advisor-panel" aria-label="Your test roster"><h2>{seat ? `Seat ${seat} roster` : 'Choose your test seat'}</h2><p>{seat ? 'Your Sleeper selections appear here automatically.' : 'Select your actual draft slot above so we can identify your picks.'}</p>{seat > 0 && <div className="roster-grid">{slots.map((slot, i) => <div key={i} className={slot.player ? 'filled' : ''}><span>{slot.label}</span><b>{slot.player ? displayName(slot.player) : 'Open slot'}</b></div>)}</div>}</section>
      <section className="study-panel" aria-label="Synced test picks"><h2>Synced test picks</h2>{ord.length === 0 ? <p>The next successful sync will show picks made in Sleeper. A commissioner reset to zero clears this list.</p> : <ol className="test-pick-list">{ord.map((name, i) => <li key={`${i}-${name}`}><span>#{i + 1} · Seat {snapTeam(i + 1)}</span><b>{displayName(name)}</b>{DS[name] === 'mine' && <strong>Your pick</strong>}</li>)}</ol>}</section>
    </div>
    <details className="draft-disclosure"><summary>Test connection details</summary><p>12-team snake · 16 rounds. This test tab polls every 3 seconds after a response, retries errors after 5 seconds, and times out requests after 10 seconds. Real Draft room polling is unchanged.</p><code className="test-endpoint">{ENDPOINT}</code><p>Refresh or leave and return to fetch the complete draft again. This tab has no controls that select players or reset Sleeper.</p></details>
  </div>;
}
