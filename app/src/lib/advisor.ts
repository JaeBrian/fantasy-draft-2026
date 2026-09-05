import { offBoardPick } from "./sleeper-draft";
import { P, BYE, CUFFS, MKT, VEGAS, type PlayerRow, type Pos, type Verdict } from "../data";
import { SLP } from "../sleeper";
import { PROJ } from "../projections";
import { CEIL } from "../ceilings";
import { pinnedPick } from "./intel";
import { cuffUplift, riskOf, missShareOf } from "./risk";

/* ---- measured teammate correlation ------------------------------------------------------
 * scripts/sim-correlation.mjs, 2025 weekly half-PPR logs. 2025 rosters were reconstructed
 * from the team snap counts carried on every stats row (teammates in a week share the exact
 * tm_off_snp / tm_def_snp / tm_st_snp triple), because Sleeper's stats have no team field and
 * the players endpoint only knows where someone plays now.
 *
 * Every figure is quoted against a control of non-teammate pairs, which came back at ~0.000
 * for every position pair — so these are teammate effects, not a league-wide weekly rhythm.
 *
 *   QB-WR  +0.342  (n=87)  <- real, and large
 *   QB-TE  +0.236  (n=49)  <- real
 *   QB-RB  +0.071  (n=71)  <- real, small
 *   RB-WR  +0.001  (n=223) <- nothing
 *   WR-WR  +0.006  (n=108) <- nothing
 *   RB-RB  +0.023  (n=53)  <- nothing
 *
 * Only pairs clearing two combined standard errors are carried. The rest are set to zero
 * deliberately: "two Rams cannibalise each other" is a widely held belief that the game logs
 * do not support, and encoding it anyway would be adding a bias with no evidence behind it.
 *
 * Caveat worth keeping in view: a pair must share 8+ weeks with BOTH playing to be measured,
 * so a pure handcuff — who only plays when the starter is hurt — is excluded by construction.
 * This answers "given both are startable, do they move together?", which is the question that
 * matters when both are in your lineup, but it is not a claim about handcuffs. */
const TEAMMATE_RHO: Record<string, number> = { "QB-WR": 0.342, "QB-TE": 0.236, "QB-RB": 0.071 };

/** Correlation between two players' weekly scores. Zero unless they are teammates in a pair
 *  the data actually called. */
const CORR = (a: PlayerRow, b: PlayerRow): number => {
  if (a[2] !== b[2]) return 0;                       // different teams — independent
  return TEAMMATE_RHO[[a[1], b[1]].sort().join("-")] ?? 0;
};

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
  /** within 2% of the top score — the model cannot honestly separate these; take your pick */
  tied?: boolean;
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
  /** how many teams picking before your next turn still need each position, and how many
   *  pick at all. This is the thing ADP cannot see: a run is coming when the room needs the
   *  position, not when the board says it is scarce. */
  runAhead: { pos: Pos; need: number; of: number }[];
  /** your current starters, scored on measured 2025 week-to-week distributions */
  lineup: { mid: number; floor: number; ceiling: number; starters: number } | null;
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
/* Player value comes from Sleeper's own 2026 half-PPR projection, per game. The curves above
 * are only a fallback for anyone Sleeper has no projection for (currently 1 of 170).
 *
 * This used to be curve-only, and that was a real problem: a player's projection was a pure
 * function of where OUR board ranked him, so the model had no independent opinion — it simply
 * restated the board. Against real projections the curves carried a mean absolute error of
 * 1.99 pts/wk, as large as the differences we were drawing conclusions from, and they were
 * biased: quarterbacks overrated by ~5 pts/wk, Justin Jefferson by 4.7.
 *
 * The board now does the thing it is actually good at — the verdict, tier and tags applied
 * further down as multipliers. That is our research edge over the projection, not a
 * substitute for having one. */
/* Sleeper projects points in games a player PLAYS. What you actually get is that times the
 * share of the season he is available, and those differ by a lot more than the projections do.
 *
 * The advisor was scoring on the raw figure while the simulations applied a chance of missing
 * time, so the two disagreed systematically — and always in the same direction, because
 * running backs carry a higher base miss rate than receivers. At Emily's third pick it had her
 * taking Javonte Williams (12.84 projected, 30% chance of missing a stretch) over Zay Flowers
 * (12.61, 22%), and the simulation preferred Flowers by 1.21 pts/wk against a 0.63 threshold.
 * Javonte grades higher only if you assume he plays every week.
 *
 * When the sim does take a player out he still returns for roughly 60% of the season, so the
 * expected multiplier is 1 - 0.4 x pMiss. That is the same arithmetic the simulation performs,
 * moved to where the recommendation is made. */
const availOf = (name: string, pos: Pos, verdict: Verdict): number =>
  1 - missShareOf(riskOf(name, pos, verdict));

const projOf = (name: string, pos: Pos, posRank: number): number =>
  (PROJ[name] !== undefined ? PROJ[name] : PPG[pos](posRank)) + cuffUplift(name);

/** Replacement level: what the last startable player at each position is actually projected
 *  for, read off the real distribution rather than assumed from a curve. A 12-team lineup
 *  starts 1 QB, 2 RB, 2 WR, 1 TE and 2 flex, so the flex spots push RB and WR deeper. */
/* Replacement level, MEASURED rather than assumed. Simulating 3,000 drafted leagues and
 * counting who actually appears in the twelve starting lineups gives 12.0 quarterbacks, 31.3
 * backs, 39.5 receivers and 13.2 tight ends per league — so the last starter sits at roughly
 * QB12, RB31, WR40, TE13.
 *
 * The old WR34 was the load-bearing error. Both flex spots go to receivers far more often than
 * that implied, and because RB value falls away faster than WR (10.8 at RB24 down to 8.9 by
 * RB32, against 10.7 to 9.7 for WR), calling RB32 replacement while calling WR34 replacement
 * handed running backs a structural edge in every comparison the advisor made. It showed up as
 * the simulation preferring a receiver the advisor had ranked behind a back — twice, at two
 * different seats, which is what sent us looking. */
const REPL_RANK: Record<Pos, number> = { QB: 12, RB: 31, WR: 40, TE: 13, K: 1, DST: 1 };
const REPL: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 7, DST: 7 };
const GP: Record<string, { pr: number; proj: number; vorp: number }> = {};
{
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const byPos: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
  P.forEach((r) => {
    const pr = ++c[r[1]];
    /* expected points, not healthy-week points */
    const proj = projOf(r[0], r[1], pr) * availOf(r[0], r[1], r[4]);
    GP[r[0]] = { pr, proj, vorp: 0 };
    byPos[r[1]]?.push(proj);
  });
  (["QB", "RB", "WR", "TE"] as Pos[]).forEach((pos) => {
    const sorted = byPos[pos].slice().sort((a, b) => b - a);
    REPL[pos] = sorted[Math.min(REPL_RANK[pos] - 1, sorted.length - 1)] ?? 0;
  });
  P.forEach((r) => {
    GP[r[0]].vorp = Math.max(0.2, GP[r[0]].proj - REPL[r[1]]);
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
export const PLAINSHORT: Record<string, string> = {
  QB: "quarterback", RB: "running back", WR: "wide receiver", TE: "tight end",
};

/** What pick this player is expected to come off the board at.
 *
 *  We draft on Sleeper, so Sleeper's own half-PPR ADP is the truth: it is measured from real
 *  Sleeper drafts in our exact scoring format. Mock-market ADP is kept only as a blend partner
 *  to steady players Sleeper has thin data on, and as the fallback when Sleeper has none.
 *
 *  Deliberately NOT used: `SLP.rk`, Sleeper's in-app board-sort rank. It is superflex-flavoured
 *  and lists QBs ~37 picks earlier than a 1-QB league drafts them; pricing on it made the model
 *  expect 3 QBs gone by the end of round 3 when the real number is 2. */
export const mktADP = (row: PlayerRow): number => {
  /* League intel wins outright. If you know he goes at 8, he goes at 8 — a market average
   * built from thousands of other people's drafts is not evidence about this room. */
  const pin = pinnedPick(row[0]);
  if (pin !== undefined) return pin;
  const m = MKT[row[0]];
  const ffc = m ? m[0] : row[3];
  const sadp = SLP[row[0]]?.adp;
  return sadp !== undefined ? 0.75 * sadp + 0.25 * ffc : ffc;
};
/* How far a player can slide from his expected pick.
 *
 * This used to floor at 2.2 picks for everyone, which was badly wrong at the top and doing no
 * work anywhere else. The mock-draft data measures the real spread and it grows steeply with
 * ADP — median 1.3 picks inside the first round, 3.2 by pick 36, 6.1 by 72, 15.3 past 121 —
 * so 0.13 x ADP already covers the deep board. The floor only ever bit at the very top, where
 * the market is most certain of all: Gibbs is measured at 0.7 and Puka at 0.5, and a 2.2 floor
 * had the model believing Gibbs could last to pick 6. No real league leaves him there.
 *
 * So: trust the measurement where we have one, keep the ADP-scaled estimate for the 18 players
 * we do not, and floor at half a pick rather than two. */
const sigmaOf = (row: PlayerRow): number => {
  /* a pin is a near-certainty, so collapse the spread around it rather than leaving the
     model hedging against a market it has been told to ignore */
  if (pinnedPick(row[0]) !== undefined) return 0.8;
  const m = MKT[row[0]];
  return Math.max(0.5, m ? m[1] : 0, 0.13 * mktADP(row));
};

function ncdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Evaluate the normal-tail approximation in log space, including far overdue players. */
function logSurvival(z: number): number {
  if (z < 0) return Math.log(ncdf(-z));
  const t = 1 / (1 + 0.2316419 * z);
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return -0.5 * z * z + Math.log(0.3989423 * poly);
}

/** Conditional probability of selection between the current pick and a later horizon. */
export function pGoneBy(row: PlayerRow, pick: number, cur: number, shift: number): number {
  if (pick <= cur) return 0;
  const a = mktADP(row) + (shift || 0), s = sigmaOf(row);
  const logRatio = logSurvival((pick - a) / s) - logSurvival((cur - a) / s);
  return Math.min(0.97, Math.max(0, -Math.expm1(logRatio)));
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
  /* "best still there" only means something if we walk the pool best-first. That used to be
   * board order, which was fine while projections WERE board order; now that value is
   * independent of the board, sort by it. */
  const pool = avail
    .filter((o) => o.r[1] === ps)
    .sort((a, b) => GP[b.r[0]].proj - GP[a.r[0]].proj);
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

export function advise(DS: DraftState, mySlot: number, ord: string[], blocked?: Set<string>): Advice {
  const all: Slot[] = P.map((r, i) => ({ r, i }));
  /* blocked players are dead to us: never recommended, never counted as future value */
  const avail = all.filter((o) => !DS[o.r[0]] && !blocked?.has(o.r[0]));
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
  const externalMine = Object.keys(DS).filter(n => DS[n] === "mine").map(offBoardPick).filter(p => p !== null);
  const have = (ps: Pos) => mine.filter((r) => r[1] === ps).length + externalMine.filter(p => p.pos === ps).length;
  const qb = have("QB"), rb = have("RB"), wr = have("WR"), te = have("TE");
  const myCount = Object.values(DS).filter(mark => mark === "mine").length;
  const wrt = rb + wr + te;
  const byeCount: Record<number, number> = {};
  mine.forEach((r) => {
    const b = BYE[r[2]];
    if (b) byeCount[b] = (byeCount[b] || 0) + 1;
  });

  const takeAt = onClock || !nextPick ? cur : nextPick;
  const back = Math.max(followPick, takeAt + 1);
  /* a third horizon: positional shelves that keep collapsing (RB) should outrank
     shelves that hold (WR) — this is what full-draft simulation rewards. */
  const back2 = back + (back - takeAt || 12);
  const shift = demandShift(ord, mySlot, cur, back);
  const run = runDetect(ord);
  if (run) shift[run] = (shift[run] || 0) + 1.5;
  /* Calibration: summed across the pool, P(gone by pick k) must equal the number of picks
     that actually happen before k. Raw per-player CDFs over-predict by ~18%. We correct by
     SHIFTING the horizon (bisection on an offset) rather than scaling probabilities — scaling
     would make locks like the 1.01 look available; shifting keeps certainties certain. */
  const calibFor = (pick: number) => {
    const target = Math.max(0, pick - cur);
    const sumAt = (k: number) => {
      let t = 0;
      avail.forEach((o) => { t += pGoneBy(o.r, k, cur, shift[o.r[1]]); });
      return t;
    };
    if (target <= 0) return 0;
    let lo = -24, hi = 4;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (sumAt(pick + mid) > target) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  const offTake = calibFor(takeAt);
  const offBack = calibFor(back);
  const offBack2 = calibFor(back2);
  const pg = (row: PlayerRow, pick: number, off: number) =>
    pGoneBy(row, pick + off, cur, shift[row[1]]);

  /* ---- roster radar: what must be filled, and how fast the shelf is emptying ---- */
  const needSlots: Record<string, number> = {
    QB: Math.max(0, 1 - qb), RB: Math.max(0, 2 - rb), WR: Math.max(0, 2 - wr), TE: Math.max(0, 1 - te),
  };
  const dRB = Math.min(rb, 2), dWR = Math.min(wr, 2), dTE = Math.min(te, 1);
  const flexFilled = Math.max(0, Math.min(2, wrt - dRB - dWR - dTE));
  const skillUnfilled = (2 - dRB) + (2 - dWR) + (1 - dTE) + (2 - flexFilled);
  const picksLeft = 16 - myCount;
  const starterGap = (qb === 0 ? 1 : 0) + skillUnfilled + Number(have("K") === 0) + Number(have("DST") === 0);
  const warnings: string[] = [];
  const plainWarn: string[] = [];
  if (externalMine.some(p => p.pos !== "K" && p.pos !== "DST")) {
    warnings.push("An off-board pick has no player projection; review that roster spot manually.");
    plainWarn.push("check your off-board player: his points are absent from the forecast");
  }
  const mustNow = new Set<Pos>();
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
          expNext += 1 - pg(o.r, back, offBack);
        }
      });
      if (expNow <= needN) {
        if (expNow > 0) mustNow.add(ps);
        warnings.push(`${ps}: only ${expNow} startable left and you still need ${needN} — fill it NOW.`);
        plainWarn.push(`you still need a ${PLAINSHORT[ps]} and there are almost none worth starting left — grab one right now`);
      } else if (expNext < needN + 0.7) {
        mustNow.add(ps);
        warnings.push(`${ps}: startable options likely gone by your next turn (~${expNext.toFixed(1)} left) — this pick or never.`);
        plainWarn.push(`the good ${PLAINSHORT[ps]}s will probably all be taken before your next turn — it's now or never`);
      } else if (expNext < needN + 2) {
        warnings.push(`${ps}: shelf thinning — expect only ~${Math.round(expNext)} startable left at your next turn.`);
        plainWarn.push(`good ${PLAINSHORT[ps]}s are running out — plan to take one soon`);
      }
    });
  }
  if (myCount >= 14 && (have("K") === 0 || have("DST") === 0)) {
    const missing = [have("K") === 0 ? "a kicker" : "", have("DST") === 0 ? "a defense" : ""].filter(Boolean).join(" and ");
    warnings.push(`Use your remaining picks to fill ${missing}.`);
    plainWarn.push(`you still need ${missing}`);
  }
  /* a pick at YOUR slot marked "Taken" means your own turn was recorded as someone else's */
  if (mySlot >= 1) {
    ord.forEach((n, i) => {
      if (snapTeam(i + 1) === mySlot && DS[n] === "gone") {
        warnings.push(`Pick #${i + 1} was YOUR turn but ${n} is marked Taken — if he's actually your player, hit Pick on him.`);
        plainWarn.push(`pick #${i + 1} was your turn, but ${n} is marked as another team's — press Pick on him if he's yours`);
      }
    });
  }

  const w: Record<Pos, number> = {
    /* A backup QB and TE are worth far more than the weights used to allow. Scored week by
     * week with byes live, going 2 QB + 2 TE instead of 1 + 1 is worth +1.3 to +2.7 pts/wk —
     * more than the gap between any two draft strategies. On your starter's bye you otherwise
     * field nobody in the slot. Kept near zero until the late rounds, where the alternative is
     * a sixth wide receiver who will never start. (The sim has no waiver wire, so the true
     * edge is smaller than measured — but it is clearly not 0.05.) */
    QB: qb === 0 ? (myCount >= 5 ? 1 : 0.55) : qb === 1 && myCount >= 10 ? 0.5 : 0.05,
    RB: rb < 2 ? 1.05 : wrt < 7 ? 0.8 : rb >= 6 ? 0.08 : 0.45,
    WR: wr < 2 ? 1.05 : wrt < 7 ? 0.8 : wr >= 6 ? 0.08 : 0.45,
    /* No early-round penalty on your first tight end. This used to be 0.6 until you held three
     * players, which predates having real projections: value over replacement already decides
     * whether a TE is worth the pick, and the extra gate double-charged for it. With Sleeper's
     * numbers the position is genuinely top-heavy — TE3 projects 12.3 against a TE13
     * replacement of 7.4 — and the old gate had the advisor passing an elite tight end for a
     * back with less value over replacement. It does not risk a round-1 TE: at pick 1 Gibbs
     * carries 11.5 of VORP against Bowers's 5.5, and the weights cannot close that. */
    TE: te === 0 ? 0.85 : te === 1 && myCount >= 10 ? 0.6 : 0.07,
    K: 0,
    DST: 0,
  };
  const bestAt = (ps: Pos) =>
    avail.filter((o) => o.r[1] === ps).sort((a, b) => GP[b.r[0]].proj - GP[a.r[0]].proj)[0];
  const bestQB = bestAt("QB");
  const bestTE = bestAt("TE");
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
  /* (the RB-team set was only used by the RB+WR anti-stack penalty, which the correlation
     measurement retired — see the stacking note below) */

  const cands: Candidate[] = [];
  (["RB", "WR", "QB", "TE"] as Pos[]).forEach((ps) => {
    /* hard roster caps: a third QB or TE is a wasted bench spot in a 1QB/1TE league */
    if (ps === "QB" && qb >= 2) return;
    if (ps === "TE" && te >= 2) return;
    /* Consider candidates by VALUE, not by where our board happens to list them.
     *
     * This used to slice the first 18 available at the position in board order, which was
     * fine while a player's projection WAS his board rank. It is not any more, and the gap
     * bit: Josh Jacobs projects as the 12th best back and goes at pick 29, but our board has
     * him 21st among running backs, so he fell outside the slice and the advisor could not
     * recommend him at all. Same for Burden, Waddle and McMillan at receiver.
     *
     * The board still does its real job below — verdict, tier and tags adjust the score. It
     * just no longer decides who gets to be considered. */
    const pool = avail
      .filter((o) => o.r[1] === ps)
      .sort((a, b) => GP[b.r[0]].proj - GP[a.r[0]].proj);
    if (!pool.length) return;
    const nb = nextBest(ps, avail, back + offBack, cur, shift[ps]);
    const nb2 = nextBest(ps, avail, back2 + offBack2, cur, shift[ps]);
    let kept = 0;
    pool.slice(0, 18).forEach((now, k) => {
      if (kept >= 4) return;
      const g = GP[now.r[0]];
      /* between your picks, judge players by their odds of actually reaching your turn */
      const pReach = onClock ? 1 : Math.max(0.02, 1 - pg(now.r, takeAt, offTake));
      if (k >= 2 && pReach < 0.2) return;
      /* on the clock, do not offer someone far below the best at his position — measured in
         value now that the pool is ordered by it, rather than in board slots */
      if (k > 0 && onClock && GP[pool[0].r[0]].proj - g.proj > 2.5) return;
      kept++;
      const pGone = pg(now.r, back, offBack);
      const gapNext = Math.max(0, g.proj - nb.ev);
      const gapTwo = Math.max(0, g.proj - nb2.ev);
      /* full-round decay counts too, at reduced weight — a shelf that empties over two
         turns is scarcer than one that dips and holds */
      const gap = gapNext + 0.45 * Math.max(0, gapTwo - gapNext);
      let s = w[ps] * (g.vorp + 1.25 * gap);
      if (!onClock) s *= 0.1 + 0.9 * pReach;
      s *= vmul[now.r[4]] ?? 1;
      s *= phaseMul(now.r[8], myCount);
      /* live Sleeper signals: a player listed Out/IR/PUP can't be your pick no matter the note */
      const liveInj = SLP[now.r[0]]?.inj;
      if (liveInj === "O" || liveInj === "IR" || liveInj === "PUP" || liveInj === "SUS" || liveInj === "NA") s *= 0.55;
      else if (liveInj === "D") s *= 0.85;
      else if (liveInj === "Q") s *= 0.97;
      const liveTrend = SLP[now.r[0]]?.trend;
      if (liveTrend !== undefined && Math.abs(liveTrend) >= 5000) s *= liveTrend > 0 ? 1.02 : 0.98;
      const tier = now.r[6];
      const tLeft = tierSurvivors(ps, tier, avail, back + offBack, cur, shift[ps]);
      const cliff = tLeft < 1.5 && gap >= 0.8;
      if (cliff) s *= 1.05;
      /* Stacking. These used to be three rules taken from published research; we have now
       * measured all three ourselves on 2025 game logs, against a control of non-teammate
       * pairs that came back at ~0.000 (scripts/sim-correlation.mjs). Two survived and one
       * did not:
       *
       *   QB with his own pass-catcher   cited r≈0.43 / 0.27    measured +0.342 / +0.236  KEPT
       *   two same-team pass-catchers    assumed negative       measured +0.006 (n=108)   GONE
       *   RB + WR, same team             assumed negative       measured +0.001 (n=223)   GONE
       *
       * The quarterback stack holds up — our own number is a little smaller than the cited
       * one but the same effect, and it stays a tiebreaker rather than a reason to reach.
       *
       * The two anti-stack penalties do not hold up at all, so they are removed. "Two Rams
       * eat each other's lunch" is widely believed and simply is not in the game logs: a
       * receiver pairs with his own teammate exactly the way he pairs with a stranger. The
       * penalties were small (0.97 and 0.985) but they applied to every same-team pair on the
       * board, and a small bias with no evidence behind it is still a bias.
       *
       * What the correlation genuinely changes is the SPREAD of a stacked lineup, not the
       * value of the pick — and that is handled properly now in the floor/ceiling below. */
      const stack =
        ((ps === "WR" || ps === "TE") && myQBteams.has(now.r[2])) ||
        (ps === "QB" && myPCteams.has(now.r[2]));
      if (stack) s *= 1.03;
      const antiStack = false;
      if (myCount >= 5 && ps !== "RB") {
        const po = PO[now.r[2]] || 67;
        s *= 1 + Math.max(-0.02, Math.min(0.025, (po - 68) / 450));
      }
      const cuffOf = cuffTargets[now.r[0]];
      if (myCount >= 9 && cuffOf) s += 1.8;
      const b = BYE[now.r[2]];
      /* byeCount is the roster BEFORE this pick, so `>= 2` only fired on the third player
       * sharing a week — the second one, which is the one that actually creates the hole, went
       * through unpenalised. That is how Zay Flowers landed on Derrick Henry's week-13 bye with
       * nothing said. Trigger on the pick that creates the clash, not the one that deepens it. */
      const clash = !!(b && byeCount[b] >= 1);
      /* MEASURED, not judged — scripts/sim-byecost.mjs. Identical rosters, identical
       * projections, only the bye weeks moved, 15,000 seasons each:
       *
       *   2 starters on one bye   -0.29 pts/wk
       *   3 starters              -1.03
       *   4 starters              -1.73
       *
       * So the cost of each extra body on a used week is roughly 0.29, then 0.74, then 0.70 —
       * it is a hole in the schedule, near enough ABSOLUTE, and not proportional to how good
       * the player is. The old multipliers (0.88, then 0.78) happened to charge about the
       * right amount for the second player — 0.25 against a measured 0.29 on a two-point
       * candidate — but badly under-charged the third: 0.45 against a measured 1.03. Two
       * Packers is fine; three is the mistake, and the multiplier form hid that.
       *
       * Subtract the measured cost instead. On a cheap late-round player a multiplier would
       * charge almost nothing for a hole that costs the same whoever fills it. */
      const BYE_COST = [0, 0.29, 1.03, 1.73];
      if (clash) s -= BYE_COST[Math.min(byeCount[b], BYE_COST.length - 1)];
      const fell = Math.round(takeAt - mktADP(now.r));
      if (fell >= 6) s *= 1.04;
      cands.push({ p: ps, now, later: nb.likely, proj: g.proj, vNow: g.vorp, evLater: nb.ev, gap, pGone, pReach, score: s, clash, bye: b, cuffOf, cliff, tier, stack, antiStack, fell });
    });
  });
  /* A starting slot that can no longer wait overrides every score. Two triggers, both already
   * computed by the roster radar above: no spare picks remain (every pick must fill a slot),
   * or a slot is unfilled and its startable shelf is expected to be empty by your NEXT turn —
   * the "this pick or never" warning, now enforced instead of merely printed. Found by
   * audit-advisor on Aug 31: small opponent-ADP shifts let the lookahead defer the first TE
   * turn after turn; the advisor then spent its one spare pick on a seventh runner at pick 145
   * with the last startable TE on the board, and finished QB1 RB6 WR7 TE0 — a roster that
   * fields a zero at TE every week, a cost no candidate score can express. */
  const spareLeft = picksLeft - starterGap;
  const forced = (["QB", "RB", "WR", "TE"] as Pos[]).filter(
    (p) => needSlots[p] > 0 && (spareLeft <= 0 || mustNow.has(p)),
  );
  if (forced.length) {
    const keep = cands.filter((c) => forced.includes(c.p) || (spareLeft <= 0 && c.p !== "QB" && flexFilled < 2));
    if (keep.length) { cands.length = 0; cands.push(...keep); }
  }
  cands.sort((x, y) => y.score - x.score);

  let dream: Advice["dream"] = null;
  if (!onClock && nextPick) {
    const topC = cands[0];
    for (const o of avail.slice(0, 15)) {
      const pr = 1 - pg(o.r, takeAt, offTake);
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

  /* Flag near-ties. The score is not precise enough to rank players this close, and
   * presenting a coin flip as an ordered instruction is how the panel ends up telling you to
   * pass the better player. At pick 3 with Gibbs and Bijan gone, Jonathan Taylor outscored
   * Ja'Marr Chase by 0.024 on a 14.3 scale — 0.17%.
   *
   * We deliberately do NOT reorder them. Chase leads on projection, VORP, our board rank and
   * market ADP; Taylor leads on the two-pick lookahead, which is the more principled test
   * (Taylor now plus the best WR left at your next turn beats Chase now plus the best RB, by
   * 0.15, because WR is the deeper position). A 5,000-season simulation put Chase ahead by
   * 0.25. Both edges are far inside the noise, so the honest answer is that it is the
   * drafter's call — the UI says so rather than the model pretending to know. */
  const TIE_BAND = 0.02;
  if (deduped.length > 1) {
    const lead = Math.max(deduped[0].score, deduped[1].score);
    deduped.slice(0, 3).forEach((c) => {
      if (c.score >= lead * (1 - TIE_BAND)) c.tied = true;
    });
    if (deduped.filter((c) => c.tied).length < 2) deduped.forEach((c) => { c.tied = false; });
  }
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
  /* The sequencing check compares raw projections and ignores whether the player will still
   * be there, so it must not overturn a decisive score. At Emily's pick 10 it promoted James
   * Cook (score 6.55, on the board ~25% of the time) over Justin Jefferson (7.90) — and a
   * 5,000-season run has Jefferson as her single best first pick. Only let it reorder when
   * the two are genuinely close; the score already carries availability and risk. */
  const FLIP_BAND = 0.06;
  if (look?.flipped) {
    const i = deduped.indexOf(look.first);
    if (i > 0 && look.first.score >= deduped[0].score * (1 - FLIP_BAND)) {
      deduped.splice(i, 1);
      deduped.unshift(look.first);
    } else if (i > 0) {
      look = { first: deduped[0], second: look.first, edge: look.edge };
    }
  }
  /* players to write off: gone before the pick you're actually planning for,
     never including the players we're recommending */
  const recommended = new Set(deduped.slice(0, 4).map((c) => c.now.r[0]));
  const gsPick = onClock ? back : takeAt;
  const goneSoon = avail
    .slice(0, 24)
    .filter((o) => !recommended.has(o.r[0]))
    .map((o) => ({ n: o.r[0], pg: pg(o.r, gsPick, gsPick === back ? offBack : offTake) }))
    .filter((x) => x.pg >= 0.6)
    .slice(0, 4);
  /* Who picks between now and your next turn, and what do they still need? Eleven other
   * rosters are visible in the draft state, so this is knowable — and it is the part ADP
   * structurally cannot tell you. A back is not scarce because a list says so; he is scarce
   * because six of the eight teams ahead of you have no running back yet. */
  const runAhead: Advice["runAhead"] = [];
  {
    const rosters: Record<number, PlayerRow[]> = {};
    for (let t = 1; t <= 12; t++) rosters[t] = [];
    ord.forEach((n, i) => {
      const r = P.find((x) => x[0] === n);
      if (r) rosters[snapTeam(i + 1)].push(r);
    });
    const until = onClock ? back : takeAt;
    const want: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    let teams = 0;
    for (let pk = cur; pk < until; pk++) {
      const t = snapTeam(pk);
      if (mySlot >= 1 && t === mySlot) continue;
      teams++;
      const { need, flexOpen } = teamNeeds(rosters[t]);
      (["QB", "RB", "WR", "TE"] as Pos[]).forEach((ps) => {
        if (need[ps] || (flexOpen && (ps === "RB" || ps === "WR"))) want[ps]++;
      });
    }
    (["RB", "WR", "TE", "QB"] as Pos[]).forEach((ps) => {
      if (teams > 0) runAhead.push({ pos: ps, need: want[ps], of: teams });
    });
  }

  /* What your starters actually look like week to week, from measured 2025 distributions
   * rather than from the projection alone. A lineup of steady players and a lineup of
   * boom-bust players can average the same and win very different numbers of weeks. */
  let lineup: Advice["lineup"] = null;
  if (mine.length) {
    const val = (r: PlayerRow) => (PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6) + cuffUplift(r[0]);
    const by = (ps: Pos) => mine.filter((r) => r[1] === ps).sort((a, b) => val(b) - val(a));
    const qbs = by("QB"), rbs = by("RB"), wrs = by("WR"), tes = by("TE");
    const used = new Set<string>();
    const picked: PlayerRow[] = [];
    const take = (a: PlayerRow[], n: number) =>
      a.slice(0, n).forEach((r) => { picked.push(r); used.add(r[0]); });
    take(qbs, 1); take(rbs, 2); take(wrs, 2); take(tes, 1);
    take([...rbs, ...wrs, ...tes].filter((r) => !used.has(r[0])).sort((a, b) => val(b) - val(a)), 2);
    if (picked.length) {
      /* Adding p10s together answers "what if all eight have their worst week at once" — that
       * is a correlation-of-1.0 question, and it is not the one anyone is asking. Eight
       * players do not bottom out in the same week; their ups and downs partly cancel. So
       * combine VARIANCES, which is where correlation actually enters:
       *
       *     Var(total) = Σ σi²  +  2 Σi<j  ρij σi σj
       *
       * ρ is measured, not assumed — scripts/sim-correlation.mjs, 2025 game logs, teammate
       * pairs against a non-teammate control that came back at ~0.000 across the board:
       *
       *     QB-WR +0.34    QB-TE +0.24    QB-RB +0.07     (same team, real)
       *     RB-WR  0.00    WR-WR  0.00    RB-RB  0.02     (nothing — see below)
       *
       * Worth stating plainly because the folk wisdom says otherwise: two receivers off one
       * team, or a back and a receiver off one team, do NOT measurably eat each other's
       * lunch. They behave like strangers. What is real is the quarterback stack, and it cuts
       * the other way — a stacked lineup is genuinely swingier, higher ceiling and lower
       * floor, and until now we were not showing that. */
      const Z = 1.2816;                                  // p10/p90 of a normal
      const sig: number[] = [];
      let mid = 0;
      picked.forEach((r) => {
        const c = CEIL[r[0]];
        const v = val(r);
        mid += v;
        if (c && c.games >= 6) {
          const med = (c.p10 + c.p90) / 2 || v;
          const k = med > 0 ? v / med : 1;
          sig.push(Math.max(0, ((c.p90 - c.p10) * k) / (2 * Z)));
        } else {
          /* unmeasured: a flat band, same shape as before, so one rookie cannot distort it */
          sig.push((v * 1.5 - v * 0.55) / (2 * Z));
        }
      });

      let varTot = sig.reduce((s, x) => s + x * x, 0);
      for (let i = 0; i < picked.length; i++)
        for (let j = i + 1; j < picked.length; j++) {
          const rho = CORR(picked[i], picked[j]);
          if (rho) varTot += 2 * rho * sig[i] * sig[j];
        }
      const sd = Math.sqrt(Math.max(0, varTot));
      lineup = { mid, floor: mid - Z * sd, ceiling: mid + Z * sd, starters: picked.length };
    }
  }

  return {
    qb, rb, wr, te, wrt, myCount, cur, onClock, nextPick, byeCount,
    run, look, cands: deduped, warnings, plainWarn, goneSoon, dream,
    horizon: { takeAt, back }, runAhead, lineup,
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
    const cap = ({ QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 } as Record<string, number>)[p] || 0;
    if (fill[p] && fill[p].length < cap) fill[p].push(r[0]);
    else if (["RB", "WR", "TE"].includes(p) && fill.FLX.length < 2) fill.FLX.push(r[0]);
    else fill.BN.push(r[0]);
  });
  for (const [key, mark] of Object.entries(DS)) {
    const p = mark === "mine" ? offBoardPick(key) : null;
    if (!p) continue;
    const cap = ({QB:1,RB:2,WR:2,TE:1,K:1,DST:1} as Record<string,number>)[p.pos] ?? 0;
    if (fill[p.pos] && fill[p.pos].length < cap) fill[p.pos].push(p.name);
    else if (["RB","WR","TE"].includes(p.pos) && fill.FLX.length < 2) fill.FLX.push(p.name);
    else fill.BN.push(p.name);
  }
  const out: RosterSlot[] = [];
  slots.forEach(([s, n]) => {
    for (let k = 0; k < n; k++) {
      const label = s + (n > 1 && s !== "FLX" && s !== "BN" ? k + 1 : "");
      out.push({ label, player: fill[s][k] });
    }
  });
  return out;
}
