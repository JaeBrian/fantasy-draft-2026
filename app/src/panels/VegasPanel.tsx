import { Card, Eyebrow, Intro, KV, Noob } from "../components/ui";
import { VEGAS } from "../data";

function Bars() {
  return (
    <div className="flex flex-col gap-1">
      {VEGAS.map(([team, ppg, playoff]) => {
        const w = Math.max(3, ((ppg - 17) / 10.5) * 100);
        const hot = ppg >= 25.5;
        return (
          <div
            key={team}
            className="grid grid-cols-[130px_1fr_52px] items-center gap-2.5 rounded px-1 py-0.5 hover:bg-raised"
            title={`Weeks 15–17 implied total: ${playoff.toFixed(1)} pts`}
          >
            <span className={`truncate text-[0.87rem] font-semibold ${hot ? "text-ink" : "text-ink-2"}`}>{team}</span>
            <span className="relative h-3.5 overflow-hidden rounded-sm bg-line-soft">
              <span
                className="absolute inset-y-0 left-0 rounded-r-sm bg-gradient-to-r from-clock-deep to-clock"
                style={{ width: `${w.toFixed(1)}%`, opacity: hot ? 1 : 0.55 }}
              />
            </span>
            <span className={`text-right font-mono text-[0.8rem] tabular-nums ${hot ? "font-semibold text-ink" : "text-ink-2"}`}>
              {ppg.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ANGLES: [string, string][] = [
  ["Bills pass-catchers are free.", "Vegas: #2 offense. ADP: Allen and Cook only. DJ Moore at a WR27 price in a 26-point offense is the gap."],
  ["The Cardinals tax.", "Three ARI players in the top 100 on a bottom-2 implied offense. At least one is an expensive mistake."],
  ["Jefferson's props are stale.", "+1400 to lead receiving yards, priced before the Kyler news fully landed. Same mispricing shows in his ADP."],
  ["KC's run game rebuilt.", "Team total is mid-pack, but they paid Walker III bellcow money to fix a 25th-ranked run game with Mahomes back. The market's still anchored on \"boring Chiefs backfield.\""],
  ["Broncos regression, Chiefs bounce-back.", "Denver's win total drops ~4 off an 11-one-score-win fluke season; KC is priced for the league's biggest rebound. Adjust your game-script assumptions accordingly."],
];

export function VegasPanel({ noob }: { noob: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="What the money says" title="The betting market is the sharpest forecast available. Read it before you draft.">
        Betting lines are the sharpest public forecast of team scoring that exists. Draft players from offenses the
        market expects to score, and use season props as a volume signal — directionally, not literally.
      </Intro>

      <Noob show={noob} title="How to read this:">
        "implied points per game" is how much Vegas expects each team to score, worked out from win totals and point
        spreads. More team points = more touchdowns for your players. The Weeks 15–17 column matters because that's when
        fantasy playoffs (and your $2,000) are decided.
      </Noob>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>Implied points per game, all 32 offenses (Aug 11 lines)</Eyebrow>
          <Bars />
          <div className="mt-2 text-[0.8rem] text-ink-3">
            Source: Sharp Football Analysis implied team totals from DraftKings lines. Hover a row for the team's Weeks
            15–17 implied total.
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <Eyebrow>Fantasy playoff weeks (15–17)</Eyebrow>
            <KV
              rows={[
                [<span className="text-value">Spike ↑</span>, <><b className="text-ink">Cowboys</b> (77.6 implied pts over 3 weeks, three dome games — best playoff profile in football: Lamb, Pickens, Dak, Ferguson), <b className="text-ink">Bills</b> &amp; <b className="text-ink">Bengals</b> (79.0 each), <b className="text-ink">Rams</b>, <b className="text-ink">Lions</b> (easiest RB slate wire-to-wire — Gibbs).</>],
                [<span className="text-avoid">Sag ↓</span>, <><b className="text-ink">Eagles</b> — the biggest playoff fade in the league (64.5 implied over Wks 15–17 vs a top-10 season pace; slate: SEA, HOU, at SF). Dings Hurts, Barkley, DeVonta at the margin. Also depressed: <b className="text-ink">49ers</b> (67.8), <b className="text-ink">Seahawks</b>, <b className="text-ink">Texans</b> (60.8).</>],
              ]}
            />
          </Card>
          <Card>
            <Eyebrow>Five market angles the draft room is missing</Eyebrow>
            <ol className="m-0 list-none p-0">
              {ANGLES.map(([head, body], i) => (
                <li key={i} className="grid grid-cols-[36px_1fr] gap-x-3 border-b border-line-soft py-3 last:border-0">
                  <span className="display row-span-2 flex h-8 w-8 items-center justify-center rounded border border-line bg-raised text-[1.05rem] font-semibold text-clock">
                    {i + 1}
                  </span>
                  <b className="col-start-2 text-ink">{head}</b>
                  <span className="col-start-2 text-[0.92rem] text-ink-2">{body}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <Eyebrow>Prop nuggets worth knowing</Eyebrow>
            <KV
              rows={[
                ["Puka Nacua", "107.5 receptions line — the market expects huge target volume (suspension ruling aside)."],
                ["Tyler Warren", "74.5 receptions — elite-TE volume, round-6 price."],
                ["Jahmyr Gibbs", "OPOY favorite (+750) and rushing-TD co-favorite. The market's 1.01."],
                ["Rushing yards favs", "Taylor and Henry +600, Cook +650, Gibbs/Bijan +700 — the top of your draft in one prop board."],
                ["James Cook", "30.5 receptions line — Vegas doubts the new-OC passing-role story. Half-PPR softens the blow."],
                ["Passing yards", "Burrow 7/1 favorite (stack with Chase); Allen 22/1 — Vegas sees him as a points machine, not a yardage machine."],
              ]}
            />
          </Card>
        </div>
      </div>

      <Card>
        <Eyebrow>Win totals, quick scan</Eyebrow>
        <p className="my-0 text-[0.93rem] text-ink-2">
          <b className="text-ink">11.5 wins:</b> Rams, Ravens &nbsp;·&nbsp; <b className="text-ink">10.5:</b> Bills, Seahawks, Lions,
          Eagles, Chiefs, 49ers, Patriots &nbsp;·&nbsp; <b className="text-ink">9.5:</b> Packers, Texans, Broncos, Chargers,
          Bears, Bengals, Cowboys &nbsp;·&nbsp; <b className="text-ink">8.5:</b> Jaguars, Bucs, Steelers, Vikings &nbsp;·&nbsp;{" "}
          <b className="text-ink">7.5:</b> Giants, Saints, Panthers, Commanders, Colts &nbsp;·&nbsp; <b className="text-ink">6.5:</b>{" "}
          Titans, Falcons, Browns &nbsp;·&nbsp; <b className="text-ink">5.5:</b> Raiders, Jets &nbsp;·&nbsp;{" "}
          <b className="text-ink">4.5:</b> Cardinals, Dolphins. Super Bowl favorite: Rams +500. Reigning champs: Seahawks (beat
          the Patriots 29–13 in LX).
        </p>
      </Card>
    </div>
  );
}
