# Weekly public-data baseline evidence

Generated 2026-09-08T04:56:25.249Z.

- 18 weeks; week 1 contains 897 mapped players. Player records absent from the public dataset remain unknown and require live roster metadata mapping.
- Schedule: 272 regular-season games, 32 teams, exactly 17 games per team. Kickoff Eastern timezone verified against nflreadr schedule dictionary: https://raw.githubusercontent.com/nflverse/nflreadr/main/data-raw/dictionary_schedules.csv .
- Artifact: 9254550 bytes (933763 gzip bytes). Raw observations stay under app/.simcache/weekly; generated output publishes atomically after validation with prior output retained locally.
- Exact league component scoring for skill positions and DEF. Kicker distance buckets are incomplete: minimum/maximum scoring bounds retain unknown allocations; conservative lower bound used for ranking and retrospective K residuals. These bounds are scoring-input ambiguity, not outcome intervals.
- Heldout 2025 weeks 11–18: n=2607, MAE=4.2586, RMSE=5.8009. Position residuals fit only weeks 1–10.
- Same-sample ablation n=2403: provider/bound baseline MAE=4.3748 versus trailing-three-observed-game MAE=4.9108. Provider baseline retained.
- This is retrospective: historical projections carry postgame revisions. Missing actual rows are excluded. These results establish neither prospective quality nor matchup-feature improvement. Start/sit decision gains, CRPS, injury calibration and trade acceptance remain unvalidated.
- Current-week Sleeper injury tags apply only to the current week. Future forecasts are conditional on availability. Official gameweek injuries, WR/CB coverage, weather and odds are unavailable and do not change projections.
- Current-season observed usage fields populate only after completed games; week 1 has no fabricated recent usage.
- Commands from app: node scripts/weekly/backtest.mjs; node scripts/weekly/project.mjs; node --test scripts/weekly/data.test.mjs. Seven focused tests pass.
