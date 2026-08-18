import { useState, type ReactNode } from "react";
import { CLIFF_MAP } from "../data";
import { Card, Eyebrow, Intro, KV, Noob } from "../components/ui";

type SlotKey = "s13" | "s46" | "s79" | "s1012";

const SLOT_LABELS: [SlotKey, string][] = [
  ["s13", "Picks 1–3"],
  ["s46", "Picks 4–6"],
  ["s79", "Picks 7–9"],
  ["s1012", "Picks 10–12"],
];

function Round({ rn, children }: { rn: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-b border-line-soft py-2.5 last:border-0 max-sm:grid-cols-1 max-sm:gap-0.5">
      <div className="display text-[0.95rem] font-semibold uppercase tracking-wide text-clock">{rn}</div>
      <div className="text-ink-2 [&_b]:text-ink">{children}</div>
    </div>
  );
}

const PLANS: Record<SlotKey, ReactNode> = {
  s13: (
    <>
      <Round rn="Round 1"><b>Take the RB — the sim is emphatic.</b> 400 simulated drafts per strategy: opening with an RB wins 98–99% of simulated leagues from this seat; opening Ja’Marr Chase instead drops you to 50%. Gibbs or Bijan is a coin flip.</Round>
      <Round rn="Which one">Half-PPR leans Gibbs (bellcow, easiest schedule); Bijan’s TD math points up. You can’t get this wrong. At 1.03 with both gone, Chase is right — you’re forced, and it’s still fine.</Round>
      <Round rn="Picks 24 + 25 (the wheel)"><b>Breece Hall + George Pickens</b> — the sim’s most common pair at your double (Hall ~65%, Pickens ~58%). RB-RB and RB-WR-RB finish dead even at the top (110.5 pts/wk), so order doesn’t matter; you get both.</Round>
      <Round rn="Rounds 4–7"><b>WR hammer through the dead zone</b> (Egbuka, McConkey, Olave, DJ Moore) + one TE swing (Loveland/Warren) if the value comes.</Round>
      <Round rn="Rounds 8–16">Upside RBs (Mason, Croskey-Merritt), late QB (Murray/Nix/Purdy) if you waited, your RB1's handcuff, K + DST last.</Round>
      <Round rn="Sim’s best line">Gibbs → Breece Hall + Pickens → Waddle → Loveland → McLaurin → Lamar → Mason… <span className="text-ink-3">(110.6 pts/wk, won 98% of simulated leagues)</span></Round>
    </>
  ),
  s46: (
    <>
      <Round rn="Round 1"><b>Double-RB wins here — 95% of simulated leagues.</b> Chase at 4 if he falls. Otherwise the sim takes McCaffrey ~75% of the time on raw projection — but our research has him at 78% injury odds, and swapping to JSN costs only ~0.4 pts/wk. Jefferson at 5–6 remains a defensible value play.</Round>
      <Round rn="First pick, ranked"><b>By final roster strength across 900 drafts each:</b> Jonathan Taylor 109.2 (there 48% of the time) · McCaffrey 109.0 (73%) · Chase 109.0 (12%) · James Cook 108.9 (90%) · JSN 108.9 (74%) · Henry 108.5 (98%). <b className="text-avoid">Justin Jefferson is the worst realistic pick here at 107.9</b> — he is ~100% to still be there, so spending pick 6 on him wastes the scarcity. Take the best RB.</Round>
      <Round rn="Best structure"><b>RB-RB-WR-WR wins outright</b> at 109.0 ±0.04 — a real margin over the next best (108.6), not noise. RB-TE-early is worst at 106.0.</Round>
      <Round rn="Round 2"><b>Kenneth Walker III — the sim’s pick ~70% of the time</b>, and our biggest buy on the board. Henry, Saquon or Chase Brown if he’s gone. Every RB-first line beat every WR-first line from this seat.</Round>
      <Round rn="Round 3"><b>Second RB or elite WR2</b> depending on round 2. This is also the Allen window — he slides here often because everyone's fixated on RB/WR.</Round>
      <Round rn="Rounds 4–7">WR volume (DeVonta, Waddle, McLaurin) + a TE (Bowers/McBride will be gone — Loveland/Warren are the play).</Round>
      <Round rn="Rounds 8–16">Dead-zone-survivor RBs, late QB, handcuffs, K/DST last two.</Round>
      <Round rn="Sim’s best line">McCaffrey (or JSN) → Walker III → Nabers → Egbuka → Warren → DJ Moore → Lamar → Diggs… <span className="text-ink-3">(109.0 pts/wk, won 95% of simulated leagues)</span></Round>
    </>
  ),
  s79: (
    <>
      <Round rn="Round 1"><b>The RB-RB sweet spot.</b> Establish The Run's favorite seats this year. Taylor, Cook, or CMC (with eyes open) starts the double-tap.</Round>
      <Round rn="Round 2"><b>Second bellcow:</b> Walker III, Chase Brown, Henry, Saquon — a natural RB-RB combo lands here (e.g., Taylor + Chase Brown, Cook + Walker).</Round>
      <Round rn="Rounds 3–8"><b>Attack WR relentlessly:</b> A.J. Brown/Pickens tier in 3, then Egbuka, Olave, McConkey, DJ Moore, Diggs. Bowers/McBride in round 2 instead is fine if the RB you wanted is gone — then go RB in 3.</Round>
      <Round rn="Rounds 9–16">Late QB (Murray/Nix/Purdy), upside RBs, handcuff your studs, K/DST last.</Round>
      <Round rn="Example line">Taylor → Walker III → Pickens → Egbuka → McConkey → Tyler Warren → Watson → Murray… <span className="text-ink-3">(not simulated — slots 1, 6 and 10 were; RB-RB won at every one of them)</span></Round>
    </>
  ),
  s1012: (
    <>
      <Round rn="First pick, ranked"><b>Almost everything ties — except Jefferson.</b> Forcing each candidate and measuring the final roster across 900 drafts: Amon-Ra 108.06 · Henry 108.03 · JSN 108.01 · Cook 107.96 — all within noise of each other. But <b className="text-avoid">Jefferson finishes 107.29 and Lamb 107.17</b>, a real ~0.75 gap. The reason is availability: both are ~100% to still be there at 10, so taking one spends a scarce pick on a player who was coming back to you anyway.</Round>
      <Round rn="Best structure"><b>RB-WR-WR-RB (108.01)</b>, but the top five structures sit within 0.27 — genuinely interchangeable. Just don’t open QB or TE.</Round>
      <Round rn="Earlier framing"><b>One bellcow, then best WR — 85% win rate.</b> Full 16-round sims put Hero-RB narrowly on top here, with Derrick Henry the most common opener (~59%). The top four strategies sit within 0.4 pts/wk, so what matters is landing one RB early: the WR shelf at picks 34–39 holds, the RB shelf collapses.</Round>
      <Round rn="Round 3"><b>RB2 first</b> — Skattebo, Etienne, or a healthy-checked Breece keeps you on the two-RBs-in-three-rounds plan. The one exception worth breaking it: <b>Josh Allen sliding to 26–31</b> — take him and push RB2 to round 4; his edge over QB12 is bigger than the RB you're deferring.</Round>
      <Round rn="Rounds 4–7">You pick in pairs — plan two at a time. WR + RB each turn beats doubling one position. Loveland/Warren for TE in this window; Odunze, Waddle, Egbuka are the WR targets.</Round>
      <Round rn="Rounds 8–16">This seat wins late: Diggs, Mason, Croskey-Merritt, Murray, Likely all live here. K/DST last two.</Round>
      <Round rn="Sim’s best line">Henry → A.J. Brown → DeVonta Smith → Javonte Williams → Warren → Diggs… <span className="text-ink-3">(108.0 pts/wk, won 85% of simulated leagues)</span></Round>
      <Round rn="Jefferson line (a tie)">Jefferson → Saquon → Javonte Williams → DeVonta Smith… <span className="text-ink-3">(107.8 pts/wk, 84%) — if you believe the Jefferson case, taking him costs you nothing.</span></Round>
    </>
  ),
};


const SLOT_TO_PICK: Record<SlotKey, number | null> = { s13: 1, s46: 6, s79: null, s1012: 10 };

/** Where each position falls off a cliff — for this exact seat. */
function CliffMap({ slot }: { slot: SlotKey }) {
  const pick = SLOT_TO_PICK[slot];
  const rows = pick ? CLIFF_MAP[pick] : undefined;
  if (!rows) return null;
  const cell = (v: number, prev?: number) => {
    const drop = prev === undefined ? 0 : prev - v;
    const heavy = drop >= 2.5;
    return (
      <td className={`px-2 py-1 text-right font-mono tabular-nums ${heavy ? "font-bold text-avoid" : "text-ink-2"}`}>
        {v.toFixed(1)}
        {heavy && <span className="ml-1 text-[0.7rem]">▼</span>}
      </td>
    );
  };
  return (
    <div className="mt-4 border-t border-line-soft pt-3">
      <div className="display text-[0.95rem] font-semibold uppercase tracking-wide text-clock">
        Where the cliffs are — pick {pick}
      </div>
      <p className="m-0 mt-1 mb-2 text-[0.85rem] text-ink-2">
        Best player still available at each of your picks (projected pts/wk), from 500 simulated drafts. Red
        ▼ marks a drop of 2.5+ points — that position fell off a cliff since your last turn, so take it{" "}
        <i>before</i> the drop, not after.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full max-w-[420px] text-[0.85rem]">
          <thead>
            <tr className="text-ink-3">
              <th className="px-2 py-1 text-left font-semibold">your pick</th>
              <th className="px-2 py-1 text-right font-semibold">RB</th>
              <th className="px-2 py-1 text-right font-semibold">WR</th>
              <th className="px-2 py-1 text-right font-semibold">TE</th>
              <th className="px-2 py-1 text-right font-semibold">QB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = i > 0 ? rows[i - 1] : undefined;
              return (
                <tr key={r.pick} className="border-t border-line-soft">
                  <td className="px-2 py-1 font-mono text-ink">#{r.pick}</td>
                  {cell(r.rb, prev?.rb)}
                  {cell(r.wr, prev?.wr)}
                  {cell(r.te, prev?.te)}
                  {cell(r.qb, prev?.qb)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-2 text-[0.82rem] text-ink-3">
        Notice QB barely moves — about 2 points across 60 picks. That is the whole argument for waiting on
        quarterback: the position you can get late costs you almost nothing, while RB costs you six.
      </p>
    </div>
  );
}

export function PlanPanel({ noob }: { noob: boolean }) {
  const [slot, setSlot] = useState<SlotKey>("s13");
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="Strategy" title="The 2026 draft has a shape. Draft with it, not against it.">
        Sharps reverted to RB-heavy drafting this year (Establish The Run counts ~12 RBs in the first 20 picks) because
        the bellcow tier is deep at the top and gone by round 4. Half-PPR pushes the same direction — and your league's
        TWO flex spots push it harder still: you start seven RB/WR/TE every week, so you need more startable runners and
        receivers than a standard league. Below: what each stretch of the draft looks like, then a plan for your exact
        draft slot.
      </Intro>

      <Noob show={noob} title="Why &quot;strategy&quot; matters:">
        every round, certain kinds of players run out. If you know the RB shelf empties by round 4 but good WRs last
        until round 8, you take RBs first and WRs later — even when a WR feels like the "bigger name." That's the whole
        game.
      </Noob>

      <Card>
        <Eyebrow>Your draft slot</Eyebrow>
        <h3 className="display m-0 text-[1.35rem] text-ink">Pick a seat, get a plan</h3>
        <div className="mt-3 mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Draft slot">
          {SLOT_LABELS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={slot === key}
              className={`btn px-4 py-2 text-[0.9rem] ${slot === key ? "on" : ""}`}
              onClick={() => setSlot(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div>{PLANS[slot]}</div>
        <CliffMap slot={slot} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>What each round looks like (market map)</Eyebrow>
          <Round rn="Rd 1">7 of 12 picks are RBs. Elite WRs fill the rest. No QB/TE.</Round>
          <Round rn="Rd 2">TE run starts (Bowers ~20, McBride ~30). Last true bellcows go. Allen sometimes sneaks in late.</Round>
          <Round rn="Rd 3–4">Allen goes (~pick 26–36), Lamar follows. <b>RB dead zone begins</b> — supply thins to committees.</Round>
          <Round rn="Rd 5–8">WR2/flex feast. Second QB wave (Maye, Burrow, Daniels). Dead-zone-survivor RBs (Warren, Stevenson, Pollard, Dowdle).</Round>
          <Round rn="Rd 9–12">Handcuff run, TE bargains (Likely, Kittle), late-QB window (Murray, Nix, Purdy, Stafford).</Round>
          <Round rn="Rd 13–16">Lottery tickets (Boston, Stribling, Charbonnet, Lloyd), then K + DST with the last two picks.</Round>
        </Card>
        <Card>
          <Eyebrow>Half-PPR fine print</Eyebrow>
          <p className="mt-0">Most apps and ADP default to full-PPR. In <b>your</b> scoring, catches are worth half as much, so:</p>
          <KV
            rows={[
              ["Nudge UP", "Rushing-volume, goal-line backs: Taylor, Cook, Henry, Walker III, Judkins, Monangai, Mason."],
              ["Nudge DOWN", "Catch-only backs (Gainwell-types) and low-yardage possession slot WRs."],
              ["Unchanged", "Rushing QBs (Allen, Lamar, Daniels, Murray) — rushing points don't care about scoring format, which quietly makes them even better relative to pocket passers."],
            ]}
          />
          <Eyebrow className="mt-4">Stacks worth a tiebreaker</Eyebrow>
          <p className="my-0 text-[0.93rem] text-ink-2">
            <b className="text-ink">Burrow + Chase</b> (the best in football) · <b className="text-ink">Dak + Lamb</b> (+ Pickens for
            the playoff weeks) · <b className="text-ink">Goff + Amon-Ra</b> · <b className="text-ink">Mayfield + Egbuka</b>. Rule: a
            stack breaks ties inside a tier — never reach a tier for one.
          </p>
          <Eyebrow className="mt-4">Handcuffs that matter</Eyebrow>
          <p className="my-0 text-[0.93rem] text-ink-2">
            <b className="text-ink">Blake Corum</b> (LAR — the #1 cuff, standalone value) · <b className="text-ink">Zach Charbonnet</b>{" "}
            (SEA) · <b className="text-ink">Tyler Allgeier</b> (ARI — instant value if Love's ankle lingers) ·{" "}
            <b className="text-ink">MarShawn Lloyd</b> (GB — the Jacobs contingency) · <b className="text-ink">Isiah Pacheco</b> (DET —
            Gibbs insurance) · <b className="text-ink">Justice Hill / Ray Davis</b> deep. Cuff your own RB1 first, rounds 12+.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>2026 bye weeks (don't triple-stack one)</Eyebrow>
          <KV
            rows={[
              ["Wk 5", "Chiefs, Panthers"],
              ["Wk 6", <><b className="text-ink">Bengals, Lions, Dolphins, Vikings</b> — the landmine: Chase, Gibbs, Amon-Ra and Jefferson ALL sit this week. Pairing two of them is fine; know it's coming.</>],
              ["Wk 7", "Bills, Jaguars, Chargers, Commanders — Allen, Daniels and Herbert all off (matters if you carry two QBs)."],
              ["Wk 8", "Texans, Saints, Giants, 49ers"],
              ["Wk 9", "Steelers, Titans"],
              ["Wk 10", "Bears, Broncos, Eagles, Bucs — Hurts + Saquon go dark together."],
              ["Wk 11", <><b className="text-ink">Six teams off</b> (Falcons, Browns, Packers, Rams, Patriots, Seahawks) — the thinnest lineup week of the year; bench depth earns its keep here.</>],
              ["Wk 13", "Ravens, Colts, Raiders, Jets — Lamar + Henry off in some leagues' playoff week 1."],
              ["Wk 14", "Cardinals, Cowboys"],
            ]}
          />
          <p className="mt-2.5 mb-0 text-[0.85rem] text-ink-3">
            Every player's bye is shown next to his team on the Draft tab, and the pick advisor warns you before you
            stack a third starter on one bye.
          </p>
        </Card>
        <Card>
          <Eyebrow>Opening weeks — fast starts &amp; slow starts</Eyebrow>
          <KV
            rows={[
              ["Soft openings", "Eagles skill players, Jaxson Dart, Zay Flowers — friendly first month, fast starts likely."],
              ["Brutal openings", "Josh Allen, James Cook and Trevor Lawrence all open against a gauntlet — don't panic-trade a slow September."],
              ["Wk 1 QB streams", "Kyler Murray (vs GB), Tyler Shough, Sam Darnold (@ NE) — if you punted QB to the last rounds."],
              ["Wk 1 DST streams", "Chargers (vs ARI), Jaguars (vs CLE), Steelers (vs ATL). The Ravens are a sneaky weeks 1–6 hold."],
              ["Wk 1 kickers", "Aubrey (@ NYG), Dicker (vs ARI), Fairbairn (vs BUF)."],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
