# Fantasy Draft 2026

A draft guide, live tracker, practice room, and pick advisor for a 12-team half-PPR Sleeper league. Open the root `index.html` for the self-contained app.

The September 4 audit and rerun for Ashley (seat 1), Brian JK (seat 2), and Emily (seat 10) are documented in [the analysis report](analysis/2026-09-04/REPORT.md). The board contains 235 distinct skill players: 170 curated rows and 65 source-backed depth options. The additional depth lets all twelve teams finish legal rosters.

## League and model

The live league has 16 rounds: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 K, 1 DEF, and six bench spots. Receiving scores 0.5 per catch; passing touchdowns score four points. The refresh verifies the league format through Sleeper before computing projections.

Published studies simulate **14 skill-player rounds** and exclude kicker/defense scoring. The weekly studies choose starters from available players using projections before observing simulated scores. The aggregate season studies hold the projected starting lineup fixed and summarize season-level outcomes. Their absolute scores and ranges answer different questions.

The advisor considers value over replacement, the actual picks before the next turn, roster needs, availability, market prices, handcuffs, and bye weeks. Recommendations respond to the live draft. Statistical ties and projection-sensitive choices deserve alternatives rather than a fixed script.

## Data sources

| Source | Input and use |
|---|---|
| [Sleeper draft](https://api.sleeper.app/v1/draft/1389372699129700353) and league endpoints | Actual order, scoring rules, roster configuration, live picks |
| [Sleeper season projections](https://api.sleeper.com/projections/nfl/2026?season_type=regular) | `adp_half_ppr` and source-backed depth candidates |
| [Sleeper weekly projections](https://api.sleeper.com/projections/nfl/2026/1?season_type=regular) | All 18 weeks, component statistics re-scored under the actual league rules |
| [Sleeper player registry](https://api.sleeper.app/v1/players/nfl) | Player identity, team, injury designation, depth, age, experience |
| [Sleeper 2025 weekly actuals](https://api.sleeper.app/v1/stats/nfl/regular/2025/1) | All 18 weeks, re-scored for measured weekly spread and small-sample shrinkage |
| [FantasyFootballCalculator](https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=2026) | Half-PPR, 12-team mock ADP and spread; latest refresh includes 3,064 drafts from August 30–September 4 |
| Sleeper per-player news endpoint | Attributed reporting with source, date, trigger sentence, and rule-based injury/role tags |
| [Official NFL bye schedule](https://www.nfl.com/_amp/2026-nfl-schedule-release-every-team-bye-week) | All 32 team byes checked against `BYE` |
| [Hashtag Football](https://hashtagfootball.com/fantasy-football-half-ppr-rankings) | Independent projection comparison and bounded sensitivity checks; not blended into the production forecast |

Market price is 75% Sleeper half-PPR ADP and 25% mock ADP, with explicit fallbacks. Never substitute the superflex-biased `search_rank`. Mock coverage is thinner in the late rounds; the audit reports missing entries and large price disagreements.

The refreshed weekly feed covers 231 of 235 board players. Unmatched players receive zero projected value rather than a made-up rank-curve estimate. The historical distribution covers 190 players. Name normalization includes provider aliases such as Kenneth/Kenny Gainwell so a player cannot become two draft options.

The news refresh retained 451 of 1,384 items with identifiable attribution. Keyword tags remain fallible. Historical references, negation, and another player's injury require guards; important draft-day reports also receive manual source checks. Recovery time is measured from the report date, allowing preseason recovery to elapse before it costs regular-season games. Reported early absences are respected in the opening simulated weeks.

The app also carries team implied totals for context and cosmetic team logos. Waiver trending measures attention and does not set recommendation scores.

## Interpretation limits

More simulations reduce sampling noise within the model. They cannot remove uncertainty in projections, medical timelines, depth charts, or opponents' choices. Weekly variance is measured from 2025 where available; injury probabilities, future-role adjustments, handcuff uplift, and aggregate season variance remain assumptions. A handcuff's uplift uses the starter's expected missed share and a coarse historical multiplier.

The priority study compares candidates in overlapping worlds against one common baseline. Draft paths can diverge after a different pick; shared seeds do not make the resulting opponent rosters identical. The advisor agreement audit uses a simpler continuation policy, so it is a useful cross-check rather than proof of global optimality.

**No calibrated championship probability is published.** An earlier hard-coded championship claim used an invalid matchup schedule. The schedule generator is fixed and tested; a title forecast still requires validated league scheduling, waiver behavior, opponent strength, and uncertainty assumptions.

## Refresh and validation

```sh
cd app
npm ci
node scripts/predraft.mjs
npm run build
```

`predraft.mjs` refreshes depth, Sleeper data/projections, mock-market ADP, measured spread, and news; builds the simulation modules; runs the eight published studies and validation gates; and loads results only after every gate passes. It rejects missing/stale study files and failed subprocesses. Review dated player commentary after each refresh. Large default studies take time: RB-run comparisons use 20,000 worlds per shape/room/seat, and priority comparisons use 5,000 worlds per candidate.

Focused checks:

```sh
node scripts/sim-build.mjs
node scripts/league-scoring.test.mjs
node scripts/availability.test.mjs
node scripts/round-robin.test.mjs
node scripts/audit-model-inputs.mjs
node scripts/audit-draftday.mjs 300
node scripts/audit-full-draft.mjs
```

`audit-full-draft` verifies 36 complete 192-pick drafts, with all twelve seats using the advisor and early/late kicker and defense choices. `audit-draftday` drives the real browser advisor for all three users in the same room, across market, early-RB-run, and value-aware opponents. `audit-sensitivity.mjs <external.json>` compares identical states under five projection scenarios; its input is a JSON array containing `{name,total}` season projections.

The eight published studies are `sim-all`, `sim-paired`, `sim-first`, `sim-tree`, `sim-plans`, `sim-risk`, `sim-priority`, and `sim-rbrun`. Other `sim-*` files are research experiments; their output is not automatically published or certified by this refresh.

## Development

Vite, React, TypeScript, and Tailwind live in `app/`. Run `npm run dev` there. `npm run build` type-checks and regenerates the root `index.html`; never hand-edit that artifact.

Board data and commentary live in `app/src/data.ts`. Generated data lives in `sleeper.ts`, `projections.ts`, `ceilings.ts`, and `news.ts`. Panels live in `app/src/panels/`. Draft state and optional league intel persist in localStorage under `fd26-*` keys. A PR updates the source and build artifact; merging/deployment is a separate action.
