import { useState } from "react";
import { ARBITRAGE, P, RUN_TIMING, type Pos } from "../data";
import { SLP } from "../sleeper";
import { Card, Eyebrow, InjChip, Intro, Noob, SleeperMark, Sticker, TeamIcon } from "../components/ui";

const POSITIONS = ["ALL", "RB", "WR", "TE", "QB"] as const;
type Filter = (typeof POSITIONS)[number];

/** Every board player that Sleeper has a real half-PPR ADP for, in draft order. */
const ROWS = P.map((r, i) => ({
  name: r[0] as string,
  pos: r[1] as Pos,
  team: r[2] as string,
  mock: r[3] as number,
  ourRank: i + 1,
  adp: SLP[r[0] as string]?.adp,
})).filter((r) => r.adp !== undefined) as {
  name: string; pos: Pos; team: string; mock: number; ourRank: number; adp: number;
}[];
ROWS.sort((a, b) => a.adp - b.adp);

const GAP = new Map<string, number>();
[...ARBITRAGE.falls, ...ARBITRAGE.traps].forEach((r) => GAP.set(r.name, r.gap));

export function AdpPanel({ noob }: { noob: boolean }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const shown = filter === "ALL" ? ROWS : ROWS.filter((r) => r.pos === filter);

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="Sleeper ADP" title="The board your league is actually looking at">
        Sleeper's own average draft position for half-PPR leagues — measured from real Sleeper drafts in our exact
        scoring format, not from national mock drafts. This is the order players will come off the board on draft
        night, and it is what the model prices every recommendation against.
      </Intro>

      <Noob show={noob} title="What this tab is for:">
        <ul className="mt-1.5 mb-0.5 list-disc space-y-1 pl-5">
          <li>
            <b>ADP</b> is the pick a player usually goes at. ADP 12 means he's typically gone by the end of round 1.
          </li>
          <li>
            <b>Our #</b> is where our research ranks him. When our number is much <i>lower</i> (better) than his ADP,
            the room is letting him fall — you can wait and still get him. That's the green column.
          </li>
          <li>
            Red means the room pays more than he's worth. You don't have to avoid these players, you just shouldn't be
            the one who pays the premium.
          </li>
        </ul>
      </Noob>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="!mb-0">
            <span className="inline-flex items-center gap-1.5">
              <SleeperMark size={13} /> {ROWS.length} players with a real Sleeper ADP
            </span>
          </Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map((p) => (
              <button key={p} type="button" className={`btn ${filter === p ? "on" : ""}`} onClick={() => setFilter(p)}>
                {p === "ALL" ? "All" : p}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[0.87rem]">
            <thead>
              <tr className="text-ink-3">
                <th className="px-2 py-1 text-left font-semibold">
                  <span className="inline-flex items-center gap-1"><SleeperMark size={11} />ADP</span>
                </th>
                <th className="px-2 py-1 text-left font-semibold">player</th>
                <th className="px-2 py-1 text-left font-semibold">pos</th>
                <th className="px-2 py-1 text-right font-semibold">our #</th>
                <th className="px-2 py-1 text-right font-semibold">edge</th>
                <th className="hidden px-2 py-1 text-right font-semibold sm:table-cell">mock</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const edge = r.adp - r.ourRank;
                const big = GAP.has(r.name);
                const round = Math.ceil(r.adp / 12);
                return (
                  <tr key={r.name} className="border-t border-line-soft">
                    <td className="px-2 py-1 font-mono tabular-nums text-ink">
                      {r.adp.toFixed(1)}
                      <span className="ml-1.5 text-[0.68rem] text-ink-3">r{round}</span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        {r.name}
                        <TeamIcon team={r.team} size={15} />
                        <InjChip name={r.name} />
                      </span>
                    </td>
                    <td className="px-2 py-1"><Sticker pos={r.pos} /></td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-ink-3">{r.ourRank}</td>
                    <td
                      className={`px-2 py-1 text-right font-mono tabular-nums ${
                        edge >= 12 ? "text-value" : edge <= -12 ? "text-avoid" : "text-ink-3"
                      } ${big ? "font-bold" : ""}`}
                    >
                      {edge > 0 ? `+${edge.toFixed(0)}` : edge.toFixed(0)}
                    </td>
                    <td className="hidden px-2 py-1 text-right font-mono tabular-nums text-ink-3 sm:table-cell">
                      {r.mock.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <Eyebrow>How the board drains</Eyebrow>
        <h3 className="display m-0 mb-2 text-[1.2rem] text-ink">Players gone by the end of each round</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[0.86rem]">
            <thead>
              <tr className="text-ink-3">
                <th className="px-2 py-1 text-left font-semibold">by end of</th>
                <th className="px-2 py-1 text-right font-semibold text-rb">RB</th>
                <th className="px-2 py-1 text-right font-semibold text-wr">WR</th>
                <th className="px-2 py-1 text-right font-semibold text-te">TE</th>
                <th className="px-2 py-1 text-right font-semibold text-qb">QB</th>
              </tr>
            </thead>
            <tbody>
              {RUN_TIMING.map((r) => (
                <tr key={r.round} className="border-t border-line-soft">
                  <td className="px-2 py-1 text-ink-2">round {r.round}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{r.RB}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{r.WR}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{r.TE}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{r.QB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-[0.82rem] leading-relaxed text-ink-3">
          Twelve running backs are gone by the end of round 2 — one per team, before anyone has a second. Quarterback is
          the opposite: only {RUN_TIMING[2].QB} are gone through three rounds and {RUN_TIMING[7].QB} through eight, so a
          starter is always there. Taking one early buys nothing you couldn't have had four rounds later.
        </p>
      </Card>
    </div>
  );
}
