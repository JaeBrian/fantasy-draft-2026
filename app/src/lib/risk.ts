import type { Pos, Verdict } from "../data";
import { SLP } from "../sleeper";

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

const BASE_CV: Record<string, number> = { QB: 0.26, RB: 0.44, WR: 0.40, TE: 0.42 };
const BASE_MISS: Record<string, number> = { QB: 0.14, RB: 0.30, WR: 0.22, TE: 0.24 };
const VERDICT_CV: Record<string, number> = { buy: 0.95, solid: 1.0, risk: 1.22, avoid: 1.32 };
const VERDICT_MISS: Record<string, number> = { buy: 1.0, solid: 1.0, risk: 1.3, avoid: 1.5 };

export interface Risk {
  /** spread of his season outcome around the projection */
  cv: number;
  /** chance he misses a meaningful stretch */
  pMiss: number;
  /** plain-English reasons this player is less certain than his projection suggests */
  flags: string[];
}

export function riskOf(name: string, pos: Pos, verdict: Verdict): Risk {
  const s = SLP[name] ?? {};
  let cv = BASE_CV[pos] ?? 0.4;
  let pMiss = BASE_MISS[pos] ?? 0.25;
  const flags: string[] = [];

  cv *= VERDICT_CV[verdict] ?? 1;
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
      cv *= 1.3;
      pMiss *= 1.45;
      flags.push(`${age} years old — well past the running-back cliff`);
    } else if (pos === "RB" && age >= 29) {
      cv *= 1.15;
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

  return { cv, pMiss: Math.min(0.75, pMiss), flags };
}
