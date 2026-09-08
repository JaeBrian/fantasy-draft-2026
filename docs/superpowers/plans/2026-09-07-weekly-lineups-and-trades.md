# Weekly Lineups and Trade Targets Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Checkboxes track delivery, not completed work.

**Goal:** Give Emily, Ashley, and Brian weekly, evidence-backed starting lineups, injury contingencies, waiver alternatives, and realistic trades that improve each manager’s team.

**Architecture:** A scheduled data collector saves timestamped source snapshots. One versioned statistical model produces weekly player distributions and rest-of-season scenarios. Separate lineup and trade engines consume those same distributions; the existing React site displays lightweight generated results and freshness indicators.

**Tech stack:** Existing React/TypeScript/Vite UI and Node data scripts; Python for model fitting and validation if needed. Store raw research data outside the deployed bundle. Use a scheduled server job or GitHub Actions for collection, with private secrets and appropriately restricted artifacts. Select hosting only after checking data licensing and refresh needs.

**Spec:** The product and statistical specification is contained in sections 1–9 below. This is a researched plan, not a claim that models, feeds, scheduled jobs, or recommendations are already running. Prepared September 7, 2026.

## 1. Scope and non-negotiable rules

- Support Emily, Ashley, and Brian independently, while analyzing every roster in their real Sleeper league.
- Resolve managers by Sleeper user ID and roster ID. Draft position is not a durable identity. Confirm the correct Brian, including co-owners; do not infer identities from names alone.
- Fetch scoring, eligible positions, lineup slots, IR/bench rules, playoff rules, waiver rules, trade deadlines, and actual matchup schedule. Current code assumes 12 teams, half-PPR, two flex positions, K/DST, and six bench slots; validate against live league settings before use.
- Keep this season-management feature separate from disposable test-draft configuration. Test league data must never produce real weekly recommendations.
- Optimize legal starting lineups, including kickers and defenses. Existing draft studies model 14 skill rounds and cannot simply be reused as weekly lineup optimization.
- Show what changed, which source supports it, how fresh it is, and how uncertain the conclusion is.
- Prefer the best validated baseline whenever new features fail validation or critical inputs are stale.
- Recommendations are read-only. The user makes lineup changes and sends trade offers in Sleeper. Creating notifications, purchasing feeds, or starting recurring jobs is a separate execution step.
- “Best” means best estimated decision under the selected objective and available information, not a promise about the realized score.

## 2. What the user gets each week

### Weekly lineup report, one per manager

1. Recommended starters in each eligible slot, with current starters alongside them.
2. Clear swaps: “Start A over B,” expected point difference, probability A outscores B, uncertainty, and the change in estimated team win probability when supported.
3. Player cards with mean, median, 10th/90th percentiles, expected workload, opponent, kickoff time, injury status, and three main reasons.
4. A full bench ranking and a shortlist of available waiver replacements. Include cost and availability when known.
5. Contingencies: “If A is inactive, start B; if B’s game has already locked, use C.” Highlight choices that require action before an earlier kickoff.
6. A dated “What changed?” feed, including roster transactions, practice changes, new defensive absences, and meaningful projection revisions.
7. Separate freshness for roster, projections, injury report, matchup charting, and model computation. A successful API check does not imply fresh upstream data.

### Trade report, one per manager

- Ranked buy-low, buy-high, sell-high, and hold/watch candidates, with current owners.
- Concrete outgoing/incoming packages; show each side’s best legal lineup before and after.
- Estimated next-three-week and rest-of-season lineup gains, playoff/championship probability changes if validated, downside, and waiver/drop implications.
- Explain why the other manager may benefit using measured roster shortages, injury/bye coverage, and excess bench strength.
- Give a maximum acceptable price and a counteroffer boundary. Compare trading with holding and using waivers.
- Label market value and model value separately. An acquisition can be strategically useful without the player being “cheap.”

The UI should use two tabs, **Weekly lineup** and **Trade targets**, with Emily/Ashley/Brian selectors and a week selector. Default to actionable decisions; put the full evidence table behind “Why?”

## 3. Data inventory and source feasibility

Every field needs player/team IDs, event week, source, observed-at time, available-at time, units, missingness flag, and confidence. Missing is not zero. Preserve historical snapshots before replacing current values.

| Data family | Features to investigate | Source path and fallback |
|---|---|---|
| League reality | Owners/co-owners, rosters, starters, eligible slots, transactions, standings, matchups, free agents | Documented Sleeper league endpoints; validate identity mapping and scoring on every run [S1] |
| Baseline forecasts | Component weekly projections, independent forecast disagreement, rest-of-season forecast | Audit existing projection collector; verify endpoint stability and refresh timestamps. Add an independently sourced licensed forecast if available |
| Opportunity | Snap share, routes per dropback, target share, targets per route, air yards, carries, two-minute and third-down use | Public play-by-play and snap data where available; current route/participation detail needs a verified feed [S2] |
| Scoring opportunities | End-zone targets, inside-20/10/5 carries and targets, goal-to-go use, expected TDs | Derive reproducibly from play-by-play; shrink volatile conversion rates |
| Efficiency | Yards/route, yards/target, catch probability, yards after catch, explosive plays, rushing success, yards before/after contact | Public fields first; advanced tracking/charting only where access and definitions are verified |
| Offensive environment | QB health/style, dropbacks, pass rate over expectation, pace, personnel, OL starters and injuries, pressure allowed, coaching changes | Play-by-play, official reports, depth charts, and licensed charting |
| Defensive environment | Opponent-adjusted pass/rush efficiency, pressure/blitz rate, coverage mix, box counts, explosive plays conceded, tackle quality, defensive absences | Public team features first; add charting incrementally. Avoid using raw positional points allowed as the entire matchup model |
| WR/CB and TE coverage | Slot/wide/left/right alignment, expected defender shares, shadow likelihood, man/zone, safety help, route-type interaction, LB/safety matchups | Evaluate PFF/other licensed current matchup exports. Public NGS summaries do not imply access to raw tracking or a supported public coverage API [S3, S4] |
| Availability | Practice progression, official game status, inactive list, expected workload limits, injury return scenarios | Official team/NFL releases as authority; optionally a licensed structured provider. Do not depend on an unavailable nflverse injury feed [S2, S5] |
| Game context | Opponent, venue, surface, roof status, wind/gusts, precipitation, temperature, rest, travel, international games, team incentives | Schedule plus stadium-specific weather. NWS for US venues; explicitly source international venues separately [S6] |
| Market expectations | Game totals/spreads, implied team points, player props, line movement and disagreement | Licensed or permitted timestamped odds source; store bookmaker/vig treatment. Do not assume a prop line is an expected value |
| K/DST | Kicker role, attempt distance, team drives, weather; defensive sacks/turnovers, opposing QB/OL, scoring allowed | Component distributions scored through exact league rules; model DST scoring bands explicitly |
| Trade market | ROS consensus/value ranges, ownership, waiver interest, completed trades, local roster needs | Verified market sources plus league transactions. Sparse local trade history cannot support precise acceptance probabilities |

**Confirmed limitations:** nflverse documents post-season-only participation releases, an injury-feed outage, and dataset-specific update schedules. Its play-by-play is useful for historical modeling, with subsequent stat corrections. These limitations require source-by-source freshness checks, not a universal “data updated” badge. [S2]

**Paid-data decision:** Start with public data plus reviewed injury inputs. Before buying advanced coverage data, require a sample export with stable player IDs, historical as-of timestamps, alignment/coverage definitions, update frequency, price, and permission to publish derived results. PFF advertises a WR/CB tool; that does not establish an automated API entitlement. SportsDataIO documents structured NFL workflows and projection products; exact package coverage and access still need confirmation. [S4, S5]

## 4. Statistical start/sit engine

### Baseline and feature discipline

Build a league-scored weekly baseline first. Compare a simple role/usage model, a current provider projection, and a calibrated ensemble. Use prior-season and preseason information early in the year, then learn how quickly current-season usage should displace those priors. Estimate decay and shrinkage in training; do not select weights by intuition.

Model opportunity before efficiency: team plays and dropbacks, player route/carry participation, targets/carries, conversion and yardage, and touchdowns. Allow role-changing injuries to alter team target/carry allocation coherently; projected shares must remain plausible. Fit K/DST separately. Use regression or hierarchical models first, and compare boosting only if it improves held-out performance.

Candidate adjustments include every data family above, but admission requires an ablation test. A factor that is interesting yet adds no predictive value stays in the evidence view without moving the numeric projection. Do not double-count opponent strength already included in a provider forecast or odds baseline. Test adjustments to baseline residuals as well as standalone models.

### Cornerback treatment

Estimate a distribution of likely coverage assignments from receiver alignment, defensive personnel, coverage scheme, motion, and verified shadow usage. Blend effects across all probable defenders; never assume WR1 faces CB1 on every route. Account for zone and safety help. Separate coverage exposure from target selection, since receivers targeted against a defender are a selected sample. Shrink small samples and publish assignment uncertainty.

If current charting is missing, display “individual coverage unavailable” and use the validated team/scheme model. Do not invent a cornerback penalty from reputation. Admit this feature group only if it improves held-out WR/TE forecast quality and lineup choices beyond opponent/team features.

### Distributions and lineup choice

- Model active/inactive and full/limited-workload scenarios, with probabilities calibrated from historical pregame reports where available. Do not divide a season-level missed-games probability by 17.
- Simulate correlated NFL game outcomes using shared team scoring, play volume, target allocation, and empirically estimated residual dependence. Account for both sides of the fantasy matchup.
- Avoid a generic RB/WR anti-stack penalty. Re-estimate any relationship with current historical samples and uncertainty.
- Default to maximizing expected lineup points. Offer matchup-win-probability optimization when opponent projections and dependence are validated; explain any lower-mean lineup it selects.
- Enumerate legal slot assignments or use an exact optimization solver. Respect multi-position eligibility, flex, game locks, byes, inactive status, and already scored points.
- For pending injuries, optimize a contingent policy using information available at each kickoff. Preserve later FLEX flexibility when equivalent and helpful.
- Start paired comparisons with 20,000 common-random-number draws; increase toward 100,000 for close decisions until estimated win-probability difference has Monte Carlo standard error below 0.5 percentage points or the budget is exhausted. Report inconclusive results. Simulation precision is separate from model uncertainty.
- Show close calls when the estimated advantage is small relative to uncertainty; do not manufacture confidence by running more simulations.

## 5. Trade target engine

### Find sustainable changes versus scoring noise

**Buy low:** price appears below the uncertainty-adjusted value of future starts, with sustained usage despite poor recent scoring, temporary difficult matchups, or a reasonably supported recovery scenario.

**Buy high:** production rose with a credible role change, and the asking price still trails the model’s valuation. Examples are increased route participation, goal-line ownership, or a durable promotion; these are hypotheses to test, not automatic signals.

**Sell high:** recent scores depend on unstable conversion, disappearing usage, or temporary absences that market pricing may overvalue. A “sell” label requires a better feasible alternative.

**Hold/watch:** the edge is uncertain, the price already reflects the change, or the team needs the player’s depth more than the available return.

### Match offers to roster needs

Compute marginal player value as the change in optimized weekly starting-lineup outcomes after adding/removing that player, including replacements. Analyze every team’s thin positions, upcoming byes, injuries, flex needs, and valuable bench surplus. Distinguish a temporary one-week hole from a season-long shortage.

Generate one-for-one, two-for-one, and two-for-two packages first. For each package:

1. Verify ownership, roster legality, applicable trade rules/deadline, and likely processing time.
2. Re-optimize both rosters week by week, including any forced drops and realistically obtainable free agents.
3. Compare no trade, proposed trade, and best waiver-only alternative using identical simulated worlds.
4. Evaluate near-term wins, future starting points, playoff qualification, and championship outcomes using the actual league schedule/bracket. Do not substitute the draft simulator’s synthetic round robin.
5. Apply sensitivity to player projections, injury returns, acquisition price, and replacement availability.
6. Rank robust gains. Show uncertain market acceptance as a qualitative assessment unless enough labeled negotiation data exists to calibrate it.

Avoid “two bench players for an elite starter” recommendations solely because summed projections look equal. Consolidation benefits and lost depth must both be priced. Treat Emily, Ashley, and Brian as separate competing managers; an offer between them must show each side’s outcome independently. Never sacrifice one manager’s roster to boost another’s score.

Backtesting can test player valuation and contingent roster outcomes. It cannot prove an unoffered historical package would have been accepted. Record proposed, accepted, declined, and countered offers only as actual observations.

## 6. Refresh and weekly operating cadence

Proposed schedule, not an active automation. Use America/Los_Angeles for reports and actual kickoff timestamps for locking and triggers; support Thursday, Saturday, international, Sunday, and Monday games.

| Window | Work and output |
|---|---|
| Monday after games / Tuesday morning | Reconcile results and transactions; usage and role-change report; first waiver and trade targets |
| Wednesday–Friday | Refresh practice reports, projections, coverage and opponent features; publish revised lineup and trade shortlist |
| Saturday | Full weekly simulation and contingency review; inspect late availability and roster legality |
| Each game day | Recheck ahead of each relevant kickoff, including a checkpoint around the official inactive release and a final pre-lock checkpoint |
| While the weekly page is open | Poll league roster/matchup changes at a modest shared interval; load cached model output and show both collection and model age |
| Material event | Recompute affected managers after an inactive, transaction, role change, or meaningful projection update |
| After the week | Score forecasts and recommendations; incorporate later stat corrections without rewriting the original forecast |

Suggested starting cadence: source collection every six hours midweek; 15 minutes during pregame windows where permitted; roster refresh every 60 seconds while active. Tune to provider publication times and quotas. Expensive features/models run once per changed snapshot, not once per viewer. Use retries with exponential backoff, jitter, Retry-After handling, timeouts, and last-good snapshots. A failed critical source marks output degraded; stale injury/roster data blocks a strong “ready to submit” status.

Notifications, when enabled later, should fire for actionable changes such as a starter becoming inactive or a meaningful recommended swap. Avoid alerts for tiny ranking fluctuations. Require explicit setup of destination and desired delivery schedule; this plan creates no reminders.

## 7. Validation and release gates

- Archive every forecast before kickoff. Distinguish event time from data availability; a Sunday feature cannot enter a Thursday decision retrospectively.
- Use rolling time splits, training only on earlier weeks/seasons. Tune within training folds; reserve the latest complete season as a final holdout where data access permits.
- Evaluate point MAE/RMSE, distribution CRPS or pinball loss, interval coverage, active-status Brier score, and pairwise start/sit calibration. Slice by position, early/late season, injury uncertainty, and sparse coverage samples.
- Measure lineup points gained/lost versus the provider baseline and simple projection ranking on the same legal rosters and locked decisions. Hindsight-optimal lineup is an upper bound, not a deployable baseline.
- Evaluate trade valuation over multiple future horizons with actual missed games and replacement cost. Avoid selection bias from assessing only successful deals.
- Use paired, game/week-clustered uncertainty intervals; document multiple feature experiments to limit cherry-picking. Run feature-family ablations and discard groups without stable improvement.
- A candidate model becomes the default only when its held-out decision gains are supported by uncertainty intervals and no material safety/position regression appears. If evidence is insufficient, retain the baseline and mark the new model experimental.
- Production gates: all rostered players mapped or visibly flagged; exact scoring/eligibility fixtures pass; no locked/inactive/bye starter suggested; deterministic replay; source freshness visible; no test-league contamination; atomic output publishing; previous version recoverable.
- Begin with a two-week prospective shadow trial as an operational minimum, then continue until sample size supports a performance conclusion. Two weeks alone cannot establish a statistical advantage.

## 8. Repository delivery plan

Existing code to reuse after audit: `app/scripts/league-scoring.mjs`, `fetch-projections.mjs`, `fetch-news.mjs`, `sim-correlation.mjs`, and the existing generated-data/UI approach. Existing `src/lib/advisor.ts` and `forecast.ts` solve drafting problems; do not relabel their draft-survival outputs as weekly start probabilities.

### Phase A — League identity and trustworthy snapshots

- [ ] Add `app/scripts/weekly/config.mjs`: real league identity, explicitly verified manager roster IDs, season/week resolution.
- [ ] Add `app/scripts/weekly/collect.mjs` and `schemas.mjs`: documented Sleeper endpoints, ID crosswalk, validated source records, timestamps, content hashes, caching and retry policy.
- [ ] Add fixtures/tests for two Brians, co-ownership, trades, unrecognized players, stale data, league setting changes and the test/real boundary.
- [ ] Deliver a read-only roster/scoring/freshness report for all three managers before making model claims.

### Phase B — Weekly baseline and legal lineup solver

- [ ] Add `app/scripts/weekly/project.mjs`, `lineup.mjs`, and `lineup.test.mjs`; score weekly components and solve every eligible slot, including K/DST.
- [ ] Add injury contingencies and kickoff locks, then test Thursday-to-Sunday and Sunday-to-Monday fallback cases.
- [ ] Add `app/src/panels/WeeklyPanel.tsx` and a versioned `app/public/weekly/latest.json` contract; wire the tab in `App.tsx`.
- [ ] Deliver baseline starters, bench alternatives, uncertainty labels, and source age. No advanced-model superiority claim yet.

### Phase C — Historical dataset and calibrated matchup model

- [ ] Add `app/scripts/weekly/features.mjs`, `backtest.mjs`, and `model/weekly/train.py` if a Python fitting step is warranted.
- [ ] Build as-of datasets; separate raw inputs, feature generation, training, and inference artifacts. Audit join leakage and revised-data bias.
- [ ] Fit baseline/ensemble and feature-family candidates, evaluate ablations, and publish `analysis/weekly/<run-id>/validation.md` with machine-readable metrics.
- [ ] Add correlated simulations and convergence checks in `app/scripts/weekly/simulate.mjs`; test roster constraints and compare paired decisions.
- [ ] Deliver experimentally justified matchup adjustments. Add paid WR/CB data only after access and validation gates clear.

### Phase D — Rest-of-season and trade engine

- [ ] Add `app/scripts/weekly/trades.mjs` and `trades.test.mjs`: roster-specific marginal value, package generation, replacements, deadline checks and both-team comparisons.
- [ ] Extend scenarios across the verified league schedule and playoff rules. Show projection sensitivity before claiming championship gains.
- [ ] Add `app/src/panels/TradesPanel.tsx` with target category, concrete offers, price boundary, opponent rationale, and evidence.
- [ ] Test two-for-one forced drops, multiple flex slots, scarce waivers, bye collisions, injury reversals, deadline timing, and offers between supported managers.

### Phase E — Scheduling, operations and prospective evaluation

- [ ] Add `app/scripts/weekly/refresh.mjs`: changed-input detection, model run, validation gates, atomic publish and rollback.
- [ ] Choose scheduled runtime and restricted data storage. If GitHub Actions fits, add `.github/workflows/weekly-refresh.yml`; keep paid data/API secrets out of the public repo and single-file HTML.
- [ ] Add outage/late-feed tests and runbook. Exercise kickoff checkpoints and visible degraded status.
- [ ] Run shadow mode; record recommendations and outcomes; promote only after gates in section 7 pass.
- [ ] Configure user-approved notification delivery after cadence and recipients are selected. Trade messages and lineup writes remain manual.

Each phase should be a reviewable PR with fixtures, measured outputs, and an explicit rollback. Planning does not change the current draft-room behavior.

## 9. Decisions and open questions

Proceed with public-data collection and baseline architecture planning. Before implementation requires them, resolve:

1. Confirm real Sleeper user/roster IDs for Emily, Ashley and Brian after the draft; do not use temporary test seats.
2. Decide whether paid current route/coverage/WR-CB data is worth its quoted cost after a sample coverage audit.
3. Choose the primary objective: expected points by default; matchup win probability as a validated option.
4. Confirm weekly report delivery location and notification preferences. The site can be the initial delivery surface.
5. Confirm historical projection/odds/injury snapshot access; without as-of history, use prospective validation rather than reconstructing unavailable knowledge.

## Sources checked September 7, 2026

- **S1:** [Sleeper API documentation](https://docs.sleeper.com/) — read-only league, roster, matchup and transaction interfaces; rate guidance. Undocumented projection endpoints require separate checks.
- **S2:** [nflverse data availability and schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) — update schedules, participation availability, injury-feed limitations, and stat corrections.
- **S3:** [NFL Next Gen Stats overview](https://operations.nfl.com/game-operations-logistics/technology/performance-tracking-data-next-gen-stats) — tracking and classification capabilities; not proof of public raw-data availability.
- **S4:** [PFF fantasy tools](https://www.pff.com/dfs) — WR/CB matchup product; access, exports and reuse permissions must be verified separately.
- **S5:** [SportsDataIO NFL workflow](https://sportsdata.io/developers/workflow-guide/nfl) and [NFL data product](https://sportsdata.io/nfl-api) — possible structured data provider; package and licensing evaluation still pending.
- **S6:** [National Weather Service API documentation](https://www.weather.gov/documentation/services-web-api) — weather collection for covered venues.


## Execution log — September 7, 2026

First delivery: real-league roster foundation, with shared collector/validation in `app/src/lib/weekly/`, local timestamped snapshots through `npm run weekly:snapshot`, and the draft-aware Weekly lineup tab. It resolves verified user IDs to live roster IDs and includes exact scoring, isolated real-league data, polling freshness, retry/backoff and a waiting view. The real league was still pre-draft with zero rostered players at verification.

The core Phase A roster/scoring report is implemented. Complete cross-provider player ID mapping, raw historical feature archives, matchup ingestion, weekly projection models, lineup optimization, trade models and background scheduling remain subsequent work. No claim of post-draft model readiness is made. The page explicitly distinguishes roster readiness from recommendation availability.


## September 7 implementation results

The public-data implementation now includes manual-only roster snapshots, 18 weekly component-scored forecasts, exact legal lineup optimization, kickoff locks, paired empirical simulations, injury contingency solves, waiver alternatives, and bilateral trade packages with roster-capacity and reserve handling. Weekly lineup and Trade targets share the saved real-league snapshot. Switching pages, managers or weeks never fetches Sleeper rosters. Model files refresh through the scheduled GitHub workflow independently of roster updates.

Validation retained the provider baseline: on paired historical observations, its MAE was 4.375 versus 4.911 for trailing-three-game points. Historical projections were revised after games, so these are retrospective diagnostics, not evidence of prospective superiority. Probability outputs remain experimental. The new shadow archive freezes pre-kickoff forecasts and scores completed weeks without automatically promoting a model. Week 1 was archived before kickoff.

The exact optimizer passed 40 exhaustive-oracle fixtures. The representative 12-team trade benchmark improved from 34.6 seconds to 1.8 seconds after optimizing the lineup solver. Analysis runs in a cancellable worker. The full existing draft suite plus weekly data, lineup, simulation, report, trade and shadow tests pass. Local browser checks verified manual roster loading, the real pre-draft state and both weekly pages. Post-draft live roster recommendations require the actual completed draft.

Public feed limits remain visible: official inactive reports, premium WR/CB assignments, current route participation, weather and betting feeds are not independently integrated. Future-week provider updates are older and trade outputs are exploratory. Kickers use explicit conservative scoring bounds where distance buckets are missing. Games already underway retain locked slots; live-score matchup probabilities remain unavailable. The public-data version is implemented; stronger predictive claims and feed-specific refinements remain gated on usable data and prospective evidence.

Operational commands from app/: npm run weekly:refresh generates forecasts, backtest evidence, shadow archive and public worker/data files. npm run build publishes the application bundle. npm test checks draft regressions and weekly engines. The scheduled forecast workflow does not collect user rosters or submit lineup/trade actions.
