/* Run from app/:  npx tsx scripts/audit-intel.mjs
 *
 * League intel — "James Cook goes at 8" — overrides the market for one player. It has to
 * actually propagate, and that is easy to get wrong: the forecast used to price its pool once
 * at module load, so a pin entered mid-draft would have been silently ignored while the UI
 * showed it as active. Confidently wrong is worse than no feature.
 *
 * So check the whole chain: the pin changes his own survival, it changes the players around
 * him, and removing it puts everything back. */
import { setPin, pinnedPick, parseIntel } from "../src/lib/intel.ts";
import { runForecast } from "../src/lib/forecast.ts";
import { mktADP } from "../src/lib/advisor.ts";
import { P } from "../src/data.ts";
import { SLP } from "../src/sleeper.ts";

let fails = 0;
const ok = (t, d = "") => console.log(`  PASS  ${t}${d ? "  — " + d : ""}`);
const fail = (t, d = "") => { fails++; console.log(`  FAIL  ${t}${d ? "  — " + d : ""}`); };

const row = (n) => P.find((r) => r[0] === n);
const names = P.map((r) => r[0]);

console.log("\n=== parsing ===");
for (const [input, want] of [["James Cook 8", "James Cook"], ["cook = 8", "James Cook"],
                             ["derrick henry, 17", "Derrick Henry"], ["gibbs 1", "Jahmyr Gibbs"]]) {
  const p = parseIntel(input, names);
  p && p.name === want ? ok(`"${input}"`, `${p.name} at ${p.pick}`) : fail(`"${input}" did not resolve`, want);
}
parseIntel("nonsense here 8", names) === null ? ok("unknown name is rejected") : fail("unknown name was accepted");
parseIntel("James Cook", names) === null ? ok("a name with no pick is rejected") : fail("accepted a name with no pick");

console.log("\n=== the pin reaches the price ===");
const marketPrice = mktADP(row("James Cook"));
setPin("James Cook", 8);
const pinnedPrice = mktADP(row("James Cook"));
pinnedPrice === 8
  ? ok("market price is overridden by the pin", `${marketPrice.toFixed(1)} -> 8`)
  : fail("pin did not change the price", `still ${pinnedPrice.toFixed(1)}`);
setPin("James Cook", null);
mktADP(row("James Cook")) === marketPrice
  ? ok("removing the pin restores the market price")
  : fail("price did not revert when the pin was removed");

console.log("\n=== the pin reaches the forecast ===");
/* Build a state where Emily is genuinely WAITING, with several picks between her and her
   turn. The first version of this test left only one intervening pick, which is not a fair
   test of a pin: with a single pick the market's second choice wins sometimes no matter what
   you believe, so 9% survival was correct behaviour rather than a leak. */
const byAdp = names.filter((n) => SLP[n]?.adp !== undefined).sort((a, b) => SLP[a].adp - SLP[b].adp);
const DS = {}, ord = [];
for (let i = 0; i < 4; i++) { if (byAdp[i] === "James Cook") continue; DS[byAdp[i]] = "gone"; ord.push(byAdp[i]); }

const before = await runForecast(DS, ord, 10, 4000);
setPin("James Cook", 8);
const after = await runForecast(DS, ord, 10, 4000);

const b = before.survive["James Cook"], a = after.survive["James Cook"];
console.log(`  ${before.picksAhead} picks between now and her turn`);
console.log(`  Cook survives:  without intel ${(b * 100).toFixed(0)}%  ·  pinned at 8 ${(a * 100).toFixed(0)}%`);
a < 0.05
  ? ok("a player pinned several picks before your turn is treated as gone")
  : fail("pin did not reach the forecast — it still thinks he might last", `${(a * 100).toFixed(0)}%`);
b - a > 0.1
  ? ok("the pin moved his survival materially")
  : fail("pin had no meaningful effect on survival");

/* conservation must still hold with a pin in play */
const gone = Object.values(after.survive).reduce((x, y) => x + (1 - y), 0);
Math.abs(gone - after.picksAhead) < 0.15
  ? ok("survival still conserves picks with intel applied", `${gone.toFixed(2)} over ${after.picksAhead}`)
  : fail("intel broke pick conservation", `${gone.toFixed(2)} vs ${after.picksAhead}`);

setPin("James Cook", null);
pinnedPick("James Cook") === undefined ? ok("pin cleared") : fail("pin would not clear");

console.log(`\n${"=".repeat(70)}\nRESULT: ${fails} FAIL\n`);
