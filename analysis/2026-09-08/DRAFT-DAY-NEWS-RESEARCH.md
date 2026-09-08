# September 8 draft-day research

Data collected September 8, 2026 at 1:05 PM Pacific. Compared with published commit `7c7c4f5d1e8a25897ba05d64142b78a37d6f26e3`.

## What changes tonight

| Player / group | Evidence | Draft implication |
| --- | --- | --- |
| MarShawn Lloyd | Adam Stenavich described a committee while Jacobs is unavailable, reported by Wes Hodkiewicz and relayed by [RotoBaller](https://www.rotoballer.com/player-news/packers-to-deploy-a-running-back-committee-to-begin-the-season/1926006). | Removed the blanket value label. Retain interest at a sensible price; a workhorse workload is unproven. |
| Rome Odunze | Ben Johnson remains hopeful for Sunday while Odunze sits Tuesday, per [Chris Emma, The Score](https://www.audacy.com/thescorechicago/sports/chicago-bears/bears-wr-rome-odunze-in-line-to-play-opener-vs-panthers). | Removed the blanket value label. His early availability still warrants attention. |
| Breece Hall | Glenn is optimistic for Sunday and Hall resumed drills, per [AP](https://www.seattlepi.com/sports/running-back-breece-hall-is-trending-toward-a22422474). | Encouraging; clearance pending. |
| Zay Flowers | Jamison Hensley observed Flowers leading drills Tuesday, relayed by [RotoBaller](https://www.rotoballer.com/player-news/zay-flowers-goes-through-drills-at-full-strength/1926020). | Replaced stale camp guidance with the practice update. Official game status remains pending. |
| Makai Lemon | Listed among three starting receivers on [Philadelphia's team chart](https://www.philadelphiaeagles.com/team/depth-chart). | Replaced the stale current-absence claim. Modest receiving projections still make him a late option. Return duties alone do not establish receiving volume. |
| Warren / Dowdle | Warren precedes Dowdle on [Pittsburgh's chart](https://www.steelers.com/team/depth-chart/). | Neither a Dowdle takeover nor exclusive goal-line usage is established. Retain the helper's early same-backfield guard. |
| Love / Allgeier | Allgeier precedes Love on [Arizona's chart](https://www.azcardinals.com/team/depth-chart). | Updated both notes. Removed the unsupported generic recovery deadline. Actual touches and Love's game status remain uncertain. |
| Hunter / Jacksonville RBs | [Jacksonville](https://www.jaguars.com/team/depth-chart) lists Hunter as a reserve WR and starting CB, with Tuten and Rodriguez together at RB. | Hunter's receiving volume remains limited. Jacksonville's RB committee caution remains appropriate. |
| Henderson / Stevenson | Henderson missed both practices in the latest [Patriots report](https://www.patriots.com/news/week-1-injury-report-patriots-at-seahawks), dated September 7. | Stevenson could gain Week 1 work if Henderson misses the opener. This does not establish a season-long redistribution. |
| Ferguson / Parkinson | Sleeper changed their order, while the [Rams' chart](https://www.therams.com/team/depth-chart) groups both in its first TE column. | Treat the provider ordering as weak evidence about workload. Both remain late options under the TE-wait preference. |

Positive practice reports do not automatically establish full participation or a final game designation. Team-issued depth charts are unofficial and can group several starters. The model keeps sourced ADP separate from our judgment about a player's outlook.

## Market and projection findings

- Refreshed all 235 board players' Sleeper ADP and metadata. The existing 234 ADPs were unchanged; Hunter now has his actual Sleeper ADP of **193.2** instead of relying on the older board fallback of 148.9.
- Refreshed 18 weekly projection feeds and rescored their component statistics under the live league settings. Hunter changed from a missing-data zero to **2.97 points per projected week**, 50.6 season points and 3.02 in weeks 15–17. The other 234 projection records were unchanged.
- There are 232 matched weekly records and 231 positive estimates. Jayden Higgins, Brandon Aiyuk and Jarrett Stidham lack matched weekly projections; Malik Benson's tiny projection rounds to zero. Missing production is kept at zero rather than estimated from board rank.
- Fantasy Football Calculator supplied 1,837 half-PPR, 12-team mock drafts dated September 3–8, covering 176 board players. Its market records were unchanged from the morning snapshot.
- The final news collection completed with **zero unresolved fetch failures**: 183 players and 387 retained items. It inspected 1,380 recent feed items, retained 432 with attribution, then kept up to three per player. These are collected reports, not a continuously updating news service.
- Source metadata also moved Tyrone Tracy from third to second and switched Ferguson/Parkinson's order. Tracy remains in the same modeled backup category. The TE order changes their existing depth-based risk inputs; they do not establish a measured workload share.

Lloyd and Odunze changed from `buy` to `solid`. In the existing model this removes a small favorable volatility adjustment while leaving their projected points and injury probabilities unchanged. This is a cautious editorial judgment, not a newly fitted statistical penalty. Hall and Flowers retain the provider's questionable designation pending clearance.

## Data fixes and safeguards

Hunter's primary Sleeper position is DB, with WR fantasy eligibility. The ADP, weekly projection, historical scoring, news and depth-pool collectors now honor offensive eligibility. Defensive depth orders are excluded from offensive role inputs. His seven-game 2025 receiving record is now included.

The first refresh exposed silently swallowed news failures: Pacheco's IR report disappeared when its request failed. The corrected collector retries temporary failures, honors short server cooldowns, validates player lookup coverage and refuses to replace the previous file after an incomplete collection. Tests confirm byte-for-byte preservation after failed requests or a missing player catalog. Pacheco's four-game reported minimum is present in the successful refresh.

The advertised 60-day news window now uses the current collection time. Today's research appears first in the News tab, with source links and a visible collection timestamp.

The older Draft Plan page still displayed hard-coded advice and scores that conflicted with the current saved studies. Its route and saved-tab setting now open Draft Lab, and the obsolete page is removed. Draft Lab, the six-round reference plan and the ADP tab identify their retained September 8 morning simulation snapshot. The ADP explanation also removes guarantees about which players will remain available.

## Recommendation sensitivity and validation

A fixed-board comparison evaluated **168 decisions** across all 12 seats and 14 skill-player rounds. Both versions received identical draft states; opponents selected by Sleeper ADP and prior owned picks followed the baseline helper. **Zero top picks and zero top-three name/order lists changed** in those scenarios. This supports keeping the main draft approach stable; it does not cover every live draft or establish real-world superiority.

Exact input changes and all compared decisions are recorded in [news-refresh-impact.json](news-refresh-impact.json).

All eight opening-sequence comparisons retained their leading sequence. The separate priority study changed one first-pick leader: Emily's early-RB-run scenario now places Amon-Ra St. Brown just ahead of De'Von Achane. Twenty-five follow-up branches changed their top-three lists, including six changes to the leading player. Each changed leader leads its new runner-up by at most **0.12 modeled points per week** in the stored baseline-relative ranking. These narrow gaps warrant flexibility; they are not direct confidence intervals comparing the leaders. Exact before/after names and the changed leaders' scores are included in the comparison artifact.

The rerun retains the canonical study sizes: 4,000 market worlds, 8,000 paired strategy worlds, 2,500 first-pick worlds, 6,000 risk worlds, 700 draft-tree worlds, 4,000 plan leagues per seat, 5,000 priority worlds per option and 20,000 RB-run worlds per option. Ashley (1), Brian JK (2), Jeff (8) and Emily (10) are included. The two largest studies run independently by seat with identical inputs and seeds, then merge their results after validating seat coverage.

These exploratory studies use their documented strategy policies. Separate advisor checks exercise the live draft helper. Large simulation counts reduce sampling noise within the model; they do not validate every assumption about real NFL performance or opponent behavior.

The full automated test suite passed, including live draft resets and identity changes, forecast cancellation, required roster slots, the TE-wait preference, 264 ownership/seat scenarios across 28 NFL backfields, and the new player-eligibility and news-failure tests. The News tab was checked in the browser for source links, ordering, collection time and its report filter.

All eight study programs completed. **Eight of nine release gates passed; the agreement gate recorded one failure and six warnings.** Emily's round-one case favored Nico Collins over the helper's Chase Brown by about 0.64 modeled points/week, just beyond its two-standard-error cutoff. With the morning inputs and identical 7,000 worlds, the same disagreement was 0.63520 against a 0.63884 cutoff and was recorded as a warning. The refresh moved the gap by less than 0.01 points/week; the failed result is preserved.

The nine new result files are [archived for review](news-rerun/receipt.json) and **were not loaded into the saved guides**. The morning guides remain published. The live helper receives the corrected source inputs and current player notes. Its 168-state comparison above retained every top-three list.

The agreement test uses a simpler continuation policy than the live helper and independent-sample standard errors despite shared simulated draws. These are methodological limitations for separate review; they provide no basis to waive the failed check or claim that either player is proven optimal. The archived logs include every gate and the baseline diagnostic. The draft-day audit passed 16,800 decisions across 300 drafts; the full-draft audit passed 6,912 decisions across 36 complete 16-round drafts.

The production build passed. Browser verification confirmed that the old `#plan` link opens Draft Lab, the morning study label is visible, and the News tab shows the afternoon research, source links and collection time. A source comparison confirms that all saved study JSON remains identical to the morning version.
