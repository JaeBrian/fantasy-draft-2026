# Weekly roster foundation

Run from app/: `npm run weekly:snapshot` to validate and archive the real league snapshot under `.simcache/weekly/`. These local records are excluded from Git. `latest.json` changes only after a successful validated collection.

The Weekly lineup tab fetches the same real league independently of draft-room state. The connection defaults to off and remembers your choice. When enabled it refreshes every five minutes while mounted, times out stalled requests after 15 seconds, backs off on errors, and keeps the last successful snapshot visibly marked. Turning it off aborts the current request and cancels future checks. Check rosters is available while connected. It is not a background scheduled job. Player metadata is fetched only once rosters contain players and cached in memory for a day.

Owner IDs in `src/lib/weekly/config.ts` were matched to the real league's accounts and draft order on September 7, 2026: Emily/emyun, Ashley/amatcha, Brian/JaeCooking. Roster IDs are resolved fresh; names and draft positions are never identity keys. Missing or ambiguous mappings block readiness.

This phase supplies roster identity, exact scoring, data checks and the pre-draft waiting view. It does not generate start/sit projections, trades or automated lineup writes. Post-draft roster visibility is labeled separately from model readiness. Next phase: timestamped weekly projections, position eligibility, kickoff locks and a tested lineup solver, following the repository plan.
