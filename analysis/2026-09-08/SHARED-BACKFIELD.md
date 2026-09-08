# Shared-backfield draft guard

The user reported the helper recommending Rico Dowdle immediately after drafting Jaylen Warren with their fifth selection. A representative Brian fixture at pick 71 reproduced Rico as the first recommendation after a roster of Bijan Robinson, Nico Collins, Kyren Williams, Jaylen Waddle and Warren. The user's full roster was unavailable; the fixture is an illustration, not a recovered draft state.

The existing helper values Warren at 10.23 adjusted points per week and Dowdle at 9.50. Neither receives an ownership-dependent handcuff bonus. Early recommendations combine individual projection value, positional scarcity and roster needs, including a shared-bye cost. The [Steelers describe a shared backfield whose usage depends on game plan](https://www.steelers.com/news/sharing-the-load). Uncertain future divisions of that workload are not jointly modeled.

## Behavior

For everyone's first eight selections, a second RB from an owned NFL backfield is deferred unless:

- His upcoming selection is at least 12 picks past blended market ADP.
- An unfilled required RB starting slot needs protection.
- The owned teammate has a sourced expected absence or an Out/IR/PUP/SUS/NA designation. An additional available owned RB from that team keeps the guard active.

The ninth selection onward uses the existing roster-value evaluation and permits shared-backfield depth. A discounted or late recommendation explains the overlap. Deferred players stay available in the searchable board and in opponent forecasts. RB/WR teammates such as Chase Brown and Tee Higgins remain eligible.

This is a conservative roster policy, with a one-round discount and an eight-player cutoff. Those thresholds are strategic choices, not fitted estimates of lost touchdowns. Projections and weekly correlation assumptions are unchanged. Aggregate historical RB/RB score correlation does not establish the draft value of buying two uncertain roles. The implementation does not claim to solve joint workload forecasting or prove a championship advantage.

Review also exposed a shortlist defect: a deferred high-projection RB still occupied the first pool index and could exclude all remaining eligible RBs through the 2.5-point cutoff. Eligibility now applies before shortlist slicing and projection comparisons. This also protects candidates behind deferred TEs. Forecast calculations continue using the full available pool.

## Validation

- Regression tests reproduce the fifth-to-sixth-pick issue for Ashley, Brian and Emily; check both ownership orders, off-clock recommendations, known-pick overrides, market discounts, late depth, known absence coverage, required RB2 coverage and RB/WR eligibility.
- The late-depth test holds Dowdle's ADP above the current pick to separate that exception from the discount exception.
- An RB-run regression verifies that deferring Rico keeps the next eligible RB available even when that player projects more than 2.5 points lower.
- A matrix checks 264 ownership/seat cases across 28 current healthy NFL backfields, including both pairing orders. Candidate cost and the RB pool are controlled to exercise the guard, rather than pass because a candidate was already taken or buried in a shortlist.
- Browser verification rendered the actual recommendation component with the representative roster in a narrow 390-pixel column. The deferral explanation and alternate targets were visible; the browser logged zero errors. The fixture did not modify saved drafts or submit Sleeper picks.

- The complete test suite and production build passed. The final advisor audit had zero failures or warnings. A 300-draft audit made 16,800 valid recommendations, and a separate 36-draft audit made 6,912 decisions with all ten starters filled at every seat.

## Comparison

[Paired results](backfield-performance.json) compare the final helper with `b062ddd30f9ddde5440a0c9d10e730f9ea9a6b18`, with identical projection, market and risk inputs. Both versions retain the TE-wait preference. The run uses 32 paired worlds per opponent pattern, 256 complete skill drafts and 5,376 advisor calls per version, beginning at seed 400000. The four opponent patterns and four evaluation environments follow the [earlier methodology](REPORT.md).

Changes in modeled starter points per week, with unadjusted 95% Monte Carlo intervals:

| Manager | Market | RB run | WR run | QB/TE run |
|---|---:|---:|---:|---:|
| Ashley | +0.07 [-0.05, 0.20] | +0.00 [0.00, 0.00] | +0.04 [-0.09, 0.16] | +0.08 [-0.36, 0.52] |
| Brian JK | -0.14 [-0.34, 0.06] | +0.00 [0.00, 0.00] | +0.14 [-0.12, 0.40] | -0.08 [-0.37, 0.20] |
| Emily | +0.09 [-0.08, 0.26] | +0.00 [0.00, 0.00] | -0.02 [-0.08, 0.04] | +0.02 [-0.06, 0.10] |

All original-production intervals contain zero. The sample shows no clear overall gain or loss. These estimates do not establish real-world accuracy. The final comparison had zero invalid recommendations or incomplete skill rosters; the candidate took 11.2 ms on average and 25.1 ms at the 95th percentile.

The result file retains every production and streaming sensitivity, input hashes and advisor hashes. This comparison uses individual production assumptions and therefore cannot validate the omitted joint workload uncertainty. It measures the guard's consequences inside the existing model.

Saved strategy studies retain their previous selection rules and are labeled accordingly; current draft-room targets apply this guard.

Run from `app/`:

```sh
npm test
node scripts/audit-advisor.mjs
node scripts/audit-draftday.mjs
node scripts/audit-full-draft.mjs
DRAFT_BASELINE_REF=b062ddd30f9ddde5440a0c9d10e730f9ea9a6b18 node scripts/audit-draft-performance.mjs 32 400000 ../analysis/2026-09-08/backfield-performance.json
npm run build
```
