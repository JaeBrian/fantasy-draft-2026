# Update log

## 2026-08-19 — live news wire, measured teammate correlation, lineup band fix
**Data refreshed.** Sleeper ADP, weekly projections, injury designations, depth charts and 24h trending all re-pulled. Finding worth recording: **the season projections are frozen** — pulled Aug 17 and again Aug 19, not one player moved by even 0.25 pts/wk. ADP drifts, injury flags flip, the projection does not. Between now and the draft the news wire is the only input that changes.

**News wire added.** Sleeper carries an undocumented per-player feed at `/players/nfl/{id}/news` (`scripts/fetch-news.mjs`). 57% of it is discarded: the aggregators' own analysis is AI-assisted and unreliable — one item shipped reading "Los ngeles Chargers", and the same outlet called a back "the clear lead back" on Aug 5 and "workload uncertainty" on Aug 15 — so an item is kept only if it traces to a named reporter or a direct quote. Four guards on the tagging, each added after the rules got something wrong: historical recaps (5 of the first 10 `OUT` tags), injuries belonging to another player named in the same sentence, negation ("NOT expected to miss" filed under WILL MISS), and recovery stories ("race to return … torn ACL" filed as season-ending). 11 players adjusted, all verified by hand. **News moves availability only, never a projection.**

Live: Jayden Higgins out for the season (torn ACL, Rapoport); Jordyn Tyson ~2 months (Garafolo); Alvin Kamara ~1 month MCL (Schefter); Breece Hall 2–3 weeks (Rosenblatt); Kyle Monangai multiple weeks (Fowler); **Omarion Hampton — OC Mike McDaniel will use a "hot hand" approach (Kris Rhim, ESPN), and Hampton is still priced as a workhorse at 12.5**; Rhamondre Stevenson sharing with Henderson (Graff); Chargers C Tyler Biadasz out indefinitely with an ACL.

**Teammate correlation measured, and two rules retired.** Every simulation drew players independently. Measured it from 2025 game logs — 2025 rosters reconstructed from the team snap counts carried on each stats row, since Sleeper's stats have no team field — against a control of non-teammate pairs that came back at ~0.000 across the board:

| pair | teammates | control | verdict |
|---|---|---|---|
| QB–WR | **+0.342** (n=87) | +0.003 | real, large |
| QB–TE | **+0.236** (n=49) | +0.017 | real |
| QB–RB | +0.071 (n=71) | −0.007 | real, small |
| RB–WR | +0.001 (n=223) | −0.001 | nothing |
| WR–WR | +0.006 (n=108) | −0.003 | nothing |
| RB–RB | +0.023 (n=53) | −0.001 | nothing |

The QB-stack bonus survives — our own number is a little below the cited r≈0.43 but the same effect. **The two anti-stack penalties added on Aug 17 do not survive and were removed**: the same-team pass-catcher penalty (×0.97) and the RB+WR penalty (×0.985). "Two Rams eat each other's lunch" is widely believed and is not in the game logs — a receiver pairs with his teammate exactly as he pairs with a stranger. Both penalties were small, but they applied to every same-team pair on the board, and a small bias with no evidence is still a bias.

**Lineup floor/ceiling fixed.** It summed p10 and p90 across eight starters, which asks what happens if all eight bottom out in the same week — a correlation of 1.0. Variances add in quadrature; now combined with the measured correlation matrix. **The old band was 2.8× too wide.** A QB stacked with two of his receivers now correctly reads ~8% wider than the same lineup spread across teams.

**audit-agreement 2 FAIL → 1 FAIL.** Round 1 was special-cased to an empty board, so seat 10 was asked to choose from all 170 players and then judged against a simulation that ran picks 1–9 first; it recommended James Cook (gone before pick 10 in four worlds of five) and the audit reported a gap of `Infinity` against a threshold of `0.00`. Both fixed. The remaining failure is the known TE-replacement issue (Loveland vs Tee Higgins, 0.72 against a 0.67 bar), left failing rather than tuned away.

**Seats 1/6/10 re-simulated**, 30,000 worlds each on the new data (`scripts/sim-seats.mjs`): Gibbs at seat 1; McCaffrey then Taylor at 6; Achane at 10. CeeDee Lamb grades last at every seat. Rows built from few worlds are now flagged for selection bias — a player who only reaches you when the room lets him slide is averaged over a different set of drafts than one who is always there.

**README** now documents all nine data sources and what we are single-sourced on (projections — one provider behind every points number).

## 2026-08-17 (night) — full-league division audit + React port
All 32 teams audited by division (depth charts, preseason usage, beat reports through 8/17 evening). Board grown 158 → 170 players (adds incl. Adonai Mitchell, Braelon Allen, Alec Pierce, Ray Davis, Chris Rodriguez Jr., David Njoku, Ja'Kobi Lane, Malachi Fields, Jaydon Blue, Brian Robinson Jr., Malik Benson, Elic Ayomanor). Time-sensitive flags added: Breece Hall non-contact groin (8/17), Egbuka toe / Wk 1 "not sure" (8/17), Nacua groin on top of the open conduct case, Carnell Tate practice-hit evaluation, NE officially a 50-50 committee, Washington's six-back battle reopened. Verified: Seattle are the defending champs and Kenneth Walker was SB LX MVP; John Harbaugh is the Giants' HC. Stacking research wired into the advisor (QB stack bonus kept small per r≈0.43 evidence; NEW anti-stack penalties for same-team pass-catchers outside elite offenses and RB+WR pairs). Advisor v4 + all data ported into the React app (`app/src`), root index.html regenerated from the build.

## 2026-08-17 (evening) — deep research pass + advisor v4
Data: 16 research streams re-verified the whole board — injuries/legal, all 32 team backfields & depth charts (division-by-division sweep), strategy base rates (xTD, age cliffs, dead zone, Konami code, playoff schedules), ADP movement + platform gaps, rookies/breakouts, QB/TE/Vegas markets, stacking & coaching-scheme research, plus a quantitative cross-format ADP analysis (FFC half/full/standard × league sizes, Sleeper 24h trending).

Headline corrections: Travis Hunter now primarily CB (downgraded); Miami QB battle resolved (Willis, upgraded); Brissett named ARI starter; Fannin's coach note fixed (Monken is TE-friendly); WAS depth chart lists Croskey-Merritt over White; Houston is an intentional Montgomery/Marks tandem; Charbonnet PUP = realistic Wk 5-6 return; Monangai out multiple weeks; Brooks ADP move corrected to ~+20; Mike Evans age stat replaced (unverifiable); Dolphins moved to the bottom of the Vegas board (NFL-low 3.5 win total). Nacua kept at #8 after a suspension-scenario analysis (0 games = top-4, 2 = this price, 6+ = Rd 2); Jefferson moved 6 → 8 (Kyler's accuracy is elite; his availability — 41 of 68 games — is the real risk).

Advisor v4: fixed remaining-pool projection bug (stable global position-rank projections); probabilistic "makes it back to me" survival model on live market ADP ± σ (FFC, 2,372 drafts Aug 12-17) with opponent-need demand shifts; turn-aware targeting (between picks it recommends realistic targets for YOUR next pick, with survival odds, instead of players who'll be gone); value-over-next-available scoring; tier-cliff detection; phase-aware risk appetite (floor early, ceiling late); roster radar warnings ("fill QB NOW", spare-pick budget, K/DST reminder); bye anti-stacking (scaled penalty + warning); QB-stack and playoff-schedule tiebreaks; dream-fall alerts; three stand-out "Also fine" alternates with reach odds; plain-English mode for every recommendation (Beginner mode toggle).

## 2026-08-17 — initial build
Board built from 12 research streams: FantasyPros live half-PPR ECR, Justin Boone Yahoo top-300 (8/17), Boris Chen tiers (8/16), 4for4 Underdog ADP (713 players), ESPN/CBS/PFF/NBC rankings, Vegas win totals + implied totals + props (DraftKings), ESPN xTD regression models, injury models, camp/beat reports, community + podcast consensus, 2026 bye weeks.
