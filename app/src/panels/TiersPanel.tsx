import { P, PT, BYE, type Pos } from "../data";
import type { DraftState } from "../lib/advisor";
import { Call, Card, Eyebrow, InjChip, Intro, Noob, SleeperMark, Sticker, TagChips, TeamIcon, TrendChip } from "../components/ui";

const POS_NAMES: Record<string, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
};

export function TiersPanel({ noob, DS }: { noob: boolean; DS: DraftState }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="Tier lists" title="Draft tiers, not ranks">
        Inside a tier, the players are close enough that need and preference should decide. Between tiers there's a real
        drop. The move that wins drafts: when a tier is down to its last player, take him — even a little early.
      </Intro>

      <div className="flex items-center gap-1.5 text-[0.75rem] text-ink-3">
        <SleeperMark size={13} />
        Injury tags and 🔥/🧊 waiver heat beside each name are live from Sleeper, refreshed daily.
      </div>

      <Noob show={noob} title="Example:">
        it's your pick and RB Tier 2 has one player left but WR Tier 2 has five. Take the RB — some of those WRs will
        still be there on the way back. That's "playing the tiers."
      </Noob>

      <div className="flex flex-col gap-4">
        {(["RB", "WR", "QB", "TE"] as Pos[]).map((pos) => (
          <div key={pos} className="flex flex-col gap-4">
            <h3 className="display mt-2 mb-0 text-[1.6rem] text-ink">{POS_NAMES[pos]}</h3>
            {Object.entries(PT[pos]).map(([tn, [tname, trange]]) => {
              const players = P.map((r, i) => ({ r, i })).filter(
                (o) => o.r[1] === pos && String(o.r[6]) === tn
              );
              if (!players.length) return null;
              return (
                <div key={tn} className="card overflow-hidden">
                  <div className="flex flex-wrap items-baseline gap-2.5 border-b border-line bg-raised px-4 py-2.5">
                    <Sticker pos={pos} />
                    <span className="display text-[1.05rem] font-semibold uppercase tracking-wide text-ink">
                      Tier {tn} — {tname}
                    </span>
                    <span className="text-[0.83rem] text-ink-3">{trange}</span>
                  </div>
                  <ul className="m-0 list-none p-0 py-1">
                    {players.map((o) => {
                      const [n, , t, adp, v, , , note, tags] = o.r;
                      return (
                        <li
                          key={n}
                          className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b border-line-soft px-4 py-2 last:border-0 hover:bg-raised ${DS[n] ?? ""}`}
                        >
                          <span className="min-w-[2.4ch] font-mono text-[0.78rem] text-ink-3 tabular-nums">{o.i + 1}</span>
                          <TeamIcon team={t} size={16} />
                          <span className="nm font-semibold text-ink">{n}</span>
                          <InjChip name={n} />
                          <TrendChip name={n} />
                          <span className="font-mono text-[0.75rem] text-ink-3">
                            {t} · bye {BYE[t] ?? "—"} · ADP {adp.toFixed(0)}
                          </span>
                          <Call v={v} explain />
                          <TagChips tags={tags} />
                          <span className="basis-full pl-[calc(2.4ch+10px)] text-[0.87rem] text-ink-2">{note}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>Kickers — round 15 only</Eyebrow>
          <p className="my-0 text-[0.93rem] text-ink-2">
            <b className="text-ink">1. Brandon Aubrey (DAL)</b> — three straight top-3 finishes, dome playoff slate ·{" "}
            <b className="text-ink">2. Ka'imi Fairbairn (HOU)</b> · <b className="text-ink">3. Cameron Dicker (LAC)</b> ·{" "}
            <b className="text-ink">4. Chris Boswell (PIT)</b> · <b className="text-ink">5. Jason Myers (SEA)</b> — league-high 41
            FGs last year · then Little (JAX), McPherson (CIN), Bates (DET), Reichard (MIN), Butker (KC).
          </p>
        </Card>
        <Card>
          <Eyebrow>Defenses — round 14 only</Eyebrow>
          <p className="my-0 text-[0.93rem] text-ink-2">
            <b className="text-ink">1. Seahawks</b> — league-low 17.2 PPG allowed in 2025 · <b className="text-ink">2. Texans</b> —
            top-5 two straight years · <b className="text-ink">3. Rams</b> — added Myles Garrett ·{" "}
            <b className="text-ink">4. Steelers</b> · <b className="text-ink">5. Vikings</b>. The Broncos grade top-5 on talent but
            open with a brutal schedule — skip them early and stream instead. <b className="text-ink">Week 1 streamers:</b>{" "}
            Chargers (vs ARI — the best opening DST schedule in football), Jaguars (vs CLE), Steelers (vs ATL).
          </p>
        </Card>
      </div>
    </div>
  );
}
