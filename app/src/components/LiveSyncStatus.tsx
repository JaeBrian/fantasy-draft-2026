import { useEffect, useState } from 'react';

export function syncHealth(lastCheck: number | null, error: boolean, now: number) {
  if (error) return { tone: 'error', label: 'Sync failed' };
  if (lastCheck === null) return { tone: 'waiting', label: 'Connecting to Sleeper' };
  if (now - lastCheck > 10000) return { tone: 'waiting', label: 'Sync delayed' };
  return { tone: 'current', label: 'Matches latest Sleeper response' };
}

export function LiveSyncStatus({ lastCheck, error, checking, message, onRefresh }: {
  lastCheck: number | null; error: boolean; checking: boolean; message: string; onRefresh: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const health = syncHealth(lastCheck, error, now);
  const age = lastCheck === null ? null : Math.max(0, Math.floor((now - lastCheck) / 1000));
  return <div className={`live-sync-card ${health.tone}`}>
    <div className="live-sync-heading"><strong role="status"><span className="sync-dot" />{health.label}</strong><button type="button" className="btn" onClick={onRefresh}>Check now</button></div>
    <p>{message || 'Fetching the live draft…'}</p>
    <small>{age === null ? 'No successful check yet' : `Last successful check ${age}s ago`}{checking ? ' · Checking…' : ' · Checks every 2s'}</small>
    <small>Sleeper’s API can lag its draft room. Compare the synced pick count if the boards differ.</small>
  </div>;
}
