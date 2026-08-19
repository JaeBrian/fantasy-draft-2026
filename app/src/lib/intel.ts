/* League intel: things you know that no projection or ADP can.
 *
 * "James Cook will go at 8" is not a probability, it is a fact about this room — somebody
 * telegraphed it, or you know the manager. ADP says 9.2 with a spread either side, and the
 * model will happily tell Emily he is available a quarter of the time when he is available
 * none of the time. That is worse than useless, because it is confidently wrong.
 *
 * A pin says: treat this player as going at exactly this pick. It works by overriding his
 * market price and collapsing the uncertainty around it, so everything downstream — survival
 * odds, the run forecast, the scarcity gap, who the advisor bothers to consider — follows
 * automatically rather than each needing to know about intel separately.
 *
 * Empty by default and only ever populated in the browser, so the simulations and audits run
 * on the market as it is rather than on anyone's hunches. */

const KEY = "fd26-intel";

/** player name -> the pick you believe he actually goes at */
let PINS: Record<string, number> = {};

function load(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === "number" && v >= 1 && v <= 200) out[k] = v;
    return out;
  } catch {
    return {};
  }
}
PINS = load();

const listeners = new Set<() => void>();

export const getPins = (): Record<string, number> => PINS;

export function setPin(name: string, pick: number | null): void {
  if (pick === null) delete PINS[name];
  else PINS[name] = pick;
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(PINS)); } catch { /* private mode */ }
  }
  listeners.forEach((f) => f());
}

export function onPinsChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The pinned pick for a player, if you have said one. */
export const pinnedPick = (name: string): number | undefined => PINS[name];

/**
 * Parse "James Cook 8" or "james cook = 8" into a name and a pick.
 * Matches loosely against the board so you can type quickly mid-draft.
 */
export function parseIntel(input: string, names: string[]): { name: string; pick: number } | null {
  const m = input.trim().match(/^(.*?)[\s=,:]+(\d{1,3})$/);
  if (!m) return null;
  const pick = Number(m[2]);
  if (!(pick >= 1 && pick <= 200)) return null;
  const q = m[1].toLowerCase().replace(/[.'-]/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[.'-]/g, " ").replace(/\s+/g, " ").trim();
  const exact = names.find((n) => norm(n) === q);
  if (exact) return { name: exact, pick };
  const starts = names.filter((n) => norm(n).startsWith(q));
  if (starts.length === 1) return { name: starts[0], pick };
  const has = names.filter((n) => norm(n).includes(q));
  if (has.length === 1) return { name: has[0], pick };
  /* last name only, when unambiguous */
  const last = names.filter((n) => norm(n).split(" ").slice(-1)[0] === q);
  if (last.length === 1) return { name: last[0], pick };
  return null;
}
