import { CUFFS, P, type PlayerRow, type Pos, type Verdict } from "../data";
import { PROJ } from "../projections";
import { SLP } from "../sleeper";
import { CEIL } from "../ceilings";
import { newsTagged, topNews } from "./news";

/* One definition of how uncertain a player is, shared by the advisor and every simulation so
 * the two cannot drift apart.
 *
 * Until now the spread and injury numbers were flat constants per position — every running
 * back got the same 44% coefficient of variation and the same 30% chance of missing time,
 * whether he was a 24-year-old bellcow or a 32-year-old on his third contract. Sleeper carries
 * the facts that separate them, so use them:
 *
 *   depth chart order   a back listed second is not a starter, whatever his projection says
 *   age                 running backs fall off a cliff around 29 in a way receivers do not
 *   experience          a rookie's range is wider than his projection implies
 *
 * The multipliers below are still judgement, not fitted values — but they are now applied to
 * real per-player facts rather than to everyone at a position equally. Where the data is
 * missing (1 of 170 players) everything falls back to the position baseline. */

/* How long is he out for? Wire copy writes durations in words as often as digits — "expected
 * to miss about a week" — and the first version only read digits, fell through to a three-week
 * default, and tripled a knock the same sentence called no danger for Week 1.
 *
 * Built once at module load rather than per call: riskOf runs a few hundred thousand times
 * inside a single simulation, and compiling these on every one of them halved the throughput. */
const NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  several: 3, couple: 2, few: 3, multiple: 3,
};
const val = (s: string) => NUM[s.toLowerCase()] ?? Number(s);
const N = "a|an|one|two|three|four|five|six|several|couple|few|multiple|\\d+";
const HEDGE = "(?:about |around |roughly |at least )?";
const WK_RANGE = new RegExp(`\\b(${N})\\s*(?:-|–|to)\\s*(${N})\\s*weeks?`, "i");
const WK_ONE = new RegExp(`\\b${HEDGE}(${N})\\s*weeks?`, "i");
const MONTHS = new RegExp(`\\b${HEDGE}(${N})\\s*months?`, "i");

const BASE_CV: Record<string, number> = { QB: 0.26, RB: 0.44, WR: 0.40, TE: 0.42 };
const BASE_MISS: Record<string, number> = { QB: 0.14, RB: 0.30, WR: 0.22, TE: 0.24 };
const VERDICT_CV: Record<string, number> = { buy: 0.95, solid: 1.0, risk: 1.22, avoid: 1.32 };
const VERDICT_MISS: Record<string, number> = { buy: 1.0, solid: 1.0, risk: 1.3, avoid: 1.5 };

export interface Risk {
  /** spread of his season outcome around the projection */
  cv: number;
  /** chance he misses a meaningful stretch */
  pMiss: number;
  /** Minimum fraction of the season missed according to sourced absence reports. */
  knownMiss: number;
  /** plain-English reasons this player is less certain than his projection suggests */
  flags: string[];
}

export function riskOf(name: string, pos: Pos, verdict: Verdict): Risk {
  const s = SLP[name] ?? {};
  let cv = BASE_CV[pos] ?? 0.4;
  const flagsFromData: string[] = [];

  /* Where a player has a real 2025 game log, use his measured week-to-week spread instead of
   * the position assumption — shrunk toward the baseline by sample size, because a six-game
   * distribution is not worth the same as a seventeen-game one. n/(n+8) puts a full season at
   * about two-thirds measured.
   *
   * This corrected the assumption in both directions and neither was small: McCaffrey was
   * being charged 0.65 for age and a risk verdict when he actually ran at 0.37, one of the
   * steadiest players in football, while Gibbs was assumed 0.44 and measured 0.66. */
  const m = CEIL[name];
  if (m && m.games >= 6) {
    const w = m.games / (m.games + 8);
    cv = w * m.cv + (1 - w) * cv;
    if (m.boom >= 0.28) flagsFromData.push(`wins a week on his own ${Math.round(m.boom * 100)}% of the time`);
    if (m.boom <= 0.05 && m.games >= 10) flagsFromData.push("no ceiling — never cleared 1.5x his own median in 2025");
    if (m.bust >= 0.28) flagsFromData.push(`disappeared in ${Math.round(m.bust * 100)}% of his 2025 games`);
  }
  let pMiss = BASE_MISS[pos] ?? 0.25;
  let knownMiss = 0;
  const flags: string[] = [];

  /* the verdict still moves availability, but only nudges spread once we have measured it —
     the measurement already contains whatever made us call him risky */
  cv *= m && m.games >= 6 ? 1 + ((VERDICT_CV[verdict] ?? 1) - 1) * 0.4 : (VERDICT_CV[verdict] ?? 1);
  pMiss *= VERDICT_MISS[verdict] ?? 1;

  /* live injury designation */
  if (s.inj && ["O", "IR", "PUP", "SUS", "NA"].includes(s.inj)) {
    cv *= 1.2;
    pMiss *= 1.5;
    flags.push(`listed ${s.inj}`);
  } else if (s.inj === "D") {
    cv *= 1.1;
    pMiss *= 1.25;
  } else if (s.inj === "Q") {
    cv *= 1.05;
  }

  /* not the starter. For receivers this is normal — teams field three — so only a genuine
     third-stringer counts. For a back or a tight end, second on the chart is the whole story. */
  const dc = s.dc;
  if (dc !== undefined) {
    if ((pos === "RB" || pos === "TE") && dc >= 2) {
      cv *= 1.35;
      pMiss *= 1.15;
      flags.push(`listed #${dc} on the depth chart`);
    } else if (pos === "WR" && dc >= 3) {
      cv *= 1.2;
      flags.push(`listed #${dc} among the receivers`);
    }
  }

  /* age. The running-back cliff is real and steep; receivers and quarterbacks age far better. */
  const age = s.age;
  if (age !== undefined) {
    if (pos === "RB" && age >= 31) {
      if (!m) cv *= 1.3;
      pMiss *= 1.45;
      flags.push(`${age} years old — well past the running-back cliff`);
    } else if (pos === "RB" && age >= 29) {
      if (!m) cv *= 1.15;
      pMiss *= 1.25;
      flags.push(`${age} years old for a running back`);
    } else if (pos !== "RB" && age >= 32) {
      cv *= 1.12;
      pMiss *= 1.2;
      flags.push(`${age} years old`);
    }
  }

  /* rookies: the projection is a guess with a wider range behind it */
  if (s.exp === 0) {
    cv *= 1.25;
    flags.push("rookie — widest range on the board");
  }

  /* ---- the wire --------------------------------------------------------------------------
   * A reported absence is direct evidence about AVAILABILITY, which is exactly what pMiss
   * models, so this is the one place a news item legitimately enters the arithmetic. It moves
   * availability and nothing else — it never touches the projection, and the flag it produces
   * carries the reporter's name so the adjustment can be argued with.
   *
   * Only sourced items reach here: scripts/fetch-news.mjs drops 57% of the feed for having no
   * primary attribution, and guards the rest against past-season recaps, injuries belonging to
   * another player named in the same sentence, and negation ("NOT expected to miss").
   *
   * Sleeper's own injury_status is a designation, which is a different and slower thing. Alvin
   * Kamara read "Q" on the morning Schefter reported a month on the shelf. */
  const top = topNews(name);
  if (top?.g) {
    /* Wire copy writes durations in words as often as digits, and the first version of this
     * only read digits. "expected to miss about a week" matched no pattern, fell through to a
     * three-week default, and tripled a knock that the same sentence said left Week 1 "not in
     * any danger". So read the words too, and when nothing at all parses assume the smaller
     * number — an unreadable report is not evidence of a long absence. */
    /* a range takes its upper bound: "2-3 weeks" is three */
    const parse = (d: string): number | null => {
      const wkRange = WK_RANGE.exec(d);
      const wk = wkRange ?? WK_ONE.exec(d);
      const mo = MONTHS.exec(d);
      if (mo) return 4.3 * (val(mo[1]) || 1);
      if (wk) return val(wkRange ? wkRange[2] : wk[1]) || 1;
      return null;
    };

    /* turn the report into games missed out of a 17-week season */
    let miss = 0, by = top.a;
    if (top.g === "out") miss = 17;
    else if (top.g === "miss" || top.g === "ir") {
      /* The newest "miss" item is not always the most specific one. Five days after Schefter
       * put Kamara out "at least a month", a Kendre Miller quote arrived saying Kamara "is
       * expected to miss time, possibly into the regular season" — no number, so it read as
       * one week and quietly replaced the month. Use the newest miss item that carries a
       * duration; one week only when none does. */
      const dated = [top, ...newsTagged(name, "miss").filter((n) => n !== top)]
        .map((n) => ({ d: parse(n.d), a: n.a, t: n.t })).find((x) => x.d !== null);
      miss = dated?.d != null ? regularSeasonAbsence(dated.d, dated.t) : 0;
      by = dated?.a ?? top.a;
      /* injured reserve after the cutdown is a four-game minimum — longer only if a report says so */
      if (top.g === "ir") miss = Math.max(4, miss);
    }
    /* `hurt` is deliberately NOT priced. It fires on any mention of a knock — "limited in
     * practice", "left the game" — and in August that is thirty-odd players, most of whom
     * will start Week 1. Treating a practice note as evidence of missed games would inflate
     * risk across half the board on the flimsiest signal. It shows as a flag; nothing else. */

    if (miss > 0) {
      const share = Math.min(1, miss / 17);
      /* a report supersedes the base rate rather than stacking on top of it */
      knownMiss = share;
      cv *= 1 + 0.5 * share;
      flags.push(
        top.g === "out"
          ? `reported out for the season — ${top.a}`
          : top.g === "ir"
          ? `on injured reserve — ${Math.round(miss)}+ games — ${by}`
          : `reported to miss ~${miss < 1 ? "time" : `${Math.round(miss)} week${Math.round(miss) === 1 ? "" : "s"}`} — ${by}`,
      );
    } else if (top.g === "committee" || top.g === "workload" || top.g === "demoted") {
      /* not an availability question — a share-of-work question. Flagged for a human, and
       * deliberately NOT priced: we have no measurement of how much a reported timeshare
       * actually costs, and inventing a number here would be worse than saying so. */
      flags.push(`reported ${top.g === "committee" ? "timeshare" : top.g} — ${top.a}`);
    } else if (top.g === "hurt") {
      flags.push(`knock reported in camp — ${top.a}`);
    }
  }

  const cuff = cuffUplift(name);
  if (cuff >= 0.2) flags.push(`+${cuff.toFixed(1)} pts/wk as ${STARTER_OF[name]}'s handcuff`);

  return { cv, pMiss: Math.min(0.92, pMiss), knownMiss, flags: [...flags, ...flagsFromData] };
}

/* ---- handcuff uplift -----------------------------------------------------------------
 * A backup's projection assumes his starter plays. When the starter carries risk, part of that
 * risk is the backup's upside, and until now nothing priced it — Josh Jacobs' suspension talk
 * moved Jacobs and nobody else. Measured on 2025 game logs (scripts/sim-cuffvalue.mjs): across
 * 41 weeks in which a starter sat, his backup scored 0.65 of the starter's own pts/wk MORE than
 * he did with the starter in (per-pair median 0.71, n=14 pairs — a small sample, so this is a
 * coarse number and is applied only to the listed handcuffs in CUFFS).
 *
 * Expected weeks lost = 0.4 × pMiss, the same arithmetic the advisor and the simulations use
 * for the starter himself. So the uplift is  0.4 × pMiss(starter) × 0.65 × proj(starter). It
 * is added to the backup's projection everywhere the model reads one, for every seat — not
 * only the starter's owner. Suspensions with no reported length are NOT in pMiss, so a "may
 * be suspended" starter moves his backup only through whatever risk he already carries. */
export const CUFF_K = 0.65;
const STARTER_OF: Record<string, string> = Object.fromEntries(Object.entries(CUFFS).map(([st, cf]) => [cf, st]));
const ROW: Record<string, PlayerRow> = Object.fromEntries(P.map((r) => [r[0], r]));
export function cuffUplift(name: string): number {
  const st = STARTER_OF[name];
  const row = st ? ROW[st] : undefined;
  if (!row || PROJ[st] === undefined || STARTER_OF[st]) return 0;   // no starter, or a chain
  return missShareOf(riskOf(st, row[1], row[4])) * CUFF_K * PROJ[st];
}

/** Expected missed fraction. Reported absences are a floor, never an event probability. */
export function missShareOf(risk: { pMiss: number; knownMiss?: number }): number {
  return Math.min(1, Math.max(risk.knownMiss ?? 0, 0.4 * risk.pMiss));
}

/** Draw availability with the same mean as missShareOf, bounded by the reported absence.
 * The residual event rate accounts only for risk beyond that known floor. */
export function seasonAvailability(risk: { pMiss: number; knownMiss?: number }, rnd: () => number): number {
  const known = Math.min(1, Math.max(0, risk.knownMiss ?? 0));
  if (known === 1) return 0;
  const residual = (missShareOf(risk) - known) / (0.4 * (1 - known));
  return (1 - known) * (rnd() < residual ? 0.35 + 0.5 * rnd() : 1);
}

/** Preseason recovery time elapses before it can cost a regular-season week.
 * Weeks are rounded conservatively from the report date; an undated vague report adds no floor. */
export function regularSeasonAbsence(durationWeeks: number, reportedSeconds: number): number {
  const week = 7 * 24 * 60 * 60 * 1000;
  const kickoff = Date.UTC(2026, 8, 9);
  return Math.max(0, Math.min(17, Math.ceil((reportedSeconds * 1000 + durationWeeks * week - kickoff) / week)));
}

/** Preseason absences occupy the opening weeks; residual risk affects later weeks. */
export function unavailableInWeek(risk: { pMiss: number; knownMiss?: number }, week: number, rnd: () => number): boolean {
  const known = Math.min(1, Math.max(0, risk.knownMiss ?? 0));
  if (week <= Math.round(17 * known)) return true;
  return known < 1 && rnd() < Math.max(0, (missShareOf(risk) - known) / (1 - known));
}
