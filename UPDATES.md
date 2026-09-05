# Update log

## 2026-09-04 — league scoring, draft tracker and full simulation audit

Corrected component scoring, injury availability, hindsight lineup selection, paired comparisons and late-round depth. Refreshed Sleeper projections, market ADP and attributed news. Fixed atomic live-pick catch-up, K/DEF and off-board tracking, and availability calibration. Failed gates and stale result files now stop publication.

The rerun includes 1.44 million RB-run/paired draft-strategy trials plus six other studies, 900 shared-room advisor tests and 36 full 192-pick drafts. Ashley opens Gibbs, Brian opens Bijan, and Emily uses the available RB/WR tier and room behavior. Close alternatives and source uncertainty are documented in the [September 4 report](analysis/2026-09-04/REPORT.md).

Earlier entries below are historical. Their numerical recommendations, injury estimates and manual failed-gate override policy are superseded by this audit.

## 2026-09-01 — Pacheco to IR, the Packers backfield after the Kaleb Johnson trade, and an IR tagger bug
Brian: "any new updates? scrape the web and find any news that might make drafting different." Web sweep (ESPN, NBC, Yahoo, RotoWire, team beats) on top of the Sleeper wire, Aug 31 → Sep 1.

**Pacheco.** Placed on injured reserve Tuesday with the back that cost him most of camp (Ari Meirov; Eric Woodyard, ESPN) — out at least four games, earliest return Oct 11 vs ARI. Sleeper designation Q → IR. He was the Gibbs handcuff in `CUFFS`; nothing else behind Gibbs is draftable (Sione Vaki ADP 527, Jacob Saylors 486), so the mapping stays and his row now says what he is: a free IR-slot stash for whoever takes Gibbs, not a Week 1 backup. Verdict solid → risk; pMiss 0.67.

**Packers.** The Aug 31 entry missed that Green Bay traded a 2028 sixth to Pittsburgh for Kaleb Johnson on Aug 30 (NFL.com; ESPN). It does not change the pick: Gutekunst on Tuesday called Lloyd "as ready as he's ever been... he looks good" (Dennis Krause, Spectrum News 1), Johnson's Sleeper ADP is 575, and Chris Brooks is 695 — Lloyd is the only draftable share. Gutekunst also "anticipates" Jacobs playing at some point in 2026 (Schneidman) with no date; Sleeper moved Jacobs O → NA (already in the risk list, so priced with no code change) and to fourth on the depth chart. Jacobs pMiss 0.78, Lloyd's uplift +2.6.

**Also, sourced:** Love "trending toward Week 1" (Weinfuss) vs "50/50" (Garafolo); Chase limited by design, Taylor expects him Week 1, Tee Higgins Q with a minor heel contusion (Ben Baby); Hubbard back at practice (Joe Person), Brooks Q with soreness; Carnell Tate Q with unexplained "stiffness" (Turron Davenport); Egbuka still out on the Aug 12 toe, Bowles "hopefully" Week 1 (Greg Auman); Jeanty still hasn't practiced, working with trainers (Sam Warren); Henderson still not cleared for full practice (Mike Reiss); Nabers practiced, non-committal himself (Pat Leonard); Kittle activated off PUP, limited this week (Barrows); Flowers good for Week 1 (Zenitz); Kyren Williams tagged COMMITTEE off Nate Atkins' expected 50-50 with Corum — a beat writer's read, flag only. Market: Cook 8.2 → 9.9, St. Brown 7.6 → 6.2, Travis Hunter 174 → 187. Projections unchanged (Jaydon Blue back from zero at 2.0 after signing to the Eagles' practice squad).

**Tagger bug, fixed.** `fetch-news.mjs` filed "placed on injured reserve" under `out` — season-ending, 17 games. Tyson has read "out for the season" since his IR placement on Aug 31, overriding Garafolo's two-month timeline, and Pacheco would have too. After the Aug 30 cutdown an IR placement is a four-game minimum, not the year. New `ir` tag (between `out` and `miss` in every rank map), priced in `risk.ts` as max(4, longest reported timeline): Tyson 9 games (pMiss 0.51, was 0.92), Pacheco 4, Higgins' torn ACL still `out`. No new constants — four games is the league's rule. The board badge reads IR.

**Studies regenerated** on the corrected wire and today's market. Seat 2 wins 38% (RB-WR-RB-RB best, 123.3 pts/wk); Bijan there 85%, Gibbs 17%. Head-to-head: Brian 111.2 pts/wk (best team 40%), Ashley 108.9 (34%), Emily 104.8 (26%). Value falls on Sleeper: Purdy +40, Goff +38, Downs +34, Quentin Johnston +31, Worthy +28.

**Gates.** logic 0 FAIL / 3 WARN (new: the 2025 stats snapshot is not present in this checkout, so the calibration check skipped; 18 players lack a mock-market ADP; 13 priced >12 picks off Sleeper's ADP, worst Elic Ayomanor), advisor 0, forecast 0, agreement **3 FAIL** / 2 WARN — the same three marginal calls as Aug 31 (Love over Pickens at seat 1 rd 3, 1.65 vs 0.72; Flowers over Loveland at seat 10 rd 3, 0.90 vs 0.66; Watson over Warren rd 6, 0.78 vs 0.66). Left standing per precedent; results loaded by hand under the documented-failure rule.

## 2026-08-31 — Jacobs to the exempt list, and the weekend repricing
**Jacobs.** Placed on the Commissioner's Exempt List (Schefter) — cannot play or practice, no end date; two misdemeanor charges, first court date Nov 17 (Demovsky). Sleeper designation O (`DNR` maps to `O` in fetch-sleeper, so the risk model priced it with no code change: pMiss 0.67). ADP 28.5 → 34.6, −42k drops in 24h. The exempt-list wire items carry no keyword tag — there is no rule for it — but the designation is the designed channel for exactly this.

**The market did what the handcuff model said.** Lloyd ADP 179 → 136, +449k adds in 24h, and Schneidman has him "poised to begin the season as Green Bay's lead running back." His uplift flag reads +2.3 pts/wk from Jacobs' risk.

**Also:** Tyson officially to IR (ADP 92 → 104); Charbonnet opens on PUP (formalising the Wk 5–6 return); Jeanty avoids IR and the Raiders are "counting on" him Wk 1; Nacua back at practice and expected to avoid the exempt list (Pelissero); Worthy and Johnston cleared; Jaydon Blue waived and zeroed from projections.

**Studies regenerated** on the new market (seat 2: 39% win, Bijan there 87%, Gibbs 15% — the room re-firmed on Gibbs first overall).

**A real advisor bug, caught by the gate.** On the post-weekend ADP, audit-advisor's seat-1 self-draft finished **QB1 RB6 WR7 TE0** — a roster that fields a zero at tight end every week. Mechanism: the two-pick lookahead kept flipping the first TE to "take him next turn," turn after turn, and at pick 145 the advisor spent its one spare pick on a seventh running back with the last startable TE on the board; by 168 every TE was gone. Thursday's data passed the same audit — a few opponent-ADP shifts (McBride 24.2 → 26 among them) re-ordered the deterministic room and exposed it. Fix: the roster radar's existing "this pick or never" computation (startable shelf empty by your next turn) now **filters the candidate list** instead of merely printing a warning, and once no spare picks remain, only slot-filling players are candidates at all. No new constants — both triggers already existed as warnings. audit-advisor 0 FAIL on all five seats after the fix.

**Gates.** logic 0 FAIL / 2 WARN, advisor 0 (after the fix), forecast 0, agreement **3 FAIL** / 2 WARN — all three marginal value calls just over the noise bar on fresh data (Love over Pickens at seat 1 rd 3, 1.62; Zay Flowers over Loveland at seat 10 rd 3, 0.72 vs 0.66; Watson over Warren rd 6, 0.69 vs 0.65). Left standing per precedent; results loaded under the documented-failure rule. (One earlier gate run also crashed on a `SIMITEM` placeholder briefly left in `data.ts` mid-edit — self-inflicted, no effect on the numbers.)

## 2026-08-27 (later) — handcuffs priced for their starter's risk, and the daily runs everything
Brian, after the Jacobs suspension story: "is it worth drafting the Packers backup RB earlier?" — and then "prices and ADPs should change based off these things, right?"

**Checked what already moves.** Sleeper's ADP does react to news, in proportion to severity: Higgins (torn ACL) 126 → 200 over nine days, Tyson (2 months) 79 → 92, Jeanty (Q) 11.3 → 13.4 in a day. The wire moves availability (Jeanty pMiss 0.39, "~1 week — Rapoport"). So Jeanty was already priced. The 24h waiver-add feed is **not** a signal — players with 5,000+ adds went 1.4 picks *later* at the next snapshot (n=24); adds are waiver moves, not draft picks. It stays out.

**What did not move: the backup.** A handcuff's projection assumed his starter plays, and the advisor only boosted him for the starter's own owner. `scripts/sim-cuffvalue.mjs` measures it on 2025 logs — 28 starter/backup pairs from snap-count fingerprints (pairwise; a union-find over shared fingerprints merged teams on one coincidental collision and put Barkley behind Jonathan Taylor), starter = whoever scores more when both play (season carries alone had Vidal ahead of Hampton). Across 41 starter-less weeks the backup scored **k = 0.65** of the starter's pts/wk more than with him in (per-pair median 0.71). Priced as `0.4 × pMiss(starter) × 0.65 × proj(starter)` in `risk.ts` (`cuffUplift`), read by the advisor and every study. Lloyd +1.5 (3.9 → 5.4), Pacheco +1.6, B. Robinson +1.5, Allgeier +1.4, Bigsby +1.3. Fourteen pairs is a small sample; the number is coarse and applies only to the `CUFFS` list.

**Not priced:** a suspension with no reported length. Jacobs' pMiss is his injury-and-verdict share (0.45); "preparing for a potential suspension" carries no number and inventing one would be worse than saying so.

**`predraft.mjs` now runs everything**: news wire, all eight studies, the four gates, then `load-sims.mjs` when the gates pass. Every study regenerated on the new pricing; seat means moved ±0.5 pts/wk, win rates 3–5 points lower (seat 2: 40%), RB-LOSS unchanged (RB-WR-WR-RB best at seat 2, every RB-first opening within 1.0).

**Gates.** logic 0 FAIL / 2 WARN, advisor 0, forecast 0, agreement **1 FAIL** / 3 WARN — the two round-6 failures from the morning closed; a new one at seat 1 round 3 (sim prefers Jeremiyah Love to Pickens by 1.17 vs a 0.72 bar, Love still Q). Left standing; results loaded by hand under the documented-failure rule.

## 2026-08-27 — draft-week refresh, and the sims finally run on the fixed room
**Refreshed.** Sleeper ADP, projections, injury designations, depth charts, trending, and the news wire (Aug 24 → Aug 27). Projections republished again — quarterbacks up across the board (Kyler +2.1, Burrow +2.0, Hurts +1.8), McCaffrey +1.5; Makai Lemon −2.2, Sadiq −2.0. Injury flags 37 → 42: Ja'Marr Chase Q (knee, Ben Baby), Kenneth Walker III, Zay Flowers, Brian Thomas Jr., Josh Downs, Wan'Dale Robinson, Keaton Mitchell. Alec Pierce PUP → Q.

**Market.** Gibbs 1.1 → 1.9, Bijan 2.7 → 2.4. Gibbs now reaches pick 2 about 27% of the time, up from 5%.

**Three bugs.**

| where | what | effect |
|---|---|---|
| `sim-all.mjs` | templates and head-to-head still keyed to seat 6 after Brian moved to 2 | threw on seat 2 — `predraft.mjs` had been stopping at its first study since PR #58, so the Aug 24 run never reached the gates |
| `risk.ts` | the newest `miss` item won even with no duration in it | Kamara's month (Schefter) silently became one week when a Kendre Miller quote arrived; now the newest miss item **with a number** wins |
| `fetch-news.mjs` | `hold(-\| )?in` matched "hold**in**g him out of Saturday's game" | Trey McBride tagged as a contract holdout; `\b` added |

**`scripts/load-sims.mjs` added.** Writes every `.simcache/*.json` back into `data.ts` / `SimPanel.tsx` in place, refusing lines that are not the shape it expects. The Aug 24 pass did this by hand with a regex that deleted two datasets.

**All seat studies regenerated** (plans, cliffs, paired, first-pick, tree, risk dial, priority, arbitrage, run timing, head-to-head, RB-LOSS). Seat 2 now wins 43%, was 35%. Attributed by swapping inputs: today's data alone moves it to 37%; the rest is PR #62's opponent-model fix (no more four-QB rosters), which the Aug 24 datasets predate. A first pick who falls too rarely to rank the next pick (Gibbs at seat 2, 26%) is now left out of the draft tree instead of shipping as an empty branch.

**Gates.** logic 0 FAIL / 2 WARN, advisor 0 FAIL, forecast 0 FAIL, agreement **2 FAIL** / 4 WARN — both round 6, both just over the bar (Pierce over Reed at seat 1, 0.87 vs 0.75; Watson over Warren at seat 10, 0.70 vs 0.68). The sim likes Pierce's projection now that he is off PUP; the board says believe it when he practices. Left standing. audit-sim: the known bye-start failure (3.8%, was 4.2%), still documented rather than fixed.

## 2026-08-20 — data refresh, and a claim from yesterday retracted
**Refreshed.** Sleeper ADP, projections, injury designations, depth charts, trending, and the news wire.

**Correction: the projections are not frozen.** Yesterday's entry said they were, on the strength of an Aug 17 → Aug 19 pull in which not one player moved by 0.25 pts/wk. Today a batch moved together — Mahomes +1.95, Rodgers +1.57, Shough +1.24, Purdy +1.01, mostly quarterbacks — and Jayden Higgins dropped out of the feed entirely, the day after his ACL tear. They republish in steps, apparently after preseason games, and are flat between. That two-day window fell in a gap. Refresh them; expect no change most days; never read "nothing moved" as confirmation that nothing happened. README and the news page corrected.

**Injury flags** 34 → 37. New: Quinshon Judkins Q, Tyler Warren Q, Sam LaPorta Q, Khalil Shakir Q. Cleared: Jameson Williams.

**Four wire-tagging bugs, all caught by reading the new batch by hand:**

| player | what the wire said | what we recorded |
|---|---|---|
| Tyler Warren | "miss about **a week**, Week 1 not in danger" | ~3 weeks |
| Makai Lemon | *returning* after a two-week absence | ~3 weeks out |
| Jordan Mason | a ranking blurb: "**if he can claim** a larger portion of the timeshare" | `COMMITTEE` |
| — | "Ian Rapoport of ESPN **and NFL Network**" | "Ian Rapoport, ESPN" |

Fixes: the duration parser now reads worded durations ("a week", "a couple of weeks", "several") and defaults to **one** week rather than three when nothing parses, because an unreadable report is not evidence of a long absence. The recovery guard now covers `miss` as well as `out`. Role tags (`committee`/`workload`/`demoted`/`promoted`) no longer fire on conditionals — "if he", "could", "potential to", "fantasy managers" — or on sentences citing the aggregator's own rankings. Known insiders' outlets are now looked up rather than read off the sentence.

That last change also caught an over-correction of my own: an early draft of the recovery guard matched a bare "after being", which reads the comeback in "after being sidelined … will get his first taste" but *also* reads it in "sidelined for at least a month **after being diagnosed** with a sprained MCL" — quietly demoting Alvin Kamara's month on the shelf to a camp knock. Pattern tightened; Kamara restored.

Committee tags fell 6 → 2, and the two that survive are both real reports of a coach's plan (Hampton's "hot hand", Stevenson sharing with Henderson) rather than analysts speculating about a timeshare.

`riskOf` regexes are now built once at module load instead of per call — compiling them inside a function that runs hundreds of thousands of times per simulation had halved throughput.

## 2026-08-19 — live news wire, measured teammate correlation, lineup band fix
**Data refreshed.** Sleeper ADP, weekly projections, injury designations, depth charts and 24h trending all re-pulled. Finding worth recording: **the season projections are frozen** — pulled Aug 17 and again Aug 19, not one player moved by even 0.25 pts/wk. ADP drifts, injury flags flip, the projection does not. Between now and the draft the news wire is the only input that changes.

**News wire added.** Sleeper carries an undocumented per-player feed at `/players/nfl/{id}/news` (`scripts/fetch-news.mjs`). 57% of it is discarded: the aggregators' own analysis is AI-assisted and unreliable — one item shipped reading "Los ngeles Chargers", and the same outlet called a back "the clear lead back" on Aug 5 and "workload uncertainty" on Aug 15 — so an item is kept only if it traces to a named reporter or a direct quote. Four guards on the tagging, each added after the rules got something wrong: historical recaps (5 of the first 10 `OUT` tags), injuries belonging to another player named in the same sentence, negation ("NOT expected to miss" filed under WILL MISS), and recovery stories ("race to return … torn ACL" filed as season-ending). 11 players adjusted, all verified by hand. **News moves availability only, never a projection.**

Live: Jayden Higgins out for the season (torn ACL, Rapoport); Jordyn Tyson ~2 months (Garafolo); Alvin Kamara ~1 month MCL (Schefter); Breece Hall 2–3 weeks (Rosenblatt); Kyle Monangai multiple weeks (Fowler); **Omarion Hampton — OC Mike McDaniel will use a "hot hand" approach (Kris Rhim, ESPN), and Hampton is still priced as a workhorse at 12.5**; Rhamondre Stevenson sharing with Henderson (Graff); Chargers C Tyler Biadasz out indefinitely with an ACL.

**Teammate correlation measured, and two rules retired.** Every simulation drew players independently. Measured it from 2025 game logs — 2025 rosters reconstructed from the team snap counts carried on each stats row, since Sleeper's stats have no team field — against a control of non-teammate pairs that came back at ~0.000 across the board:

| pair | teammates | control | verdict |
|---|---|---|---|
| QB–WR | **+0.342** (n=87) | +0.003 | real, large |
| QB–TE | **+0.236** (n=49) | +0.017 | real |
| QB–RB | +0.071 (n=71) | −0.007 | real, small |
| RB–WR | +0.001 (n=223) | −0.001 | nothing |
| WR–WR | +0.006 (n=108) | −0.003 | nothing |
| RB–RB | +0.023 (n=53) | −0.001 | nothing |

The QB-stack bonus survives — our own number is a little below the cited r≈0.43 but the same effect. **The two anti-stack penalties added on Aug 17 do not survive and were removed**: the same-team pass-catcher penalty (×0.97) and the RB+WR penalty (×0.985). "Two Rams eat each other's lunch" is widely believed and is not in the game logs — a receiver pairs with his teammate exactly as he pairs with a stranger. Both penalties were small, but they applied to every same-team pair on the board, and a small bias with no evidence is still a bias.

**Lineup floor/ceiling fixed.** It summed p10 and p90 across eight starters, which asks what happens if all eight bottom out in the same week — a correlation of 1.0. Variances add in quadrature; now combined with the measured correlation matrix. **The old band was 2.8× too wide.** A QB stacked with two of his receivers now correctly reads ~8% wider than the same lineup spread across teams.

**audit-agreement 2 FAIL → 1 FAIL.** Round 1 was special-cased to an empty board, so seat 10 was asked to choose from all 170 players and then judged against a simulation that ran picks 1–9 first; it recommended James Cook (gone before pick 10 in four worlds of five) and the audit reported a gap of `Infinity` against a threshold of `0.00`. Both fixed. The remaining failure is the known TE-replacement issue (Loveland vs Tee Higgins, 0.72 against a 0.67 bar), left failing rather than tuned away.

**Seats 1/6/10 re-simulated**, 30,000 worlds each on the new data (`scripts/sim-seats.mjs`): Gibbs at seat 1; McCaffrey then Taylor at 6; Achane at 10. CeeDee Lamb grades last at every seat. Rows built from few worlds are now flagged for selection bias — a player who only reaches you when the room lets him slide is averaged over a different set of drafts than one who is always there.

**README** now documents all nine data sources and what we are single-sourced on (projections — one provider behind every points number).

## 2026-08-17 (night) — full-league division audit + React port
All 32 teams audited by division (depth charts, preseason usage, beat reports through 8/17 evening). Board grown 158 → 170 players (adds incl. Adonai Mitchell, Braelon Allen, Alec Pierce, Ray Davis, Chris Rodriguez Jr., David Njoku, Ja'Kobi Lane, Malachi Fields, Jaydon Blue, Brian Robinson Jr., Malik Benson, Elic Ayomanor). Time-sensitive flags added: Breece Hall non-contact groin (8/17), Egbuka toe / Wk 1 "not sure" (8/17), Nacua groin on top of the open conduct case, Carnell Tate practice-hit evaluation, NE officially a 50-50 committee, Washington's six-back battle reopened. Verified: Seattle are the defending champs and Kenneth Walker was SB LX MVP; John Harbaugh is the Giants' HC. Stacking research wired into the advisor (QB stack bonus kept small per r≈0.43 evidence; NEW anti-stack penalties for same-team pass-catchers outside elite offenses and RB+WR pairs). Advisor v4 + all data ported into the React app (`app/src`), root index.html regenerated from the build.

## 2026-08-17 (evening) — deep research pass + advisor v4
Data: 16 research streams re-verified the whole board — injuries/legal, all 32 team backfields & depth charts (division-by-division sweep), strategy base rates (xTD, age cliffs, dead zone, Konami code, playoff schedules), ADP movement + platform gaps, rookies/breakouts, QB/TE/Vegas markets, stacking & coaching-scheme research, plus a quantitative cross-format ADP analysis (FFC half/full/standard × league sizes, Sleeper 24h trending).

Headline corrections: Travis Hunter now primarily CB (downgraded); Miami QB battle resolved (Willis, upgraded); Brissett named ARI starter; Fannin's coach note fixed (Monken is TE-friendly); WAS depth chart lists Croskey-Merritt over White; Houston is an intentional Montgomery/Marks tandem; Charbonnet PUP = realistic Wk 5-6 return; Monangai out multiple weeks; Brooks ADP move corrected to ~+20; Mike Evans age stat replaced (unverifiable); Dolphins moved to the bottom of the Vegas board (NFL-low 3.5 win total). Nacua kept at #8 after a suspension-scenario analysis (0 games = top-4, 2 = this price, 6+ = Rd 2); Jefferson moved 6 → 8 (Kyler's accuracy is elite; his availability — 41 of 68 games — is the real risk).

Advisor v4: fixed remaining-pool projection bug (stable global position-rank projections); probabilistic "makes it back to me" survival model on live market ADP ± σ (FFC, 2,372 drafts Aug 12-17) with opponent-need demand shifts; turn-aware targeting (between picks it recommends realistic targets for YOUR next pick, with survival odds, instead of players who'll be gone); value-over-next-available scoring; tier-cliff detection; phase-aware risk appetite (floor early, ceiling late); roster radar warnings ("fill QB NOW", spare-pick budget, K/DST reminder); bye anti-stacking (scaled penalty + warning); QB-stack and playoff-schedule tiebreaks; dream-fall alerts; three stand-out "Also fine" alternates with reach odds; plain-English mode for every recommendation (Beginner mode toggle).

## 2026-08-17 — initial build
Board built from 12 research streams: FantasyPros live half-PPR ECR, Justin Boone Yahoo top-300 (8/17), Boris Chen tiers (8/16), 4for4 Underdog ADP (713 players), ESPN/CBS/PFF/NBC rankings, Vegas win totals + implied totals + props (DraftKings), ESPN xTD regression models, injury models, camp/beat reports, community + podcast consensus, 2026 bye weeks.
