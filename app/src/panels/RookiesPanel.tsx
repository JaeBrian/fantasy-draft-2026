import type { ReactNode } from "react";
import { Card, Eyebrow, Info, Intro, Noob, Call } from "../components/ui";
import type { Verdict } from "../data";

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

const ROOKIES: [Verdict, string, string, string, string, string][] = [
  ["buy", "LEAGUE-WINNER", "Jeremiyah Love", "RB · ARI · #3 overall pick", "Rd 3", "Highest-drafted RB since Saquon; James Conner's ankle has \"no timeline\" and Love already won the passing-down role. Two real warts: a fresh high-ankle sprain (Week 1 in doubt) and Vegas's 2nd-worst offense. If he slips past his ADP because of the ankle — pounce. At full price, he's a faith pick."],
  ["solid", "SAFEST BET", "Carnell Tate", "WR · TEN · #4 overall pick", "Rd 5–6", "Instant WR1 for Cam Ward; GM called him the best receiver in the class; zero drops his final college year. High floor, modest ceiling in a bottom-tier offense."],
  ["buy", "FREE MONEY", "Denzel Boston", "WR · CLE · Rd 2", "Rd 12+", "The camp riser of the summer — promoted to Cleveland's first team, \"no Browns WR has been better in camp.\" Costs nothing; could be their WR1 by October. QB situation is the cap."],
  ["solid", "RUNWAY BET", "Jadarian Price", "RB · SEA · Rd 1 (32nd)", "Rd 6", "\"Prime Dalvin Cook\" burst comps; Walker left for KC and Charbonnet's rehabbing an ACL. He just returned from a month-long leg injury — ramp-up risk is real, runway is enormous."],
  ["risk", "STASH ONLY", "Jordyn Tyson", "WR · NO · Rd 1 (8th)", "Rd 13+", "Elite 35% college target share, clear #2 role behind Olave — but a hamstring has him out until ~October. Only draftable as a late-round stash at a crashed price."],
  ["solid", "LATE DARTS", "Makai Lemon (PHI) · Zachariah Branch (ATL) · Kaytron Allen (WAS) · De'Zhaun Stribling (SF) · Omar Cooper Jr. (NYJ)", "", "Rd 13+", "Each has a real path (Lemon = Eagles WR2 if healthy; Branch = first-team reps in ATL; Allen = more talented than Washington's incumbents; Stribling = SF's decimated room; Cooper = risk fully priced in). One late pick on this pile is smart; two is greedy."],
  ["avoid", "SKIP", "Fernando Mendoza (QB LV) · Kenyon Sadiq (TE NYJ) · KC Concepcion (WR CLE) · Eli Stowers (TE PHI)", "", "—", "Mendoza sits behind Cousins; Sadiq (hernia setback) is buried in a crowded, low-scoring passing game; Concepcion loses the camp battle to Boston; Stowers sits behind Goedert. Waiver-wire names, not draft picks."],
];

const SOPHOMORES: [string, string, string, string][] = [
  ["Emeka Egbuka", "WR · TB", "Rd 3", "Mike Evans left → clear alpha. New OC Zac Robinson did this exact trick for Drake London (moved him around, catches exploded). The consensus \"this year's JSN\" pick."],
  ["Colston Loveland", "TE · CHI", "Rd 4", "\"Unguardable in camp.\" Second-best TE in football over the final 10 weeks of 2025, now in Ben Johnson's TE-friendly offense. Top-2 TE upside at a TE3 price."],
  ["Tyler Warren", "TE · IND", "Rd 5–6", "106 targets as a rookie, Pro Bowl, Pittman traded away, and Vegas set his reception line at 74.5 — that's elite-TE volume priced two rounds late."],
  ["Ashton Jeanty", "RB · LV", "Rd 1–2 turn", "Rookie year was inefficient (3.7 YPC) but still top-15 on volume. New coach, bigger passing role. The catch: Vegas rates the Raiders offense worst in football — fine at 15–18, a reach at 10–12."],
  ["Quinshon Judkins", "RB · CLE", "Rd 5", "\"Looked 100%\" after the ankle; locked-in starter with goal-line work. League-worst O-line caps the ceiling; half-PPR helps the floor."],
  ["Cam Skattebo", "RB · NYG", "Rd 4", "Fully recovered, leading the backfield in camp, and John Harbaugh wants to run the ball. Goal-line battering ram."],
  ["Luther Burden III", "WR · CHI", "Rd 4–5", "The \"next Amon-Ra\" narrative is real (Ben Johnson slot role) — but the Aug 8 groin strain puts Week 1 in doubt. Take the injury discount, don't pay full sticker."],
  ["Tetairoa McMillan", "WR · CAR", "Rd 4", "122 targets as a rookie, outscored Egbuka, ascending offense. Quietly the safer of the two sophomore alphas — Egbuka just has the louder ceiling story."],
];

export function RookiesPanel({ noob }: { noob: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="The 2026 class" title="One league-winner, one safe bet, and a bargain bin of camp risers">
        Only 13 RBs were drafted in the entire 2026 class — historically thin. The real rookie juice this year is two
        top-5 picks and a handful of nearly-free receivers winning jobs in camp right now. (History says round-1 rookies
        hit ~50–70% of the time; day-3 picks almost never do.)
      </Intro>

      <Noob show={noob} title="Rookie vs. sophomore:">
        "rookies" are 2026 draftees playing their first NFL season. The hyped young guys you've heard all summer (Jeanty,
        Egbuka, Tyler Warren, Loveland) are mostly <i>second-year</i> players — they're on the Draft board, and the best of
        them are in the second card below.
      </Noob>

      <Card className="!p-0">
        <div className="border-b border-line px-5 py-4"><Eyebrow className="mb-0">True 2026 rookies — draft board</Eyebrow></div>
        <Tbl
          head={[
            "Tier",
            "Player",
            <span key="cost" className="inline-flex items-center gap-1.5">
              Cost
              <Info tip="The draft round he currently costs (his ADP). Pay it only if the case next to it still holds on draft day." />
            </span>,
            "The case",
          ]}
        >
          {ROOKIES.map(([v, label, name, sub, cost, why]) => (
            <tr key={name}>
              <td><Call v={v} label={label} /></td>
              <td><PCell name={name} sub={sub || undefined} /></td>
              <td className="num">{cost}</td>
              <td className="note">{why}</td>
            </tr>
          ))}
        </Tbl>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-line px-5 py-4"><Eyebrow className="mb-0">The sophomore leap — 2025 draftees primed to break out</Eyebrow></div>
        <Tbl
          head={[
            "Player",
            <span key="cost" className="inline-flex items-center gap-1.5">
              Cost
              <Info tip="The draft round he currently costs (his ADP)." />
            </span>,
            "Why this is the year",
          ]}
        >
          {SOPHOMORES.map(([name, sub, cost, why]) => (
            <tr key={name}>
              <td><PCell name={name} sub={sub} /></td>
              <td className="num">{cost}</td>
              <td className="note">{why}</td>
            </tr>
          ))}
        </Tbl>
      </Card>
    </div>
  );
}
