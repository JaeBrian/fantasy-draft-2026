import { useState, type ReactNode } from "react";
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
      <Round rn="Round 1"><b>Gibbs or Bijan — a true coin flip.</b> Half-PPR crowd leans Gibbs (bellcow, easiest schedule); Bijan's TD math points up. You can't get this wrong. At 1.03, Ja'Marr Chase.</Round>
      <Round rn="Round 2"><b>Best available from: Jefferson, Lamb, Cook, Henry, Walker III.</b> Elite WR or your RB2 — the wheel comes back late, so take talent, not need.</Round>
      <Round rn="Round 3"><b>Complete the base:</b> if you're RB-RB, grab a WR1 (A.J. Brown, Pickens, DeVonta Smith). If RB-WR, lock RB2 (Chase Brown, Walker, Hampton). Josh Allen if he's still here.</Round>
      <Round rn="Rounds 4–7"><b>WR hammer through the dead zone</b> (Egbuka, McConkey, Olave, DJ Moore) + one TE swing (Loveland/Warren) if the value comes.</Round>
      <Round rn="Rounds 8–16">Upside RBs (Mason, Croskey-Merritt), late QB (Murray/Nix/Purdy) if you waited, your RB1's handcuff, K + DST last.</Round>
      <Round rn="Example">Gibbs → Jefferson → Chase Brown → Egbuka → Loveland → McLaurin → Lamar → Mason…</Round>
    </>
  ),
  s46: (
    <>
      <Round rn="Round 1"><b>Chase at 4 is the dream.</b> After him: JSN / Amon-Ra, or McCaffrey if you can stomach the age-30 risk (he's still the projected points leader when healthy). Jefferson at 5–6 is a sneaky-correct pick this year.</Round>
      <Round rn="Round 2"><b>You need an RB here</b> — Cook, Henry, Walker III, Saquon, Chase Brown. The bellcow shelf is nearly bare after this round.</Round>
      <Round rn="Round 3"><b>Second RB or elite WR2</b> depending on round 2. This is also the Allen window — he slides here often because everyone's fixated on RB/WR.</Round>
      <Round rn="Rounds 4–7">WR volume (DeVonta, Waddle, McLaurin) + a TE (Bowers/McBride will be gone — Loveland/Warren are the play).</Round>
      <Round rn="Rounds 8–16">Dead-zone-survivor RBs, late QB, handcuffs, K/DST last two.</Round>
      <Round rn="Example">Chase → James Cook → DeVonta Smith → Breece Hall → Tyler Warren → DJ Moore → Lamar → Diggs…</Round>
    </>
  ),
  s79: (
    <>
      <Round rn="Round 1"><b>The RB-RB sweet spot.</b> Establish The Run's favorite seats this year. Taylor, Cook, or CMC (with eyes open) starts the double-tap.</Round>
      <Round rn="Round 2"><b>Second bellcow:</b> Walker III, Chase Brown, Henry, Saquon — a natural RB-RB combo lands here (e.g., Taylor + Chase Brown, Cook + Walker).</Round>
      <Round rn="Rounds 3–8"><b>Attack WR relentlessly:</b> A.J. Brown/Pickens tier in 3, then Egbuka, Olave, McConkey, DJ Moore, Diggs. Bowers/McBride in round 2 instead is fine if the RB you wanted is gone — then go RB in 3.</Round>
      <Round rn="Rounds 9–16">Late QB (Murray/Nix/Purdy), upside RBs, handcuff your studs, K/DST last.</Round>
      <Round rn="Example">Taylor → Walker III → Pickens → Egbuka → McConkey → Tyler Warren → Watson → Murray…</Round>
    </>
  ),
  s1012: (
    <>
      <Round rn="Rounds 1–2 (back-to-back)"><b>Double-RB is the slight favorite here.</b> Our own sim of the turn (10 + 15) has RB-RB edging WR-RB by ~0.5 pts/wk: the WR shelf at picks 34-39 stays strong, the RB shelf doesn't. So Saquon/Walker/Henry-type pairs beat taking the best WR first — by a hair. Jefferson + an RB is the defensible alternative if he's the value you believe in; order between your two turn picks doesn't matter, you get both.</Round>
      <Round rn="Round 3"><b>RB2 first</b> — Skattebo, Etienne, or a healthy-checked Breece keeps you on the two-RBs-in-three-rounds plan. The one exception worth breaking it: <b>Josh Allen sliding to 26–31</b> — take him and push RB2 to round 4; his edge over QB12 is bigger than the RB you're deferring.</Round>
      <Round rn="Rounds 4–7">You pick in pairs — plan two at a time. WR + RB each turn beats doubling one position. Loveland/Warren for TE in this window; Odunze, Waddle, Egbuka are the WR targets.</Round>
      <Round rn="Rounds 8–16">This seat wins late: Diggs, Mason, Croskey-Merritt, Murray, Likely all live here. K/DST last two.</Round>
      <Round rn="Example (base)">Jefferson + Cook → Skattebo → Waddle → Egbuka + Warren → Lamar + Mason…</Round>
      <Round rn="Example (Allen slides)">Jefferson + Cook → Allen → Skattebo/Etienne → Odunze + Warren → Diggs + Croskey-Merritt…</Round>
    </>
  ),
};

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
            Every player's bye is shown next to his team on the Big Board, and the pick advisor warns you before you
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
