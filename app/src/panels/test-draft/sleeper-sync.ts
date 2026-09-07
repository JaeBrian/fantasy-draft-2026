import type { PlayerRow } from '../../data';
import { sleeperSnapshot, type SleeperPick } from '../../lib/sleeper-draft';

export type SyncedDraft = ReturnType<typeof sleeperSnapshot> & { syncedAt: number };

/** Poll complete authoritative snapshots; one request at a time, cancelled on exit. */
export function startSleeperSync(
  draftUrl: string, slot: number, board: PlayerRow[],
  onSnapshot: (snapshot: SyncedDraft) => void, onError: (message: string) => void,
) {
  const id = draftUrl.match(/(?:^|\/)(\d{15,20})(?:[/?#]|$)/)?.[1];
  if (!id) { onError('Paste a Sleeper draft URL or numeric draft ID.'); return () => {}; }
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController;
  const poll = async () => {
    let delay = 3000;
    controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`https://api.sleeper.app/v1/draft/${id}/picks`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Sleeper returned ${response.status}`);
      const picks: unknown = await response.json();
      if (!Array.isArray(picks)) throw new Error('Invalid Sleeper pick response');
      const snapshot = sleeperSnapshot(picks as SleeperPick[], slot, board);
      if (!stopped) onSnapshot({ ...snapshot, syncedAt: Date.now() });
    } catch (error) {
      delay = 5000;
      if (!stopped) onError(`Sync error — ${controller.signal.aborted ? 'request timed out' : String(error instanceof Error ? error.message : error)}. Retrying in 5 seconds.`);
    } finally {
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(poll, delay);
    }
  };
  void poll();
  return () => { stopped = true; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
}
