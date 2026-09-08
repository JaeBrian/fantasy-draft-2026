# Draft-day correctness audit

September 8, 2026. Baseline: `f38233a937573350e49ff9b7db4746beb771900f` (PR #85).

## Corrected behavior

- **Fresh live picks:** Sleeper's shared cache served a response with `age: 24` and `cf-cache-status: HIT` even when the client requested `cache: no-store`. A separate header check showed age 76. Its response permits `s-maxage=30, stale-while-revalidate=300`. A timestamp query produced `MISS`, no age, and a fresh origin timestamp. The draft room now uses that fresh URL and disables browser caching. The existing two-second interval, sequential requests, timeout, cancellation and error backoff remain intact. This bypasses a stale shared response; Sleeper's underlying data can still lag its draft room.
- **Manual undo:** Removing the middle of three picks and undoing it previously appended that player to the end, changing ownership when seats were rebuilt. Undo now restores the original position and mark.
- **Saved-state recovery:** Validate saved draft marks and name arrays; discard invalid entries and duplicate order entries. Valid JSON with an incorrect shape, such as `null`, previously crashed the board.
- **Known upcoming picks:** Honor exact future picks independently of positional demand and probability calibration. A Bowers-at-32 belief previously made Bowers Emily's top target for pick 34. Ignore a past belief contradicted by the actual board. Keep one active player per known pick, including when loading or re-enabling beliefs. Practice opponents use the same exact-pick constraint. A pin on our future turn guarantees reaching that turn; after our own selection, return odds are conditional on passing.
- **Personal exclusions:** Excluded players remain available to opponents and in the probability calibration. Excluding Gibbs, Bijan and Chase previously changed CeeDee's estimated availability from 79.8% to 28.6% without any actual picks occurring.
- **Demand and snake lookahead:** Increased positional demand now moves selections earlier. Demand is computed for each actual forecast horizon. Opponent disappearance counts exclude our own selections, so two consecutive own picks have zero opponent loss. The third horizon follows the snake order instead of repeating the previous gap.

The tight-end preference and shared-backfield policy thresholds remain unchanged. These are conservative strategy choices, not demonstrated performance improvements.

## Verification

- Regression tests first reproduced the probability, known-pick, undo and saved-state failures; all pass after correction.
- Full `npm test`, TypeScript check and production build pass. Advisor and forecast audits report zero failures and zero warnings.
- **36 complete 16-round drafts**, **192 picks each**, **6,912 advisor decisions**: every seat fills all ten starters, with early and late kicker/defense scenarios and no duplicate or illegal recommendations.
- **128 paired comparison drafts** (64 matched pairs, 16 worlds in each of four room styles), with **2,688 advisor decisions per version**. Inputs and random numbers are shared between versions; scoring sensitivity includes RB-down, WR-down and generous streaming scenarios. See `draft-day-performance.json` for all results, confidence intervals, hashes and timings. No illegal decisions or incomplete skill rosters. Outcome estimates are mixed, including negative sensitivity cases; this audit establishes corrected behavior, not a scoring advantage.
- Current Sleeper player payloads resolve all **235 board players**, including Travis Hunter's dual-position eligibility.
- The completed test draft has **192 picks, including 24 off-board picks**. The production parser retains every pick and assigns ownership correctly for all 12 seats. The actual league was still pre-draft with zero picks during this check.
- Browser verification: record Gibbs/Bijan/Chase; remove Bijan; undo; switch away from Brian and back. Bijan remains Brian's original pick. The separate test room loads 192 picks, 16 owned players and 10/10 starters, displays a recent successful sync, and leaves the real room's three manual picks intact. No browser console errors observed.
- Final independent code review cleared the probability, pin and synchronization fixes.

## Live league checked

Draft `1389372699129700353`: 12-team snake, 16 rounds, 60 seconds per pick, half-PPR, four-point passing touchdowns, QB/RB/RB/WR/WR/TE/FLEX/FLEX/K/DEF plus six bench spots. Ashley 1, Brian 2, Jeff 8, Emily 10; Aaron is 3. No outstanding traded picks were returned by Sleeper. The completed test draft also has 12 draft slots, despite having only two human participants.

## Limits

The real draft had not begun, so this is not a claim that every live draft-night failure has been eliminated. The parser's reset/rollback and request cancellation paths have automated coverage; a completed real test draft was verified through the browser. Recommendations still depend on uncertain projections, injuries and opponent choices. Historical saved reference studies were not refreshed in this code audit; the live advisor and the new comparison artifact exercise the changed logic.
