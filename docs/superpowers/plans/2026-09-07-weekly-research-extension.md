# Weekly research extension

User-authorized scope: complete the research-driven weekly system for the games of the selected NFL week, Emily/Ashley/Brian, while keeping Sleeper roster updates strictly manual. Existing lineup/trade optimizers stay shared and tested. This extends the approved weekly plan.

## Tasks and interfaces

1. Environment collector: actual event venue/roof, kickoff forecast, rest and travel context, official practice/game status. Own environment.mjs/test and source notes. Output collectEnvironment({season,week,now}).
2. Usage/model collector: completed-game player opportunity and team/opponent efficiency, current-season evidence with explicit prior-season fallback, standalone statistically fitted candidate with temporal heldout tests and ablations. Own research-stats/model scripts/tests and evidence. Output collectResearchStats({season,week,now}).
3. Coverage collector: dated NGS receiving metrics, verified defensive personnel, timestamped market context, validated optional coverage input. Own coverage script/tests and evidence. Output collectCoverage({season,week,now}).
4. Root integration: merge the three outputs into a source-attributed weekly briefing, per-player evidence, official availability exclusions, model disagreement, change feed, current-week default and UI; schedule builds and archives and retain manual roster behavior.
5. Verification/release: meaningful fixture tests, actual collector/model run, browser review, whole-change review, PR/merge and successful hosted weekly workflow.

## Interface review and rulings

| Tasks | Shared interface | Ruling |
|---|---|---|
| 1/4 | Injuries and game IDs | Exact team/name identity only; ambiguous names remain evidence and cannot exclude players. Blank official game status never means active. |
| 2/4 | candidateMean versus numeric replacement | Show measured research candidate independently; replace provider only when the admission test actually passes. Interesting evidence alone never justifies a point multiplier. |
| 3/4 | NGS context versus coverage assignments | Separation is observed tracking context, not an individual WR/CB assignment. Optional licensed input requires current timestamps, IDs and assignment weights. |
| 1/2/3 | Cache and source time | Reuse bounded public cache; collectors own separate files. Snapshot cutoffs precede target games. Source timestamps and collection times remain distinct. |
| 4/5 | Schedule versus roster boundary | Scheduled jobs collect public game/player research only. User league rosters and saved starters refresh only on button click. |

Ruling: new commercial subscriptions and external trade/lineup submissions remain outside authorization. Public data and a validated import interface support the system without inventing premium coverage. Missing feeds remain visible; the implemented pipeline retries them each weekly run.

Research runs for the current NFL week, with daily context refresh and targeted pregame checks. The initial weekly report uses prior-season history before current games exist. Actual future observations are required to establish prospective predictive performance.

## Execution evidence

All five tasks implemented. Live week-one collection produced 16 verified games, 13 kickoff weather forecasts (three indoor exclusions), 11 official practice rows, 32 defensive personnel snapshots, 79 qualifying NGS receiving profiles and 585 mapped historical opportunity profiles. The model fitted 2023 data, selected feature family/penalty on 2024 and reported 2025 heldout results. On 4,798 paired player-games, research MAE 4.223 exceeded provider MAE 4.055; the 95% week-cluster interval for added absolute error was +0.118 to +0.224. The independent candidate is displayed and archived as a second opinion; it does not replace the empirically better provider forecast. Official Out/Inactive status can exclude a uniquely matched player.

Review corrections: reject invalid defender assignments and stale depth charts; reject historical environment collection without pre-cutoff observations; clear incompatible player selection; preserve research generation/model/source provenance in immutable shadow archives; use paired candidate/provider actuals; keep future-week research separate and avoid trying to archive stale future projections midweek. Generated app and root publication files are synchronized by the build.

Checks: 42 weekly tests pass plus the complete existing draft suite; production build passes; real collection, model fitting and shadow archival succeed. Browser inspection verified the 16-game briefing and individual player search/evidence. Roster ownership remains pre-draft, so post-draft live decisions still await the completed league draft. Source-specific limitations remain visible: current individual route/coverage assignment requires an authorized feed, final inactive checks remain important, and retrospective testing does not establish prospective superiority.
