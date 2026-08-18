# Fantasy Draft 2026

A 12-team half-PPR draft guide + live draft tracker. Open `index.html` — it's a single self-contained build, no server needed.

- **Big Board**: 158 players, synthesized half-PPR ranks with ADP, verdict calls, profile tags, and bye weeks
- **Draft tracker**: mark picks (✕ others / ★ mine), roster slot panel, undo, best-available bar
- **Pick advisor**: set your slot; it scores need × value × positional cliff, warns on bye stacking, boosts your handcuffs
- Position tiers, slot-by-slot strategy, rookies, do-not-draft risk board, Vegas board, plain-English glossary

Data current as of the date in the page header. `UPDATES.md` logs each data refresh.

## Development

The app is a Vite + React + TypeScript + Tailwind project in `app/`. The root `index.html` is the build artifact.

```sh
cd app
npm install
npm run dev      # live dev server
npm run build    # type-checks, builds, and regenerates ../index.html (single file)
```

Player data and draft copy live in `app/src/data.ts` and the panel components in `app/src/panels/`. Draft state persists in localStorage under the same keys as the original version (`fd26-draft`, `fd26-slot`, `fd26-noob`), so saved picks survive the upgrade.
