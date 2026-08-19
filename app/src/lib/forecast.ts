import { P, MKT, type PlayerRow, type Pos } from "../data";
import { SLP } from "../sleeper";
import { mktADP, snapTeam, type DraftState } from "./advisor";
import { pinnedPick } from "./intel";
import { rbShift } from "./tendency";

/* Live forecast of the picks between now and your next turn.
 *
 * The advisor's survival odds come from a normal curve on ADP — fast, and close enough to rank
 * candidates. This is the expensive version: actually simulate the intervening picks, hundreds
 * of times, with the eleven other rooms drafting the way they really do — priced off Sleeper
 * ADP, with noise, and refusing a second quarterback once they hold one.
 *
 * It is worth the cost because it sees something the curve cannot. ADP says a running back
 * goes at 24. It does not say that five of the seven teams picking before you have no back
 * yet, so the position is about to be stripped regardless of what any list claims. Roster
 * state is knowable — Sleeper sync hands us all twelve — and it is the difference between
 * "he usually lasts this long" and "he will not last in THIS room".
 *
 * Chunked deliberately: you have a minute on the clock, so accuracy is cheap, but the tab must
 * stay responsive while it runs. Each slice yields to the browser and reports progress. */

/* Priced fresh on every forecast rather than cached at module load. A pin added mid-draft has
 * to reach this, and a stale pool would go on quoting the market's price for a player after
 * you have told the tool otherwise. The cost is nothing beside the simulation it feeds. */
type Priced = { name: string; pos: Pos; row: PlayerRow; adp: number; sig: number };
function pricePool(): Priced[] {
  const out: Priced[] = [];
  P.forEach((r) => {
    if (!["QB", "RB", "WR", "TE"].includes(r[1])) return;
    const adp = mktADP(r);
    out.push({
      name: r[0],
      pos: r[1] as Pos,
      row: r,
      adp,
      sig: pinnedPick(r[0]) !== undefined ? 0.8 : Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * adp),
    });
  });
  return out;
}
const ROW: Record<string, PlayerRow> = {};
P.forEach((r) => { ROW[r[0]] = r; });

function gauss(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Forecast {
  /** P(still on the board when your next pick arrives) */
  survive: Record<string, number>;
  /** expected number of each position taken before your turn */
  taken: Record<string, number>;
  /** P(this position loses 3 or more before your turn) — a genuine run */
  runs: { pos: Pos; p: number; expected: number }[];
  /** how many teams pick before you, and how many of them still need each position */
  needs: { pos: Pos; need: number; of: number }[];
  sims: number;
  picksAhead: number;
  /** each team picking before you: what they already hold and what the sim expects them to
   *  take. This is the forecast's working, and it is the part worth reading — a number saying
   *  62% tells you nothing you can argue with, but "the team at 7 has no back and four of the
   *  next six are in the same position" is something you can weigh yourself. */
  room: { pick: number; team: number; has: string; needs: Pos[]; likely: { pos: Pos; p: number }[] }[];
}

/** Roster each team holds right now, rebuilt from the pick order. */
function rosters(ord: string[]): Record<number, PlayerRow[]> {
  const out: Record<number, PlayerRow[]> = {};
  for (let t = 1; t <= 12; t++) out[t] = [];
  ord.forEach((n, i) => {
    const r = ROW[n];
    if (r) out[snapTeam(i + 1)].push(r);
  });
  return out;
}

function counts(roster: PlayerRow[]): Record<string, number> {
  const c: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  roster.forEach((r) => { if (c[r[1]] !== undefined) c[r[1]]++; });
  return c;
}

/**
 * Simulate from the current state to your next pick, `iters` times.
 * Yields between slices so the page stays usable while it thinks.
 */
export function runForecast(
  DS: DraftState,
  ord: string[],
  mySlot: number,
  iters = 5000,
  onProgress?: (done: number, total: number) => void,
): Promise<Forecast> {
  const made = Object.keys(DS).length;
  const cur = made + 1;
  /* Which pick are we forecasting to?
   *
   * When you are waiting, it is your next turn: will he still be there when I pick?
   *
   * When you are ON the clock the naive answer is "this pick", which makes every survival
   * number 100% and the forecast worthless at the exact moment it matters most. On the clock
   * the real question is the one you are actually weighing — if I pass on him now, is he back
   * at my NEXT turn? So skip past this pick and forecast to the one after. */
  const onClock = snapTeam(cur) === mySlot;
  let target = onClock ? cur + 1 : cur;
  while (target <= 168 && snapTeam(target) !== mySlot) target++;
  const picksAhead = Math.max(0, target - cur - (onClock ? 1 : 0));

  const base = rosters(ord);
  const POOL = pricePool();
  const live = POOL.filter((p) => !DS[p.name]);
  const surviveHits: Record<string, number> = {};
  const took: Record<number, Record<string, number>> = {};
  const takenSum: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const runHits: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

  /* who is between you and your next turn, and what each of them is short of */
  const room: Forecast["room"] = [];
  {
    for (let pk = onClock ? cur + 1 : cur; pk < target; pk++) {
      const t = snapTeam(pk);
      if (t === mySlot) continue;
      const c = counts(base[t] ?? []);
      const flexOpen = c.RB + c.WR + c.TE < 7;
      const needs: Pos[] = [];
      (["QB", "RB", "WR", "TE"] as Pos[]).forEach((ps) => {
        const need = ps === "QB" ? c.QB < 1 : ps === "TE" ? c.TE < 1 : c[ps] < 2;
        if (need) needs.push(ps);
      });
      if (flexOpen && !needs.includes("RB")) needs.push("RB");
      if (flexOpen && !needs.includes("WR")) needs.push("WR");
      const has = (["QB", "RB", "WR", "TE"] as Pos[])
        .filter((ps) => c[ps] > 0).map((ps) => `${c[ps]}${ps}`).join(" ") || "nothing yet";
      room.push({ pick: pk, team: t, has, needs, likely: [] });
    }
  }

  /* how many of the teams ahead of you still need each spot — the reason a run happens */
  const needs: Forecast["needs"] = [];
  {
    const want: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    let teams = 0;
    for (let pk = onClock ? cur + 1 : cur; pk < target; pk++) {
      const t = snapTeam(pk);
      if (t === mySlot) continue;
      teams++;
      const c = counts(base[t] ?? []);
      const flexOpen = c.RB + c.WR + c.TE < 7;
      (["QB", "RB", "WR", "TE"] as Pos[]).forEach((ps) => {
        const need = ps === "QB" ? c.QB < 1 : ps === "TE" ? c.TE < 1 : c[ps] < 2;
        if (need || (flexOpen && (ps === "RB" || ps === "WR"))) want[ps]++;
      });
    }
    (["RB", "WR", "TE", "QB"] as Pos[]).forEach((ps) => needs.push({ pos: ps, need: want[ps], of: teams }));
  }

  return new Promise((resolve) => {
    let done = 0;
    const SLICE = 250;

    const step = () => {
      const end = Math.min(iters, done + SLICE);
      for (; done < end; done++) {
        const gone = new Set<string>();
        const c: Record<number, Record<string, number>> = {};
        for (let t = 1; t <= 12; t++) c[t] = counts(base[t] ?? []);
        const tally: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

        for (let pk = onClock ? cur + 1 : cur; pk < target; pk++) {
          const t = snapTeam(pk);
          if (t === mySlot) continue;
          const slot = room.find((x) => x.pick === pk);
          /* Intel is a fact, not a price. Pricing a pinned player at his pick still let another
             player's random noise beat him to it, so "he goes at 8" came out as 92% rather than
             certain. If you say he goes at 8, he is taken at 8. */
          const pinnedNow = live.find((x) => !gone.has(x.name) && pinnedPick(x.name) === pk);
          if (pinnedNow) {
            gone.add(pinnedNow.name);
            c[t][pinnedNow.pos]++;
            tally[pinnedNow.pos]++;
            if (slot) took[pk] = (took[pk] ?? {}), took[pk][pinnedNow.pos] = (took[pk][pinnedNow.pos] ?? 0) + 1;
            continue;
          }
          let best: Priced | null = null;
          let bs = Infinity;
          for (const p of live) {
            if (gone.has(p.name)) continue;
            /* and he cannot be taken before the pick you named — that is what naming it means */
            const pinAt = pinnedPick(p.name);
            if (pinAt !== undefined && pinAt > pk) continue;
            let s = p.adp + gauss() * p.sig * 0.8;
            const rc = c[t];
            if (p.pos === "QB" && rc.QB >= 1) s += 60;
            if (p.pos === "TE" && rc.TE >= 1) s += 50;
            if (p.pos === "RB" && rc.RB >= 5) s += 25;
            if (p.pos === "WR" && rc.WR >= 5) s += 25;
            /* what THIS room does, as opposed to what the market does — off unless set */
            if (p.pos === "RB") s -= rbShift(pk);
            if (s < bs) { bs = s; best = p; }
          }
          if (!best) break;
          gone.add(best.name);
          c[t][best.pos]++;
          tally[best.pos]++;
          if (slot) { took[pk] = (took[pk] ?? {}); took[pk][best.pos] = (took[pk][best.pos] ?? 0) + 1; }
        }
        for (const p of live) if (!gone.has(p.name)) surviveHits[p.name] = (surviveHits[p.name] ?? 0) + 1;
        (["QB", "RB", "WR", "TE"] as Pos[]).forEach((ps) => {
          takenSum[ps] += tally[ps];
          if (tally[ps] >= 3) runHits[ps]++;
        });
      }
      onProgress?.(done, iters);
      if (done < iters) {
        setTimeout(step, 0);
      } else {
        const survive: Record<string, number> = {};
        for (const p of live) survive[p.name] = (surviveHits[p.name] ?? 0) / iters;
        const taken: Record<string, number> = {};
        const runs: Forecast["runs"] = [];
        (["RB", "WR", "TE", "QB"] as Pos[]).forEach((ps) => {
          taken[ps] = takenSum[ps] / iters;
          runs.push({ pos: ps, p: runHits[ps] / iters, expected: takenSum[ps] / iters });
        });
        room.forEach((r) => {
          const t = took[r.pick] ?? {};
          r.likely = (Object.entries(t) as [Pos, number][])
            .map(([pos, n]) => ({ pos, p: n / iters }))
            .sort((a, b) => b.p - a.p)
            .slice(0, 2);
        });
        resolve({ survive, taken, runs, needs, room, sims: iters, picksAhead });
      }
    };
    if (picksAhead === 0) {
      const survive: Record<string, number> = {};
      for (const p of live) survive[p.name] = 1;
      resolve({
        survive,
        taken: { QB: 0, RB: 0, WR: 0, TE: 0 },
        runs: (["RB", "WR", "TE", "QB"] as Pos[]).map((pos) => ({ pos, p: 0, expected: 0 })),
        needs, room, sims: 0, picksAhead: 0,
      });
    } else step();
  });
}

/** Sleeper's own ADP, for showing alongside a simulated survival number. */
export const adpOf = (name: string): number | undefined => SLP[name]?.adp;
