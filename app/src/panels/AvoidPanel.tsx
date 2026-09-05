import type { ReactNode } from "react";
import { Card, Eyebrow, Info, Intro, Noob } from "../components/ui";

function PCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <>
      <span className="pname">{name}</span>
      {sub && <span className="pteam">{sub}</span>}
    </>
  );
}

function Tbl({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const FADES: [string, string, string, string][] = [
  ["Christian McCaffrey", "RB · SF", "Rd 1 (~6)", "Age 30, league-high 450 touches in 2025, and camp \"tightness\" — the same word that preceded his lost 2024. Injury models give him a 78% chance of missing time. His production was real (volume-earned, not TD luck), so he's a conviction pick — just know 4 of ESPN's panel called bust."],
  ["De'Von Achane", "RB · MIA", "Rd 2 (~17)", "The most injury-prone RB in football per the models (7+ injuries in 4 seasons), coach McDaniel gone, Waddle traded, QB room a mess, Vegas bottom-4 offense. The clearest early-round fade on the board — four independent outlets agree."],
  ["Jonathan Taylor's TDs", "RB · IND", "Rd 1 (~8)", "Not a full fade — the volume is elite. But 20 TDs on 14.4 expected: 11 of 13 backs who hit 18+ rushing TDs lost ~12 the next year (Taylor himself went 18→4 once). Round 1 yes, top-5 no."],
  ["Malik Nabers", "WR · NYG", "Rd 2–3 (~24)", "ACL + a second scar-tissue surgery this spring; five ESPN analysts independently called bust. Camp reports flipped positive in the last two weeks, so this one's genuinely contested — treat him as an upside WR2, not a locked WR1."],
  ["Rashee Rice", "WR · KC", "Rd 3 (~27)", "No new suspension expected — but one healthy season in three, May knee surgery, and 9.8 PPG vs good defenses. WR1 price for a WR2 risk profile."],
  ["Davante Adams", "WR · LAR", "Rd 5 (~52)", "Turns 34 in December; 15 TDs drove 38% of his points on a career-low 53% catch rate. Four outlets flag the same thing: the TDs don't repeat."],
  ["Bucky Irving", "RB · TB", "Rd 5 (~55)", "Tampa built a genuine three-man committee (Gainwell, Tucker) and his final six 2025 games collapsed to 3.4 YPC. The elite O-line keeps him relevant; the price assumes a role he may not have."],
  ["Mike Evans", "WR · SF", "Rd 5 (~49)", "The target vacuum is real (Pearsall out for the year) — but only two WRs since 2015 have finished top-25 at age 33+, and his low-YAC game is the opposite of what Shanahan's scheme rewards. Contested: BDGE loves him here. Fine price, capped ceiling."],
  ["TreVeyon Henderson", "RB · NE", "Rd 5 (~57)", "Stevenson outsnapped him in 15 of 18 games. Explosive, but the price assumes a takeover the Patriots haven't signaled."],
  ["Harold Fannin Jr.", "TE · CLE", "TE6 (~102)", "Small-sample 2025 magic, TE-friendly coach gone, two rookie WRs added, QB chaos. Four ESPN analysts flagged him — the most overdrafted TE on the board."],
  ["Travis Kelce", "TE · KC", "TE10 (~123)", "Turns 37, two straight years of declining per-route numbers, and his value is hostage to Mahomes' surgically repaired knee. The name costs more than the player."],
  ["Alec Pierce", "WR · IND", "Rd 8 (~91)", "Ankle surgery + a second PRP injection + no return timetable. PFF says avoid outright. His ADP jumped 22 spots the wrong way this month."],
  ["Jonathon Brooks", "RB · CAR", "Rd 7 (~79)", "ADP rocketed up 50 spots on health buzz — for a back with 9 career carries and two ACL tears, behind an entrenched starter. Classic hype spiral."],
  ["Matthew Stafford's 46 TDs", "QB · LAR", "QB9 (~109)", "More TDs in 2025 than the prior two years combined, at age 38. Base rates say ~30 this year. Fine as a QB2; ESPN drafters beware — his ADP runs two rounds hotter there."],
  ["Miami's passing game", "MIA", "—", "New coach, new scheme, unsettled QB (Willis/Ewers), bottom-tier O-line, Vegas's 4th-worst offense. Achane is the only Dolphin worth rostering, and even he's a fade at cost."],
  ["Arizona's pass-catchers at cost", "ARI", "—", "Vegas: bottom-2 offense (18.4 implied PPG), QB is Brissett/Minshew, hardest schedule in football. Three Cardinals go in the top-100 (McBride, Harrison, Love) — \"at least one expensive wrong answer in this offense, if not more.\""],
];

const OVERBLOWN: [string, string, string, string][] = [
  ["Justin Jefferson", "WR · MIN", "\"He was WR25 last year\"", "141 targets with the league's worst TD luck (2 scored vs 8 expected) and a QB carousel that threw 17 TD / 21 INT. Kyler fixes the input. Buy everywhere."],
  ["Kyren Williams", "RB · LAR", "\"Blake Corum is coming\"", "RB7/RB7/RB9 three straight years and 66% of the Rams' red-zone work. The split fear is exactly why he's a discount."],
  ["Terry McLaurin", "WR · WAS", "\"He cratered in 2025\"", "That was a contract holdout + only 3 games with a healthy Jayden Daniels. The model that called his down year now projects the bounce-back."],
  ["Daniel Jones", "QB · IND", "\"Achilles\"", "Fully cleared, zero camp limitations, ADP rising — the rare Achilles recovery that's actually clean. Stabilizes Taylor too."],
  ["Bo Nix", "QB · DEN", "\"Prove it (again)\"", "QB7 in back-to-back seasons, best O-line in football, and they traded a 1st for Waddle. Priced QB14."],
  ["Zay Flowers", "WR · BAL", "\"Henry owns the goal line\"", "Half true (11 catches inside the 10 in two years vs Henry's 71 carries) — but he also had the 2nd-fewest TDs of any 1,200-yard WR since 2011. At his current 3rd-round price both stories are fine; just don't pay the WR12 sticker."],
];

export function AvoidPanel({ noob }: { noob: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="The risk board" title="Every one of these players is fine at a discount. None at full price.">
        Names below appear on three or more independent expert bust lists (ESPN's 10-analyst panel, CBS, RotoWire,
        FantasyPros, PFF, 4for4) or carry a live legal/injury situation. "Avoid" means at current cost — if a faller
        lands two rounds late, the math changes.
      </Intro>

      <Noob show={noob} title="Why avoid good players?">
        Because you don't draft players — you draft <i>prices</i>. A star with a pending suspension, a 30-year-old RB
        coming off 450 touches, or a guy whose TDs were luck-driven costs a 2nd-round pick but returns 5th-round
        production if the risk hits. In a $2,000 league, dodging one landmine is worth more than nailing one sleeper.
      </Noob>

      <Card>
        <Eyebrow>The two live legal situations</Eyebrow>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-md border border-avoid/25 bg-avoid/6 p-4">
            <h3 className="display m-0 text-[1.25rem] text-ink">Puka Nacua · WR · LAR</h3>
            <p className="mt-1.5 mb-0 text-[0.93rem] text-ink-2">
              Check the current NFL conduct ruling and groin-injury report before paying an early-round price.
              His production when active is valuable, but the duration of any absence remains uncertain.
              Compare healthy alternatives and the depth needed to cover missed games.
            </p>
          </div>
          <div className="rounded-md border border-avoid/25 bg-avoid/6 p-4">
            <h3 className="display m-0 text-[1.25rem] text-ink">Josh Jacobs · RB · GB</h3>
            <p className="mt-1.5 mb-0 text-[0.93rem] text-ink-2">
              Placed on the commissioner’s exempt list August 30. He cannot play while that designation remains,
              and Green Bay has given no confirmed return date. Treat an early pick as a substantial availability
              risk. Compare MarShawn Lloyd and Kaleb Johnson’s current roles and prices for exposure to this backfield.
            </p>
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-line px-5 py-4"><Eyebrow className="mb-0">Consensus fades at current price</Eyebrow></div>
        <Tbl
          head={[
            "Player",
            <span key="price" className="inline-flex items-center gap-1.5">
              Price
              <Info tip="What he currently costs (round and overall ADP). 'Avoid' always means at THIS price — if he falls two rounds past it, the math changes." />
            </span>,
            "Why the experts are out",
          ]}
        >
          {FADES.map(([name, sub, price, why]) => (
            <tr key={name}>
              <td><PCell name={name} sub={sub} /></td>
              <td className="num">{price}</td>
              <td className="note">{why}</td>
            </tr>
          ))}
        </Tbl>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-line px-5 py-4"><Eyebrow className="mb-0">Overblown fears — the market is scared, you shouldn't be</Eyebrow></div>
        <Tbl head={["Player", "The fear", "Why it's priced in"]}>
          {OVERBLOWN.map(([name, sub, fear, why]) => (
            <tr key={name}>
              <td><PCell name={name} sub={sub} /></td>
              <td className="note">{fear}</td>
              <td className="note">{why}</td>
            </tr>
          ))}
        </Tbl>
      </Card>
    </div>
  );
}
