# September 8 draft readiness and roster value study

The draft helper uses the league's actual scoring and roster requirements. This update refreshes its inputs and improves how it values later picks: once eight players are rostered, it estimates each candidate's contribution to the team's starting lineup across bye weeks and possible absences. A handcuff receives extra production in the scenarios where his starter is unavailable.

The completed comparison supports better modeled coverage, with modest gains over the previous helper. It does not establish championship odds, real-world superiority to ADP, or an improvement for every manager under every waiver strategy. The early-pick policy remains unchanged. Ashley and Brian still open with Gibbs and Bijan when both follow the helper; Emily's choices depend on the players who reach her turn.

## League and current inputs

The live [league](https://api.sleeper.app/v1/league/1389372699129700352) and [draft](https://api.sleeper.app/v1/draft/1389372699129700353) were checked September 8. They confirm 12 teams, a 16-round snake, a 60-second clock, half-PPR, four-point passing touchdowns, and QB/2RB/2WR/TE/2FLEX/K/DEF/6BN. Ashley is seat 1, Brian JK seat 2, Emily seat 10. Jeff is seat 8 and Aaron seat 3 following their trade.

The canonical refresh retrieved 235 skill players, 231 usable weekly projections, 234 Sleeper ADP entries, 191 historical scoring distributions, and attributed news for 182 players. Component statistics are scored using this league's rules. The four players without usable projections remain visible with zero estimated production: Jayden Higgins, Travis Hunter, Brandon Aiyuk, and Jarrett Stidham.

[FantasyFootballCalculator](https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=2026) supplied 1,837 mock drafts from September 3–8, matching 176 board players. The existing 75% Sleeper/25% mock blend and missing-source fallbacks remain. A separate comparison uses Hashtag Football’s September 6 projections, retrieved September 8.

Current availability notes distinguish expectations from official game designations:

- **Puka Nacua:** McVay expects him to play Week 1; later discipline remains unresolved. Replaced the older August practice note. [NFL reporting, September 6](https://amp.nfl.com/news/rams-hc-sean-mcvay-expects-wr-puka-nacua-ol-alaric-jackson-to-play-in-week-1-vs-49ers).
- **Chase and Higgins:** returned to practice September 7, per Ben Baby; official Week 1 participation levels were still pending. [Attributed report](https://www.fantasypros.com/nfl/news/606372/jamarr-chase-knee-returns-to-practice-monday.php).
- **Emeka Egbuka:** Tampa Bay confirmed his return to practice, with participation level and game designation still unassigned. [Team update](https://www.buccaneers.com/news/september-2026-updates).
- **TreVeyon Henderson:** New England listed him DNP September 6 and 7 with an ankle injury. [Official injury report](https://www.patriots.com/news/week-1-injury-report-patriots-at-seahawks).

The sourced wire updates numeric absence evidence through the existing risk model. These curated practice notes change explanatory copy, not arbitrary projection multipliers. Older profiles, implied totals and commentary remain background material.

## Independent projection comparison

[Hashtag Football’s September 6 table](https://hashtagfootball.com/fantasy-football-half-ppr-rankings) matched 180 board players. Comparing season totals divided by 17 gives mean absolute differences of 0.68 points for QBs, 0.92 for RBs, 1.06 for WRs, and 0.85 for TEs. These measure provider disagreement, not accuracy. The largest differences involve Jacobs, Reed, Sadiq, McCaffrey and Ja’Kobi Lane. Bijan Robinson and Brian Robinson Jr. were distinguished using their individual provider profiles. [Comparison summary](projection-check.json).

The expanded sensitivity audit made **2,700 legal recommendations across 540 common draft states**, covering rounds 1, 3, 6, 9, 12 and 14. The external projection adjustment was capped at ±20% per player. It changed the first recommendation in 272 states (50.4%); RB-down-10%, WR-down-10%, and QB-up-10% scenarios changed 57, 66, and 2 states. Every sampled first-round choice stayed unchanged in all four scenarios. Later choices remain projection-sensitive, which supports keeping alternatives visible. [Full sensitivity results](sensitivity.json).

## What changed in the live helper

- Later picks are compared by marginal starting-lineup value instead of applying the early-round scarcity formula to every bench pick. Each candidate uses the same 408 scenarios: 24 availability draws across 17 weeks, with both FLEX slots included.
- Bye weeks and known early absences are explicit. The new score applies availability once and avoids applying the previous bye, injury, and stacking adjustments again.
- A backup's extra opportunity occurs in the same scenarios as his starter's absence. This preserves the insurance value of a handcuff that a flat season average can miss.
- The candidate search includes more of each positional pool during later rounds. Roster caps and required starting slots still constrain the recommendation.
- When a synced skill player is outside the projection pool, the helper keeps the prior scoring path and warns about the missing projection. Kicker and defense records do not trigger this fallback.
- “Why these picks?” explains the modeled lineup contribution and its sensitivity to waiver moves.
- The simulator labels scoring leadership explicitly, and explains that its position summary combines per-pick frequencies. The beginner glossary removes blanket claims about middle-round RBs and handcuffs inheriting an entire job.

The roster evaluator has no waiver model. Its points describe the value of adding a player to the current roster before future transactions; they are not a forecast of the gain over the best possible waiver plan.

## Completed comparison of the actual advisor

[Full results](draft-performance.json) compare the current helper with the previous advisor at commit `c8a093f206cd36e1534c23cfb900b2735528a8ab`. Both use the same refreshed projection, market, news and risk inputs. Thus the comparison measures the code change, rather than crediting it for newer data.

The final run contains **1,024 complete 14-round skill drafts**, split evenly between versions, with Ashley, Brian and Emily following the same version in one shared room. Each version made **21,504 recommendations**. There were **zero illegal, missing, or non-finite recommendations** and all three managers filled their required skill positions. Kicker and defense legality is tested separately in full 16-round drafts.

There are 128 paired draft worlds per opponent pattern: market, early RB run, early WR run, and early QB/TE run. Seeds 100000–100127 were separated from the small development study. Shared player/pick random numbers keep comparisons aligned when draft paths change. Each roster is evaluated in 12 sampled 17-week seasons under four environments: original forecasts, RB production 15% lower, WR production 15% lower, and weekly streaming. Lineups are selected by projection before the season-performance error is revealed.

Changes in average modeled starter points per week, with unadjusted 95% Monte Carlo intervals:

| Manager | Market | RB run | WR run | QB/TE run |
|---|---:|---:|---:|---:|
| Ashley | +0.70 [0.33, 1.07] | +1.17 [0.84, 1.50] | +0.72 [0.38, 1.06] | +0.89 [0.50, 1.27] |
| Brian JK | +0.27 [-0.06, 0.60] | +0.31 [-0.00, 0.63] | +0.05 [-0.27, 0.37] | +0.63 [0.29, 0.97] |
| Emily | +0.23 [-0.06, 0.53] | +0.52 [0.19, 0.86] | +0.43 [0.11, 0.76] | +0.47 [0.12, 0.83] |

All 12 means above improve; eight intervals exclude zero. These intervals quantify sampling variation within the assumptions, not projection accuracy. Rooms and environments reuse worlds, and the 48 reported comparisons are correlated; their intervals are not adjusted for multiple comparisons.

### Waiver sensitivity

The streaming scenario grants temporary access to one available undrafted player each week whenever that player improves the projected lineup. It can replace a weak starter as well as fill an empty slot. Access is generous: there is no bidding, competition, roster-drop cost or evolving free-agent pool.

| Manager | Market | RB run | WR run | QB/TE run |
|---|---:|---:|---:|---:|
| Ashley | +0.13 | +0.41 | +0.04 | +0.20 |
| Brian JK | -0.01 | -0.02 | -0.31 | -0.13 |
| Emily | +0.14 | +0.34 | -0.03 | -0.24 |

Brian's WR-run streaming interval is [-0.60, -0.02]. That is a sensitivity concern, and his general improvement with active weekly streaming is unproven. Only two of the 12 streaming intervals favor the new helper, one favors the prior version, and nine cross zero. These results were retained without changing thresholds or tuning the candidate to erase them. The `preStreamingEmptySlotDelta` metric records holes before any free agent is added.

Across all measured candidate calls, computation averaged **10.2 ms**, with **24.8 ms at the 95th percentile** and a **111.3 ms maximum** on this machine while other studies ran. These are advisor execution times, excluding network sync, rendering and the separate availability forecast. They support responsiveness on this machine, not a device-independent timing guarantee.

The final saved comparison is counted once. Exploratory runs, interrupted runs, and the completed calculation that failed to save to a missing directory are excluded. The script now creates the output directory and saves a checkpoint after each completed room.

## Verification and interpretation

All **nine canonical gates passed**: model inputs, draft mechanics, logic, advisor constraints, advisor/simulation agreement, forecast probabilities, draft-day decisions, all 16 rounds, and saved-result integrity. The draft-day gate checked another **16,800 live-advisor decisions** across 300 drafts. [Gate receipt](gates.json).

All nine saved result files were refreshed and loaded for Ashley, Brian JK, Jeff and Emily. The RB-run study completed **1,760,000 strategy trials** (20,000 worlds × 11 openings × 2 rooms × 4 seats), and the paired-opening study completed **160,000 strategy trials** (8,000 worlds × 5 openings × 4 seats). These are shared-world model trials, not independent observations of real seasons. The first-two-picks study used 5,000 worlds per option. [Saved results](results/).

The heavier priority and RB-run studies ran in four isolated per-seat caches using identical scripts and frozen inputs, then were combined after all eight jobs exited successfully. Interrupted duplicate work was excluded. Every saved study passed schema, finite-value, seat-coverage and freshness checks before loading. The loader updated all published simulation datasets and the Draft lab now shows September 8.

The RB-run study illustrates why the opening should adapt to the room. In its market scenario, the leading patterns were RB-RB-WR-WR for Ashley, RB-WR-RB-WR for Brian, and RB-WR-WR-RB for Emily; the next-best patterns were only 0.05, 0.12 and 0.10 modeled points/week behind. In the very RB-heavy room, Ashley and Brian led with RB-WR-WR-RB, while Emily led with WR-WR-TE-RB. These are scenario results from a simpler continuation policy, not instructions to force those positions in the live draft.

Warnings remain visible: 59 players lack mock-market ADP, 19 differ materially between market sources, and six advisor/continuation comparisons fall within the agreement audit's two-standard-error uncertainty band. Tylan Wallace retains an unusually high CV warning. These were not removed to make the audit look cleaner.

### Scoring-spread correction

The initial mechanics gate failed because it assumed every coefficient of variation (standard deviation divided by mean) must be below 2. Sparse positive scoring can validly exceed that bound; Wallace's measured risk CV is 2.351. The gate now requires finite, nonnegative CV and finite probabilities in [0,1], including known absence. CV ≥2 still produces a named warning. The original failed receipt is retained in [initial-gates.json](initial-gates.json); the corrected audit passed all 24 checks in [scoring-spread-audit.txt](scoring-spread-audit.txt).

The investigation also found that a zero median labeled zero-point games as “boom” games. Relative boom/bust rates are now unavailable for zero or negative medians, with explicit null guards and factual threshold wording. Four players were affected: Terrance Ferguson, Quintin Morris, Trent Sherfield and Tylan Wallace. Regression tests cover these domains and the actual risk-label consumer.

Both a strict script comparison and independent review confirmed that all 235 players' CV, absence probability and known absence values stayed identical. All other fields across the 191 ceiling records also stayed identical. Thus these final label corrections preserve the numeric inputs of the completed simulations and performance study. The final bundle hashes differ from the study's hashes because labels and saved study data were subsequently updated. [Invariance receipt](scoring-spread-correction.json).

The helper tests cover both FLEX slots, direct upgrades, unused depth, shared-bye backups, known absences, deterministic comparisons, and conditional handcuff value. Integration regressions exercise seats 1, 2 and 10 with modeled rosters and unknown WR/OTHER/K records. The independent reviewer verified the scoring changes and examined the negative streaming result.

The separate full-draft audit completed **36 legal 192-pick drafts and 6,912 decisions**, filling all ten starters for every seat. The final full test command passed, including 47 weekly tests, followed by a successful production build. Browser testing checked all three managers, made eight picks in Emily's isolated practice draft, verified the round-nine explanation, and confirmed no horizontal page overflow at 390px. The original live draft was restored after testing. A final browser pass verified the refreshed study date, first-two-pick options and full-analysis scoring labels, with zero console errors.

This remains a projection-driven model. Injury rates, handcuff opportunity and opponent behavior contain assumptions. Held-out seeds test different simulated worlds under the same forecasting system. They do not test actual future NFL outcomes. The performance evaluation keeps preseason projection rankings throughout the season and omits learning about role changes, breakouts and declines. Trades, actual fantasy matchups, waiver competition and championship probabilities are outside its scope. Weekly roster updates remain manual.

## Reproduction

Run from `app/`:

```sh
node scripts/predraft.mjs
npm test
node scripts/audit-draft-performance.mjs 128 100000 ../analysis/2026-09-08/draft-performance.json
node scripts/audit-full-draft.mjs
npm run build
```

`predraft.mjs` retrieves fresh external data, so later runs can have different inputs. The performance JSON records input and advisor bundle hashes plus the baseline commit. Re-run `sim-build.mjs` before an isolated performance comparison if source data changed. The published strategy studies use their own simpler continuation policies; they are reference experiments, while the 1,024-draft comparison directly exercises the live advisor.
