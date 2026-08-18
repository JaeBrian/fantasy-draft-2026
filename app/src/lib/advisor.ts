import { P, BYE, CUFFS, type PlayerRow, type Pos, type Verdict } from "../data";

export type Mark = "gone" | "mine";
export type DraftState = Record<string, Mark>;

export interface Candidate {
  p: Pos;
  now: { r: PlayerRow; i: number };
  later: { r: PlayerRow; i: number } | undefined;
  drop: number;
  score: number;
  clash: boolean;
  bye: number | undefined;
  cuffOf: string | undefined;
}

export interface Advice {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  wrt: number;
  myCount: number;
  cur: number;
  onClock: boolean;
  nextPick: number | null;
  horizon: number;
  byeCount: Record<number, number>;
  cands: Candidate[];
}

export function advise(DS: DraftState, mySlot: number): Advice {
  const avail = P.map((r, i) => ({ r, i })).filter((o) => !DS[o.r[0]]);
  const mine = P.filter((r) => DS[r[0]] === "mine");
  const made = Object.keys(DS).length;
  const cur = made + 1;
  let horizon = 12;
  let onClock = false;
  let nextPick: number | null = null;
  if (mySlot >= 1) {
    const picks: number[] = [];
    for (let r = 1; r <= 16; r++) picks.push((r - 1) * 12 + (r % 2 ? mySlot : 13 - mySlot));
    const fut = picks.filter((x) => x >= cur);
    if (fut.length) {
      nextPick = fut[0];
      onClock = fut[0] === cur;
      horizon = Math.max(1, (fut[1] ?? fut[0] + 12) - Math.max(cur, fut[0]));
    }
  }
  const have = (p: Pos) => mine.filter((r) => r[1] === p).length;
  const qb = have("QB"), rb = have("RB"), wr = have("WR"), te = have("TE");
  const myCount = mine.length;
  const wrt = rb + wr + te;
  const byeCount: Record<number, number> = {};
  mine.forEach((r) => {
    const b = BYE[r[2]];
    if (b) byeCount[b] = (byeCount[b] || 0) + 1;
  });
  const w: Record<Pos, number> = {
    QB: qb === 0 ? (myCount >= 5 ? 0.95 : 0.5) : myCount >= 13 ? 0.12 : 0.05,
    RB: rb < 2 ? 1.05 : wrt < 7 ? 0.75 : rb >= 6 ? 0.08 : 0.42,
    WR: wr < 2 ? 1.05 : wrt < 7 ? 0.75 : wr >= 6 ? 0.08 : 0.42,
    TE: te === 0 ? (myCount >= 3 ? 0.8 : 0.55) : 0.07,
    K: 0,
    DST: 0,
  };
  const bestQB = avail.find((o) => o.r[1] === "QB");
  const bestTE = avail.find((o) => o.r[1] === "TE");
  if (bestQB && qb === 0 && cur - (bestQB.i + 1) >= 6) w.QB = Math.max(w.QB, 0.92);
  if (bestTE && te === 0 && cur - (bestTE.i + 1) >= 6) w.TE = Math.max(w.TE, 0.92);
  const vmul: Record<Verdict, number> = { buy: 1.06, solid: 1, risk: 0.94, avoid: 0.8 };
  const val = (i: number) => 200 * Math.exp(-i / 45);
  const taken = new Set(
    [...avail]
      .sort((x, y) => x.r[3] - y.r[3])
      .slice(0, Math.max(0, horizon - 1))
      .map((o) => o.r[0])
  );
  const cuffTargets: Record<string, string> = {};
  mine.forEach((r) => {
    const c = CUFFS[r[0]];
    if (c) cuffTargets[c] = r[0];
  });
  const cands: Candidate[] = [];
  (["RB", "WR", "QB", "TE"] as Pos[]).forEach((p) => {
    const pool = avail.filter((o) => o.r[1] === p);
    if (!pool.length) return;
    pool.slice(0, 2).forEach((now, k) => {
      if (k > 0 && now.i - pool[0].i > 6) return;
      const later = pool.find((o) => !taken.has(o.r[0]) && o.r[0] !== now.r[0]);
      const drop = (later ? later.i : now.i) - now.i;
      let s = w[p] * (val(now.i) + 1.4 * (val(now.i) - val(now.i + drop)));
      s *= vmul[now.r[4]] ?? 1;
      const cuffOf = cuffTargets[now.r[0]];
      if (myCount >= 9 && cuffOf) s += 30;
      const b = BYE[now.r[2]];
      const clash = !!(b && byeCount[b] >= 2);
      if (clash) s *= 0.93;
      cands.push({ p, now, later, drop, score: s, clash, bye: b, cuffOf });
    });
  });
  cands.sort((x, y) => y.score - x.score);
  const seen = new Set<string>();
  const deduped = cands.filter((c) => {
    if (seen.has(c.now.r[0])) return false;
    seen.add(c.now.r[0]);
    return true;
  });
  return { qb, rb, wr, te, wrt, myCount, cur, onClock, nextPick, horizon, byeCount, cands: deduped };
}

export function needText(p: Pos, a: Advice): string {
  if (p === "QB") return a.qb === 0 ? "your QB slot is still empty" : "QB depth";
  if (p === "TE") return a.te === 0 ? "fills your TE" : "TE depth";
  const h = p === "RB" ? a.rb : a.wr;
  if (h < 2) return "fills your " + p + (h + 1);
  if (a.wrt < 7) return "fills a flex spot";
  return "bench depth";
}

export interface RosterSlot {
  label: string;
  player: string | undefined;
}

/** Fill starting slots the same way the original tracker did. */
export function rosterSlots(DS: DraftState): RosterSlot[] {
  const mine = P.filter((r) => DS[r[0]] === "mine");
  const slots: [string, number][] = [
    ["QB", 1], ["RB", 2], ["WR", 2], ["TE", 1], ["FLX", 2], ["K", 1], ["DST", 1], ["BN", 6],
  ];
  const fill: Record<string, string[]> = { QB: [], RB: [], WR: [], TE: [], FLX: [], K: [], DST: [], BN: [] };
  mine.forEach((r) => {
    const p = r[1];
    const cap = ({ QB: 1, RB: 2, WR: 2, TE: 1 } as Record<string, number>)[p] || 0;
    if (fill[p] && fill[p].length < cap) fill[p].push(r[0]);
    else if (["RB", "WR", "TE"].includes(p) && fill.FLX.length < 2) fill.FLX.push(r[0]);
    else fill.BN.push(r[0]);
  });
  const out: RosterSlot[] = [];
  slots.forEach(([s, n]) => {
    for (let k = 0; k < n; k++) {
      const label = s + (n > 1 && s !== "FLX" && s !== "BN" ? k + 1 : "");
      out.push({ label, player: fill[s][k] });
    }
  });
  return out;
}
