export async function fetchPlayerNews(id, { fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let retryAfter = 0;
    try {
      const response = await fetcher(`https://api.sleeper.com/players/nfl/${id}/news?limit=6`,
        { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const header = response.headers.get('retry-after');
        retryAfter = /^\d+(\.\d+)?$/.test(header ?? '') ? Number(header) * 1000 : Date.parse(header ?? '') - Date.now();
        throw new Error(`HTTP ${response.status}`);
      }
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('Invalid news response');
      return items;
    } catch (error) {
      if (attempt === 2) throw new Error(`News for ${id}: ${error.message}`, { cause: error });
      // A longer server cooldown stops this run; the collector preserves its previous file.
      if (retryAfter > 30000) throw new Error(`News for ${id}: server requested a longer cooldown`);
      await wait(Math.max(500 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter : 0));
    }
  }
}
