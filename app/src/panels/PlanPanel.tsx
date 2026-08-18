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
      <Round rn="Round 1"><b>Take Gibbs.</b> Forcing each candidate and playing out 2,500 seasons: Gibbs 108.09 · Bijan 107.43 · Taylor 106.52 · Cook 106.14 · Henry 105.93 · Chase 105.87. Everyone is available at 1.01, so this is a straight talent call and Gibbs wins it.</Round>
      <Round rn="Best structure"><b>RB-WR-WR-RB, 109.26 pts/wk</b> — a real margin over the next four (107.86–107.92). The one mistake is opening a WR: WR-RB-RB-WR finishes 105.42, a 3.8-point drop, because you never recover the RB1.</Round>
      <Round rn="Picks 24 + 25 (the wheel)"><b>George Pickens then Malik Nabers</b> — Pickens is the pick at 24 in 76% of drafts, Nabers at 25 in 57% (Nico Collins is the common alternate at either). Your picks are back-to-back, so order between them does not matter.</Round>
      <Round rn="Rounds 4–7">D&apos;Andre Swift at 48 (75%), then a tight end at 49 — Loveland 55% or Warren 42%. Round 5 is the measured optimum for TE at every seat.</Round>
      <Round rn="Rounds 8–16">Quarterback at 72 (Caleb Williams 41%, Daniels 33%, Hurts 19%), then upside RBs, a backup QB and TE, K + DST last.</Round>
      <Round rn="Sim’s best line">Gibbs → Pickens + Nabers → Swift → Loveland → Caleb Williams… <span className="text-ink-3">(108.8 pts/wk across 4,000 seasons; bad year 90.5, good year 129.3)</span></Round>
    </>
  ),
  s46: (
    <>
      <Round rn="First pick, ranked"><b>Read availability alongside the score.</b> Across 2,500 seasons each: Jonathan Taylor 107.26 (on the board 74% of the time) · Amon-Ra St. Brown 106.89 (88%) · James Cook 106.85 (98%) · JSN 106.80 (83%) · Henry 106.43 (100%) · Jefferson 106.28 (100%). Taylor grades best but is gone a quarter of the time, so know your second name before you are on the clock.</Round>
      <Round rn="Open with the running back"><b>Jonathan Taylor.</b> An earlier study reported that opening a WR was better here; that was an artifact and it is withdrawn. Fixing the position each round forces the draft to take whoever our board lists first at it — and our board has Christian McCaffrey at #6, ahead of Taylor at #9, so the RB-first template drafted McCaffrey about half the time. McCaffrey is worth <b>1.8 pts/wk less</b> than Taylor (105.62 vs 107.40), which is the entire reason the RB open looked bad. It was a fact about our board order, not about position.</Round>
      <Round rn="Policies, not templates"><b>Every value-based way of drafting opens Taylor here.</b> Across 4,000 paired seasons scored week by week: value-plus-scarcity 105.25 (opens Taylor 73%) · need-weighted 105.22 (Taylor 73%) · raw value-over-replacement 104.35 (Taylor 71%) · straight board order 103.70 (opens JSN 81%) · <b className="text-avoid">just following ADP 100.10</b>. The only policy that opens a receiver is the one that reads our board literally, and it is 1.55 pts/wk worse than thinking about scarcity. <b className="text-avoid">RB-RB-QB-WR finishes 104.59</b> — a round-3 quarterback remains the costliest common mistake.</Round>
      <Round rn="If Taylor is gone">He is on the board 73% of the time. When he is not, Amon-Ra St. Brown (106.89, there 88%) and James Cook (106.85, 98%) are the fallbacks — both fine, neither worth reaching past Taylor for.</Round>
      <Round rn="Round 2"><b>Kenneth Walker III, 59%</b> — Breece Hall (17%) or Omarion Hampton (11%) if he is gone.</Round>
      <Round rn="Round 3"><b>Malik Nabers 73%</b>, DeVonta Smith 23%.</Round>
      <Round rn="Rounds 4–7">Etienne (52%) or Swift (42%) at 43, then a TE at 54 — Warren 60%, Kraft 21%, Loveland 19%.</Round>
      <Round rn="Rounds 8–16">QB at 67 (Daniels 62%), then depth, a backup QB and TE, K/DST last two.</Round>
      <Round rn="Sim’s best line">Taylor → Walker III → Nabers → Etienne → Warren → Daniels… <span className="text-ink-3">(the rounds below come from the older template run and still open JSN; the opening pick above supersedes them)</span></Round>
    </>
  ),
  s79: (
    <>
      <Round rn="Not simulated">Slots 1, 6 and 10 are the seats we simulate, because those are the three being drafted from. Treat this as a read-across rather than a measured plan.</Round>
      <Round rn="Round 1">Best available of Taylor, Cook or Henry. At 7–9 the elite RB tier is thinning but not gone.</Round>
      <Round rn="Round 2"><b>Second bellcow or the best WR left</b> — Walker III, Chase Brown, Saquon, or an A.J. Brown-tier receiver.</Round>
      <Round rn="Rounds 3–8">Attack WR: the shelf holds far longer than RB. Tight end in round 5 is the measured optimum at every seat we tested.</Round>
      <Round rn="Rounds 9–16">Quarterback around round 10–12 — waiting costs almost nothing and taking one in round 3 costs 2+ pts/wk. Then a backup QB and TE, K/DST last.</Round>
    </>
  ),
  s1012: (
    <>
      <Round rn="First pick, ranked"><b>Justin Jefferson, and this reverses our earlier advice.</b> Across 2,500 seasons: Jefferson 107.84 (on the board 97% of the time) · Henry 107.36 (100%) · Saquon 107.21 (98%) · Cook 107.16 (25%) · Lamb 107.16 (87%). We previously called Jefferson the worst pick here on the grounds that he was always available and so would come back to you. On Sleeper’s real ADP he does not: his ADP is 12.3, which falls between your pick 10 and your pick 15, and he survives to 15 only 12% of the time. A player whose ADP sits between two of your picks is exactly the one to take at the earlier pick.</Round>
      <Round rn="Open with a running back"><b>Saquon Barkley or Derrick Henry.</b> This reverses advice given earlier today, and it is worth saying why rather than quietly editing it. The Jefferson case rested on a projection the model invented: his value came from a curve on his board rank, which put him at 16.1 pts/wk. Sleeper&apos;s actual 2026 projection for him is <b>11.4</b>, outside their top eight receivers. On real projections the top six openers at this seat are all running backs — Cook 90.49 (on the board just 25% of the time) · <b>Saquon 90.04 (98%)</b> · <b>Henry 90.01 (100%)</b> · Walker III 89.64 · Chase Brown 89.58 · Jeanty 89.37.</Round>
      <Round rn="Which one">Cook grades highest but is gone three drafts in four. Saquon and Henry are both there essentially always, and are within 0.03 of each other — take whichever you prefer; there is no measurable difference.</Round>
      <Round rn="Best structure"><b>RB-RB-WR-WR, 88.63 pts/wk</b> — and RB-first is now unambiguous here: every WR-first line trails it. The five finalists span 1.3.</Round>
      <Round rn="Round 2"><b>Saquon 45%</b>, Walker III 34%, Henry 21% — you pick at 10 and 15, so plan the pair together.</Round>
      <Round rn="Rounds 3–4">DeVonta Smith (53%) then Egbuka (43%) or Zay Flowers (33%). You pick in pairs at this seat — plan two at a time.</Round>
      <Round rn="Rounds 5–7">TE at 58: Kraft 51%, Warren 42%.</Round>
      <Round rn="Rounds 8–16">QB at 63 (Daniels 78%), then depth, a backup QB and TE, K/DST last two.</Round>
      <Round rn="Sim’s best line">Henry → Saquon → DeVonta Smith → Egbuka → Kraft → Daniels… <span className="text-ink-3">(all numbers on this page now come from Sleeper&apos;s real 2026 projections rather than a curve fitted to our own board order)</span></Round>
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
