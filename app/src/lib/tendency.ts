/* How THIS room drafts, as opposed to how the market drafts.
 *
 * ADP is an average over thousands of strangers. Your league is twelve specific people, and if
 * they all grew up believing you take backs early then the market's answer to "will he reach
 * me?" is wrong in a direction that costs you real picks. A room that takes fifteen backs in
 * two rounds strips the RB shelf bare three picks earlier than ADP says, and hands you
 * receivers you were not expecting to see.
 *
 * The same machinery as a pin (see intel.ts): state a belief about the room, switch it on, and
 * everything downstream — survival odds, the run forecast, what the advisor bothers to
 * consider, the practice opponents — follows without any of them needing to know about it.
 *
 * The setting is deliberately expressed as A COUNT YOU CAN CHECK rather than a multiplier
 * nobody can reason about: go and look at last year's draft and count the backs in the first
 * two rounds. The shift values below were solved for by simulation, not guessed —
 * scripts/sim-tendency.mjs prints the mapping:
 *
 *     shift      backs in the first 24 picks
 *       0                 12.5      <- the market as it actually prices
 *       8                 15.0
 *      15                 16.7
 *
 * Off by default, and only ever set in the browser, so the simulations and audits keep running
 * against the market rather than against a house style. */

const KEY = "fd26-tendency";

export type RbLean = "market" | "heavy" | "extreme";

/** What each setting means in picks, and what it looks like when you count it. */
export const RB_LEAN: Record<RbLean, { shift: number; backs: string; label: string; blurb: string }> = {
  market: {
    shift: 0,
    backs: "12–13 of 24",
    label: "Market",
    blurb: "Price the room the way ADP does — about half the first two rounds goes to backs.",
  },
  heavy: {
    shift: 8,
    backs: "15 of 24",
    label: "RB-heavy",
    blurb: "Backs go about a round earlier than ADP. The RB shelf empties sooner and receivers last longer than their price suggests.",
  },
  extreme: {
    shift: 15,
    backs: "17 of 24",
    label: "Very RB-heavy",
    blurb: "Two thirds of the first two rounds are backs. Elite receivers routinely fall past their ADP.",
  },
};

let LEAN: RbLean = "market";

function load(): RbLean {
  if (typeof localStorage === "undefined") return "market";
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "heavy" || raw === "extreme" ? raw : "market";
  } catch {
    return "market";
  }
}
LEAN = load();

export const rbLean = (): RbLean => LEAN;

export function setRbLean(v: RbLean) {
  LEAN = v;
  try { localStorage.setItem(KEY, v); } catch { /* private browsing — the session still works */ }
}

/** Picks to shave off a back's market price when modelling what this room does.
 *
 *  Applied only in the FIRST TWO ROUNDS. That is the whole claim: a room described as
 *  "RB-heavy" is one that reaches for backs at the top, not one that keeps doing it in the
 *  eleventh round, where everybody is taking backs anyway and the roster-need rules already
 *  cover it. Widening it past round 2 would double-count. */
export const rbShift = (pick: number): number =>
  pick <= 24 ? RB_LEAN[LEAN].shift : 0;

/** For the panel that has to explain itself. */
export const leanSummary = (): string =>
  LEAN === "market" ? "" : `${RB_LEAN[LEAN].label} — modelling ${RB_LEAN[LEAN].backs} picks as backs`;
