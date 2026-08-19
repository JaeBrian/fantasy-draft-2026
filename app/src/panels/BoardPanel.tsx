import { useEffect, useRef, useState, type ReactNode } from "react";
import { P, OT, BYE, DRAFT_ORDER, SIM_PLANS, TOOL_USERS, VEGAS, type Pos } from "../data";
import { snapTeam } from "../lib/advisor";
import { advise, needText, rosterSlots, PLAINPOS, PLAINSHORT, type DraftState } from "../lib/advisor";
import { fillToMyTurn, gradeDraft } from "../lib/mock";
import { usePersistent } from "../lib/store";
import { SLP } from "../sleeper";
import { CEIL } from "../ceilings";
import { valueOf, valueTier } from "../lib/value";
import { runForecast, type Forecast } from "../lib/forecast";
import { getPins, setPin, togglePin, parseIntel, pinnedPick } from "../lib/intel";

type SleeperPick = { pick_no: number; draft_slot: number; metadata?: { first_name?: string; last_name?: string; team?: string } };
const normName = (s: string) =>
  s.toLowerCase().replace(/[.'-]/g, " ").replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/\s+/g, " ").trim();
import { Call, Chevrons, Info, InjChip, NewsChip, Noob, SleeperMark, Sticker, TagChips, TeamIcon, TrendChip } from "../components/ui";
import { RB_LEAN, rbLean, setRbLean, type RbLean } from "../lib/tendency";

const NICKOF: Record<string, string> = {
  LAR: "Rams", BUF: "Bills", DET: "Lions", CIN: "Bengals", BAL: "Ravens", DAL: "Cowboys",
  SF: "49ers", GB: "Packers", SEA: "Seahawks", CHI: "Bears", KC: "Chiefs", LAC: "Chargers",
  NE: "Patriots", PHI: "Eagles", JAX: "Jaguars", WAS: "Commanders", IND: "Colts", TB: "Buccaneers",
  HOU: "Texans", MIN: "Vikings", DEN: "Broncos", NYG: "Giants", NO: "Saints", PIT: "Steelers",
  ATL: "Falcons", CAR: "Panthers", TEN: "Titans", LV: "Raiders", MIA: "Dolphins", CLE: "Browns",
  NYJ: "Jets", ARI: "Cardinals",
};

/** Overall pick 39 is round 4, pick 3 — which is how anyone at a draft actually says it. */
const roundPick = (overall: number): string => {
  const rd = Math.ceil(overall / 12);
  const inRd = overall - (rd - 1) * 12;
  return `${rd}.${String(inRd).padStart(2, "0")}`;
};

const POS_FILTERS: ("ALL" | Pos)[] = ["ALL", "QB", "RB", "WR", "TE"];

interface BoardProps {
  noob: boolean;
  DS: DraftState;
  ord: string[];
  mark: (name: string, want: "gone" | "mine") => void;
  undo: () => void;
  reset: () => void;
  applyRun: (names: string[]) => void;
  canUndo: boolean;
  mySlot: number;
  setMySlot: (n: number) => void;
}

function AdvisorStrip({ DS, mySlot, ord, noob, blocked, lean }: { DS: DraftState; mySlot: number; ord: string[]; noob: boolean; blocked: string[]; lean: RbLean }) {
  const a = advise(DS, mySlot, ord, new Set(blocked));

  /* Heavy forecast, recomputed every pick. You have a minute on the clock, so spend it: this
   * simulates the intervening picks rather than approximating them with a curve, which is the
   * only way to see a run that is coming because of what the other rooms still NEED rather
   * than because of what a list says. Chunked so the page stays usable while it runs. */
  const [fc, setFc] = useState<Forecast | null>(null);
  const [fcPct, setFcPct] = useState<number | null>(null);
  useEffect(() => {
    if (!mySlot) { setFc(null); return; }
    let stale = false;
    setFc(null);
    setFcPct(0);
    runForecast(DS, ord, mySlot, 5000, (d, t) => { if (!stale) setFcPct(Math.round((d / t) * 100)); })
      .then((r) => { if (!stale) { setFc(r); setFcPct(null); } });
    return () => { stale = true; };
  }, [DS, ord, mySlot, lean]);

  const made = Object.keys(DS).length;
  const [compact, setCompact] = usePersistent<boolean>(
    "fd26-adv-compact",
    false,
    (raw) => raw === "1",
    (v) => (v ? "1" : "0")
  );
  /* on the clock the full detail always shows — compact is for the waiting stretches */
  const showFull = !compact || a.onClock;

  const next: Partial<Record<Pos, { n: string; i: number }>> = {};
  P.forEach((r, i) => {
    if (!DS[r[0]] && !next[r[1]]) next[r[1]] = { n: r[0], i };
  });

  const waiting = !a.onClock && a.nextPick !== null && a.myCount < 14;
  /* one-phrase reason for the 2nd/3rd choices */
  const shortWhy = (c: (typeof a.cands)[number]) =>
    c.cuffOf ? `handcuffs your ${c.cuffOf}`
    : c.cliff ? `last of ${c.p} Tier ${c.tier}`
    : c.fell >= 6 ? `slid ${c.fell} past his ADP`
    : c.gap >= 1.5 ? `${c.p} cliff right behind him`
    : needText(c.p, a);
  const reachCls = (n: number) =>
    `rounded border px-1.5 py-0.5 font-mono text-[0.72rem] font-semibold ${
      n >= 70 ? "border-value/50 text-value" : n >= 40 ? "border-clock/50 text-clock" : "border-avoid/50 text-avoid"
    }`;
  let suggestion: { list: typeof a.cands; why: ReactNode } | null = null;
  let special: string | null = null;
  let plain: ReactNode = null;
  if (a.myCount >= 16) special = "Roster complete.";
  else if (a.myCount >= 14) {
    special =
      a.myCount === 14
        ? "Take your defense — best remaining of Seahawks / Texans / Rams / Steelers. (K and DST always go with your last two picks.)"
        : "Take your kicker — best remaining of Aubrey / Fairbairn / Dicker / Boswell. (K and DST always go with your last two picks.)";
    plain = <>You're almost done! Use your last picks on a kicker and a defense — the ones suggested here are all fine. Click <b>Pick</b> next to a name when you take someone.</>;
  } else if (a.cands.length) {
    const t = a.cands[0];
    /* one readable sentence: what he fills, plus at most two supporting reasons */
    const clauses: string[] = [];
    clauses.push(t.cuffOf ? `he's the handcuff to your ${t.cuffOf} — season insurance` : needText(t.p, a));
    const liveInj = SLP[t.now.r[0]]?.inj;
    if (liveInj && liveInj !== "Q") clauses.push(`heads-up: Sleeper lists him ${liveInj === "O" ? "OUT" : liveInj} right now`);
    if (!waiting && t.pGone >= 0.5)
      clauses.push(`pass now and there's only a ~${Math.max(1, Math.round((1 - t.pGone) * 100))}% chance he's back at your next turn`);
    else if (t.cliff) clauses.push(`he's the last of ${t.p} Tier ${t.tier} likely to survive`);
    else if (t.gap >= 2.0) clauses.push(`waiting a round costs ~${t.gap.toFixed(1)} pts/wk at ${t.p}`);
    else if (t.gap >= 0.9) clauses.push(`the ${t.p} shelf thins before your next turn`);
    if (t.fell >= 6) clauses.push(`he's slid ${t.fell} picks past his market ADP — free value`);
    else if (a.run === t.p) clauses.push(`a ${t.p} run is on`);
    else if (t.stack) clauses.push(`stacks with your ${t.p === "QB" ? "pass-catcher" : "QB"}`);
    const whyText = clauses.slice(0, 3).join("; ");
    suggestion = {
      list: a.cands.slice(0, 3),
      why: (
        <>
          {whyText.charAt(0).toUpperCase() + whyText.slice(1)}.
          {t.antiStack && (
            <span className="text-risky"> Note: he'd compete for targets with your {t.now.r[2]} pass-catcher.</span>
          )}
          {t.clash && (
            <span className="text-risky"> <b>Bye clash:</b> Week {t.bye} already takes {a.byeCount[t.bye!]} of your starters — that week you field an incomplete lineup, which costs you the week rather than lowering an average.</span>
          )}
        </>
      ),
    };
    plain = waiting ? (
      <>
        It's not your turn yet — your next pick is <b>#{a.nextPick}</b> ({a.nextPick! - a.cur} picks away). Click{" "}
        <b>Taken</b> for each player other teams draft. When your turn comes, aim for <b>{t.now.r[0]}</b>, the best{" "}
        {PLAINPOS[t.p]} likely to still be there (~{Math.round(t.pReach * 100)}% chance).
        {a.cands.length > 1 && <> If he's gone, next in line: {a.cands.slice(1, 3).map((c) => c.now.r[0]).join(", then ")}.</>}
        {a.plainWarn.length > 0 && <> Also: {a.plainWarn.join("; ")}.</>}
      </>
    ) : (
      <>
        {t.cuffOf ? (
          <>Take <b>{t.now.r[0]}</b>. He's the backup to your star {t.cuffOf} — if {t.cuffOf} gets hurt, this pick takes over his job. Think of it as insurance.</>
        ) : t.tied && a.cands[1]?.tied ? (
          <>
            This one's <b>too close to call</b>: <b>{t.now.r[0]}</b> ({PLAINPOS[t.p]}) and{" "}
            <b>{a.cands[1].now.r[0]}</b> ({PLAINPOS[a.cands[1].p]}) score within a fraction of a point of each other, which
            is well inside what this model can actually tell apart. Take whichever you'd rather own — there is no wrong
            answer here, and anyone who says otherwise is guessing.
            {a.cands[1].proj > t.proj + 0.4 && (
              <> If you want a tiebreaker: {a.cands[1].now.r[0]} is projected for slightly more points, while{" "}
              {t.now.r[0]} is the scarcer position.</>
            )}
          </>
        ) : (
          <>
            Take <b>{t.now.r[0]}</b>. He's the best {PLAINPOS[t.p]} still available
            {t.pGone >= 0.5
              ? ", and if you pass, he'll almost certainly be on someone else's team before your next turn"
              : t.gap >= 1.5
                ? `, and the ones left after this round are clearly worse — he's worth about ${Math.max(1, Math.round(t.gap))} extra points every week`
                : ""}
            .
          </>
        )}
        {t.clash && (
          <> One catch: he skips the same week (his "bye week" — every team gets one week off) as {a.byeCount[t.bye!]} of your players, so that week your bench will be thin.</>
        )}
        {a.cands.length > 1 && <> If someone just snagged him, take {a.cands[1].now.r[0]} instead.</>}
        {a.plainWarn.length > 0 && <> Also: {a.plainWarn.join("; ")}.</>}{" "}
        When it's your pick, hit <b>Pick</b> next to his name; when anyone else drafts, hit <b>Taken</b> next to theirs.
      </>
    );
  }

  const slots = rosterSlots(DS);

  return (
    <div
      className={`card sticky top-[calc(var(--hdr,86px)+6px)] z-30 max-h-[calc(100vh-var(--hdr,86px)-20px)] overflow-y-auto overscroll-contain transition-shadow min-[1200px]:static min-[1200px]:max-h-none min-[1200px]:overflow-visible ${
        a.onClock ? "border-clock/60 shadow-[0_0_0_1px_var(--color-clock),0_0_24px_-6px_rgba(240,180,41,0.45)]" : "shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft px-4 py-2 text-[0.85rem] text-ink-2">
        {a.onClock && (
          <span className="display rounded-sm bg-clock px-2 py-0.5 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-[#171204]">
            You're on the clock
          </span>
        )}
        <span>
          <b className="font-mono text-ink tabular-nums">{made}</b> of {P.length} drafted
        </span>
        <span className="font-mono tabular-nums">
          Round {Math.min(16, Math.ceil(a.cur / 12))} · pick {a.cur}
          {a.cur <= 192 && (
            <span className="text-ink-3"> · {DRAFT_ORDER[snapTeam(a.cur) - 1]}{a.onClock ? " (you)" : ""}</span>
          )}
        </span>
        {mySlot >= 1 && a.nextPick && !a.onClock && (
          <span className="font-mono tabular-nums">
            your next pick: #{a.nextPick} ({a.nextPick - a.cur} away)
          </span>
        )}
        <span className="ml-auto hidden gap-3 text-[0.8rem] text-ink-3 md:flex min-[1200px]:hidden">
          {(["RB", "WR", "QB", "TE"] as Pos[]).map((p) => (
            <span key={p}>
              {p}: {next[p] ? <b className="font-medium text-ink-2">{next[p]!.n}</b> : "—"}
              {next[p] && <span className="font-mono"> #{next[p]!.i + 1}</span>}
            </span>
          ))}
        </span>
        <button
          type="button"
          className="btn !px-2.5 !py-0.5 !text-[0.72rem]"
          onClick={() => setCompact(!compact)}
          title={compact ? "Show the full advisor detail" : "Shrink the advisor to one line while you wait"}
        >
          {compact ? "Full view" : "Compact"}
        </button>
      </div>

      <div className="px-4 py-3">
        {special && <div className="text-[0.95rem] text-ink"><b>Take:</b> {special}</div>}
        {suggestion && !showFull && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.95rem]">
            {suggestion.list.map((c, idx) => (
              <span key={c.now.r[0]}>
                <span className="font-mono text-[0.8rem] text-ink-3">{idx + 1}</span>{" "}
                <b className={idx === 0 ? "text-ink" : "text-ink-2"}>{c.now.r[0]}</b>{" "}
                <span className="text-[0.8rem] text-ink-3">
                  {c.p}
                  {waiting && c.pReach < 0.995 ? ` · ${Math.round(c.pReach * 100)}%` : ""}
                </span>
              </span>
            ))}
          </div>
        )}
        {suggestion && showFull && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="display text-[0.92rem] uppercase tracking-[0.14em] text-clock">
                {waiting ? `Your board for pick #${a.nextPick} — in order` : "Take — in order"}
              </span>
              {waiting && (
                <span className="text-[0.78rem] normal-case tracking-normal text-ink-3">
                  value × odds he's still there — when you're on the clock this re-ranks with what's actually left
                </span>
              )}
            </div>
            {suggestion.list.map((c, idx) => (
              <div key={c.now.r[0]} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="w-5 text-right font-mono text-[0.85rem] text-ink-3">{idx + 1}</span>
                <span
                  className={
                    idx === 0 ? "display text-[1.4rem] leading-none text-ink" : "text-[0.95rem] font-semibold text-ink"
                  }
                >
                  {c.now.r[0]} <TeamIcon team={c.now.r[2]} size={idx === 0 ? 20 : 15} />
                </span>
                <Sticker pos={c.p} />
                <span className="font-mono text-[0.75rem] text-ink-3">#{c.now.i + 1}</span>
                <InjChip name={c.now.r[0]} />
                {c.tied && (
                  <span
                    className="rounded-sm border border-clock/40 px-1 py-px font-mono text-[0.66rem] uppercase tracking-wide text-clock"
                    title="Too close for the model to call — pick whichever you prefer"
                  >
                    too close to call
                  </span>
                )}
                {waiting && (() => {
                  /* simulated survival beats the analytic curve when we have it — same number,
                     measured against the actual rooms rather than a normal distribution */
                  const sim = fc?.survive[c.now.r[0]];
                  const pr = sim !== undefined ? sim : c.pReach;
                  if (pr >= 0.995) return null;
                  return (
                    <span className={reachCls(Math.round(pr * 100))} title={sim !== undefined ? `simulated across ${fc!.sims.toLocaleString()} drafts` : "estimated from ADP"}>
                      ~{Math.round(pr * 100)}% there{sim !== undefined ? "" : "*"}
                    </span>
                  );
                })()}
                {idx > 0 && (
                  <span className="text-[0.84rem] text-ink-3">
                    — {shortWhy(c)}
                    {c.clash && (
                      <span className="text-risky"> · same Week {c.bye} bye as {a.byeCount[c.bye!]} of yours</span>
                    )}
                  </span>
                )}
              </div>
            ))}
            <p className="m-0 max-w-[70ch] pl-7 text-[0.92rem] leading-relaxed text-ink-2">{suggestion.why}</p>
            {(() => {
              /* What the projection is made of, rather than just how big it is. A player who
                 wins you a week outright a third of the time is a different asset from one who
                 never does, even at the same average — and points from touchdowns are the least
                 repeatable thing in football, so a high share is a fragile projection. */
              const top = suggestion.list[0];
              if (!top) return null;
              const c = CEIL[top.now.r[0]];
              if (!c || c.games < 6) return null;
              const bits: string[] = [];
              bits.push(`wins you a week outright ${Math.round(c.boom * 100)}% of the time, disappears ${Math.round(c.bust * 100)}%`);
              bits.push(`a good week is ${c.p90.toFixed(0)} pts, a bad one ${c.p10.toFixed(0)}`);
              if (c.tdShare !== null && c.tdShare >= 0.3) bits.push(`${Math.round(c.tdShare * 100)}% of his points come from touchdowns — the part that regresses hardest`);
              else if (c.tdShare !== null && c.tdShare <= 0.22) bits.push(`only ${Math.round(c.tdShare * 100)}% from touchdowns, so it rests on volume rather than scoring luck`);
              if (c.touches) bits.push(`${c.touches} projected touches — opportunity is what a coach controls`);
              const vg = VEGAS.find(([t]) => t === NICKOF[top.now.r[2]]);
              if (vg) bits.push(`his offence is projected for ${vg[1].toFixed(1)} a game`);
              return (
                <p className="m-0 max-w-[70ch] pl-7 text-[0.84rem] leading-relaxed text-ink-3">
                  <b className="text-ink-2">{top.now.r[0]} in 2025:</b> {bits.join(" · ")}.
                </p>
              );
            })()}
            {(() => {
              /* Is this room drafting ahead of the market or behind it? Compare every pick
                 made to that player's ADP. It matters more than it sounds: if the room is
                 running three picks hot, every survival number ADP implies is optimistic, and
                 the players you are counting on will not reach you. */
              const diffs: number[] = [];
              ord.forEach((n, i) => {
                const ad = SLP[n]?.adp;
                if (ad !== undefined) diffs.push(ad - (i + 1));
              });
              if (diffs.length < 12) return null;
              const recent = diffs.slice(-24);
              const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
              if (Math.abs(avg) < 2.5) return null;
              return (
                <p className="m-0 max-w-[70ch] pl-7 text-[0.86rem] leading-relaxed text-ink-3">
                  <b className="text-ink-2">Room tempo:</b> the last {recent.length} picks have run{" "}
                  <b className={avg > 0 ? "text-avoid" : "text-value"}>
                    {Math.abs(avg).toFixed(1)} picks {avg > 0 ? "ahead of" : "behind"} ADP
                  </b>
                  {avg > 0
                    ? " — this room reaches, so anyone you are counting on will reach you less often than his ADP suggests."
                    : " — this room waits, so value is sliding further than usual. Be patient."}
                </p>
              );
            })()}
            {fcPct !== null && (
              <p className="m-0 max-w-[70ch] pl-7 text-[0.86rem] leading-relaxed text-ink-3">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-clock" />{" "}
                Simulating the next {a.nextPick && a.cur ? Math.max(0, a.nextPick - a.cur) : ""} picks
                against every rival roster… {fcPct}%
              </p>
            )}
            {fc && fc.room.length > 0 && (
              <details className="pl-7 text-[0.84rem]">
                <summary className="cursor-pointer text-ink-3 hover:text-ink-2">
                  Why — the {fc.room.length} {fc.room.length === 1 ? "team" : "teams"} picking before you
                </summary>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {fc.room.map((r) => (
                    <div key={r.pick} className="flex flex-wrap items-baseline gap-x-2 text-ink-3">
                      <span className="w-12 shrink-0 font-mono text-[0.76rem]">#{r.pick}</span>
                      <span className="w-28 shrink-0 truncate text-ink-2">{DRAFT_ORDER[r.team - 1] ?? `Team ${r.team}`}</span>
                      <span className="font-mono text-[0.76rem]">has {r.has}</span>
                      {r.needs.length > 0 && r.needs.length <= 2 && (
                        <span className="text-[0.76rem]">· short of {r.needs.join(" and ")}</span>
                      )}
                      {r.likely.length > 0 && (
                        <span className="ml-auto font-mono text-[0.76rem] text-clock">
                          likely {r.likely.map((l) => `${l.pos} ${Math.round(l.p * 100)}%`).join(" · ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="m-0 mt-2 max-w-[70ch] text-[0.78rem] leading-snug text-ink-3">
                  Rosters come from the live sync, so "needs" is what each team is actually short of rather
                  than a guess. "Likely" is what they took across {fc.sims.toLocaleString()} simulated versions
                  of these picks. When several teams in a row need the same position, that is the run — and it
                  is visible here before it shows up in anyone's ADP.
                </p>
              </details>
            )}
            {fc && fc.picksAhead > 0 && (() => {
              const hot = fc.runs.filter((r) => r.p >= 0.5 && r.expected >= 2).sort((x, y) => y.p - x.p);
              if (!hot.length) return null;
              return (
                <p className="m-0 max-w-[70ch] pl-7 text-[0.86rem] leading-relaxed text-clock">
                  <b>Run incoming:</b>{" "}
                  {hot.slice(0, 2).map((r) => {
                    const nd = fc.needs.find((x) => x.pos === r.pos);
                    return `${Math.round(r.p * 100)}% chance three or more ${PLAINSHORT[r.pos]}s go before your turn (about ${r.expected.toFixed(1)} expected${nd ? `, and ${nd.need} of the ${nd.of} teams ahead of you still need one` : ""})`;
                  }).join("; ")}
                  . Simulated across {fc.sims.toLocaleString()} versions of the next{" "}
                  {fc.picksAhead} picks — this comes from what those rosters actually hold, which
                  is the part ADP cannot see.
                </p>
              );
            })()}
            {a.lineup && a.lineup.starters >= 4 && (
              <p className="m-0 max-w-[70ch] pl-7 text-[0.86rem] leading-relaxed text-ink-3">
                <b className="text-ink-2">Your starters so far:</b> about{" "}
                <b className="text-ink">{a.lineup.mid.toFixed(0)}</b> pts in a typical week — a bad
                one {a.lineup.floor.toFixed(0)}, a good one {a.lineup.ceiling.toFixed(0)}. From
                measured 2025 week-to-week ranges, not from the projection alone.
              </p>
            )}
            {(() => {
              const weeks = Object.entries(a.byeCount)
                .map(([w, n]) => ({ w: Number(w), n }))
                .filter((x) => x.n >= 1)
                .sort((x, y) => x.w - y.w);
              if (!weeks.length || a.myCount < 3) return null;
              return (
                <div className="flex flex-wrap items-center gap-1.5 pl-7 text-[0.8rem] text-ink-3">
                  <span>Byes:</span>
                  {weeks.map((x) => (
                    <span
                      key={x.w}
                      className={`rounded px-1.5 py-0.5 font-mono ${
                        x.n >= 3 ? "bg-avoid/20 text-avoid" : x.n === 2 ? "bg-risky/20 text-risky" : "bg-line-soft text-ink-3"
                      }`}
                      title={`${x.n} of your players are off in week ${x.w}`}
                    >
                      wk{x.w} ×{x.n}
                    </span>
                  ))}
                </div>
              );
            })()}
            {(a.qb === 0 || a.te === 0) && a.myCount >= 4 && (
              <p className="m-0 max-w-[70ch] pl-7 text-[0.86rem] leading-relaxed text-ink-3">
                {a.qb === 0 && a.te === 0
                  ? "Your QB and TE slots are both still empty. "
                  : a.qb === 0
                    ? "Your QB slot is still empty. "
                    : "Your TE slot is still empty. "}
                {a.qb === 0 && (
                  <>
                    The quarterback can wait — QB1 through QB14 covers just 3.4 pts/wk, so they are close to
                    interchangeable, and forcing one in round 3 rather than round 10 costs about two points a week.{" "}
                  </>
                )}
                {a.te === 0 && (
                  <>
                    Tight end is the opposite: TE1 to TE13 spans 5.2 pts/wk, so the position genuinely runs out. Round 5
                    is the measured sweet spot and the useful ones are gone by round 8.
                  </>
                )}
              </p>
            )}
            {(a.goneSoon.length > 0 || a.dream || (a.look && a.look.edge >= 0.8)) && (
              <p className="m-0 text-[0.82rem] leading-relaxed text-ink-3">
                {a.goneSoon.length > 0 && <>{waiting ? "Won't reach your pick" : "Won't come back to you"}: {a.goneSoon.map((g) => g.n).join(" · ")}.</>}
                {a.look && a.look.edge >= 0.8 && (
                  <> Order matters: {a.look.first.p} now, {a.look.second.p} on the way back — beats the reverse by ~{a.look.edge.toFixed(1)} pts/wk.</>
                )}
                {a.dream && (
                  <> If {a.dream.o.r[0]} somehow slides to #{a.nextPick} (~{Math.round(a.dream.pr * 100)}% chance), forget all of this and sprint the card up.</>
                )}
              </p>
            )}
          </div>
        )}
        {a.warnings.length > 0 && a.myCount < 16 && (
          <div className="mt-2 rounded border border-risky/50 bg-risky/5 px-3 py-1.5 text-[0.85rem] text-ink-2">
            <b className="text-risky">Roster radar:</b> {a.warnings.join("  ·  ")}
          </div>
        )}
        {showFull && SIM_PLANS[mySlot] && (
          <details className="mt-2.5 rounded border border-line-soft bg-raised/40 px-3 py-1.5 text-[0.82rem]" open={a.myCount === 0}>
            <summary className="cursor-pointer list-none text-ink-2">
              <b className="text-ink">Your simulated best line</b>{" "}
              <span className="text-ink-3">
                — {SIM_PLANS[mySlot].strategy} · won {SIM_PLANS[mySlot].winPct}% of 800 sims
              </span>
            </summary>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
              {SIM_PLANS[mySlot].picks.map((sp) => {
                const got = sp.opts.find(([nm]) => DS[nm] === "mine");
                return (
                  <li key={sp.pick} className="flex flex-wrap items-baseline gap-x-1.5 text-ink-2">
                    <span className="w-10 shrink-0 font-mono text-[0.72rem] text-ink-3">#{sp.pick}</span>
                    {sp.opts.map(([nm, pct], i) => (
                      <span key={nm} className={DS[nm] ? "text-ink-3 line-through" : i === 0 ? "font-semibold text-ink" : "text-ink-3"}>
                        {i > 0 && <span className="mr-1 text-ink-3">or</span>}
                        {nm}
                        <span className="ml-1 font-mono text-[0.7rem] text-ink-3">{pct}%</span>
                      </span>
                    ))}
                    {got && <span className="font-mono text-[0.7rem] text-value">✓ yours</span>}
                  </li>
                );
              })}
            </ul>
            <p className="m-0 mt-1.5 text-[0.76rem] leading-snug text-ink-3">
              {SIM_PLANS[mySlot].ppw} pts/wk of starters. The % is how often that player was still on the board at that
              pick across 800 drafts — so the second name is your fallback, not a downgrade. A plan, not a script: the
              panel above always reflects the real board.
            </p>
          </details>
        )}
        {plain && showFull && (
          <Noob show={noob}>
            <b>Plain English:</b> {plain}
          </Noob>
        )}
        {showFull && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {slots.map((s, i) => (
            <span
              key={i}
              className={`rounded border px-2 py-0.5 text-[0.75rem] ${
                s.player ? "border-solid border-line bg-raised text-ink" : "border-dashed border-line text-ink-3"
              }`}
            >
              <b className="mr-1.5 font-mono text-[0.65rem] tracking-wide text-ink-3">{s.label}</b>
              {s.player ? s.player.split(" ").slice(-1)[0] : "—"}
            </span>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

export function BoardPanel({ noob, DS, ord, mark, undo, reset, applyRun, canUndo, mySlot, setMySlot }: BoardProps) {
  const [pos, setPos] = useState<"ALL" | Pos>("ALL");
  const [q, setQ] = useState("");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [openTiers, setOpenTiers] = useState<number[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  /* personal do-not-draft list — blocked players never appear in a recommendation */
  const [blocked, setBlocked] = usePersistent<string[]>(
    "fd26-blocked",
    [],
    (raw) => {
      try {
        return JSON.parse(raw) as string[];
      } catch {
        return [];
      }
    },
    JSON.stringify
  );
  /* ---- practice draft ----------------------------------------------------------------
   * The other eleven seats pick with the same model the simulations use, straight into the
   * real draft state, so the advisor and the board behave exactly as they will on the night. */
  const [practice, setPractice] = usePersistent("fd26-practice", false, (r) => r === "1", (v) => (v ? "1" : "0"));
  /* League intel — things you know that no market average does. Kept in component state only
     to force a re-render; the values themselves live in lib/intel so the engine can read them
     without the UI having to pass them down through everything. */
  const [pins, setPinsState] = useState(() => ({ ...getPins() }));
  /* How this room drafts, as opposed to how the market does. Owned here because the toolbar
     sets it, and passed down to the advisor strip because the forecast depends on it: a room
     that takes backs early empties the RB shelf sooner, and "will he reach me?" must know. */
  const [lean, setLean] = useState<RbLean>(() => rbLean());
  const [intelText, setIntelText] = useState("");
  const [intelErr, setIntelErr] = useState<string | null>(null);
  const applyIntel = () => {
    const parsed = parseIntel(intelText, P.map((r) => r[0]));
    if (!parsed) { setIntelErr("Try: James Cook 8"); return; }
    setPin(parsed.name, parsed.pick);
    setPinsState({ ...getPins() });
    setIntelText("");
    setIntelErr(null);
  };
  const dropPin = (n: string) => { setPin(n, null); setPinsState({ ...getPins() }); };
  const flipPin = (n: string) => { togglePin(n); setPinsState({ ...getPins() }); };
  const myPickCount = Object.values(DS).filter((v) => v === "mine").length;
  const picksMade = Object.keys(DS).length;
  const practiceOver = myPickCount >= 14;
  const myTurn = mySlot > 0 && snapTeam(picksMade + 1) === mySlot;

  useEffect(() => {
    if (!practice || !mySlot || practiceOver || myTurn) return;
    const run = fillToMyTurn(DS, ord, mySlot);
    if (!run.length) return;
    const t = setTimeout(() => applyRun(run), 260);
    return () => clearTimeout(t);
  }, [practice, mySlot, DS, ord, myTurn, practiceOver, applyRun]);

  const grade = practiceOver && practice && mySlot ? gradeDraft(ord, mySlot) : null;

  const toggleBlock = (name: string) =>
    setBlocked(blocked.includes(name) ? blocked.filter((x) => x !== name) : [...blocked, name]);
  const HATED = "Justin Jefferson";
  /* notes collapse by default so more players fit on one screen */
  const [openNotes, setOpenNotes] = useState<string[]>([]);
  const [allNotes, setAllNotes] = usePersistent<boolean>(
    "fd26-allnotes",
    false,
    (raw) => raw === "1",
    (v) => (v ? "1" : "0")
  );
  const noteOpen = (n: string) => allNotes || openNotes.includes(n);
  const toggleNote = (n: string) =>
    setOpenNotes(openNotes.includes(n) ? openNotes.filter((x) => x !== n) : [...openNotes, n]);

  /* ---- Sleeper live draft sync: read-only API, no token; ~1 call per 10s while on.
     The league's real draft is pre-wired so picks start marking themselves the moment it begins. ---- */
  const DEFAULT_SLEEPER = "https://sleeper.app/draft/nfl/1389372699129700353";
  const [sleeperId, setSleeperId] = usePersistent<string>("fd26-sleeper", DEFAULT_SLEEPER, (r) => r || DEFAULT_SLEEPER, (v) => v);
  const [syncOn, setSyncOn] = usePersistent<boolean>("fd26-sync-on", true, (r) => r === "1", (v) => (v ? "1" : "0"));
  const [syncMsg, setSyncMsg] = useState("");
  const [staleMarks, setStaleMarks] = useState(0);
  const DSRef = useRef(DS);
  DSRef.current = DS;
  const slotRef = useRef(mySlot);
  slotRef.current = mySlot;
  useEffect(() => {
    if (!syncOn) return;
    const idMatch = sleeperId.match(/(\d{15,20})/);
    if (!idMatch) {
      setSyncMsg("Paste your Sleeper draft URL or ID first.");
      return;
    }
    const id = idMatch[1];
    const lookup = new Map(P.map((r) => [normName(r[0]), r[0]]));
    /* nickname fallback: Sleeper says "Kenny Gainwell", our board says "Kenneth".
       Accept a UNIQUE last-name + first-initial match when the full name misses. */
    const byLast = new Map<string, string[]>();
    P.forEach((r) => {
      const parts = normName(r[0]).split(" ");
      const key = parts[parts.length - 1] + "|" + parts[0][0];
      byLast.set(key, [...(byLast.get(key) ?? []), r[0]]);
    });
    const teamOf = new Map(P.map((r) => [r[0], r[2]]));
    const resolve = (raw: string, team?: string) => {
      const k = normName(raw);
      const exact = lookup.get(k);
      if (exact) return exact;
      /* fallback only fires for a UNIQUE last-name + first-initial match on the SAME team,
         so an obscure namesake can never mark a real player as drafted */
      const parts = k.split(" ");
      if (parts.length < 2 || !parts[0] || !team) return undefined;
      const cand = byLast.get(parts[parts.length - 1] + "|" + parts[0][0]);
      if (!cand || cand.length !== 1) return undefined;
      return teamOf.get(cand[0]) === team ? cand[0] : undefined;
    };
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/draft/${id}/picks`);
        if (!res.ok) throw new Error(String(res.status));
        const picks = (await res.json()) as SleeperPick[];
        if (picks.length === 0) {
          if (!stop) {
            const localMarks = Object.keys(DSRef.current).length;
            setStaleMarks(localMarks);
            setSyncMsg(
              localMarks > 0
                ? `The live draft hasn't started, but this board has ${localMarks} mark${localMarks === 1 ? "" : "s"} from practice.`
                : 'Connected to "charmin ultra strong" — waiting for the draft to start. Pick who you are before it does!'
            );
          }
          return 60000;
        }
        if (!stop) setStaleMarks(0);
        let offBoard = 0;
        picks
          .sort((x, y) => x.pick_no - y.pick_no)
          .forEach((pk) => {
            const nm = resolve(`${pk.metadata?.first_name ?? ""} ${pk.metadata?.last_name ?? ""}`, pk.metadata?.team);
            if (!nm) {
              offBoard++;
              return;
            }
            const want = pk.draft_slot === slotRef.current ? "mine" : "gone";
            /* also self-heal: if you picked your identity after picks were synced, re-attribute them */
            if (!DSRef.current[nm] || DSRef.current[nm] !== want) mark(nm, want);
          });
        if (!stop)
          setSyncMsg(
            `Live: ${picks.length} picks synced${offBoard ? ` (${offBoard} off-board)` : ""} · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
          );
        return 10000;
      } catch {
        if (!stop) setSyncMsg("Sync error — retrying shortly. Check the draft URL/ID if this persists.");
        return 30000;
      }
    };
    let timer: number | undefined;
    const loop = async () => {
      const delay = (await tick()) ?? 10000;
      if (!stop) timer = window.setTimeout(loop, delay);
    };
    loop();
    return () => {
      stop = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [syncOn, sleeperId, mark]);

  /* "/" from anywhere focuses the search box for rapid-fire pick marking */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = q.trim().toLowerCase();
  const showTiers = pos === "ALL" && !query && !hideDrafted;

  /* a tier collapses once every player in it is drafted (click its band to peek) */
  const tierDone: Record<number, boolean> = {};
  P.forEach((r) => {
    tierDone[r[5]] = (tierDone[r[5]] ?? true) && !!DS[r[0]];
  });

  const rows: ReactNode[] = [];
  let lastTier = 0;
  let shown = 0;
  let firstUnmarked: string | null = null;
  P.forEach((r, i) => {
    const [n, p, t, adp, v, ot, , note, tags] = r;
    const st = DS[n] ?? "";
    if (pos !== "ALL" && p !== pos) return;
    if (query && !(n.toLowerCase().includes(query) || t.toLowerCase().includes(query))) return;
    if (hideDrafted && st) return;
    if (!firstUnmarked && !st) firstUnmarked = n;
    const collapsed = showTiers && tierDone[ot] && !openTiers.includes(ot);
    if (showTiers && ot !== lastTier) {
      lastTier = ot;
      const done = tierDone[ot];
      rows.push(
        <tr key={`tier-${ot}-${i}`} className="tier-band">
          <td
            colSpan={9}
            className={done ? "cursor-pointer select-none" : undefined}
            onClick={done ? () => setOpenTiers((o) => (o.includes(ot) ? o.filter((x) => x !== ot) : [...o, ot])) : undefined}
          >
            Tier {ot} — {OT[ot][0]}
            <span>{OT[ot][1]}</span>
            {done && (
              <span className="ml-2 font-semibold text-value">
                ✓ all drafted · {collapsed ? "show" : "hide"}
              </span>
            )}
          </td>
        </tr>
      );
    }
    if (collapsed) return;
    shown++;
    rows.push(
      <tr key={n} className={`group/row ${st}${blocked.includes(n) ? " opacity-45" : ""}`}>
        <td>
          <span className="rowact">
            <button type="button" className="bx" title="Drafted by another team (click again to undo)" onClick={() => mark(n, "gone")}>
              Taken
            </button>
            <button type="button" className="bs" title="My pick (click again to undo)" onClick={() => mark(n, "mine")}>
              Pick
            </button>
          </span>
        </td>
        <td className="num">{i + 1}</td>
        <td>
          <span className="inline-flex items-center gap-1.5 align-middle">
            <TeamIcon team={t} />
            <span className="pname">{n}</span>
            <button
              type="button"
              onClick={() => toggleBlock(n)}
              title={blocked.includes(n) ? `Un-ban ${n}` : `Never recommend ${n}`}
              className="ml-1 align-middle text-[0.7rem] text-ink-3 opacity-0 transition-opacity hover:text-avoid focus-visible:opacity-100 group-hover/row:opacity-100"
            >
              🚫
            </button>
          </span>
          <span className="pteam">
            {t} · bye {BYE[t] ?? "—"}
          </span>
          <InjChip name={n} className="ml-1.5" /> <NewsChip name={n} /> <TrendChip name={n} />
          {blocked.includes(n) && (
            <span className="ml-1.5 rounded-sm border border-avoid/60 px-1 font-mono text-[0.62rem] font-bold text-avoid">BANNED</span>
          )}
          <br />
          <span className="mt-0.5 inline-flex flex-wrap gap-1"><TagChips tags={tags} max={3} /></span>
          <button
            type="button"
            onClick={() => toggleNote(n)}
            title={noteOpen(n) ? "Collapse note" : "Expand note"}
            className={`mt-1 block max-w-[46ch] cursor-pointer text-left text-[0.85rem] leading-snug text-ink-2 min-[1620px]:hidden ${
              noteOpen(n) ? "" : "truncate"
            }`}
          >
            {note}
          </button>
        </td>
        <td>
          <Sticker pos={p} />
          {(() => {
            /* Live value flag. A player is not cheap because a list says so — he is cheap
               because the room has passed on him this many times already. Recomputed every
               pick, so it moves as the draft moves. */
            /* your own intel outranks anything the market says about him */
            const pin = pinnedPick(n);
            if (pin !== undefined && !DS[n]) {
              return (
                <span
                  className="ml-1 rounded-sm border border-clock bg-clock/15 px-1 py-px font-mono text-[0.62rem] uppercase tracking-wide text-clock"
                  title={`You told the tool he goes at ${pin}. Every survival number for him uses that, not his ADP.`}
                >
                  goes {pin}
                </span>
              );
            }
            const sadp = SLP[n]?.adp;
            if (!sadp) return null;
            if (DS[n]) {
              /* already gone — show what the room paid. A player taken well before his ADP is
                 a reach, and reaches are contagious: they pull the whole board forward and
                 make everyone else harder to get than any list suggests. */
              const at = ord.indexOf(n) + 1;
              if (at <= 0) return null;
              const over = sadp - at;
              if (Math.abs(over) < 8) return null;
              return (
                <span
                  className={`ml-1 rounded-sm border px-1 py-px font-mono text-[0.62rem] uppercase tracking-wide ${
                    over > 0 ? "border-avoid/50 text-avoid" : "border-ink-3/40 text-ink-3"
                  }`}
                  title={over > 0
                    ? `Taken at ${at}, ${Math.round(over)} picks before his ADP of ${sadp.toFixed(1)} — a reach`
                    : `Taken at ${at}, ${Math.round(-over)} picks after his ADP of ${sadp.toFixed(1)} — the room let him slide`}
                >
                  {over > 0 ? `reach ${Math.round(over)}` : `late ${Math.round(-over)}`}
                </span>
              );
            }
            const slid = picksMade + 1 - sadp;
            if (slid < 6) return null;
            const big = slid >= 15;
            return (
              <span
                className={`ml-1 rounded-sm border px-1 py-px font-mono text-[0.62rem] uppercase tracking-wide ${
                  big ? "border-value bg-value/15 text-value font-bold" : "border-value/40 text-value"
                }`}
                title={`Still here ${Math.round(slid)} picks after the room usually takes him (ADP ${sadp.toFixed(1)})`}
              >
                {big ? `fell ${Math.round(slid)}` : `-${Math.round(slid)}`}
              </span>
            );
          })()}
        </td>
        <td className="num">
          {(() => {
            /* Value is not a property of a player, it is a property of a MOMENT. A back with an
               ADP of 30 is a steal at pick 45 and a reach at pick 20, and the same number on
               screen means opposite things an hour apart. So read it against where the draft
               actually is: how many picks past his ADP has he now lasted? */
            const a = SLP[n]?.adp;
            const shown = a !== undefined ? a.toFixed(1) : adp.toFixed(1);
            if (a === undefined || DS[n]) {
              return <span className="text-ink-3">{shown}</span>;
            }
            const past = picksMade + 1 - a;      // positive: he has outlasted his price
            const rank = (past >= 24 ? 3 : past >= 12 ? 2 : past >= 5 ? 1
              : past <= -18 ? 3 : past <= -9 ? 2 : past <= -4 ? 1 : 0) as 0 | 1 | 2 | 3;
            const dir: "up" | "down" = past >= 0 ? "up" : "down";
            /* Colour and the height of the chevron stack already carry the signal. Filled
               boxes behind the number added a third encoding of the same thing and turned a
               quiet column of figures into a patchwork — the numbers stopped being readable
               as numbers. Weight and hue only. */
            const tone =
              past >= 12 ? "text-value font-bold"
              : past >= 5 ? "text-value"
              : past <= -9 ? "text-avoid font-bold"
              : past <= -4 ? "text-avoid"
              : "text-ink";
            return (
              <span
                className={`inline-flex items-baseline gap-1 ${tone}`}
                title={
                  past >= 5
                    ? `The room usually takes him at ${a.toFixed(1)} and you are at ${roundPick(picksMade + 1)}. He has lasted ${Math.round(past)} picks past his price.`
                    : past <= -4
                      ? `He goes at ${a.toFixed(1)} and you are only at ${roundPick(picksMade + 1)} — taking him now is reaching ${Math.round(-past)} picks early.`
                      : `Right about on schedule: he goes at ${a.toFixed(1)}, you are at ${roundPick(picksMade + 1)}.`
                }
              >
                {shown}
                {rank > 0 && <Chevrons n={rank as 1 | 2 | 3} dir={dir} />}
              </span>
            );
          })()}
          {SLP[n]?.adp !== undefined && (
            <span className="block text-[0.66rem] leading-tight text-ink-3 min-[1400px]:hidden" title="mock-draft market ADP">
              mock {adp.toFixed(0)}
            </span>
          )}
        </td>
        <td className="num hidden min-[1400px]:table-cell">
          {SLP[n]?.adp !== undefined ? adp.toFixed(1) : <span className="text-ink-3">—</span>}
        </td>
        <td className="num">
          {(() => {
            /* Where his projection ranks him against the pick the market takes him at. Both
               numbers are Sleeper's, so this is the market disagreeing with itself rather than
               us disagreeing with the market — a much harder thing to argue with. */
            const v = valueOf(n);
            if (!v) return <span className="text-ink-3">—</span>;
            const tier = valueTier(v.edge);
            const sign = v.edge > 0 ? `+${Math.round(v.edge)}` : `${Math.round(v.edge)}`;
            /* Same reasoning as the ADP column: weight and hue, no filled box. Two adjacent
               numeric columns both drawing chips made the row read as a row of badges rather
               than a row of figures. */
            const cls =
              tier === "big" ? "font-bold text-value"
              : tier === "good" ? "font-semibold text-value"
              : tier === "steep" ? "font-bold text-avoid"
              : "text-ink-3";
            return (
              <span
                className={cls}
                title={`Projects as the ${v.rank}${v.rank % 10 === 1 && v.rank !== 11 ? "st" : v.rank % 10 === 2 && v.rank !== 12 ? "nd" : v.rank % 10 === 3 && v.rank !== 13 ? "rd" : "th"} most valuable player on the board, and the market takes him at ${v.adp.toFixed(1)}.`}
              >
                {sign}
              </span>
            );
          })()}
        </td>
        <td><Call v={v} explain /></td>
        <td className="note hidden min-[1620px]:table-cell">
          <button
            type="button"
            onClick={() => toggleNote(n)}
            title={noteOpen(n) ? "Collapse note" : "Expand note"}
            className={`w-full cursor-pointer text-left ${noteOpen(n) ? "" : "line-clamp-2"}`}
          >
            {note}
          </button>
        </td>
      </tr>
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="display text-[1.15rem] font-bold uppercase tracking-[0.04em] text-ink">
          {P.length} players, ranked for your league
        </span>
        <Info
          tip={
            <>
              Synthesized half-PPR ranks — expert consensus adjusted for Vegas environments, TD regression, injury
              risk, and camp news. <b className="text-ink">ADP</b> is Sleeper's own half-PPR average draft position,
              measured from real Sleeper drafts, with the outside <b className="text-ink">mock</b> market beside it for
              contrast. A rank far better than ADP means the room will let you have him late.
            </>
          }
        />
      </div>

      <Noob show={noob} title="Using the board:">
        <ul className="mt-1.5 mb-0.5 list-disc space-y-1 pl-5">
          <li><b>Do this one thing:</b> tap your name under <b>I am</b> (Ashley / Brian JK / Emily). That's it — our league's Sleeper draft is already connected, so every pick marks itself as it happens. You never touch <b>Taken</b> or <b>Pick</b> unless the sync is off.</li>
          <li>Then just read the panel: it shows your <b>next three targets in order</b>, each with the odds he's still there when your turn comes. Take #1 if he's there, else #2, else #3.</li>
          <li>Chips: <Call v="buy" /> better than his price · <Call v="solid" /> fairly priced · <Call v="risk" /> only at a discount · <Call v="avoid" /> the price ignores a real problem. Hover any small tag for its meaning.</li>
          <li><b>Value</b> is a price tag: how good he is against what the room pays. <b className="text-value">Green</b> = on sale, he'll come back to you — don't reach. <b className="text-avoid">Red</b> = marked up, let someone else pay. <b>ADP</b> comes straight from real Sleeper half-PPR drafts, so it is what this room actually pays.</li>
          <li>Drafting somewhere other than Sleeper? Turn sync off and mark picks yourself: type a name in the search box and press <b>Enter</b> (someone else took him) or <b>Shift+Enter</b> (you took him). Press <b>/</b> to jump to the search box.</li>
        </ul>
      </Noob>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Filter by position">
          {POS_FILTERS.map((pf) => (
            <button key={pf} type="button" className={`btn ${pos === pf ? "on" : ""}`} onClick={() => setPos(pf)}>
              {pf === "ALL" ? "All" : pf}
            </button>
          ))}
        </div>
        <input
          ref={searchRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQ("");
              return;
            }
            if (e.key === "Enter" && query && firstUnmarked) {
              mark(firstUnmarked, e.shiftKey ? "mine" : "gone");
              setQ("");
            }
          }}
          placeholder="Type name → Enter = Taken · Shift+Enter = Pick"
          aria-label="Search players — Enter marks the top match as taken, Shift+Enter as your pick"
          className="min-w-[300px] rounded-[5px] border border-line bg-surface px-3.5 py-1.5 text-[0.9rem] text-ink placeholder:text-ink-3"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`btn ${hideDrafted ? "on" : ""}`}
            aria-pressed={hideDrafted}
            onClick={() => setHideDrafted(!hideDrafted)}
          >
            Hide drafted
          </button>
          <button type="button" className="btn" disabled={!canUndo} onClick={undo}>
            Undo
          </button>
          <span className="inline-flex items-center gap-1">
            <input
              value={intelText}
              onChange={(e) => { setIntelText(e.target.value); setIntelErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyIntel(); } }}
              placeholder="Intel → James Cook 8"
              title="Something you know that ADP does not — a player you are sure goes at a particular pick. Type a name and the pick, then Enter."
              className="w-[184px] rounded border border-line-soft bg-raised px-2 py-1 text-[0.82rem] text-ink placeholder:text-ink-3"
            />
            {intelErr && <span className="text-[0.72rem] text-avoid">{intelErr}</span>}
          </span>
          {/* How this room drafts, as opposed to how the market drafts. ADP is an average over
              strangers; your league is twelve specific people, and if they all take backs early
              then "will he reach me?" is wrong in a way that costs real picks. */}
          <span className="inline-flex items-center gap-1">
            <label htmlFor="rblean" className="text-[0.78rem] text-ink-3">Room:</label>
            <select
              id="rblean"
              value={lean}
              onChange={(e) => { const v = e.target.value as RbLean; setLean(v); setRbLean(v); }}
              title={RB_LEAN[lean].blurb}
              className={`rounded border bg-raised px-2 py-1 text-[0.82rem] ${lean === "market" ? "border-line-soft text-ink-3" : "border-clock text-clock font-semibold"}`}
            >
              {(Object.keys(RB_LEAN) as RbLean[]).map((k) => (
                <option key={k} value={k}>{RB_LEAN[k].label} · {RB_LEAN[k].backs} RB</option>
              ))}
            </select>
          </span>
          <button
            type="button"
            className={`btn ${practice ? "on" : ""}`}
            title="Draft against eleven simulated rooms using real Sleeper ADP"
            onClick={() => {
              reset();
              setPractice(!practice);
            }}
          >
            {practice ? "End practice" : "Practice draft"}
          </button>
          <button
            type="button"
            className={`btn ${resetArmed ? "danger" : ""}`}
            onClick={() => {
              if (resetArmed) {
                reset();
                setResetArmed(false);
              } else {
                setResetArmed(true);
                setTimeout(() => setResetArmed(false), 3500);
              }
            }}
          >
            {resetArmed ? "Click again to confirm" : "Reset draft"}
          </button>
          <button
            type="button"
            className={`btn ${blocked.includes(HATED) ? "danger" : ""}`}
            onClick={() => toggleBlock(HATED)}
            title={
              blocked.includes(HATED)
                ? "Jefferson is banned from your recommendations. Click to forgive him."
                : "Ban Justin Jefferson from every recommendation, forever (or until you click again)"
            }
          >
            {blocked.includes(HATED) ? "🚫 Jefferson banned" : "🚫 No Jefferson"}
          </button>
          <button
            type="button"
            className={`btn ${allNotes ? "on" : ""}`}
            onClick={() => setAllNotes(!allNotes)}
            title={allNotes ? "Collapse every note — fit more players on screen" : "Expand every note"}
          >
            {allNotes ? "Notes: full" : "Notes: short"}
          </button>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-2">
          I am:
          {TOOL_USERS.map(([nm, slot]) => (
            <button
              key={nm}
              type="button"
              className={`btn !px-2.5 !py-1 !text-[0.8rem] ${mySlot === slot ? "on" : ""}`}
              onClick={() => setMySlot(slot)}
            >
              {nm}
            </button>
          ))}
          <select
            value={String(mySlot)}
            onChange={(e) => setMySlot(parseInt(e.target.value) || 0)}
            aria-label="My draft slot"
            className="rounded-[5px] border border-line bg-surface px-2 py-1.5 text-[0.88rem] font-semibold text-ink"
          >
            <option value="0">—</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {i + 1} · {DRAFT_ORDER[i]}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="flex flex-col gap-5 min-[1200px]:flex-row-reverse min-[1200px]:items-start">
        <div className="contents min-[1200px]:z-30 min-[1200px]:flex min-[1200px]:flex-col min-[1200px]:gap-3 min-[1200px]:sticky min-[1200px]:top-[calc(var(--hdr,86px)+6px)] min-[1200px]:w-[360px] min-[1200px]:shrink-0 min-[1200px]:max-h-[calc(100vh-var(--hdr,86px)-24px)] min-[1200px]:overflow-y-auto min-[1200px]:overscroll-contain">
      {Object.keys(pins).length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[0.8rem]">
          <span className="text-ink-3">Your intel — click one to switch it on or off:</span>
          {Object.entries(pins).sort((a, b) => a[1].pick - b[1].pick).map(([n, pin]) => (
            <span key={n} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => flipPin(n)}
                title={pin.on
                  ? `On — the model is treating ${n} as going at ${pin.pick}. Click to switch it off and see what changes.`
                  : `Off — ${n} is being priced by the market again. Click to apply your read.`}
                className={`rounded-l border py-0.5 pl-1.5 pr-1 font-mono text-[0.75rem] ${
                  pin.on
                    ? "border-clock bg-clock/15 text-clock"
                    : "border-line-soft text-ink-3 line-through decoration-ink-3/60"
                }`}
              >
                {n} → {pin.pick}
              </button>
              <button
                type="button"
                onClick={() => dropPin(n)}
                title="Forget this one"
                className={`rounded-r border border-l-0 px-1 py-0.5 font-mono text-[0.75rem] ${
                  pin.on ? "border-clock text-clock" : "border-line-soft text-ink-3"
                } hover:border-avoid hover:text-avoid`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {grade && (
        <div className="mb-4 rounded-lg border border-clock/40 bg-raised px-4 py-3">
          <div className="display mb-1 text-[0.8rem] uppercase tracking-wide text-clock">Practice draft complete</div>
          <h3 className="display m-0 mb-1 text-[1.25rem] text-ink">
            Your starters project {grade.mine.toFixed(1)} pts/wk — {grade.rank === 1 ? "best" : `${grade.rank}${grade.rank === 2 ? "nd" : grade.rank === 3 ? "rd" : "th"}`} of the twelve teams
          </h3>
          <p className="m-0 mb-2 text-[0.85rem] leading-relaxed text-ink-2">
            The best room in this draft managed {grade.best.toFixed(1)} and the median team {grade.median.toFixed(1)}.
            Scored on Sleeper's own 2026 projections, best legal lineup — the same model every study on the Simulations
            tab uses. The eleven other seats drafted off real Sleeper ADP, so this is the room you will actually face.
          </p>
          {grade.gaps.length > 0 && (
            <p className="m-0 mb-2 text-[0.85rem] leading-relaxed text-avoid">
              Holes worth fixing next time: {grade.gaps.join(" · ")}.
            </p>
          )}
          <button type="button" className="btn" onClick={() => reset()}>
            Draft again
          </button>
        </div>
      )}

      <AdvisorStrip DS={DS} mySlot={mySlot} ord={ord} noob={noob} blocked={blocked} lean={lean} />

      <div className="flex flex-wrap items-center gap-2">
        <SleeperMark size={18} />
        <input
          type="text"
          value={sleeperId}
          onChange={(e) => setSleeperId(e.target.value)}
          placeholder="Drafting on Sleeper? Paste the draft URL — picks mark themselves"
          aria-label="Sleeper draft URL or ID for live sync"
          className="min-w-[360px] rounded-[5px] border border-line bg-surface px-3.5 py-1.5 text-[0.85rem] text-ink placeholder:text-ink-3"
        />
        <button type="button" className={`btn ${syncOn ? "on" : ""}`} onClick={() => setSyncOn(!syncOn)}>
          {syncOn ? "● Live sync on" : "Start live sync"}
        </button>
        {syncMsg && <span className="text-[0.8rem] text-ink-3">{syncMsg}</span>}
        {staleMarks > 0 && (
          <button
            type="button"
            className="btn danger !py-1 !text-[0.8rem]"
            onClick={() => {
              reset();
              setStaleMarks(0);
            }}
          >
            Clear practice picks
          </button>
        )}
        {!syncMsg && (
          <Info tip={<>Works for any Sleeper draft (read-only, no login). Set <b className="text-ink">My slot</b> first so your own picks land as <b className="text-ink">Pick</b>, everyone else's as <b className="text-ink">Taken</b>. Checks once a minute before the draft, every 10 seconds once picks are flowing.</>} />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[0.75rem] text-ink-3">
        <SleeperMark size={13} />
        Injury tags, 🔥/🧊 trending, and the board ranks behind pick predictions come live from Sleeper's public API — refreshed daily.
      </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  Track
                  <Info tip={<>Mark every pick here, in draft order: <b className="text-ink">Taken</b> = drafted by another team, <b className="text-ink">Pick</b> = your pick. The advisor rebuilds all 12 rosters from these marks. Click again to un-mark.</>} />
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  Rk
                  <Info tip={<>My overall rank for <i>your</i> league (12-team, half-PPR, 2 flex). On the clock, take the highest rank left — not the biggest name.</>} />
                </span>
              </th>
              <th>Player</th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  Pos
                  <Info tip={<>Position, color-coded the same everywhere: <b className="text-rb">RB</b> · <b className="text-wr">WR</b> · <b className="text-qb">QB</b> · <b className="text-te">TE</b>. Your lineup starts 1 QB, 2 RB, 2 WR, 1 TE and 2 flex (RB/WR/TE).</>} />
                </span>
              </th>
              <th className="!text-right">
                <span className="inline-flex items-center gap-1.5">
                  <SleeperMark size={12} />ADP
                  <span className="font-mono text-[0.7rem] font-normal text-clock">@ {roundPick(picksMade + 1)}</span>
                  <Info tip={<><b className="text-ink">Sleeper's own average draft position</b>, shaded against the pick you are on right now — green and <b className="text-value">▲</b> means he has already lasted past his price, red and <b className="text-avoid">▼</b> means taking him here is a reach. More arrows, bigger gap. Measured from real half-PPR Sleeper drafts — the pick this player actually goes at in our exact format. This is the number the model prices with, because it is the room we are drafting in. The smaller <b className="text-ink">mock</b> figure is the outside mock-draft market for comparison; where the two disagree, trust Sleeper. Rank far better than ADP = he'll likely still be there next round, so don't reach.</>} />
                </span>
              </th>
              <th className="hidden !text-right min-[1400px]:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  mock
                  <Info tip={<>The outside mock-draft market ADP, from national mock drafts rather than Sleeper. Shown for comparison only. When it disagrees with Sleeper's ADP, Sleeper wins — that's the board your league-mates are actually looking at.</>} />
                </span>
              </th>
              <th className="!text-right">
                <span className="inline-flex items-center gap-1.5">
                  Value
                  <Info tip={<><b className="text-ink">How many picks of value he is.</b> We rank every player by what he is worth over a replacement starter, then compare that to the pick the market actually takes him at. <b className="text-value">+45 or more</b> is highlighted: he grades 45 places better than where he goes, which is the clearest edge on the board. <b className="text-avoid">−30 or worse</b> is highlighted the other way — the room pays a lot over his worth, so let someone else. Both halves are Sleeper's own numbers, their projection against their ADP, so this is the market disagreeing with itself rather than us picking a fight with it.</>} />
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  Call
                  <Info tip={<>My verdict at his current price: <b className="text-value">VALUE</b> take him a bit early · <b className="text-solid">SOLID</b> take at price · <b className="text-risky">RISKY</b> only at a discount · <b className="text-avoid">AVOID</b> let someone else deal with it. Hover any chip for the one-line meaning.</>} />
                </span>
              </th>
              <th className="hidden min-[1620px]:table-cell">Note</th>
            </tr>
          </thead>
          <tbody>
            {shown > 0 ? (
              rows
            ) : (
              <tr>
                <td colSpan={9} className="!p-5 text-ink-3">
                  No players match — clear the search or the position filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </div>
      </div>
    </div>
  );
}
