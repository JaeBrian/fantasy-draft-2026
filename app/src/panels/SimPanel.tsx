import { SeatPicker } from "../components/SeatPicker";
import { usePersistent } from "../lib/store";
import { useState } from "react";
import { ARBITRAGE, CLIFF_MAP, DRAFT_TREE, PAIRED_SIM, PRIORITY, RB_LOSS, RISK_DIAL, SIM_PLANS, TOOL_USERS, type Pos } from "../data";
import { Card, Eyebrow, Noob, Sticker } from "../components/ui";


/** Forced-first-pick study on the corrected model: 2,500 paired seasons per candidate.
 *  We force the pick, run best-available after it, and play the season out. `avail` is how
 *  often he was still on the board at that seat. Regenerate with app/scripts/sim-first.mjs */
const FIRST_PICK: Record<number, { name: string; pos: string; pts: number; avail: number }[]> =
  {"1":[{"name":"Jahmyr Gibbs","pos":"RB","pts":100.94,"avail":100},{"name":"Bijan Robinson","pos":"RB","pts":100.07,"avail":100},{"name":"Christian McCaffrey","pos":"RB","pts":99.01,"avail":100},{"name":"Jonathan Taylor","pos":"RB","pts":98.64,"avail":100},{"name":"James Cook","pos":"RB","pts":97.32,"avail":100},{"name":"Jaxon Smith-Njigba","pos":"WR","pts":97.21,"avail":100},{"name":"Puka Nacua","pos":"WR","pts":96.74,"avail":100},{"name":"Amon-Ra St. Brown","pos":"WR","pts":96.58,"avail":100},{"name":"Ja'Marr Chase","pos":"WR","pts":96.25,"avail":100}],"2":[{"name":"Bijan Robinson","pos":"RB","pts":100.16,"avail":97},{"name":"Christian McCaffrey","pos":"RB","pts":99.05,"avail":99},{"name":"Jonathan Taylor","pos":"RB","pts":98.64,"avail":100},{"name":"James Cook","pos":"RB","pts":97.37,"avail":100},{"name":"Jaxon Smith-Njigba","pos":"WR","pts":96.95,"avail":100},{"name":"Puka Nacua","pos":"WR","pts":96.43,"avail":100},{"name":"Amon-Ra St. Brown","pos":"WR","pts":96.29,"avail":100},{"name":"Chase Brown","pos":"RB","pts":95.97,"avail":100},{"name":"Ja'Marr Chase","pos":"WR","pts":95.95,"avail":98}],"10":[{"name":"James Cook","pos":"RB","pts":98.87,"avail":52},{"name":"De'Von Achane","pos":"RB","pts":96.83,"avail":96},{"name":"Chase Brown","pos":"RB","pts":96.46,"avail":100},{"name":"Nico Collins","pos":"WR","pts":96.36,"avail":100},{"name":"CeeDee Lamb","pos":"WR","pts":96.11,"avail":93},{"name":"Derrick Henry","pos":"RB","pts":96.09,"avail":100},{"name":"Kenneth Walker III","pos":"RB","pts":96.04,"avail":100},{"name":"Drake London","pos":"WR","pts":95.79,"avail":100},{"name":"A.J. Brown","pos":"WR","pts":95.66,"avail":100}]};

/** All three tool seats drafting the same way in the same league, 4,000 paired seasons.
 *  Note this is a harder test than the per-seat studies: there, only one seat used our board.
 *  Here all three do, so they compete for the same players. */
const HEAD_TO_HEAD = [
  { who: "Ashley", slot: 1, avg: 94.8, best: 36 },
  { who: "Brian JK", slot: 2, avg: 95.1, best: 38 },
  { who: "Emily", slot: 10, avg: 90.2, best: 26 },
];


/** "The room takes all the backs before I'm on the clock — is it still worth taking one?"
 *  Answered by forcing each opening shape and playing the season out. */
function RbLoss({ seat }: { seat: number }) {
  const [room, setRoom] = useState<'Market' | 'Very RB-heavy (RB LOSS — worst case)'>('Market');
  const [all, setAll] = useState(false);
  const entry = Object.values(RB_LOSS).find(e => e.seat === seat);
  const rows = entry?.rooms[room];
  if (!rows?.length) return null;
  const minimum = Math.floor(Math.min(...rows.map(r => r.floor)));
  const maximum = Math.ceil(Math.max(...rows.map(r => r.ceil)));
  const position = (value: number) => `${100 * (value - minimum) / (maximum - minimum)}%`;
  return <section className="study-panel">
    <div className="study-heading"><div><h2>Compare your opening</h2><p>Four picks set the shape. See the trade-off across complete simulated rosters.</p></div><span className="sample-note">20,000 worlds per opening</span></div>
    <div className="segmented" role="group" aria-label="Opponent scenario">{(['Market', 'Very RB-heavy (RB LOSS — worst case)'] as const).map(k => <button type="button" key={k} aria-pressed={room === k} onClick={() => setRoom(k)}>{k === 'Market' ? 'Market room' : 'Early RB run'}</button>)}</div>
    <div className="range-legend"><span>Opening: rounds 1–4</span><span>10th–90th percentile range · dot = mean</span></div>
    <div className="strategy-comparison">{(all ? rows : rows.slice(0, 5)).map((r, i) => <article key={r.k} className={`strategy-row ${i === 0 ? 'leading' : ''}`}><div><div className="opening-shape">{r.k.split('-').map((pos, j) => <Sticker key={j} pos={pos as Pos} />)}</div><p>{i === 0 ? 'Highest modeled mean' : r.tied ? 'Within sampling error of leader' : `${Math.abs(r.delta).toFixed(2)} pts/wk behind leader`}</p></div><div className="range-plot" aria-label={`${r.k}: mean ${r.ppg}, 10th percentile ${r.floor}, 90th percentile ${r.ceil}`}><div className="range-track"><span style={{left: position(r.floor), width: `${100 * (r.ceil - r.floor) / (maximum - minimum)}%`}} /><i style={{left: position(r.ppg)}} /></div><div><span>{r.floor.toFixed(1)}</span><span>{r.ceil.toFixed(1)}</span></div></div><div className="strategy-mean"><b>{r.ppg.toFixed(2)}</b><span>pts/wk ±{r.se.toFixed(2)} SE</span></div></article>)}</div>
    <button type="button" className="btn" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show top five' : `Compare all ${rows.length} openings`}</button><p className="study-footnote">Ranges describe modeled season outcomes. Small mean differences can change with projections and opponent behavior. These experiments constrain positions; the live picker adapts to the players available.</p>
  </section>;
}

function PriorityBoard({ seat }: { seat: number }) {
  const [room, setRoom] = useState<'RB LOSS' | 'Market'>('Market');
  const [took, setTook] = useState<string | null>(null);
  const entry = Object.values(PRIORITY).find(e => e.seat === seat);
  const data = entry?.rooms[room];
  if (!entry || !data?.round1.length) return null;
  const r1 = data.round1;
  const likely = r1.find(r => r.there >= 50 && data.round2[r.name]?.length)?.name ?? r1[0].name;
  const chosen = took && data.round2[took]?.length ? took : likely;
  const r2 = data.round2[chosen] ?? [];
  const render = (rows: typeof r1, second = false) => <ol className="priority-list">{rows.map((r, i) => <li key={r.name} className={second ? '' : chosen === r.name ? 'chosen' : ''}>
    <span className="priority-rank">{i + 1}</span><div>{second ? <strong>{r.name}</strong> : <button type="button" disabled={!data.round2[r.name]?.length} aria-pressed={chosen === r.name} onClick={() => setTook(r.name)}>{r.name}</button>}<span className="priority-meta"><Sticker pos={r.pos as Pos} />ADP {r.adp.toFixed(1)} · {r.there}% {second ? 'joint availability' : 'available at pick'}</span></div><span className="priority-gap"><b>{r.delta === null ? '—' : `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}`}</b><small>{r.tied ? 'close to baseline' : 'pts/wk vs baseline'}</small></span>
  </li>)}</ol>;
  return <section className="study-panel">
    <div className="study-heading"><div><h2>Explore your first two picks</h2><p>Select an opening player to see the next choices for your roster.</p></div><span className="sample-note">5,000 worlds per option</span></div>
    <div className="segmented" role="group" aria-label="Priority room">{(['Market','RB LOSS'] as const).map(k => <button type="button" key={k} aria-pressed={room === k} onClick={() => { setRoom(k); setTook(null); }}>{k === 'Market' ? 'Market room' : 'Early RB run'}</button>)}</div>
    <div className="priority-columns"><div><h3>Pick {entry.p1}<span>Your first player</span></h3>{render(r1)}</div><div><h3>Pick {entry.p2}<span>After {chosen}</span></h3><label className="branch-select">First pick<select value={chosen} onChange={e => setTook(e.target.value)}>{r1.filter(r => data.round2[r.name]?.length).map(r => <option key={r.name}>{r.name}</option>)}</select></label>{render(r2, true)}</div></div>
    <details className="draft-disclosure"><summary>How to read the comparisons</summary><p>Ranked by paired differences against a common baseline, using worlds where both options were available. “Close to baseline” means within two standard errors of that baseline, not necessarily the leading player.</p><p>Second-pick percentages count worlds where both the selected first player and this second player were available. They are joint availability across all worlds. Use the Draft room forecast to estimate who reaches your next turn from the current board.</p></details>
  </section>;
}

export function SimPanel({ noob, initialSeat, onOpenDraft }: { noob: boolean; initialSeat: number; onOpenDraft: (seat: number) => void }) {
  const [seat, setSeat] = usePersistent('fd26-sim-seat', [1, 2, 10].includes(initialSeat) ? initialSeat : 2, r => [1, 2, 10].includes(Number(r)) ? Number(r) : 2, String);
  const [view, setView] = useState<'plan' | 'compare' | 'research'>('plan');
  const [branch, setBranch] = useState<string>("");
  const plan = SIM_PLANS[seat];
  const cliff = CLIFF_MAP[seat];
  const paired = PAIRED_SIM[seat];
  const risk = RISK_DIAL[seat];
  const tree = DRAFT_TREE[seat];
  const firsts = FIRST_PICK[seat];

  return (
    <div className="sim-workspace">
      <div className="workspace-title"><div><span className="section-caption">Saved simulations · Updated September 4</span><h1>Draft lab</h1><p>Explore the choices before you're on the clock.</p></div><button type="button" className="btn primary" onClick={() => onOpenDraft(seat)}>Open draft picker</button></div>
      <SeatPicker value={seat} onChange={value => { setSeat(value); setBranch(''); }} />
      <div className="study-navigation" role="group" aria-label="Simulation view">{([['plan','First two picks'],['compare','Compare openings'],['research','Full analysis']] as const).map(([key, name]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{name}</button>)}</div>
      {view === 'plan' && <>
        <div className="seat-brief"><div><span className="section-caption">{TOOL_USERS.find(([, s]) => s === seat)?.[0]}'s draft</span><h2>{seat === 1 ? 'Start with Gibbs. Keep the turn flexible.' : seat === 2 ? 'Bijan first. Watch Ashley at the turn.' : 'Let the first nine picks shape your opening.'}</h2><p>{seat === 10 ? 'James Cook, Chase Brown and a falling elite receiver offer different routes. Explore the follow-up at pick 15.' : 'Compare available RBs, receivers and elite tight ends at the next turn. Your roster and the room decide the order.'}</p></div><div className="pick-route" aria-label="First six overall picks">{plan?.picks.map((p, i) => <span key={p.pick}><small>Round {i + 1}</small><b>{p.pick}</b></span>)}</div></div>
        <PriorityBoard key={seat} seat={seat} />
      </>}
      {view === 'compare' && <RbLoss key={seat} seat={seat} />}
      {view === 'research' && <div className="research-sections">
      <Card>
        <Eyebrow>What these numbers count</Eyebrow>
        <p className="m-0 text-[0.85rem] leading-relaxed text-ink-2">
          Pulled from the league's own Sleeper settings, not assumed: <b className="text-ink">charmin ultra strong</b>,
          12 teams, 16-round snake, half-PPR — 0.5 per catch, 6-point rushing and receiving TDs, 4-point passing TDs,
          no tight-end premium. Our projections are built for exactly this scoring, so player values need no adjusting.
        </p>
        <p className="m-0 mt-2 text-[0.85rem] leading-relaxed text-ink-2">
          You start <b className="text-ink">1 QB, 2 RB, 2 WR, 1 TE, 2 flex, 1 K and 1 DST</b>, with 6 bench spots. Every
          points-per-week score on this page counts the <b className="text-ink">eight skill starters only</b>.
          Kicker and defense production is excluded from these comparisons.
        </p>
        <p className="m-0 mt-2 text-[0.8rem] leading-relaxed text-ink-3">
          The published studies use fourteen skill picks per team. The draft tracker separately supports all sixteen rounds,
          including early kicker or defense selections. These studies do not estimate the scoring impact of those positions.
        </p>
      </Card>

      <Noob show={noob} title="How to read this:">
        The point estimates describe <b className="text-ink">modeled starter production</b>. Compare the{" "}
        <b className="text-ink">mean</b> column alongside the "bad yr" and "good yr" ranges. Small differences between
        plans can change with projections and opponent behavior. Use these to explore the opening positions;
        the Draft room recommends players as your roster and the available pool change.
      </Noob>


      {plan && (
        <Card>
          <Eyebrow>Weekly policy outcomes</Eyebrow>
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
            Percentages are how often the simulated policy selected that player at the pick.
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
            Read both columns together. A high-scoring option matters only if he reaches this pick. Availability here
            means he was present at this pick in the simulations; it does not mean he will survive another round.
            Keep alternatives ready and use the current board when your turn arrives.
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
            1 TE, 2 flex. Each strategy shares seeded opponent randomness and player outcomes. Different picks can change
            the later draft path. "Average matchup win rate" averages its head-to-head results against the other four plans, counting an exact tie as half a win.
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
                  <th className="px-2 py-1 text-right font-semibold">average matchup win rate</th>
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
          Compare the current tier and your next turn before choosing a quarterback or tight end.
          Their value depends on who remains available and what your roster needs. The old fixed
          round-5 tight-end rule came from an earlier scoring model and has been retired.
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
            Compare both the mean and the range above. These are model scenarios for different
            draft preferences. A higher individual variance can change which players the policy takes;
            it does not establish a championship advantage.
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
            Compare the position columns across your next two picks. Larger drops indicate a more expensive wait.
          </p>
        </Card>
      )}

      <Card>
        <Eyebrow>All three of you in one league</Eyebrow>
        <h3 className="display m-0 mb-2 text-[1.2rem] text-ink">4,000 drafts with all three following the board</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.9rem]">
          {HEAD_TO_HEAD.map((h) => (
            <li key={h.who} className="flex flex-wrap items-baseline gap-x-3 text-ink-2">
              <span className="w-24 shrink-0 font-semibold text-ink">{h.who}</span>
              <span className="font-mono tabular-nums">{h.avg.toFixed(1)} pts/wk</span>
              <span className="text-ink-3">best of the three in {h.best}% of drafts</span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-2 text-[0.82rem] leading-relaxed text-ink-3">
          Read these as seat comparisons, not as the tool’s edge over your league. The gap between these
          numbers and a simulated opponent’s depends heavily on how well the opponent model drafts, and ours
          reaches and panics more than real people do — so any “points clear of the league” figure flatters us.
          Championship odds require a validated schedule, playoff bracket, waiver model and opponent
          model. The previous 14–16% championship claim has been withdrawn because the old schedule
          generator did not give every team one game per week.
        </p>
      </Card>
      </div>}
      <p className="study-footnote">Studies model 14 skill rounds and eight starters. Projections, injury assumptions and opponent behavior affect the estimates. Scoring-rank percentages describe simulated production, not championship odds.</p>
    </div>
  );
}
