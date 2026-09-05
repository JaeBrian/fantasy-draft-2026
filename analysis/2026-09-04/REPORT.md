# September 4 draft audit and rerun

This rerun replaces the earlier numerical recommendations with corrected league scoring, current source data, realistic lineup selection, and tests of the actual draft advisor. Ashley remains seat 1, Brian JK seat 2, and Emily seat 10. Their Tuesday, September 8 plans should respond to the available players and the room's behavior.

The strongest stable opening is **Gibbs for Ashley and Bijan for Brian**. Emily has several competitive openings: **Cook or Chase Brown in a market-like room; an elite receiver when the room takes running backs early**. Small differences between simulated lines should be treated as alternatives. These studies optimize modeled starter production; they do not establish a globally optimal draft or calibrated championship odds.

## Verified league and inputs

The live [Sleeper draft](https://api.sleeper.app/v1/draft/1389372699129700353) and [league](https://api.sleeper.app/v1/league/1389372699129700352) confirm 2026, 12 teams, a 16-round snake, half-PPR, four-point passing touchdowns, and 1QB/2RB/2WR/1TE/2FLEX/1K/1DEF/6BN. The league has seven playoff teams and playoffs in weeks 15–17. All 32 byes match the [official NFL schedule](https://www.nfl.com/_amp/2026-nfl-schedule-release-every-team-bye-week).

| Seat | Manager | First six picks |
|---|---|---|
| 1 | Ashley | 1, 24, 25, 48, 49, 72 |
| 2 | Brian JK | 2, 23, 26, 47, 50, 71 |
| 10 | Emily | 10, 15, 34, 39, 58, 63 |

Full order: Ashley, Brian JK, Jeff, Brandon, Duy, Zach, Michelle, Aaron, Matt, Emily, Josh, Brian V. The existing order was correct.

The board now contains 235 distinct skill players, including 65 source-backed depth additions. Weekly projection coverage is 231/235; historical weekly distributions cover 190. The four players without usable weekly projections are Jayden Higgins, Travis Hunter, Brandon Aiyuk, and Jarrett Stidham. They receive zero estimated production until a usable projection exists. Kenneth/Kenny Gainwell now resolves to one player across providers.

The [FantasyFootballCalculator refresh](https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=2026) includes 3,064 mock drafts from August 30–September 4. Mock ADP covers 187/235 names. Market prices retain the 75% Sleeper/25% mock blend. Late-round missing coverage and 21 large disagreements with Sleeper are visible audit warnings. Elic Ayomanor is the most extreme fallback disagreement; that late-board estimate has limited precision.

## Problems found and corrected

| Problem | Consequence | Correction and evidence |
|---|---|---|
| Provider aggregate fantasy points disagreed with this league's component scoring | Passing production was overstated, distorting QB value | Re-score every weekly projection and 2025 actual from raw stats using the live league's scoring settings. Purdy's Week 1 aggregate was 21.23 versus 17.93 under the league rules; Burrow 22.40 versus 19.36. Arithmetic and format tests cover the scorer. |
| Injury duration ignored elapsed preseason recovery; known absence was mixed with generic risk | Too much or too little missed production; opening-week availability inconsistent | Separate reported absence from baseline risk, subtract preseason recovery, and enforce known absence in opening weeks. 500,000 deterministic samples verify bounds and expected availability. |
| Some studies selected starters after seeing simulated scores | Hindsight inflated expected lineup production | Choose starters by projection first; weekly models can replace players known to be unavailable. A bench-explosion fixture now scores zero instead of selecting the unexpected 100-point bench players. |
| Simulations used inconsistent projection and injury inputs | Differences between scripts could masquerade as strategy findings | Published studies share component projections, handcuff uplift, and availability helpers; model-input regressions verify those paths. Removed duplicate risk discounts and rank-derived substitutes in the affected models. |
| Only 170 skill players supported 168 skill picks | The real advisor could run out of legal recommendations near the end | Expand to 235 distinct, source-backed players and exercise every pick in complete rooms. |
| Agreement audit discarded opponents' already-drafted players and used manager names as pick history | Continuations represented the wrong room | Preserve all team rosters and the ordered player picks before comparing alternatives. |
| Paired results depended on roster traversal and displayed mismatched matrix columns | Comparisons could attach different outcomes or labels to a player | Use per-world/per-player random outcomes, reorder matrix columns with displayed rows, and give exact ties half credit. |
| Championship experiment duplicated or omitted teams in 13 of 14 weekly schedules | Published title claim lacked a valid foundation | Tested round-robin schedule with one game per team each week and all 66 pairs over 11 weeks. Remove the old fixed championship percentage from the guide. |
| Live sync applied a batch through callbacks holding old state | Initial catch-up could retain only the final pick | Build and apply one authoritative snapshot; test batch catch-up, identity switching, rollback, and invalid sequences. |
| K/DST and missing-board players were skipped by sync and unavailable to manual entry | Pick clock and roster counts drifted | Preserve every pick, add manual off-board recording, and count those positions in roster needs. Browser test recorded a kicker, advanced the clock, and restored both with Undo. |
| Every player's analytic selection probability had a 1% minimum | With 235 players, one intervening pick could never calibrate; Gibbs was shown as 99% available for Brian | Remove the floor and use stable conditional normal tails for overdue players. Tests cover the opening recommendation and two overdue players sharing one pick of probability mass. Waiting text now uses the same simulated survival figure as its badge. |
| Refresh accepted failed subprocesses or manually loaded stale results | A failed audit could still publish an apparently fresh guide | Required gates fail the refresh; the loader rejects missing files and results older than the current run. |

## Independent projection and sensitivity analysis

A comparison with [Hashtag Football's half-PPR projections](https://hashtagfootball.com/fantasy-football-half-ppr-rankings) matched 180 current players. Among the same 24 QBs available before and after the fix, mean absolute disagreement fell from **3.36 to 0.69 points per 17-week season average**. RB/WR/TE disagreement stayed approximately 0.85/1.09/0.96. This supports the scoring correction; another provider's forecast is still an estimate. Largest remaining differences involve Sadiq, Reed, Jacobs, Lane, and McCaffrey. [Comparison data](projection-check.json).

The sensitivity audit evaluates identical draft states under five scenarios: baseline, movement toward the external projection with each player's adjustment capped at 20%, RB projections down 10%, WR down 10%, and QB up 10%. Those are stress scenarios, not confidence intervals. Their purpose is to identify recommendations dependent on uncertain inputs. [Full sensitivity output](results/sensitivity.json).

The final sensitivity run made 1,350 valid recommendations across 270 common states with zero failures. First-pick choices stayed unchanged for all three seats in all five scenarios. Later choices were less stable:

| Scenario | Changed first recommendation across 270 states |
|---|---:|
| External projection adjustment capped at 20% | 109 (40.4%) |
| RB production reduced 10% | 22 (8.1%) |
| WR production reduced 10% | 23 (8.5%) |
| QB production increased 10% | 3 (1.1%) |

The sample covers rounds 1, 3 and 6 across 30 seeded drafts. Stability in those sampled opening states does not establish robustness to every injury or unexpected selection. Opponent behavior remains a larger driver of Emily's opening than these bounded projection changes.

## Draft-day plans

Use the live advisor as the board changes. The following target groups summarize its market-room choices; they are alternatives, not a roster that will always be available. Ashley and Brian compete for the same players at the 2/3 turn, so both cannot assume they get the same falling receiver or tight end. Single-seat studies model the other eleven owners from market behavior, which sometimes leaves Gibbs at pick 2. The shared-room advisor test has Ashley take Gibbs, so Brian takes Bijan in all 900 tested rooms.

| Manager | Opening | Rounds 2–3 | Rounds 4–6 |
|---|---|---|---|
| Ashley | Gibbs at 1 | Compare Kyren, Bowers, London and Pickens/Olave at the turn. Select the best two-player combination actually left. | Jameson/Waddle and Judkins/Jaylen Warren provide alternatives; Purdy is a frequent round-6 choice when QB value exceeds the remaining skill options. |
| Brian JK | Bijan after Ashley takes Gibbs; take Gibbs if he falls | Nico, Kyren or London at 23; Olave/Pickens or a falling Bowers at 26. Ashley's two picks between these turns matter. | Waddle/Montgomery, Tyler Warren/Jaylen Warren, then compare RB depth with Hurts or another QB fall. |
| Emily | Cook/Chase Brown in a normal room; JSN/Amon-Ra if an early RB run leaves elite receivers | At 15, compare the remaining Brown/Nico/CeeDee tier against the first pick. At 34/39, Montgomery, Javonte, Loveland and Flowers compete on roster need. | Watson and Jaylen Warren/Dowdle are common choices; keep Kraft or another TE alternative if Loveland went earlier. |

After round 6, prioritize remaining starting slots, usable RB/WR depth and injury contingencies. Avoid spending a third pick at QB or TE while other needs remain. Reserve room for one kicker and one defense; if either was taken early, the tracker recognizes that and allows the remaining bench picks. Off-board skill players count toward the roster but have no invented projection.

The actual-advisor audit places **all three people in the same 168-pick room**, with 300 rooms per opponent model: market, an early RB run, and value-aware drafting. This exercises **900 drafts and 37,800 advisor decisions**. It tests complete legal skill rosters, unique picks, finite recommendations, on-clock state, and positional caps. It does not simulate a jointly optimal strategy for three teams. A separate full-round integration test completed 36 drafts of 192 picks with all twelve seats using the advisor: 6,912 decisions, early and late K/DEF selections, and all ten starting slots filled for every seat.

In the 300 market-room drafts using the actual advisor, these were the two most common selections per round. Percentages are marginal selection frequencies; combining the cells does not describe one jointly available roster.

| Manager | Round 1 | Round 2 | Round 3 | Round 4 | Round 5 | Round 6 |
|---|---|---|---|---|---|---|
| Ashley | Jahmyr Gibbs 100% | Kyren Williams 51%; Brock Bowers 25% | George Pickens 43%; Brock Bowers 41% | Jameson Williams 42%; Quinshon Judkins 20% | Quinshon Judkins 39%; Jameson Williams 24% | Brock Purdy 56%; Jayden Reed 14% |
| Brian JK | Bijan Robinson 100% | Nico Collins 38%; Kyren Williams 31% | Chris Olave 43%; George Pickens 43% | Jaylen Waddle 46%; David Montgomery 28% | Jaylen Warren 42%; Tyler Warren 38% | Rico Dowdle 20%; Jalen Hurts 17% |
| Emily | Chase Brown 47%; James Cook 41% | Chase Brown 49%; Nico Collins 49% | Colston Loveland 35%; David Montgomery 31% | Colston Loveland 53%; Zay Flowers 24% | Christian Watson 74%; Jayden Reed 9% | Rico Dowdle 72%; Jaylen Warren 21% |

The early-RB stress test in this audit applies a 15-pick RB premium through pick 60. The separate RB-run study varies the first-two-round room composition. Those scenarios test different assumptions and their percentages should be compared within their own tables.

## Completed simulation comparisons

Eight published study scripts produce nine result files. The RB-run study completed **1,320,000 draft-strategy trials** (20,000 worlds × 11 openings × two rooms × three seats). The paired study adds **120,000 draft-strategy trials** (8,000 worlds × five openings × three seats). These 1.44 million trials reuse worlds for comparisons; they are not 1.44 million independent observations of real leagues.

The RB-run study's top two openings are:

| Manager | Room | Best four-round opening | Starter points/week | Next opening | Difference |
|---|---|---|---:|---|---:|
| Ashley | Early RB run | RB-WR-WR-RB | 105.39 | RB-WR-WR-WR | 0.47 |
| Ashley | Market | RB-WR-RB-WR | 104.56 | RB-RB-WR-WR | 0.03 |
| Brian JK | Early RB run | RB-WR-WR-RB | 104.53 | RB-WR-WR-WR | 0.74 |
| Brian JK | Market | RB-WR-RB-WR | 103.86 | RB-WR-WR-RB | 0.05 |
| Emily | Early RB run | WR-WR-TE-RB | 103.03 | WR-WR-RB-RB | 0.11 |
| Emily | Market | RB-WR-WR-RB | 101.03 | RB-WR-RB-WR | 0.17 |

Reported standard errors for these means are about 0.03–0.04 points/week. Those quantify Monte Carlo sampling error within the model, not uncertainty in projections, injuries or opponents. In particular, Brian's market-room top two are effectively tied. Position sequences constrain only these experiments; the live advisor can take a falling tight end or change course.

For Emily, the detailed priority study favors Cook over Brown by 1.54 paired points/week in a market room; Cook reaches pick 10 in 52% of its worlds. A rare JSN fall also grades strongly, but occurs in only 6%. The live advisor sometimes selects Brown because it uses a different roster/lookahead policy. Treat Cook, Brown and a falling elite receiver as explicit alternatives, and inspect the available pick-15 follow-up rather than treating either policy as ground truth.

The former priority “lasts to next pick” field included the simulated policy selecting the player itself. It cannot establish survival conditional on passing. That column and its wait/take advice have been removed; the saved `survives` field is retained only as a legacy policy-path statistic. Use the actual draft advisor’s separate current-board forecast for availability.

The priority table’s second-pick availability counts worlds where both the chosen first pick and second pick were possible, divided by all worlds. It is joint availability; a rare first-pick fall produces a small percentage even when the second player usually follows. Its rank uses paired gaps against a common baseline, while absolute means can reflect different available worlds. All nine modeled first-pick branches are selectable in the UI.

The priority study also supports a flexible elite-TE/WR decision at the turn: after Gibbs, Ashley’s market ranking is Bowers, Nico, London; after Bijan, Brian’s is Nico, Bowers, London. The respective paired gaps against their common baselines are +0.61/+0.56/+0.35 and +0.73/+0.38/+0.19 points/week. These rankings assume a simpler continuation than the actual advisor and cannot guarantee those players remain after Ashley and Brian take consecutive picks.

The fixed-lineup paired study yields a different scale: Ashley's two leading shapes both average 100.09, Brian's leader averages 99.62, and Emily's top three span 95.99–96.15. Ashley's identical leading outcomes now display 50/50 head-to-head after tie correction. The weekly adaptive study averages Ashley 104.7, Brian 104.1 and Emily 100.9. Its position labels are per-round modal choices, not a tested fixed sequence. Different lineup and draft policies explain differences among these outputs.

| Study command | Final sample setting | Interpretation |
|---|---|---|
| `sim-all.mjs` | 4,000 per condition | Single-seat and all-three simplified-policy comparison |
| `sim-paired.mjs` | 8,000 per opening | Five fixed-lineup openings per seat, matched world/player outcomes |
| `sim-first.mjs` | 2,500 per candidate | First-choice outcomes conditional on availability |
| `sim-tree.mjs` | 700 per branch | Descriptive second/third-pick branches |
| `sim-plans.mjs` | 4,000 per seat | Weekly available-starter policy, selection frequencies and position shelves |
| `sim-risk.mjs` | 6,000 per case | Assumed risk profiles and outcome distributions |
| `sim-priority.mjs` | 5,000 per option | First/second-choice comparisons on overlapping available worlds |
| `sim-rbrun.mjs` | 20,000 per opening/room/seat | Eleven four-round openings in two rooms |

The agreement gate finished with zero failures and three warnings, all for Emily: Nico over Brown by 0.60 (combined SE 0.32), Javonte over Loveland by 0.36 (0.31), and Kraft over Jaylen Warren by 0.13 (0.32). Each is below the gate's two-SE threshold. These alternatives stay visible because the audit uses a different continuation policy from the live advisor.

## Research affecting Tuesday's decisions

- **Jaydon Blue:** Philadelphia confirmed his September 1 practice-squad signing. Corrected DAL to PHI and removed his old Dallas role claim. [Eagles transaction](https://www.philadelphiaeagles.com/news/eagles-sign-t-kiran-amegadjie-rb-jaydon-blue-wr-danny-gray-and-cb-robert-longerbeam-to-practice-squad).
- **Josh Jacobs / Marshawn Lloyd:** Jacobs was placed on the exempt list; a possible return has no confirmed date. Green Bay's September 2 report supports Lloyd's near-term opportunity. His uplift remains a scenario assumption. [NFL status](https://amp.nfl.com/news/nfl-places-packers-rb-josh-jacobs-commissioner-exempt-list), [Packers report](https://www.packers.com/news/rb-marshawn-lloyd-as-ready-as-he-s-ever-been-to-help-packers-sep-2-2026).
- **Breece Hall:** The Jets' September 1 update described Hall and Allen working toward the regular season. Confirm availability before committing at price. [Jets report](https://www.newyorkjets.com/news/jets-rb-braelon-allen-breece-hall-working-towards-regular-season).
- **Ja'Marr Chase / Tee Higgins:** Cincinnati expected limited work ahead of game preparation. A Week 1 expectation still requires a current practice check. [Bengals report](https://www.bengals.com/news/quick-hits-zac-taylor-ja-marr-chase-tee-limited-this-week-but-have-eyes-on-bucs-week-why-jack-endries-and-ke-shawn-williams-made-it).
- **TreVeyon Henderson / Emeka Egbuka:** Recent reporting still left availability uncertain. Keep replacements in the target group. [Henderson, September 3](https://www.fantasypros.com/nfl/news/605824/treveyon-henderson-ankle-still-not-practicing-thursday.php), [Egbuka, September 1](https://www.fantasypros.com/nfl/news/605324/emeka-egbuka-toe-remains-up-air-week-1.php).

The wire retained 451 attributed items out of 1,384. The 933 rejected items lacked the required attribution; that is source filtering, not independent verification of every remaining sentence. Older curated profiles and implied totals are background material. Re-run the refresh and read current practice reports before Tuesday's draft.

## Model interpretation

Published studies draft 14 skill-player rounds. Kicker/defense production, waivers, trades, real manager behavior and the actual fantasy matchup schedule are excluded. Weekly studies use available starters selected on projection; aggregate studies use a fixed projected lineup and a coarse season-outcome distribution. Their absolute point estimates and ranges measure different things.

Historical variance has small samples for many players and substitutes positional priors for rookies. Injury probabilities and handcuff shares remain assumptions. One team-level scoring factor approximates teammate correlation and cannot exactly reproduce every QB/WR/TE relationship. Opponent ADP noise is a model of behavior, not a measurement of this league's owners.

The agreement check compares the advisor against a simpler value-based continuation. Shared player/world seeds reduce some comparison noise; draft paths and opponents' eventual rosters can still diverge after a different choice. Close results and sensitivity changes are preserved as uncertainty. Increasing trials improves numerical precision within those assumptions.

See [validation manifest](validation.json), [input changes](input-changes.json), and the [saved result files](results/) for reproducible evidence. Only completed final runs are counted; exploratory or interrupted runs are excluded. Published model inputs and results are committed. The external provider table and raw API responses are excluded; the manifest records their local hashes and source URLs, so external-provider reruns require a new snapshot.
