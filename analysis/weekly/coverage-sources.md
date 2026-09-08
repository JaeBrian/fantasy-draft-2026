# Receiving, defensive personnel and market evidence

Verified September 7, 2026 (Pacific), using actual public endpoints. `collectCoverage({season, week, now})` supplies evidence for reports; it does not alter fantasy point projections.

## Live result

The first live 2026 Week 1 collection returned 79 Sleeper-mapped receiving players with 2025 NGS context, all 32 defensive depth charts, and totals/spreads for all 16 games. Depth-chart observations were timestamped `2026-09-07T13:13:25Z`. Justin Jefferson's stable-ID join produces Sleeper `6794`; his 2025 qualifying weekly samples total 137 targets, 3.219 yards separation, 5.717 yards cushion and 10.327 intended air yards. NGS weekly qualifying samples can omit low-volume games; these totals are sample totals rather than complete season totals.

## Sources and interpretation

- [nflverse NGS dictionary](https://nflreadr.nflverse.com/articles/dictionary_nextgen_stats.html) defines cushion at snap and separation at catch/incompletion for targeted plays. Neither statistic is all-route separation, alignment, coverage quality or proof of a shadow matchup. Weekly targeted-play means are target weighted; YAC above expectation is reception weighted.
- [Receiving CSV download](https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_receiving.csv.gz) currently includes 2016–2025. The annual 2025 CSV asset is absent, so the collector reads the combined compressed file. It excludes season aggregate week 0, postseason and current/future weeks; it uses the current season's last four published weeks when available, otherwise the immediately previous season. Historical context always carries its actual season and sample weeks.
- [nflverse player identities](https://github.com/nflverse/nflverse-data/releases/download/players/players.csv) maps GSIS to ESPN IDs; [Sleeper players](https://api.sleeper.app/v1/players/nfl) supplies ESPN to Sleeper IDs. Direct GSIS matches also work. Names are never used to infer identity. Unknown IDs remain missing.
- [2026 depth charts](https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_2026.csv) provides dated ESPN personnel, positions, ranks and base defensive groups. Latest observations at or before the cutoff are retained per team. Observations older than 48 hours produce a stale status and withhold current personnel. For example, Seattle lists Devon Witherspoon, Josh Jobe and Nick Emmanwori at LCB, RCB and NB. These labels are personnel context; receivers move and defenses rotate. They do not establish who will cover a receiver or man/zone rates.
- [nflverse update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) says NGS updates nightly, depth charts daily, and current-season FTN participation is published after postseason. [The public FTN charting subset](https://nflreadr.nflverse.com/articles/dictionary_ftn_charting.html) is distinct from participation and updates on its provider's schedule. Neither feed establishes a publicly available current-week receiver-to-corner assignment here. Do not present prior-season participation as current charting.
- [ESPN Week 1 scoreboard](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=1) currently exposes Draft Kings totals and spreads. Events must match season, regular-season type and week. The first observation showed NE–SEA total 44.5, SEA -3.5. These are dated game expectations, not player prop prices, trade prices or demonstrated expected value. Availability is reported separately from receiving coverage.

## Optional licensed assignment import

Place user-authorized charting at `app/public/weekly/coverage-input.json`; no sample production data is shipped. Shape:

```json
{
  "season": 2026,
  "week": 1,
  "source": "https://your-authorized-provider.example/report",
  "observedAt": "ISO-8601 timestamp",
  "players": [{
    "playerId": "Sleeper receiver ID",
    "coverageAssignments": [{
      "defenderId": "Sleeper defender ID",
      "weight": 1,
      "alignment": "outside",
      "support": "Provider evidence describing assignment probability and charting sample"
    }]
  }]
}
```

All player/defender IDs must exist in the current Sleeper registry. Receivers must be WR/TE/RB; defenders must be defensive backs or linebackers on the receiver's actual scheduled opponent, verified from the matching ESPN regular-season week. Missing schedules, offensive defenders, self assignments and same-team assignments are rejected. Player IDs and defender IDs within each assignment set must be unique. Assignment weights must be positive, at most one, and sum to one. Alignment is `slot`, `outside`, `mixed` or `zone`. The HTTPS source, matching season/week and an observation within the previous seven days are required. Future and stale observations are rejected. Validated charting is attached as evidence only; calibration and historical evaluation are required before it can change projections.

## Cutoffs and verification

The cache retains one compressed response per URL, refreshes market observations after 30 minutes and other feeds after six hours, and bounds network bodies/decompression to 64 MB. A live download cannot supply an old historical cutoff; historical callers must inject archived observations. Cached future observations and depth snapshots after the cutoff are excluded. Source failures produce explicit unavailable entries rather than default values. Current-season source corrections are not reconstructed as historical vintages.

`node --test app/scripts/weekly/coverage.test.mjs` verifies stable identity matching, missing identities, exclusion of future weeks/aggregate rows, dated personnel, assignment weights and timeliness, missing market data and failed/future source observations.
