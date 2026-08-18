import { P, type PlayerRow, type Pos } from "../data";
import { PROJ } from "../projections";
import { mktADP, snapTeam, type DraftState } from "./advisor";

/* Practice draft.
 *
 * The eleven other seats pick with exactly the model the simulations use: Sleeper's real
 * half-PPR ADP, plus normal noise, plus the roster pressure that makes a room stop taking
 * quarterbacks once it has one. Nothing here is tuned to be beatable — if you can beat this
 * room you can beat a real one, and if it embarrasses you it will do so for real reasons.
 *
 * Picks are written into the same draft state the live board uses, so the advisor, the board
 * and the roster panel all behave exactly as they will on the night. */

const NAMES = P.map((r) => r[0]);
const ROW: Record<string, PlayerRow> = {};
P.forEach((r) => {
  ROW[r[0]] = r;
});

const sigmaOf = (r: PlayerRow): number => Math.max(2.2, 0.13 * mktADP(r));

/** Box-Muller, seeded per call site so a practice draft is not deterministic. */
function gauss(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rosterOf(ord: string[], team: number): PlayerRow[] {
  const out: PlayerRow[] = [];
  ord.forEach((n, i) => {
    if (snapTeam(i + 1) === team) {
      const r = ROW[n];
      if (r) out.push(r);
    }
  });
  return out;
}

function counts(roster: PlayerRow[]): Record<string, number> {
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  roster.forEach((r) => {
    if (c[r[1]] !== undefined) c[r[1]]++;
  });
  return c;
}

/** Who the AI team on the clock takes. Mirrors the simulation's opponent exactly. */
export function opponentPick(DS: DraftState, ord: string[], team: number): string | null {
  const c = counts(rosterOf(ord, team));
  let best: string | null = null;
  let bestScore = Infinity;
  for (const n of NAMES) {
    if (DS[n]) continue;
    const r = ROW[n];
    let s = mktADP(r) + gauss() * sigmaOf(r) * 0.8;
    if (r[1] === "QB" && c.QB >= 1) s += 60;
    if (r[1] === "TE" && c.TE >= 1) s += 50;
    if (r[1] === "RB" && c.RB >= 5) s += 25;
    if (r[1] === "WR" && c.WR >= 5) s += 25;
    if (s < bestScore) {
      bestScore = s;
      best = n;
    }
  }
  return best;
}

/** Every pick between now and your next turn. Empty when it is already your pick. */
export function fillToMyTurn(DS: DraftState, ord: string[], mySlot: number, lastPick = 168): string[] {
  const picks: string[] = [];
  const seen: DraftState = { ...DS };
  const order = ord.slice();
  for (let guard = 0; guard < 200; guard++) {
    const pick = order.length + 1;
    if (pick > lastPick) break;
    if (snapTeam(pick) === mySlot) break;
    const n = opponentPick(seen, order, snapTeam(pick));
    if (!n) break;
    seen[n] = "gone";
    order.push(n);
    picks.push(n);
  }
  return picks;
}

const projOf = (n: string): number => (PROJ[n] !== undefined ? PROJ[n] : 6);

/** Best legal starting lineup: 1 QB, 2 RB, 2 WR, 1 TE, 2 flex. */
export function lineupPoints(roster: PlayerRow[]): number {
  const by = (pos: Pos) =>
    roster.filter((r) => r[1] === pos).sort((a, b) => projOf(b[0]) - projOf(a[0]));
  const qb = by("QB");
  const rb = by("RB");
  const wr = by("WR");
  const te = by("TE");
  const used = new Set<string>();
  let pts = 0;
  const take = (a: PlayerRow[], n: number) =>
    a.slice(0, n).forEach((r) => {
      pts += projOf(r[0]);
      used.add(r[0]);
    });
  take(qb, 1);
  take(rb, 2);
  take(wr, 2);
  take(te, 1);
  take(
    [...rb, ...wr, ...te].filter((r) => !used.has(r[0])).sort((a, b) => projOf(b[0]) - projOf(a[0])),
    2,
  );
  return pts;
}

export interface Grade {
  mine: number;
  rank: number;
  field: number[];
  best: number;
  median: number;
  gaps: string[];
}

/** Score the finished practice roster against the eleven rooms it drafted against. */
export function gradeDraft(ord: string[], mySlot: number): Grade {
  const scores: { team: number; pts: number }[] = [];
  for (let t = 1; t <= 12; t++) scores.push({ team: t, pts: lineupPoints(rosterOf(ord, t)) });
  const mine = scores.find((s) => s.team === mySlot)!.pts;
  const sorted = scores.map((s) => s.pts).sort((a, b) => b - a);
  const myRoster = rosterOf(ord, mySlot);
  const c = counts(myRoster);
  const gaps: string[] = [];
  if (c.QB === 0) gaps.push("no quarterback");
  if (c.RB < 2) gaps.push("fewer than two running backs");
  if (c.WR < 2) gaps.push("fewer than two receivers");
  if (c.TE === 0) gaps.push("no tight end");
  if (c.QB === 1) gaps.push("no backup QB — you field nobody there on his bye");
  if (c.TE === 1) gaps.push("no backup TE — same problem in week " + (myRoster.find((r) => r[1] === "TE") ? "his bye" : "?"));
  return {
    mine,
    rank: sorted.indexOf(mine) + 1,
    field: sorted,
    best: sorted[0],
    median: sorted[5],
    gaps,
  };
}
