import { P, BYE, CUFFS, MKT, VEGAS, type PlayerRow, type Pos, type Verdict } from "../data";

export type Mark = "gone" | "mine";
export type DraftState = Record<string, Mark>;

interface Slot {
  r: PlayerRow;
  i: number;
}

export interface Candidate {
  p: Pos;
  now: Slot;
  /** most likely best-remaining player at this position at your next turn */
  later: Slot | null;
  proj: number;
  vNow: number;
  /** expected best projection left at this position at your next turn */
  evLater: number;
  /** pts/wk lost by waiting a turn at this position */
  gap: number;
  /** P(someone drafts him before your turn AFTER next) */
  pGone: number;
  /** P(he survives to your upcoming pick) — 1 when you're on the clock */
  pReach: number;
  score: number;
  clash: boolean;
  bye: number | undefined;
  cuffOf: string | undefined;
  cliff: boolean;
  tier: number;
  stack: boolean;
  antiStack: boolean;
  /** picks he has slid past his market ADP (positive = value fall) */
  fell: number;
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
  look: Lookahead | null;
  cands: Candidate[];
  /** roster radar — expert phrasing */
  warnings: string[];
  /** roster radar — plain-English phrasing for Beginner mode */
  plainWarn: string[];
  /** top available players unlikely to make it back to your next turn */
  goneSoon: { n: string; pg: number }[];
  /** unlikely-but-possible faller clearly better than the top target */
  dream: { o: Slot; pr: number } | null;
  horizon: { takeAt: number; back: number };
}

/* ---------------- advisor engine v4 ----------------
   Projections: half-PPR points-per-game curves by GLOBAL position rank (fit to 2025 finishes +
   VBD baselines). Ranks are fixed at load — a player's projection never inflates as the pool shrinks.
   Availability: probabilistic survival on market ADP ± σ (FFC live draft data), adjusted for what
   the specific teams picking between your turns still need, instead of a brittle ADP-order sim. */

const PPG: Record<Pos, (r: number) => number> = {
  QB: (r) => Math.max(14, 23.5 - 0.32 * r),
  RB: (r) => 12.5 * Math.exp(-(r - 1) / 20) + 5.8,
  WR: (r) => 11.5 * Math.exp(-(r - 1) / 26) + 6.2,
  TE: (r) => 8.5 * Math.exp(-(r - 1) / 7) + 5,
  K: () => 7,
  DST: () => 7,
};
const REPL: Record<Pos, number> = {
  QB: PPG.QB(14), RB: PPG.RB(32), WR: PPG.WR(34), TE: PPG.TE(13), K: 7, DST: 7,
};

const GP: Record<string, { pr: number; proj: number; vorp: number }> = {};
{
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  P.forEach((r) => {
    const pr = ++c[r[1]];
    const proj = PPG[r[1]](pr);
    GP[r[0]] = { pr, proj, vorp: Math.max(0.2, proj - REPL[r[1]]) };
  });
}

const NICK: Record<string, string> = {
  LAR: "Rams", BUF: "Bills", DET: "Lions", CIN: "Bengals", BAL: "Ravens", DAL: "Cowboys",
  SF: "49ers", GB: "Packers", SEA: "Seahawks", CHI: "Bears", KC: "Chiefs", LAC: "Chargers",
  NE: "Patriots", PHI: "Eagles", JAX: "Jaguars", WAS: "Commanders", IND: "Colts", TB: "Buccaneers",
  HOU: "Texans", MIN: "Vikings", DEN: "Broncos", NYG: "Giants", NO: "Saints", PIT: "Steelers",
  ATL: "Falcons", CAR: "Panthers", TEN: "Titans", LV: "Raiders", MIA: "Dolphins", CLE: "Browns",
  NYJ: "Jets", ARI: "Cardinals",
};
const PO: Record<string, number> = {};
VEGAS.forEach(([t, , po]) => {
  for (const k in NICK) if (NICK[k] === t) PO[k] = po;
});

export const PLAINPOS: Record<string, string> = {
  QB: "quarterback (the one who throws the ball)",
  RB: "running back (the one who runs with the ball)",
  WR: "wide receiver (the one who catches passes)",
  TE: "tight end (a big player who blocks and catches)",
};
const PLAINSHORT: Record<string, string> = {
  QB: "quarterback", RB: "running back", WR: "wide receiver", TE: "tight end",
};

export const mktADP = (row: PlayerRow): number => {
  const m = MKT[row[0]];
  return m ? m[0] : row[3];
};
const sigmaOf = (row: PlayerRow): number => {
  const m = MKT[row[0]];
  return Math.max(2.2, m ? m[1] : 0, 0.13 * mktADP(row));
};

function ncdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** P(someone drafts him before `pick`), given he's still on the board with `cur` picks made */
function pGoneBy(row: PlayerRow, pick: number, cur: number, shift: number): number {
  const a = mktADP(row) + (shift || 0);
  const s = sigmaOf(row);
  const Fk = ncdf((pick - a) / s);
  const Fc = ncdf((cur - a) / s);
  const den = 1 - Fc;
  if (den <= 0.03) return 0.97;
  return Math.min(0.97, Math.max(0.01, (Fk - Fc) / den));
}

/** Which of the 12 teams owns an overall pick in a snake draft. */
export function snapTeam(pickNo: number): number {
  const r = Math.ceil(pickNo / 12);
  const idx = pickNo - (r - 1) * 12;
  return r % 2 ? idx : 13 - idx;
}

function teamNeeds(roster: PlayerRow[]) {
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  roster.forEach((r) => {
    if (c[r[1]] !== undefined) c[r[1]]++;
  });
  const need: Record<string, boolean> = { QB: c.QB < 1, RB: c.RB < 2, WR: c.WR < 2, TE: c.TE < 1 };
  const flexOpen = c.RB + c.WR + c.TE < 7;
  return { need, flexOpen, c };
}

/** Shift each position's effective ADP by how hungry the teams picking between now and `until` are for it */
function demandShift(ord: string[], mySlot: number, cur: number, until: number): Record<string, number> {
  const rosters: Record<number, PlayerRow[]> = {};
  for (let t = 1; t <= 12; t++) rosters[t] = [];
  ord.forEach((n, i) => {
    const r = P.find((x) => x[0] === n);
    if (r) rosters[snapTeam(i + 1)].push(r);
  });
  const base: Record<string, number> = { QB: 0.25, RB: 0.75, WR: 0.8, TE: 0.3 };
  const want: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  let n = 0;
  for (let pk = cur; pk < until; pk++) {
    const t = snapTeam(pk);
    if (mySlot >= 1 && t === mySlot) continue;
    n++;
    const { need, flexOpen } = teamNeeds(rosters[t]);
    for (const ps of ["QB", "RB", "WR", "TE"]) {
      if (need[ps] || (flexOpen && (ps === "RB" || ps === "WR"))) want[ps]++;
    }
  }
  const shift: Record<string, number> = {};
  for (const ps of ["QB", "RB", "WR", "TE"]) {
    shift[ps] = Math.max(-2.5, Math.min(2.5, (want[ps] / Math.max(1, n) - base[ps]) * n * 0.3));
  }
  return shift;
}

/** Expected best projection left at `pick` for a position, plus the most likely surviving name */
function nextBest(ps: Pos, avail: Slot[], pick: number, cur: number, shift: number) {
  const pool = avail.filter((o) => o.r[1] === ps);
  let pAll = 1;
  let ev = 0;
  let likely: Slot | null = null;
  for (const o of pool) {
    const pg = pGoneBy(o.r, pick, cur, shift);
    if (!likely && pAll * (1 - pg) >= 0.5) likely = o;
    ev += pAll * (1 - pg) * GP[o.r[0]].proj;
    pAll *= pg;
    if (pAll < 0.02) break;
  }
  ev += pAll * REPL[ps];
  return { ev, likely, pAllGone: pAll };
}

function tierSurvivors(ps: Pos, tier: number, avail: Slot[], pick: number, cur: number, shift: number): number {
  let e = 0;
  avail.forEach((o) => {
    if (o.r[1] === ps && o.r[6] === tier) e += 1 - pGoneBy(o.r, pick, cur, shift);
  });
  return e;
}

/** Early picks lean floor and shed risk; late picks chase ceiling — bench spots are lottery tickets */
function phaseMul(tags: string[] | undefined, myCount: number): number {
  const early = Math.max(0, 1 - myCount / 8);
  const late = Math.max(0, Math.min(1, (myCount - 7) / 6));
  let m = 1;
  (tags || []).forEach((t) => {
    if (t === "ceil" || t === "brk") m *= 1 + 0.07 * late;
    if (t === "cap") m *= 1 - 0.06 * late;
    if (t === "floor") m *= 1 + 0.05 * early - 0.02 * late;
    if (t === "inj" || t === "susp") m *= 1 - 0.07 * early;
    if (t === "rec") m *= 1 - 0.04 * early;
    if (t === "bb") m *= 1 - 0.03 * early + 0.03 * late;
  });
  return Math.max(0.8, Math.min(1.18, m));
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

  const takeAt = onClock || !nextPick ? cur : nextPick;
  const back = Math.max(followPick, takeAt + 1);
  const shift = demandShift(ord, mySlot, cur, back);
  const run = runDetect(ord);
  if (run) shift[run] = (shift[run] || 0) + 1.5;

  /* ---- roster radar: what must be filled, and how fast the shelf is emptying ---- */
  const needSlots: Record<string, number> = {
    QB: Math.max(0, 1 - qb), RB: Math.max(0, 2 - rb), WR: Math.max(0, 2 - wr), TE: Math.max(0, 1 - te),
  };
  const dRB = Math.min(rb, 2), dWR = Math.min(wr, 2), dTE = Math.min(te, 1);
  const flexFilled = Math.max(0, Math.min(2, wrt - dRB - dWR - dTE));
  const skillUnfilled = (2 - dRB) + (2 - dWR) + (1 - dTE) + (2 - flexFilled);
  const picksLeft = 16 - myCount;
  const starterGap = (qb === 0 ? 1 : 0) + skillUnfilled + 2; /* +2 = K & DST, always your last two picks */
  const warnings: string[] = [];
  const plainWarn: string[] = [];
  if (myCount < 14 && picksLeft > 0) {
    const spare = picksLeft - starterGap;
    if (spare <= 0) {
      warnings.push(`Every one of your ${picksLeft} remaining picks must fill a starting slot — no more luxury picks.`);
      plainWarn.push("every pick from here on has to be a player who'll actually start for you — no fun gambles left");
    } else if (spare === 1) {
      warnings.push("Only 1 spare pick left once required starters (and K/DST) are counted — spend it carefully.");
      plainWarn.push('you only have one "free" pick left — everything else has to fill a starting spot');
    }
    const CUT: Record<string, number> = { QB: 14, RB: 32, WR: 36, TE: 13 };
    (["QB", "RB", "WR", "TE"] as Pos[]).forEach((ps) => {
      const needN = needSlots[ps];
      if (!needN) return;
      let expNow = 0;
      let expNext = 0;
      avail.forEach((o) => {
        if (o.r[1] === ps && GP[o.r[0]].pr <= CUT[ps]) {
          expNow++;
          expNext += 1 - pGoneBy(o.r, back, cur, shift[ps]);
        }
      });
      if (expNow <= needN) {
        warnings.push(`${ps}: only ${expNow} startable left and you still need ${needN} — fill it NOW.`);
        plainWarn.push(`you still need a ${PLAINSHORT[ps]} and there are almost none worth starting left — grab one right now`);
      } else if (expNext < needN + 0.7) {
        warnings.push(`${ps}: startable options likely gone by your next turn (~${expNext.toFixed(1)} left) — this pick or never.`);
        plainWarn.push(`the good ${PLAINSHORT[ps]}s will probably all be taken before your next turn — it's now or never`);
      } else if (expNext < needN + 2) {
        warnings.push(`${ps}: shelf thinning — expect only ~${Math.round(expNext)} startable left at your next turn.`);
        plainWarn.push(`good ${PLAINSHORT[ps]}s are running out — plan to take one soon`);
      }
    });
  }
  if (myCount === 14) {
    warnings.push("Rounds 15–16: kicker and defense — don't leave without them.");
    plainWarn.push("use your last two picks on a kicker and a defense — every team needs one of each");
  }

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
  const vmul: Record<Verdict, number> = { buy: 1.06, solid: 1, risk: 0.94, avoid: 0.8 };
  const cuffTargets: Record<string, string> = {};
  mine.forEach((r) => {
    const c = CUFFS[r[0]];
    if (c) cuffTargets[c] = r[0];
  });
  const myQBteams = new Set(mine.filter((r) => r[1] === "QB").map((r) => r[2]));
  const myPCteams = new Set(mine.filter((r) => r[1] === "WR" || r[1] === "TE").map((r) => r[2]));
  const myRBteams = new Set(mine.filter((r) => r[1] === "RB").map((r) => r[2]));

  const goneSoon = avail
    .slice(0, 24)
    .map((o) => ({ n: o.r[0], pg: pGoneBy(o.r, back, cur, shift[o.r[1]]) }))
    .filter((x) => x.pg >= 0.6)
    .slice(0, 4);

  const cands: Candidate[] = [];
  (["RB", "WR", "QB", "TE"] as Pos[]).forEach((ps) => {
    const pool = avail.filter((o) => o.r[1] === ps);
    if (!pool.length) return;
    const nb = nextBest(ps, avail, back, cur, shift[ps]);
    let kept = 0;
    pool.slice(0, 18).forEach((now, k) => {
      if (kept >= 4) return;
      const g = GP[now.r[0]];
      /* between your picks, judge players by their odds of actually reaching your turn */
      const pReach = onClock ? 1 : Math.max(0.02, 1 - pGoneBy(now.r, takeAt, cur, shift[ps]));
      if (k >= 2 && pReach < 0.2) return;
      if (k > 0 && onClock && now.i - pool[0].i > 8) return;
      kept++;
      const pGone = pGoneBy(now.r, back, cur, shift[ps]);
      const gap = Math.max(0, g.proj - nb.ev);
      let s = w[ps] * (g.vorp + 1.25 * gap);
      if (!onClock) s *= 0.1 + 0.9 * pReach;
      s *= vmul[now.r[4]] ?? 1;
      s *= phaseMul(now.r[8], myCount);
      const tier = now.r[6];
      const tLeft = tierSurvivors(ps, tier, avail, back, cur, shift[ps]);
      const cliff = tLeft < 1.5 && gap >= 0.8;
      if (cliff) s *= 1.05;
      /* stacking research: QB↔WR1 weekly r≈0.43, QB↔TE1 r≈0.27 — a tiebreaker, never a reach.
         Two same-team pass-catchers = negative outside elite offenses; RB+WR same team mildly negative. */
      const stack =
        ((ps === "WR" || ps === "TE") && myQBteams.has(now.r[2])) ||
        (ps === "QB" && myPCteams.has(now.r[2]));
      if (stack) s *= 1.03;
      const antiStack = !stack && (ps === "WR" || ps === "TE") && myPCteams.has(now.r[2]) && (PO[now.r[2]] || 0) < 73;
      if (antiStack) s *= 0.97;
      if (!stack && ((ps === "RB" && myPCteams.has(now.r[2])) || ((ps === "WR" || ps === "TE") && myRBteams.has(now.r[2])))) s *= 0.985;
      if (myCount >= 5 && ps !== "RB") {
        const po = PO[now.r[2]] || 67;
        s *= 1 + Math.max(-0.02, Math.min(0.025, (po - 68) / 450));
      }
      const cuffOf = cuffTargets[now.r[0]];
      if (myCount >= 9 && cuffOf) s += 1.8;
      const b = BYE[now.r[2]];
      const clash = !!(b && byeCount[b] >= 2);
      if (clash) s *= byeCount[b] >= 3 ? 0.88 : 0.94;
      const fell = Math.round(takeAt - mktADP(now.r));
      if (fell >= 6) s *= 1.04;
      cands.push({ p: ps, now, later: nb.likely, proj: g.proj, vNow: g.vorp, evLater: nb.ev, gap, pGone, pReach, score: s, clash, bye: b, cuffOf, cliff, tier, stack, antiStack, fell });
    });
  });
  cands.sort((x, y) => y.score - x.score);

  let dream: Advice["dream"] = null;
  if (!onClock && nextPick) {
    const topC = cands[0];
    for (const o of avail.slice(0, 15)) {
      const pr = 1 - pGoneBy(o.r, takeAt, cur, shift[o.r[1]]);
      if (pr >= 0.04 && pr < 0.38 && GP[o.r[0]].proj > (topC ? topC.proj + 0.7 : 0)) {
        dream = { o, pr };
        break;
      }
    }
  }

  const seen = new Set<string>();
  const deduped = cands.filter((c) => {
    if (seen.has(c.now.r[0])) return false;
    seen.add(c.now.r[0]);
    return true;
  });
  /* two-pick sequencing: A now + expected best of B's position later, vs the reverse */
  let look: Lookahead | null = null;
  const t0 = deduped[0];
  const t1 = deduped.find((c) => t0 && c.p !== t0.p);
  if (t0 && t1) {
    const AB = t0.proj + t1.evLater;
    const BA = t1.proj + t0.evLater;
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
    run, look, cands: deduped, warnings, plainWarn, goneSoon, dream,
    horizon: { takeAt, back },
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
