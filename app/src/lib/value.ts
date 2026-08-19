import { P, type Pos } from "../data";
import { PROJ } from "../projections";
import { SLP } from "../sleeper";

/* Value against the market, in the only currency that matters at a draft: picks.
 *
 * Rank every player by value over replacement — not raw points, or every quarterback tops the
 * list and the number means nothing — then compare that rank to the pick the market actually
 * takes him at. A back who grades 12th and goes 30th is eighteen picks of value. A receiver
 * who grades 87th and goes 39th is a forty-eight pick overpay, and you should let someone else
 * make it.
 *
 * Both halves come from Sleeper: their projection and their ADP. Our board is not involved,
 * deliberately — this is the market being wrong about itself, not us disagreeing with it,
 * which makes it a much harder claim to argue with.
 *
 * Only meaningful where the market is actually drafting. A player with an ADP of 659 shows a
 * gaudy number that means nothing because no one takes him at all. */

const REPL_RANK: Record<Pos, number> = { QB: 14, RB: 32, WR: 34, TE: 13, K: 1, DST: 1 };

export interface Value {
  /** his rank by value over replacement across the whole board */
  rank: number;
  /** picks of value: ADP minus that rank. Positive is cheap, negative is dear. */
  edge: number;
  adp: number;
}

const VAL: Record<string, Value> = {};
{
  const rows = P.filter((r) => PROJ[r[0]] !== undefined && SLP[r[0]]?.adp !== undefined)
    .map((r) => ({ name: r[0], pos: r[1] as Pos, proj: PROJ[r[0]], adp: SLP[r[0]]!.adp! }));
  const repl: Record<string, number> = {};
  (["QB", "RB", "WR", "TE"] as Pos[]).forEach((pos) => {
    const v = rows.filter((x) => x.pos === pos).map((x) => x.proj).sort((a, b) => b - a);
    repl[pos] = v[Math.min(REPL_RANK[pos] - 1, v.length - 1)] ?? 0;
  });
  rows
    .map((x) => ({ ...x, vorp: Math.max(0, x.proj - (repl[x.pos] ?? 0)) }))
    .sort((a, b) => b.vorp - a.vorp)
    .forEach((x, i) => {
      VAL[x.name] = { rank: i + 1, edge: x.adp - (i + 1), adp: x.adp };
    });
}

/** Value for a player, or undefined where the market has no real opinion on him. */
export function valueOf(name: string): Value | undefined {
  const v = VAL[name];
  /* past pick ~150 the market is not really drafting, and the arithmetic produces enormous
     meaningless numbers — a player with an ADP of 659 is not "492 picks of value" */
  if (!v || v.adp > 150) return undefined;
  return v;
}

/** How loudly to say it.
 *
 *  Calibrated on the DRAFTABLE range rather than the whole board — including players with an
 *  ADP of 600 stretched the distribution so far that nothing inside the first ten rounds ever
 *  cleared the bar, which made the loud tier useless exactly where it is needed. Among the 134
 *  players the market actually drafts: +17 is the top fifteen percent, +28 the top five, and
 *  -18 and -33 the mirror of each. */
export function valueTier(edge: number): "big" | "good" | "flat" | "steep" {
  if (edge >= 28) return "big";
  if (edge >= 15) return "good";
  if (edge <= -30) return "steep";
  if (edge <= -16) return "dear" as "steep";
  return "flat";
}
