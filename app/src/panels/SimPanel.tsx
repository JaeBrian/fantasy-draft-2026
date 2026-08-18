import { useState } from "react";
import { ARBITRAGE, CLIFF_MAP, DRAFT_TREE, PAIRED_SIM, RISK_DIAL, SIM_PLANS, TOOL_USERS } from "../data";
import { Card, Eyebrow, Intro, Noob } from "../components/ui";


/** Forced-first-pick study on the corrected model: 2,500 paired seasons per candidate.
 *  We force the pick, run best-available after it, and play the season out. `avail` is how
 *  often he was still on the board at that seat. Regenerate with app/scripts/sim-first.mjs */
const FIRST_PICK: Record<number, { name: string; pos: string; pts: number; avail: number }[]> = {
  1: [
    { name: "Jahmyr Gibbs", pos: "RB", pts: 89.72, avail: 100 },
    { name: "Bijan Robinson", pos: "RB", pts: 89.26, avail: 100 },
    { name: "Jonathan Taylor", pos: "RB", pts: 87.45, avail: 100 },
    { name: "James Cook", pos: "RB", pts: 87.06, avail: 100 },
    { name: "Derrick Henry", pos: "RB", pts: 86.89, avail: 100 },
    { name: "Saquon Barkley", pos: "RB", pts: 86.24, avail: 100 },
    { name: "Kenneth Walker III", pos: "RB", pts: 86.21, avail: 100 },
    { name: "Chase Brown", pos: "RB", pts: 86.20, avail: 100 },
    { name: "Omarion Hampton", pos: "RB", pts: 85.75, avail: 100 },
  ],
  6: [
    { name: "Jonathan Taylor", pos: "RB", pts: 90.13, avail: 74 },
    { name: "James Cook", pos: "RB", pts: 89.77, avail: 98 },
    { name: "Derrick Henry", pos: "RB", pts: 89.36, avail: 100 },
    { name: "Saquon Barkley", pos: "RB", pts: 88.98, avail: 100 },
    { name: "Chase Brown", pos: "RB", pts: 88.95, avail: 100 },
    { name: "Omarion Hampton", pos: "RB", pts: 88.94, avail: 100 },
    { name: "Christian McCaffrey", pos: "RB", pts: 88.66, avail: 46 },
    { name: "Ashton Jeanty", pos: "RB", pts: 88.23, avail: 100 },
    { name: "Kenneth Walker III", pos: "RB", pts: 87.69, avail: 100 },
  ],
  10: [
    { name: "James Cook", pos: "RB", pts: 90.49, avail: 25 },
    { name: "Saquon Barkley", pos: "RB", pts: 90.04, avail: 98 },
    { name: "Derrick Henry", pos: "RB", pts: 90.01, avail: 100 },
    { name: "Kenneth Walker III", pos: "RB", pts: 89.64, avail: 100 },
    { name: "Chase Brown", pos: "RB", pts: 89.58, avail: 100 },
    { name: "Ashton Jeanty", pos: "RB", pts: 89.37, avail: 91 },
    { name: "Omarion Hampton", pos: "RB", pts: 88.98, avail: 99 },
    { name: "CeeDee Lamb", pos: "WR", pts: 88.11, avail: 87 },
    { name: "Justin Jefferson", pos: "WR", pts: 87.87, avail: 97 },
  ],
};

/** All three tool seats drafting the same way in the same league, 4,000 paired seasons.
 *  Note this is a harder test than the per-seat studies: there, only one seat used our board.
 *  Here all three do, so they compete for the same players. */
const HEAD_TO_HEAD = [
  { who: "Ashley", slot: 1, avg: 91, best: 41 },
  { who: "Emily", slot: 10, avg: 88, best: 31 },
  { who: "Brian JK", slot: 6, avg: 87.1, best: 27 },
];

export function SimPanel({ noob }: { noob: boolean }) {
  const [seat, setSeat] = useState<number>(6);
  const [branch, setBranch] = useState<string>("");
  const plan = SIM_PLANS[seat];
  const cliff = CLIFF_MAP[seat];
  const paired = PAIRED_SIM[seat];
  const risk = RISK_DIAL[seat];
  const tree = DRAFT_TREE[seat];
  const firsts = FIRST_PICK[seat];

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="Simulations" title="We drafted this league 50,000 times">
        Every strategy below was tested by simulating complete 16-round drafts: eleven opponents priced off{" "}
        <b className="text-ink">Sleeper's real half-PPR ADP</b> — the pick each player actually goes at in our exact
        format — with realistic randomness, our seat following a fixed plan, then playing the season out. Numbers are
        points per week from your starting lineup, with each player's season drawn rather than assumed, so the spread
        you see is the spread you'd actually live through.
      </Intro>

      <Card>
        <Eyebrow>What these numbers count</Eyebrow>
        <p className="m-0 text-[0.85rem] leading-relaxed text-ink-2">
          Pulled from the league's own Sleeper settings, not assumed: <b className="text-ink">charmin ultra strong</b>,
          12 teams, 16-round snake, half-PPR — 0.5 per catch, 6-point rushing and receiving TDs, 4-point passing TDs,
          no tight-end premium. Our projections are built for exactly this scoring, so player values need no adjusting.
        </p>
        <p className="m-0 mt-2 text-[0.85rem] leading-relaxed text-ink-2">
          You start <b className="text-ink">1 QB, 2 RB, 2 WR, 1 TE, 2 flex, 1 K and 1 DST</b>, with 6 bench spots. Every
          points-per-week figure on this page counts the <b className="text-ink">eight skill starters only</b> — kicker
          and defense add roughly 16–18 more, but they are close to identical across all twelve teams, so they cannot
          separate a good draft from a bad one.
        </p>
        <p className="m-0 mt-2 text-[0.8rem] leading-relaxed text-ink-3">
          Because K and DST take two of your sixteen picks, we re-ran every strategy with only fourteen rounds of skill
          players to confirm the two spent picks change nothing. The ranking is identical at all three seats: no
          difference at all at picks 6 and 10, and a flat −0.57 across <i>every</i> strategy at pick 1, which shifts the
          whole column without reordering it.
        </p>
      </Card>

      <Noob show={noob} title="How to read this:">
        Every number is <b className="text-ink">points your starters score in a typical week</b>. Compare the{" "}
        <b className="text-ink">mean</b> column to pick a plan — but look at the "bad yr" and "good yr" columns before
        you get attached to it. The spread between a bad season and a good one is far bigger than the spread between
        the plans, which is the honest way of saying: pick the top row, then relax. Use these to choose a{" "}
        <i>shape</i> for your draft; let the live board on the Draft tab tell you the actual names.
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
            Read both columns together. The top name is only the right answer if he's actually there — Jonathan Taylor
            grades best at pick 6 but is gone a quarter of the time, so know your second choice before you're on the
            clock. Anyone sitting at 100% will keep, which is a reason to spend the pick on someone who won't.
          </p>
        </Card>
      )}

      {paired && (
        <Card>
          <Eyebrow>Every structure, same draft</Eyebrow>
          <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">
            {paired.worlds.toLocaleString()} paired seasons — same opponents, same luck, different plan
          </h3>
          <p className="m-0 mb-2 text-[0.85rem] text-ink-2">
            Every number is <b className="text-ink">points your starting lineup scores in a week</b> — 1 QB, 2 RB, 2 WR,
            1 TE, 2 flex. Each strategy runs through the <i>same</i> draft and the <i>same</i> season, so the comparison
            isolates the plan. "Beats the field" is how often it finished ahead of the other four in that shared season.
          </p>
          <p className="m-0 mb-3 rounded-md bg-line-soft/40 px-2.5 py-2 text-[0.8rem] leading-snug text-ink-2">
            <b className="text-ink">Read the spread before the mean.</b> The gap between the best and worst plan here is{" "}
            <b className="text-ink">{(paired.rows[0].mean - paired.rows[paired.rows.length - 1].mean).toFixed(1)} pts/wk</b>, but the
            gap between a bad season and a good one on the <i>same</i> plan is{" "}
            <b className="text-ink">{(paired.rows[0].ceiling - paired.rows[0].floor).toFixed(0)} pts/wk</b> — roughly{" "}
            {Math.round((paired.rows[0].ceiling - paired.rows[0].floor) / Math.max(0.1, paired.rows[0].mean - paired.rows[paired.rows.length - 1].mean))}× larger.
            Pick the top row, then stop worrying: how your players perform matters far more than which order you took them in.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.86rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 py-1 text-left font-semibold">strategy</th>
                  <th className="px-2 py-1 text-right font-semibold">mean</th>
                  <th className="px-2 py-1 text-right font-semibold">bad yr</th>
                  <th className="px-2 py-1 text-right font-semibold">good yr</th>
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

      <Card>
        <Eyebrow>Where Sleeper's room misprices</Eyebrow>
        <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">Who falls to you, and who you must not pay for</h3>
        <p className="m-0 mb-3 text-[0.85rem] text-ink-2">
          Our rank against the pick Sleeper's rooms actually take him at. This is the same list for everyone — it's a
          property of the market, not of your seat.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {([["Let them fall", ARBITRAGE.falls, true], ["Never reach", ARBITRAGE.traps, false]] as const).map(
            ([title, list, good]) => (
              <div key={title}>
                <div className={`mb-1.5 text-[0.78rem] font-semibold ${good ? "text-value" : "text-avoid"}`}>{title}</div>
                <ul className="m-0 list-none space-y-1 p-0 text-[0.83rem]">
                  {list.slice(0, 9).map((r) => (
                    <li key={r.name} className="flex items-baseline gap-1.5">
                      <span className="text-ink-2">{r.name}</span>
                      <span className="font-mono text-[0.68rem] text-ink-3">{r.pos}</span>
                      <span className="ml-auto shrink-0 font-mono text-[0.72rem] tabular-nums text-ink-3">
                        #{r.ourRank} → {r.sadp.toFixed(0)}
                      </span>
                      <span className={`w-11 shrink-0 text-right font-mono text-[0.72rem] tabular-nums ${good ? "text-value" : "text-avoid"}`}>
                        {r.gap > 0 ? `+${r.gap.toFixed(0)}` : r.gap.toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
        <p className="m-0 mt-3 rounded-md bg-line-soft/40 px-2.5 py-2 text-[0.8rem] leading-snug text-ink-2">
          <b className="text-ink">The pattern is tight ends.</b> Seven of the fourteen biggest overpays we found are
          TEs — Kelce, Pitts, LaPorta, Kincaid, Fannin, Ferguson, Kittle. Sleeper's rooms reach for the middle TE tier
          by two to four rounds. But punting the position is not the answer either: forcing the pick round by round, the best round
          for a tight end is <b className="text-ink">round 5</b> at all three seats. Paying up in round 2 costs 1.8–2.4
          pts/wk, and waiting until round 10 still costs 1.0–1.3. Round 5 is the whole window. The falls run the other
          way — quarterbacks and depth receivers keep, so let them.
        </p>
      </Card>

      {tree && (
        <Card>
          <Eyebrow>If this, then that</Eyebrow>
          <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">
            Whoever you land at {tree.picks[0]}, here's your pick {tree.picks[1]} — then {tree.picks[2]}
          </h3>
          <p className="m-0 mb-3 text-[0.85rem] text-ink-2">
            Pick the card matching who you actually got, then read straight down. Options are ranked best to worst by
            the team you finish with, and <b className="text-ink">there %</b> is how often that player is still on the
            board when the pick arrives — a great option at 30% is worth less than a good one at 90%, so have two in mind.
          </p>
          <div className="flex flex-col gap-3">
            {tree.branches.map((b) => {
              const open = branch === b.first.name;
              return (
                <div key={b.first.name} className="rounded-lg border border-line-soft">
                  <button
                    type="button"
                    onClick={() => setBranch(open ? "" : b.first.name)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="text-[0.92rem] text-ink">
                      <span className="text-ink-3">if you get </span>
                      <b>{b.first.name}</b>
                      <span className="ml-1.5 font-mono text-[0.72rem] text-ink-3">{b.first.pos}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[0.76rem] text-ink-3">
                      there {b.first.avail}% {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="grid gap-4 border-t border-line-soft px-3 py-2.5 sm:grid-cols-2">
                      {([["then take at pick " + tree.picks[1], b.second], ["and at pick " + tree.picks[2], b.third]] as const).map(
                        ([title, list]) => (
                          <div key={title}>
                            <div className="mb-1 text-[0.75rem] uppercase tracking-wide text-ink-3">{title}</div>
                            <ol className="m-0 list-none space-y-0.5 p-0 text-[0.85rem]">
                              {list.map((x, i) => (
                                <li key={x.name} className="flex items-baseline gap-1.5">
                                  <span className="w-4 shrink-0 font-mono text-[0.72rem] text-ink-3">{i + 1}.</span>
                                  <span className={i === 0 ? "font-semibold text-ink" : "text-ink-2"}>{x.name}</span>
                                  <span className="font-mono text-[0.68rem] text-ink-3">{x.pos}</span>
                                  <span className="ml-auto shrink-0 font-mono text-[0.72rem] tabular-nums text-ink-3">
                                    {x.pts.toFixed(1)} · {x.avail}%
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-3 text-[0.8rem] leading-snug text-ink-3">
            The pick {tree.picks[2]} column assumes you took the top option at {tree.picks[1]}. If you took a different
            one, the names shift but the shape rarely does — keep taking the best player your roster still has room for.
          </p>
        </Card>
      )}

      {risk && (
        <Card>
          <Eyebrow>The risk dial</Eyebrow>
          <h3 className="display m-0 mb-1 text-[1.2rem] text-ink">
            Can you buy a higher ceiling by drafting risky players?
          </h3>
          <p className="m-0 mb-3 text-[0.85rem] text-ink-2">
            Same seat, same structure (<span className="font-mono">{risk.structure}</span>), three different appetites for
            volatile players — boom-or-bust rookies and injury-prone workhorses versus steady, proven ones.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.86rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 py-1 text-left font-semibold">approach</th>
                  <th className="px-2 py-1 text-right font-semibold">bad yr</th>
                  <th className="px-2 py-1 text-right font-semibold">typical</th>
                  <th className="px-2 py-1 text-right font-semibold">good yr</th>
                  <th className="px-2 py-1 text-right font-semibold">mean</th>
                </tr>
              </thead>
              <tbody>
                {risk.rows.map((r) => (
                  <tr key={r.approach} className="border-t border-line-soft">
                    <td className="px-2 py-1.5 text-ink-2">{r.approach}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-3">{r.floor.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink">{r.typical.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-3">{r.ceiling.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink">{r.mean.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 mt-3 rounded-md bg-line-soft/40 px-2.5 py-2 text-[0.8rem] leading-snug text-ink-2">
            <b className="text-ink">The answer is no — and that's the useful finding.</b> Chasing volatile players moves the
            good-year ceiling by{" "}
            {(risk.rows[0].ceiling - risk.rows[risk.rows.length - 1].ceiling).toFixed(1)} pts/wk, essentially nothing, while
            costing {(risk.rows[0].mean - risk.rows[risk.rows.length - 1].mean).toFixed(1)} pts/wk of mean. You start eight
            skill players every week, so one man's boom cancels another's bust before it ever reaches your score. A high team
            ceiling comes from picks that <i>hit</i>, not from picks that <i>could</i>. Take the best player available and
            let the upside arrive on its own.
          </p>
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
            <span className="font-mono tabular-nums">99.3 pts/wk</span>
          </li>
        </ul>
        <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-ink-3">
          All three of you project 6–10 points a week clear of the rest of the league, which is the whole point of the
          tool. Ashley's edge is the seat, not the plan — the 1.01 is simply the best chair in a year this top-heavy.
          Worth knowing: because the three of you draft off the <i>same</i> board, you compete for the same players, so
          each of you scores a little lower here than in the single-seat studies above. Pick 6 gives up the most to
          that, since Ashley clears the board ahead of him every round.
        </p>
      </Card>
    </div>
  );
}
