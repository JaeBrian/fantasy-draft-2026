import { P, BYE, CUFFS, type PlayerRow, type Pos, type Verdict } from "../data";

export type Mark = "gone" | "mine";
export type DraftState = Record<string, Mark>;

interface Slot {
  r: PlayerRow;
  i: number;
}

export interface Candidate {
  p: Pos;
  now: Slot;
  later: Slot | undefined;
  vNow: number;
  vLater: number;
  score: number;
  clash: boolean;
  bye: number | undefined;
  cuffOf: string | undefined;
}

export interface Lookahead {
  first: Candidate;
  second: Candidate;
  edge: number;
  flipped?: boolean;
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
  byeCount: Record<number, number>;
  run: Pos | null;
  simGone: number;
  look: Lookahead | null;
  cands: Candidate[];
}

/* projected half-PPR points-per-game curves by position rank (fit to 2025 finishes + VBD baselines) */
const PPG: Record<Pos, (r: number) => number> = {
  QB: (r) => Math.max(14, 23.5 - 0.32 * r),
  RB: (r) => 12.5 * Math.exp(-(r - 1) / 20) + 5.8,
  WR: (r) => 11.5 * Math.exp(-(r - 1) / 26) + 6.2,
  TE: (r) => 8.5 * Math.exp(-(r - 1) / 7) + 5,
  K: () => 7,
  DST: () => 7,
};
const REPL: Record<Pos, number> = {
  QB: PPG.QB(14),
  RB: PPG.RB(32),
  WR: PPG.WR(34),
  TE: PPG.TE(13),
  K: 7,
  DST: 7,
};

function posRankOf(o: Slot, pool: Slot[]): number {
  let k = 0;
  for (const q of pool) {
    if (q.r[1] === o.r[1]) {
      k++;
      if (q.r[0] === o.r[0]) return k;
    }
  }
  return k || 1;
}

function vorp(o: Slot, pool: Slot[]): number {
  const pr = posRankOf(o, pool);
  return Math.max(0.2, PPG[o.r[1]](pr) - REPL[o.r[1]]);
}

/** Which of the 12 teams owns an overall pick in a snake draft. */
export function snapTeam(pickNo: number): number {
  const r = Math.ceil(pickNo / 12);
  const idx = pickNo - (r - 1) * 12;
  return r % 2 ? idx : 13 - idx;
}

function teamNeeds(roster: Slot[]) {
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  roster.forEach((pl) => {
    if (c[pl.r[1]] !== undefined) c[pl.r[1]]++;
  });
  const need: Record<string, boolean> = { QB: c.QB < 1, RB: c.RB < 2, WR: c.WR < 2, TE: c.TE < 1 };
  const flexOpen = c.RB + c.WR + c.TE < 7;
  return { need, flexOpen, c };
}

/** Rebuild every team's roster from the pick order, then simulate the
 *  opponents' picks (by ADP among needed positions) up to targetPick. */
function simulateTo(ord: string[], mySlot: number, targetPick: number, cur: number, pool: Slot[]) {
  const removed: string[] = [];
  let simPool = pool.slice();
  const rosters: Record<number, Slot[]> = {};
  for (let t = 1; t <= 12; t++) rosters[t] = [];
  const all = P.map((r, j) => ({ r, i: j }));
  ord.forEach((n, i) => {
    const o = all.find((x) => x.r[0] === n);
    if (o) rosters[snapTeam(i + 1)].push(o);
  });
  for (let pk = cur; pk < targetPick; pk++) {
    const t = snapTeam(pk);
    if (mySlot >= 1 && t === mySlot) continue;
    const { need, flexOpen } = teamNeeds(rosters[t]);
    const wanted = simPool.filter((o) => {
      const ps = o.r[1];
      if (need[ps]) return true;
      if (["RB", "WR", "TE"].includes(ps) && flexOpen) return true;
      return false;
    });
    const candPool = (wanted.length ? wanted : simPool).slice();
    candPool.sort((a, b) => a.r[3] - b.r[3]);
    const pick = candPool[0];
    if (!pick) break;
    rosters[t].push(pick);
    removed.push(pick.r[0]);
    simPool = simPool.filter((o) => o.r[0] !== pick.r[0]);
  }
  return { simPool, removed };
}

/** A position run is on when 3+ of the last 5 picks share a position. */
function runDetect(ord: string[]): Pos | null {
  const last = ord.slice(-5);
  const cnt: Record<string, number> = {};
  last.forEach((n) => {
    const r = P.find((x) => x[0] === n);
    if (r) cnt[r[1]] = (cnt[r[1]] || 0) + 1;
  });
  for (const ps of ["RB", "WR", "TE", "QB"] as Pos[]) if ((cnt[ps] || 0) >= 3) return ps;
  return null;
}

export function advise(DS: DraftState, mySlot: number, ord: string[]): Advice {
  const all: Slot[] = P.map((r, i) => ({ r, i }));
  const avail = all.filter((o) => !DS[o.r[0]]);
  const mine = P.filter((r) => DS[r[0]] === "mine");
  const made = Object.keys(DS).length;
  const cur = made + 1;
  let onClock = false;
  let nextPick: number | null = null;
  let followPick = cur + 12;
  if (mySlot >= 1) {
    const picks: number[] = [];
    for (let r = 1; r <= 16; r++) picks.push((r - 1) * 12 + (r % 2 ? mySlot : 13 - mySlot));
    const fut = picks.filter((x) => x >= cur);
    if (fut.length) {
      nextPick = fut[0];
      onClock = fut[0] === cur;
      followPick = fut[1] ?? fut[0] + 12;
    }
  }
  const have = (ps: Pos) => mine.filter((r) => r[1] === ps).length;
  const qb = have("QB"), rb = have("RB"), wr = have("WR"), te = have("TE");
  const myCount = mine.length;
  const wrt = rb + wr + te;
  const byeCount: Record<number, number> = {};
  mine.forEach((r) => {
    const b = BYE[r[2]];
    if (b) byeCount[b] = (byeCount[b] || 0) + 1;
  });
  const w: Record<Pos, number> = {
    QB: qb === 0 ? (myCount >= 5 ? 1 : 0.55) : myCount >= 13 ? 0.15 : 0.05,
    RB: rb < 2 ? 1.05 : wrt < 7 ? 0.8 : rb >= 6 ? 0.08 : 0.45,
    WR: wr < 2 ? 1.05 : wrt < 7 ? 0.8 : wr >= 6 ? 0.08 : 0.45,
    TE: te === 0 ? (myCount >= 3 ? 0.85 : 0.6) : 0.07,
    K: 0,
    DST: 0,
  };
  const bestQB = avail.find((o) => o.r[1] === "QB");
  const bestTE = avail.find((o) => o.r[1] === "TE");
  if (bestQB && qb === 0 && cur - (bestQB.i + 1) >= 6) w.QB = Math.max(w.QB, 0.95);
  if (bestTE && te === 0 && cur - (bestTE.i + 1) >= 6) w.TE = Math.max(w.TE, 0.95);
  const run = runDetect(ord);
  if (run && w[run] > 0.3) w[run] *= 1.12;
  const vmul: Record<Verdict, number> = { buy: 1.06, solid: 1, risk: 0.94, avoid: 0.8 };
  const cuffTargets: Record<string, string> = {};
  mine.forEach((r) => {
    const c = CUFFS[r[0]];
    if (c) cuffTargets[c] = r[0];
  });
  const start = onClock || !nextPick ? cur : nextPick;
  const sim = simulateTo(ord, mySlot, Math.max(followPick, start + 1), cur, avail);
  const cands: Candidate[] = [];
  (["RB", "WR", "QB", "TE"] as Pos[]).forEach((ps) => {
    const pool = avail.filter((o) => o.r[1] === ps);
    if (!pool.length) return;
    pool.slice(0, 2).forEach((now, k) => {
      if (k > 0 && now.i - pool[0].i > 6) return;
      const later = sim.simPool.find((o) => o.r[1] === ps && o.r[0] !== now.r[0]);
      const vNow = vorp(now, avail);
      const vLater = later ? vorp(later, avail) : 0.2;
      let s = w[ps] * (vNow + 1.35 * Math.max(0, vNow - vLater));
      s *= vmul[now.r[4]] ?? 1;
      const cuffOf = cuffTargets[now.r[0]];
      if (myCount >= 9 && cuffOf) s += 2.5;
      const b = BYE[now.r[2]];
      const clash = !!(b && byeCount[b] >= 2);
      if (clash) s *= 0.93;
      cands.push({ p: ps, now, later, vNow, vLater, score: s, clash, bye: b, cuffOf });
    });
  });
  cands.sort((x, y) => y.score - x.score);
  const seen = new Set<string>();
  const deduped = cands.filter((c) => {
    if (seen.has(c.now.r[0])) return false;
    seen.add(c.now.r[0]);
    return true;
  });
  /* one-step lookahead: is (best now, other position on the way back)
     better than the reverse order? */
  let look: Lookahead | null = null;
  const t0 = deduped[0];
  const t1 = deduped.find((c) => t0 && c.p !== t0.p);
  if (t0 && t1 && t0.later && t1.later) {
    const AB = t0.vNow + t1.vLater;
    const BA = t1.vNow + t0.vLater;
    if (AB >= BA) look = { first: t0, second: t1, edge: AB - BA };
    else look = { first: t1, second: t0, edge: BA - AB, flipped: true };
  }
  if (look?.flipped) {
    const i = deduped.indexOf(look.first);
    if (i > 0) {
      deduped.splice(i, 1);
      deduped.unshift(look.first);
    }
  }
  return {
    qb, rb, wr, te, wrt, myCount, cur, onClock, nextPick, byeCount,
    run, simGone: sim.removed.length, look, cands: deduped,
  };
}

export function needText(ps: Pos, a: Advice): string {
  if (ps === "QB") return a.qb === 0 ? "your QB slot is still empty" : "QB depth";
  if (ps === "TE") return a.te === 0 ? "fills your TE" : "TE depth";
  const h = ps === "RB" ? a.rb : a.wr;
  if (h < 2) return "fills your " + ps + (h + 1);
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
