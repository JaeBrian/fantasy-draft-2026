import { NEWS, type NewsItem } from "../news";

/* The wire, shared by the risk model and the UI so the two cannot tell different stories.
 *
 * Items reaching here have already passed the attribution gate in scripts/fetch-news.mjs:
 * a named reporter and outlet, or a direct quote from someone in the building. 57% of the
 * feed does not clear it. What survives is an index of other people's reporting — never the
 * aggregator's own analysis, which is AI-assisted and demonstrably unreliable. */

/** Ordered by how much it should change what you do. */
export const NEWS_RANK: Record<string, number> = {
  out: 0, miss: 1, suspended: 2, committee: 3, workload: 4,
  demoted: 5, holdout: 6, hurt: 7, promoted: 8, back: 9, hype: 10,
};

/** The one item that should change your mind about this player, if any. */
export function topNews(name: string): NewsItem | null {
  const items = NEWS[name];
  if (!items?.length) return null;
  const tagged = items.filter((n) => n.g && n.g in NEWS_RANK);
  if (!tagged.length) return null;
  return tagged.slice().sort((a, b) => NEWS_RANK[a.g!] - NEWS_RANK[b.g!] || b.t - a.t)[0];
}

/** Every item carrying this tag, newest first. */
export function newsTagged(name: string, tag: string): NewsItem[] {
  return (NEWS[name] ?? []).filter((n) => n.g === tag).sort((a, b) => b.t - a.t);
}

/** How stale is what we know about him? Days, or null if we have nothing sourced. */
export function newsAge(name: string, now = Date.now()): number | null {
  const items = NEWS[name];
  if (!items?.length) return null;
  return Math.floor((now / 1000 - items[0].t) / 86400);
}
