# Wait for tight-end value

The draft room now defaults to waiting on tight ends for every manager. In **Room settings**, **Wait for tight-end value** switches between waiting and flexible TE selection. The preference persists locally, with separate storage for the test draft.

With waiting enabled, a TE becomes eligible when the manager's upcoming pick is at least six picks later than his blended market ADP. This uses the existing 75% Sleeper / 25% mock ADP blend and existing missing-data fallbacks. Manually entered known picks still inform opponent forecasts but cannot manufacture a market discount. The roster-completion guard can recommend a TE sooner when it needs to protect an unfilled starting slot. Eligible TEs still compete with the other positions on roster value; falling six picks does not make a TE an automatic selection.

The six-pick threshold implements the requested strategy preference. It was not fitted to maximize simulated scoring. Saved studies and six-round reference plans retain flexible TE selection and are labeled accordingly. Current draft-room targets use the selected preference.

## Comparison

[Results](te-preference-performance.json) compare this default with the flexible-TE helper from `b238f0ffc831218f4542337e68c83371ec0cfe7b`, using identical refreshed inputs. The run includes 256 complete 14-round skill drafts: 32 paired worlds for each of four opponent patterns, with Ashley, Brian and Emily following the same policy in each room. Each version makes 5,376 recommendations. Seeds start at 300000. Rosters are evaluated over 12 sampled 17-week seasons per world, with the same production, absence and waiver sensitivity assumptions described in the [earlier report](REPORT.md).

Changes in modeled starter points per week, with unadjusted 95% Monte Carlo intervals:

| Manager | Market | RB run | WR run | QB/TE run |
|---|---:|---:|---:|---:|
| Ashley | -0.96 [-2.53, 0.62] | +0.00 [-1.67, 1.67] | +0.59 [-1.40, 2.58] | -0.63 [-1.58, 0.32] |
| Brian JK | +0.47 [-0.95, 1.89] | -1.06 [-3.21, 1.09] | -3.28 [-5.26, -1.30] | -0.11 [-1.00, 0.78] |
| Emily | -0.00 [-1.43, 1.43] | -0.66 [-2.21, 0.90] | +0.34 [-1.08, 1.75] | +1.31 [0.56, 2.06] |

Waiting has a measurable cost in some modeled rooms, especially Brian's early-WR-run scenario. Most intervals cross zero. The comparison is small, uses correlated scenarios, and depends on uncertain projections and opponent behavior. It does not establish a universally better drafting strategy or championship odds. The earlier report's improvement estimates concern a different code change with flexible TE selection; they do not validate this new preference. Full production and streaming sensitivities are retained in the result file.

## Validation

- Regression tests cover waiting at market price, allowing a falling TE, turning the preference off, protecting the final required TE slot, and excluding artificial discounts from known-pick overrides.
- The advisor audit passed with zero warnings or failures. A separate 300-draft audit made 16,800 recommendations with zero failures. The full-draft audit completed 36 drafts and 6,912 advisor decisions; every seat filled all ten required starters.
- The performance comparison had zero illegal, missing, or non-finite recommendations and no incomplete skill rosters.
- `npm test`, the test-context isolation checks, and the production build passed.
- Browser checks confirmed the default, visible explanation, switching, reload persistence and zero console errors. Player projections, API refresh behavior and manual player selection are unchanged.

Run from `app/`:

```sh
DRAFT_BASELINE_REF=b238f0ffc831218f4542337e68c83371ec0cfe7b node scripts/audit-draft-performance.mjs 32 300000 ../analysis/2026-09-08/te-preference-performance.json
npm test
node src/panels/test-draft/context.test.mjs
node scripts/audit-advisor.mjs
node scripts/audit-draftday.mjs
node scripts/audit-full-draft.mjs
npm run build
```
