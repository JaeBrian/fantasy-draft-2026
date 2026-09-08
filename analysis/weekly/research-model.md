# Weekly opportunity and opponent research

Run `node scripts/weekly/research-stats.mjs 2026 1` from `app/`. Output is `app/public/weekly/research-model.json`. The normal collector entry point is `collectResearchStats({season, week, now})`. Node 22 performs collection and ridge fitting; Python 3 standard library streams compressed play-by-play into small cached red-zone game/player aggregates. Raw CSV responses and aggregates stay in `.simcache/weekly/`.

## Sources and definitions

- [nflverse player statistics](https://nflreadr.nflverse.com/articles/dictionary_player_stats.html): attempts, carries, targets, receptions, air yards, target/air-yard shares, yards, touchdowns and fantasy-scoring components. League half-PPR and all relevant offensive scoring settings are applied to component statistics.
- [nflverse team statistics](https://nflreadr.nflverse.com/articles/dictionary_team_stats.html): opponent passing/rushing EPA, sacks, QB hits and explosive gains. Defensive pass EPA uses opponent passing EPA divided by attempts plus sacks suffered. Rush EPA divides by carries. Pass explosives are 20+ yards; rush explosives are 10+ yards. QB-hit rate is a proxy; charted pressure rate stays unknown.
- [nflverse play-by-play dictionary](https://nflreadr.nflverse.com/articles/dictionary_pbp.html): red-zone opportunities require distance to opponent end zone at most 20 yards; inside-five carries use at most five yards. No-play rows are excluded. Receiver/rusher GSIS IDs join directly to game statistics. This counts recorded targets/carries, including scrambles where classified as rush attempts.
- [PFR snap counts](https://nflreadr.nflverse.com/reference/load_snap_counts.html): offense snaps and share, joined through PFR ID to GSIS ID. Snap share differs from route participation.
- [Fantasy ID crosswalk](https://nflreadr.nflverse.com/reference/load_ff_playerids.html): documented DynastyProcess GSIS/Sleeper crosswalk; ESPN/GSIS fallback. Every matched player must also have the same birthday and position in live Sleeper and nflverse metadata. Names are never the sole join key. Ambiguous and mismatched identities remain absent.
- [nflverse update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html): collection timestamps describe fetch time; actual source publication depends on upstream providers. This pipeline caches these feeds for 24 hours. Collection timestamps do not establish historical vintage or latest upstream publication.

Defensive schedule adjustment goes beyond positional points allowed: for each observed defensive game, subtract that opponent offense's mean EPA rate over its own previous six games of the same season from the EPA allowed in that game; average those residuals over the defense's last six games. The opponent offense's target-game and future results never enter its baseline. Week-one games have no same-season opponent baseline and are excluded from this residual. Raw EPA is retained separately. This adjustment measures opponent context, without a hand-set matchup multiplier.

## Cutoff and early-season behavior

Only regular-season rows from weeks strictly before the target week qualify. A matching schedule record must contain both final scores and have kicked off at least eight hours before `now`. The whole target week is excluded even if a Thursday game has finished. This conservative rule also excludes recent games while scores may be in progress.

Player features summarize up to six recorded played games. Current-season observations replace prior-season observations when available; before that, the prior season is explicitly labeled. September 2026 week-one output therefore contains 2025 observations, including prior-team roles. Missing games are excluded, rather than assigned zero. This is a conditional-on-participation model. The fixed six-game history is a declared feature construction choice; no subjective player/matchup multiplier is applied.

## Fitting and untouched evaluation

Separate QB/RB/WR/TE linear ridge models forecast league-scored points from lagged opportunities. Training: 2023 with 2022 priors. Validation: 2024 chooses ridge penalty from 1, 10, 100, 1000 and selects one feature family using weighted validation MAE. Coefficients then refit on 2023–2024. The 2025 test is evaluated after selection. Means/scales and missing-value imputation come only from fitting data. Current experimental means refit the selected specification on completed 2023–2025 observations.

Three ablations are measured: opportunity only; opportunity plus snaps/red-zone role; full model adding opponent features. A last-six-played-game mean is a simple baseline. Historical rows require two earlier recorded games. Negative fitted point estimates are clipped to zero.

Verified run on September 7, 2026 (local): 585 GSIS/Sleeper-matched players and 32 team records. All four seasons of compressed PBP and snap data were collected successfully. The selected family was **opportunity only**, chosen using 2024 validation.

| 2025 heldout model | Player-games | MAE | RMSE |
| --- | ---: | ---: | ---: |
| Selected opportunity model | 5,293 | 4.108 | 5.771 |
| Opportunity plus role | 5,293 | 4.099 | 5.763 |
| Full opponent model | 5,293 | 4.109 | 5.767 |
| Trailing mean | 5,293 | 4.162 | 5.995 |

The slightly lower test error of the role model does not change the validation-selected specification. Opponent evidence remains available even when it does not improve the selected numeric forecast.

On **4,798 identical player-games** matched to positive historical Sleeper projections, the selected candidate's MAE was **4.223**, provider MAE **4.055**, and trailing mean MAE **4.340**. A 2,000-replicate paired week-cluster bootstrap gave candidate-minus-provider absolute-error difference **+0.118 to +0.224 points** (95% interval). Every position's candidate MAE was higher. The measured admission gate failed.

The gate requires that interval to fall below zero, with at least 100 matched samples and no MAE regression at each position. Its tests demonstrate both passing and failing synthetic cases. Even a retrospective pass requires prospective data/lineup validation before replacing provider means. Historical Sleeper forecasts may have been revised after kickoff; nflverse stats include later official corrections. These tests establish a reproducible retrospective comparison, with the limits stated explicitly.

`candidateMean` is the numerical research second opinion. `modelMean` remains null while admission is pending. `validation.qualityGatePassed` reports the empirical error gate, while `validation.admitted` reports whether the model may alter the primary forecast. No arbitrary adjustment or blend changes primary means.

## Limits and verification

Route participation, individual coverage, charted pressure/blitz, defensive absences, rookie role and participation/availability risk remain outside this model. K/DST require separate models. Current identity crosswalk availability introduces survivorship in the paired provider subset. No roster-constrained lineup-decision gain is established.

`node --test scripts/weekly/research-stats.test.mjs scripts/weekly/research-model.test.mjs` passes seven checks: completed-game cutoff, future-week exclusion, stable mapping rejection, prior-season labeling, strictly pregame opponent adjustment, league scoring, fitted ridge behavior/missing values, and empirical admission behavior (some checks share a test). Tests run independently of network downloads. Full collection and training were also executed successfully with real sources.
