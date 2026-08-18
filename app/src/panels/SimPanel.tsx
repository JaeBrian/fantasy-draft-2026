import { useState } from "react";
import { CLIFF_MAP, PAIRED_SIM, SIM_PLANS, TOOL_USERS } from "../data";
import { Card, Eyebrow, Intro, Noob } from "../components/ui";


/** Forced-first-pick study: final roster strength, and how often he's actually there. */
const FIRST_PICK: Record<number, { name: string; pos: string; pts: number; avail: number }[]> = {
  6: [
    { name: "Jonathan Taylor", pos: "RB", pts: 109.15, avail: 48 },
    { name: "Christian McCaffrey", pos: "RB", pts: 109.01, avail: 73 },
    { name: "Ja'Marr Chase", pos: "WR", pts: 109.0, avail: 12 },
    { name: "James Cook", pos: "RB", pts: 108.91, avail: 90 },
    { name: "Jaxon Smith-Njigba", pos: "WR", pts: 108.88, avail: 74 },
    { name: "Derrick Henry", pos: "RB", pts: 108.47, avail: 98 },
    { name: "Amon-Ra St. Brown", pos: "WR", pts: 108.35, avail: 97 },
    { name: "Justin Jefferson", pos: "WR", pts: 107.9, avail: 100 },
    { name: "CeeDee Lamb", pos: "WR", pts: 107.52, avail: 100 },
  ],
  10: [
    { name: "Amon-Ra St. Brown", pos: "WR", pts: 108.06, avail: 41 },
    { name: "Derrick Henry", pos: "RB", pts: 108.03, avail: 67 },
    { name: "Jaxon Smith-Njigba", pos: "WR", pts: 108.01, avail: 2 },
    { name: "James Cook", pos: "RB", pts: 107.96, avail: 15 },
    { name: "Justin Jefferson", pos: "WR", pts: 107.29, avail: 100 },
    { name: "CeeDee Lamb", pos: "WR", pts: 107.17, avail: 96 },
  ],
};

const HEAD_TO_HEAD = [
  { who: "Ashley", slot: 1, avg: 108.7, best: 70 },
  { who: "Brian JK", slot: 6, avg: 107.8, best: 27 },
  { who: "Emily", slot: 10, avg: 106.9, best: 4 },
];

export function SimPanel({ noob }: { noob: boolean }) {
  const [seat, setSeat] = useState<number>(6);
  const plan = SIM_PLANS[seat];
  const cliff = CLIFF_MAP[seat];
  const paired = PAIRED_SIM[seat];
  const firsts = FIRST_PICK[seat];

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="Simulations" title="We drafted this league 50,000 times">
        Every strategy below was tested by simulating complete 16-round drafts: eleven opponents drafting off the live
        Sleeper/market board with realistic randomness, our seat following a fixed plan, then scoring the team on its
        best starting lineup. Numbers are projected points per week of starters, adjusted for our injury and risk flags.
      </Intro>

      <Noob show={noob} title="How to read this:">
        A one-point difference across a whole starting lineup is small; anything under about half a point is a coin
        flip. Use these to pick a <i>shape</i> for your draft — then let the live board on the Draft tab tell you the
        actual names.
      </Noob>

      <div className="flex flex-wrap gap-1.5">
        {TOOL_USERS.filter(([, s]) => SIM_PLANS[s]).map(([nm, s]) => (
          <button key={nm} type="button" className={`btn ${seat === s ? "on" : ""}`} onClick={() => setSeat(s)}>
            {nm} · pick {s}
          </button>
        ))}
      </div>

      {plan && (
        <Card>
          <Eyebrow>The line that won most often</Eyebrow>
          <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">
            {plan.strategy} — {plan.ppw} pts/wk, best team in {plan.winPct}% of drafts
          </h3>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[0.9rem]">
            {plan.picks.map((sp) => (
              <li key={sp.pick} className="flex flex-wrap items-baseline gap-x-2 text-ink-2">
                <span className="w-12 shrink-0 font-mono text-[0.78rem] text-ink-3">#{sp.pick}</span>
                {sp.opts.map(([nm, pct], i) => (
                  <span key={nm} className={i === 0 ? "font-semibold text-ink" : "text-ink-3"}>
                    {i > 0 && <span className="mr-1">or</span>}
                    {nm} <span className="font-mono text-[0.75rem] text-ink-3">{pct}%</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[0.8rem] text-ink-3">
            Percentages are how often that player was still on the board when the pick came around.
          </p>
        </Card>
      )}

      {firsts && (
        <Card>
          <Eyebrow>Who to take with your first pick</Eyebrow>
          <h3 className="display m-0 mb-2 text-[1.2rem] text-ink">Forced each candidate, measured the final roster</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.88rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 py-1 text-left font-semibold">player</th>
                  <th className="px-2 py-1 text-right font-semibold">final roster</th>
                  <th className="px-2 py-1 text-right font-semibold">there when you pick</th>
                </tr>
              </thead>
              <tbody>
                {firsts.map((f, i) => (
                  <tr key={f.name} className="border-t border-line-soft">
                    <td className="px-2 py-1">
                      <span className={i === 0 ? "font-semibold text-ink" : "text-ink-2"}>{f.name}</span>
                      <span className="ml-1.5 font-mono text-[0.72rem] text-ink-3">{f.pos}</span>
                    </td>
                    <td className={`px-2 py-1 text-right font-mono tabular-nums ${f.pts >= firsts[0].pts - 0.3 ? "text-value" : f.pts <= firsts[0].pts - 0.7 ? "text-avoid" : "text-ink-2"}`}>
                      {f.pts.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-ink-3">{f.avail}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-ink-3">
            The counter-intuitive result: the players who are <i>always</i> there (Jefferson, Lamb at 100%) are the
            worst use of an early pick — they come back to you anyway. Spend the pick on someone who won't.
          </p>
        </Card>
      )}

      {paired && (
        <Card>
          <Eyebrow>Every structure, same draft</Eyebrow>
          <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">
            {paired.worlds.toLocaleString()} paired worlds — each strategy faced identical opponents
          </h3>
          <p className="m-0 mb-3 text-[0.85rem] text-ink-2">
            Running every strategy through the <i>same</i> draft removes luck from the comparison, so even small edges
            become measurable. "Beats the field" is how often this strategy finished ahead of the other four in the very
            same draft.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.86rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 py-1 text-left font-semibold">strategy</th>
                  <th className="px-2 py-1 text-right font-semibold">mean</th>
                  <th className="px-2 py-1 text-right font-semibold">floor</th>
                  <th className="px-2 py-1 text-right font-semibold">ceiling</th>
                  <th className="px-2 py-1 text-right font-semibold">your RB1</th>
                  <th className="px-2 py-1 text-right font-semibold">your WR1</th>
                  <th className="px-2 py-1 text-right font-semibold">beats the field</th>
                </tr>
              </thead>
              <tbody>
                {paired.rows.map((r, i) => {
                  const others = r.beats.filter((_, j) => j !== i);
                  const avgBeat = others.reduce((a, b) => a + b, 0) / others.length;
                  return (
                    <tr key={r.label} className="border-t border-line-soft align-top">
                      <td className="px-2 py-1.5">
                        <span className={i === 0 ? "font-mono font-bold text-value" : "font-mono text-ink-2"}>{r.label}</span>
                        {r.note && <span className="block max-w-[34ch] text-[0.76rem] leading-snug text-ink-3">{r.note}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink">{r.mean.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-3">{r.floor.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-3">{r.ceiling.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-2">{r.rb1.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-2">{r.wr1.toFixed(1)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${avgBeat >= 60 ? "font-bold text-value" : avgBeat < 35 ? "text-avoid" : "text-ink-2"}`}>
                        {avgBeat.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {cliff && (
        <Card>
          <Eyebrow>Scarcity clock</Eyebrow>
          <h3 className="display m-0 mb-2 text-[1.2rem] text-ink">What's left at each of your picks</h3>
          <div className="overflow-x-auto">
            <table className="w-full max-w-[460px] text-[0.88rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 py-1 text-left font-semibold">pick</th>
                  <th className="px-2 py-1 text-right font-semibold">RB</th>
                  <th className="px-2 py-1 text-right font-semibold">WR</th>
                  <th className="px-2 py-1 text-right font-semibold">TE</th>
                  <th className="px-2 py-1 text-right font-semibold">QB</th>
                </tr>
              </thead>
              <tbody>
                {cliff.map((r, i) => {
                  const prev = i > 0 ? cliff[i - 1] : undefined;
                  const c = (v: number, p?: number) => (
                    <td className={`px-2 py-1 text-right font-mono tabular-nums ${p !== undefined && p - v >= 2.5 ? "font-bold text-avoid" : "text-ink-2"}`}>
                      {v.toFixed(1)}
                      {p !== undefined && p - v >= 2.5 && <span className="ml-1 text-[0.7rem]">▼</span>}
                    </td>
                  );
                  return (
                    <tr key={r.pick} className="border-t border-line-soft">
                      <td className="px-2 py-1 font-mono text-ink">#{r.pick}</td>
                      {c(r.rb, prev?.rb)}
                      {c(r.wr, prev?.wr)}
                      {c(r.te, prev?.te)}
                      {c(r.qb, prev?.qb)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 mt-2 text-[0.82rem] text-ink-3">
            QB drops about two points across sixty picks; RB drops six. That gap is the entire argument for waiting on
            quarterback and attacking running back early.
          </p>
        </Card>
      )}

      <Card>
        <Eyebrow>All three of you in one league</Eyebrow>
        <h3 className="display m-0 mb-2 text-[1.2rem] text-ink">700 drafts with everyone using this tool</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.9rem]">
          {HEAD_TO_HEAD.map((h) => (
            <li key={h.who} className="flex flex-wrap items-baseline gap-x-3 text-ink-2">
              <span className="w-24 shrink-0 font-semibold text-ink">{h.who}</span>
              <span className="font-mono tabular-nums">{h.avg.toFixed(1)} pts/wk</span>
              <span className="text-ink-3">best of the three in {h.best}% of drafts</span>
            </li>
          ))}
          <li className="mt-1 border-t border-line-soft pt-1.5 text-ink-3">
            <span className="w-24 inline-block">The other nine</span>
            <span className="font-mono tabular-nums">99.6 pts/wk</span>
          </li>
        </ul>
        <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-ink-3">
          The three of you project 7–9 points a week clear of the rest of the league. Ashley's edge is the seat, not the
          strategy — the 1.01 is simply the best chair in a year this top-heavy.
        </p>
      </Card>
    </div>
  );
}
