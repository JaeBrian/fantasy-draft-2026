# Fantasy Draft 2026

A 12-team half-PPR draft guide, live draft tracker, and pick advisor. Open `index.html` — it's a single self-contained build, no server needed.

- **Big Board** — 170 players with real Sleeper half-PPR ADP, projections, verdict calls, profile tags, bye weeks, and an ADP column that reads against the pick you're actually on
- **Draft tracker** — mark picks (✕ others / ★ mine), roster slot panel, undo, best-available bar
- **Pick advisor** — value over replacement against a live survival model: who reaches your next turn, what the room needs, tier cliffs, bye stacking, handcuffs, and a plain-English translation of every call
- **Practice drafts** — draft against modelled opponents from any seat
- Position tiers, slot-by-slot strategy, rookies, do-not-draft board, Vegas board, glossary

---

## Where every number comes from

Nine sources. Each one lists what it feeds, so a wrong number can be traced back to the thing that produced it.

### Sleeper — real half-PPR ADP

```
https://api.sleeper.com/projections/nfl/2026?season_type=regular   → adp_half_ppr
```

Undocumented, no key. **This is the pricing input**, blended `0.75 × Sleeper + 0.25 × mock` because the draft itself is on Sleeper.

> ⚠️ Do **not** price off `search_rank` from the players endpoint. It is superflex-biased — it lifts quarterbacks roughly 37 picks earlier than they actually go in half-PPR, and it ties at the top so "rank 4" is not "the 4th player." An earlier version of this app made that mistake.

### Sleeper — weekly projections

```
https://api.sleeper.com/projections/nfl/2026/{1..18}?season_type=regular
```

Eighteen separate weekly pulls, summed. Feeds every points number in the app: candidate scoring, replacement level, the simulations. 168 of 170 board players matched.

Pulled per week rather than as a season total on purpose — the season endpoint's game count doesn't match reality, and dividing by a flat 18 understated players who miss time. Justin Jefferson came out at 11.41 pts/wk that way against a true 13.84.

> ⚠️ **These move in steps, not daily.** Pulled Aug 17 and again Aug 19: not one player shifted by even 0.25 pts/wk. Pulled again Aug 20 and a batch moved together — Mahomes +1.95, Rodgers +1.57, Shough +1.24, Purdy +1.01, mostly quarterbacks, and Jayden Higgins dropped out of the feed entirely the day after his ACL tear.
>
> So they are not frozen — an earlier version of this file said they were, on the strength of a two-day window that happened to fall between updates. They are **republished periodically**, seemingly after preseason games, and are flat in between. Refresh them, but do not expect a change most days, and do not read one as confirmation that nothing has happened. Between republishes the news feed below is the only thing that moves.

### Sleeper — 2025 weekly game logs

```
https://api.sleeper.app/v1/stats/nfl/regular/2025/{week}
```

Every 2025 week, per player. Gives **measured** week-to-week spread rather than assumed: coefficient of variation, p10/p90, boom and bust rates, touches, TD share, games played — 146 players in `src/ceilings.ts`.

This is what makes "high-risk ceiling" a measurement instead of a guess. Small samples are shrunk toward the positional mean by `n/(n+8)`.

### Sleeper — per-player news wire *(filtered)*

```
https://api.sleeper.com/players/nfl/{player_id}/news?limit=6
```

Undocumented. Relays RotoWire and RotoBaller copy. **57% of it is discarded.**

The feed's own analysis is AI-assisted and unreliable — one item shipped reading "Los ngeles Chargers", and the same outlet called a back "the clear lead back" on Aug 5 and "workload uncertainty" on Aug 15. So an item is kept only when it traces to a **primary source**: a named reporter and outlet, or a direct quote from someone in the building. This feed is used as an *index of other people's reporting*, never as an opinion source.

Kept 383 of 897 items. What survives is real:

| | |
|---|---|
| Omarion Hampton | OC will use a **"hot hand" approach** at RB — Kris Rhim, ESPN |
| Breece Hall | groin, **out 2–3 weeks** — Zack Rosenblatt, The Athletic |
| Alvin Kamara | MCL sprain, **out ~1 month** — Adam Schefter, ESPN |
| Jayden Higgins | **torn ACL, out for the season** — Ian Rapoport, NFL Network |
| Jordyn Tyson | hamstring, **out ~2 months** — Mike Garafolo, NFL Network |

Tagging is keyword rules over wire copy, not comprehension, so it carries three guards — each added after the rules got something wrong:

1. **Historical** — "suffering a season-ending injury" in a bio paragraph is about *last* year. This alone was 5 of the first 10 `OUT` tags.
2. **Proximity** — "Harvey took on a bigger role after *Dobbins'* season-ending injury" names Harvey. Whoever is named nearest the trigger owns it.
3. **Negation** — "**not** expected to miss much" was filed under `WILL MISS`; "**not** expected to face additional suspension" under `SUSPENDED`. An inverted flag is worse than no flag.

Every tag ships with the sentence that triggered it and who reported it, so the rule's call can be checked by eye. **A tag never silently moves a projection.**

### Sleeper — 2025 game logs, again: what a handcuff is worth

```
scripts/sim-cuffvalue.mjs
```

A backup's projection assumes his starter plays. Measured across the 2025 season — 28 starter/backup pairs reconstructed from the snap-count fingerprints, 41 weeks in which a starter sat — the backup scored **0.65 of the starter's own pts/wk more** than he did with the starter in (per-pair median 0.71). So every listed handcuff in `CUFFS` carries `0.4 × pMiss(starter) × 0.65 × proj(starter)` on top of his own projection, everywhere the model reads one and for every seat — not just the starter's owner. Fourteen pairs is a small sample; treat the number as coarse. A suspension with no reported length is not in `pMiss`, so it does not reach the backup.

### Sleeper — injury designations, depth charts, roster status

```
https://api.sleeper.app/v1/players/nfl
```

`injury_status` (Q/D/O/IR), `depth_chart_order`, `age`, `years_exp`, team. Feeds the risk model — depth chart position and experience drive the probability a player loses his role, alongside the measured spread above.

### Sleeper — 24-hour waiver trend

```
https://api.sleeper.app/v1/players/nfl/trending/{add,drop}?lookback_hours=24&limit=200
```

How many Sleeper leagues added or dropped a player in the last day. Displayed as heat; deliberately **not** an input to any recommendation — it tracks attention, not value.

### Sleeper — live draft sync

```
https://api.sleeper.app/v1/draft/{draft_id}   and   /v1/league/{league_id}
```

Read-only. Pulls picks as they happen so the board keeps itself current during the real draft.

### FantasyFootballCalculator — mock-draft ADP

```
https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year=2026
```

Free, no key. 2,372 real drafts, Aug 12–17 2026. Supplies the 25% blend weight and, more importantly, the **standard deviation** on each player's ADP — that σ is what the survival model integrates over to answer "will he still be there?"

### Vegas — team implied totals

Implied points per game and weeks 15–17 implied totals, in `src/data.ts`. Used for offensive environment and the playoff-schedule view.

### ESPN — team logos

`a.espncdn.com` — cosmetic only, fetched once at build and inlined.

---

## What we are single-sourced on

**Projections.** Every points number traces to one provider. The 2025 game logs, the news wire, and the ADP feeds are independent, but if Sleeper is wrong about a player's 2026 baseline, nothing else in the app will catch it. Worth knowing before trusting a 0.3 pts/wk edge.

---

## Refreshing the data

```sh
cd app
node scripts/fetch-sleeper.mjs       # ADP, injuries, depth charts, trending, + weekly projections
node scripts/fetch-ceilings.mjs      # 2025 game logs → measured spread
node scripts/fetch-news.mjs          # sourced news wire
node scripts/predraft.mjs            # rebuild sim cache, run every audit
node scripts/load-sims.mjs           # write .simcache/*.json back into data.ts / SimPanel.tsx
```

`predraft.mjs` is the one entry point before a draft — it gates on the audits and refuses to pass if the advisor and the simulations disagree beyond their combined standard errors.

## Development

Vite + React + TypeScript + Tailwind in `app/`. The root `index.html` is a **build artifact** — never hand-edit it.

```sh
cd app
npm install
npm run dev      # live dev server
npm run build    # type-checks, builds, regenerates ../index.html
```

Board data and copy live in `app/src/data.ts`; generated data in `src/sleeper.ts`, `src/projections.ts`, `src/ceilings.ts`, `src/news.ts` (all written by scripts — do not hand-edit). Panels in `app/src/panels/`. Draft state persists in localStorage under `fd26-*` keys.
