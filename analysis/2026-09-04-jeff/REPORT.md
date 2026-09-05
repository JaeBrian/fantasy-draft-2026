# Jeff at pick 8

Jeff and Aaron traded their complete draft slots: **Jeff is 8, Aaron is 3**. Ashley remains 1, Brian JK 2, and Emily 10. Jeff's first six picks are **8, 17, 32, 41, 56, 65**.

This rerun uses the existing September 4 Pacific input snapshot. Some generated files carry September 5 UTC timestamps. It adds Jeff's studies and reruns the shared-room comparison with all four tool users. It does not refresh player news or market inputs. [results.json](results.json) records Jeff's published results, run sizes, and input hashes. [README](../../README.md) contains reproduction commands.

## Draft approach

The market-room priority ranking is **Jaxon Smith-Njigba, James Cook, then Amon-Ra St. Brown**. After Smith-Njigba or Amon-Ra, **Chase Brown leads at pick 17**, followed by Kenneth Walker III. After Cook, Chase Brown, Nico Collins and Brock Bowers are close alternatives. The live advisor should choose from the players actually available and recalculate at each turn.

The position studies support **WR–RB–WR–RB or WR–WR–RB–RB in a market room**, with a stronger WR–WR opening when opponents rush RBs. A fixed RB–RB start loses 1.14 points per week against the market leader and 3.42 against the RB-run leader in the 20,000-world study. These are comparisons among tested policies, not proof of a globally optimal draft.

## Opening comparison: 440,000 complete simulated drafts

Eleven four-pick openings were tested in two rooms, with **20,000 worlds per opening per room**. Each simulated draft contains 14 skill picks per team. Scores cover the eight skill starters in this league: 1 QB, 2 RB, 2 WR, 1 TE and 2 FLEX.

| Opening | Market pts/wk | Early RB run pts/wk |
| --- | ---: | ---: |
| WR–RB–WR–RB | 101.93 | 101.25 |
| WR–WR–RB–RB | 101.83 | 102.55 |
| RB–WR–WR–RB | 101.57 | 102.44 |
| WR–WR–TE–RB | 101.31 | 102.74 |
| RB–RB–WR–WR | 100.80 | 99.32 |

The full eleven-row tables are in Draft lab and the result snapshot. Reported standard errors are approximately 0.04 pts/wk per row. The 0.10-point market gap between the first two openings is within the study's comparison threshold. WR–WR–TE–RB's 0.20-point RB-run edge is small compared with uncertainty in projections and opponent behavior. No probability is assigned to either opponent scenario.

Typical market WR–RB–WR–RB selections are Smith-Njigba, Chase Brown, Tee Higgins and David Montgomery. The common RB-run WR–WR–TE–RB route is Smith-Njigba, A.J. Brown, Colston Loveland and Montgomery. These examples summarize separate pick frequencies; they are not the probability of landing that complete roster.

## First six picks from the adaptive weekly policy

The 4,000-world adaptive policy averages **101.3 pts/wk** and finishes as the highest-scoring team among all twelve in **27%** of simulated drafts. That percentage measures simulated season scoring rank; it does not estimate a championship probability.

| Round | Pick | Most frequent selections |
| --- | ---: | --- |
| 1 | 8 | Smith-Njigba 59%; Amon-Ra 32%; Cook 5% |
| 2 | 17 | Nico Collins 63%; Chase Brown 36% |
| 3 | 32 | Javonte Williams 50%; Tee Higgins 13%; Jeremiyah Love 8% |
| 4 | 41 | David Montgomery 52%; Jaylen Waddle 19%; Tee Higgins 12% |
| 5 | 56 | Jaylen Warren 43%; Christian Watson 33%; Jameson Williams 15% |
| 6 | 65 | Jaylen Warren 40%; Christian Watson 26%; Tucker Kraft 11% |

These percentages measure **selection frequency**, not player availability. The WR–WR–RB–RB headline is the most frequent position at each of the first four picks. The policy can deviate from that sequence when the board changes.

## Player priorities

The priority study uses **5,000 seeded worlds per candidate**, with separate pick-17 branches for nine first-pick choices, in both opponent scenarios. It compares candidates against a common baseline using worlds in which both choices were available. Candidate shortlists combine market price and modeled value. The published board includes lower-frequency alternatives, so a rare slide can appear above a more likely pick.

| Market pick-8 candidate | Available at 8 | Paired pts/wk gain vs Henry baseline |
| --- | ---: | ---: |
| Jaxon Smith-Njigba | 61% | +2.14 |
| James Cook | 94% | +1.58 |
| Amon-Ra St. Brown | 63% | +0.89 |
| De'Von Achane | 100% | +0.60 |
| Chase Brown | 100% | +0.39 |

In the RB-run room, Cook ranks first and reaches 8 in 44% of worlds. Smith-Njigba reaches 8 in 96% and is the highest-ranked option available in at least half of those worlds. Puka is a rare alternative at 7% availability. After Smith-Njigba in that room, Amon-Ra leads at 17; Bowers and Lamb are next. These are scenario-dependent rankings, so the actual first seven picks matter.

Before Jeff is on the clock, the Draft room can show Cook first because its score includes the chance a player reaches pick 8. Once Jeff is on the clock, that availability discount is removed. Draft lab's paired ranking compares choices in worlds where they are available.

At round two, the displayed availability is the **joint chance of the first and second player being available along that route**. It is not conditional availability after already securing the first player. The UI labels this distinction, and the old policy-remainder statistic is excluded from draft advice.

The separate 2,500-world forced-first study returns Cook at 97.42 and Smith-Njigba at 97.33 pts/wk. Those means use different availability subsets. Their 0.09-point difference cannot establish a direct preference. Use the paired priority board and the live advisor for actual choices.

## Independent checks and model sensitivity

- **Five structures × 8,000 paired seasons:** WR–RB–WR–RB leads at 97.45; WR–WR–RB–RB follows at 97.14. Head-to-head rates between leading structures stay close to 50%.
- **Risk dial:** five structures and three risk settings receive 6,000 seasons each. On WR–WR–RB–RB, balanced averages 94.7 versus 94.8 for the high-variance setting. A 0.1-point mean difference does not settle the user's risk preference.
- **Four users in one room:** 4,000 drafts with each user's modeled opening. Jeff averages 93.2 pts/wk and leads the four tool users in 25% of worlds. Ashley is 28%, Brian 27%, Emily 20%. These percentages compare those four users only.
- **Advisor agreement:** 7,000 seasons per candidate at Jeff's rounds 1, 3 and 6. No failures. Round 6 is one warning: Hurts leads the advisor's Watson choice by 0.22 ± 0.32, within the audit's noise threshold.
- **Draft-day validation:** 900 complete drafts across market, early-RB-run and value-aware opponents; 50,400 advisor recommendations across all four users; zero failures.
- **Full roster validation:** 36 complete 192-pick drafts; 6,912 advisor decisions; every seat fills all ten starting positions, including K and DST.

The weekly, aggregate-season and risk-dial studies have different continuation policies and outcome models. Their absolute scores and percentile ranges should be compared within each study. K/DST scoring, waivers, trades, schedules and playoff brackets are excluded from the published skill-player comparisons. Sampling precision does not remove uncertainty in player projections, injuries, correlated outcomes or opponent behavior.

## Product checks

Jeff is registered in the Draft room, Draft lab, plan view and Start Here. The seat registry drives study runners and UI choices. Targeted runs preserve the original three users' results. The shared-room study includes all four and produces a new comparison.

Jeff's practice draft follows all fourteen skill-pick turns through pick 161 and finishes at 168 total selections. Undo returns to pick 161; returning to the real draft clears practice picks. The four seat buttons fit a 320-pixel viewport. Automated seat tests cover the trade, snake order, invalid targeted inputs and result preservation.

Final validation: `npm test`, `audit-results.mjs`, TypeScript and the production build pass. Both room scenarios, nine selectable first-pick branches, all eleven openings and the four-user comparison render correctly. Desktop and 320-pixel layouts pass inspection with no page overflow or browser console errors. Switching between Draft lab and Draft room retains Jeff's selected seat. All eight per-seat datasets for Ashley, Brian and Emily match the prior committed results exactly.
