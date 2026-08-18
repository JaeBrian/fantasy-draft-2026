import { useState, type ReactNode } from "react";
import { P, OT, BYE, type Pos } from "../data";
import { advise, needText, rosterSlots, type DraftState } from "../lib/advisor";
import { Call, Intro, Noob, Sticker, TagChips, TeamIcon } from "../components/ui";

const POS_FILTERS: ("ALL" | Pos)[] = ["ALL", "QB", "RB", "WR", "TE"];

interface BoardProps {
  noob: boolean;
  DS: DraftState;
  mark: (name: string, want: "gone" | "mine") => void;
  undo: () => void;
  reset: () => void;
  canUndo: boolean;
  mySlot: number;
  setMySlot: (n: number) => void;
}

function AdvisorStrip({ DS, mySlot }: { DS: DraftState; mySlot: number }) {
  const a = advise(DS, mySlot);
  const made = Object.keys(DS).length;

  const next: Partial<Record<Pos, { n: string; i: number }>> = {};
  P.forEach((r, i) => {
    if (!DS[r[0]] && !next[r[1]]) next[r[1]] = { n: r[0], i };
  });

  let suggestion: { take: string; team: string; pos: Pos; rank: number; why: ReactNode; alts: string } | null = null;
  let special: string | null = null;
  if (a.myCount >= 16) special = "Roster complete.";
  else if (a.myCount >= 14)
    special =
      a.myCount === 14
        ? "Take your defense — best remaining of Seahawks / Texans / Rams / Steelers. (K and DST always go with your last two picks.)"
        : "Take your kicker — best remaining of Aubrey / Fairbairn / Dicker / Boswell. (K and DST always go with your last two picks.)";
  else if (a.cands.length) {
    const t = a.cands[0];
    const alts = a.cands.slice(1, 3);
    let why = needText(t.p, a);
    if (t.cuffOf) why = `he's the handcuff to your ${t.cuffOf} — season insurance`;
    if (t.drop >= 12 && t.later) why += `; ${t.p}s fall off a cliff before your next turn (best left would be ${t.later.r[0]}, #${t.later.i + 1})`;
    else if (t.drop >= 6 && t.later) why += `; the ${t.p} shelf thins fast from here`;
    if (t.now.r[3] - (t.now.i + 1) >= 10) why += `; he usually goes ~pick ${Math.round(t.now.r[3])}, so this is a value`;
    suggestion = {
      take: t.now.r[0],
      team: t.now.r[2],
      pos: t.p,
      rank: t.now.i + 1,
      why: (
        <>
          {why}.
          {t.clash && (
            <span className="text-risky"> Heads-up: same Week {t.bye} bye as {a.byeCount[t.bye!]} of your players.</span>
          )}
        </>
      ),
      alts: alts.map((c) => `${c.now.r[0]} (${c.p})`).join(" · "),
    };
  }

  const slots = rosterSlots(DS);

  return (
    <div
      className={`card overflow-hidden transition-shadow ${
        a.onClock ? "border-clock/60 shadow-[0_0_0_1px_var(--color-clock),0_0_24px_-6px_rgba(240,180,41,0.45)]" : ""
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
        </span>
        {mySlot >= 1 && a.nextPick && !a.onClock && (
          <span className="font-mono tabular-nums">
            your next pick: #{a.nextPick} ({a.nextPick - a.cur} away)
          </span>
        )}
        <span className="ml-auto hidden gap-3 text-[0.8rem] text-ink-3 md:flex">
          {(["RB", "WR", "QB", "TE"] as Pos[]).map((p) => (
            <span key={p}>
              {p}: {next[p] ? <b className="font-medium text-ink-2">{next[p]!.n}</b> : "—"}
              {next[p] && <span className="font-mono"> #{next[p]!.i + 1}</span>}
            </span>
          ))}
        </span>
      </div>

      <div className="px-4 py-3">
        {special && <div className="text-[0.95rem] text-ink"><b>Take:</b> {special}</div>}
        {suggestion && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <span className="display text-[1.5rem] leading-none text-ink">
                <span className="text-clock">TAKE →</span> {suggestion.take}
              </span>
              <TeamIcon team={suggestion.team} size={22} />
            </span>
            <Sticker pos={suggestion.pos} />
            <span className="font-mono text-[0.8rem] text-ink-3">#{suggestion.rank}</span>
            <span className="basis-full text-[0.9rem] text-ink-2">
              {suggestion.why}{" "}
              {suggestion.alts && <span className="text-ink-3">Also fine: {suggestion.alts}</span>}
            </span>
          </div>
        )}
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
      </div>
    </div>
  );
}

export function BoardPanel({ noob, DS, mark, undo, reset, canUndo, mySlot, setMySlot }: BoardProps) {
  const [pos, setPos] = useState<"ALL" | Pos>("ALL");
  const [q, setQ] = useState("");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const query = q.trim().toLowerCase();
  const showTiers = pos === "ALL" && !query && !hideDrafted;

  const rows: ReactNode[] = [];
  let lastTier = 0;
  let shown = 0;
  P.forEach((r, i) => {
    const [n, p, t, adp, v, ot, , note, tags] = r;
    const st = DS[n] ?? "";
    if (pos !== "ALL" && p !== pos) return;
    if (query && !(n.toLowerCase().includes(query) || t.toLowerCase().includes(query))) return;
    if (hideDrafted && st) return;
    if (showTiers && ot !== lastTier) {
      lastTier = ot;
      rows.push(
        <tr key={`tier-${ot}`} className="tier-band">
          <td colSpan={7}>
            Tier {ot} — {OT[ot][0]}
            <span>{OT[ot][1]}</span>
          </td>
        </tr>
      );
    }
    shown++;
    rows.push(
      <tr key={n} className={st}>
        <td>
          <span className="rowact">
            <button type="button" className="bx" title="Mark drafted by another team" onClick={() => mark(n, "gone")}>
              ✕
            </button>
            <button type="button" className="bs" title="My pick" onClick={() => mark(n, "mine")}>
              ★
            </button>
          </span>
        </td>
        <td className="num">{i + 1}</td>
        <td>
          <span className="inline-flex items-center gap-1.5 align-middle">
            <TeamIcon team={t} />
            <span className="pname">{n}</span>
          </span>
          <span className="pteam">
            {t} · bye {BYE[t] ?? "—"}
          </span>
          <br />
          <span className="mt-0.5 inline-flex flex-wrap gap-1"><TagChips tags={tags} max={3} /></span>
        </td>
        <td><Sticker pos={p} /></td>
        <td className="num">{adp.toFixed(1)}</td>
        <td><Call v={v} /></td>
        <td className="note">{note}</td>
      </tr>
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="The board" title="158 players, ranked for your league">
        My synthesized half-PPR ranks — expert consensus adjusted for Vegas environments, TD regression, injury risk,
        and August camp news. <b className="text-ink">ADP</b> is live Underdog market price (Aug 17); a rank far better than ADP
        means the market will let you have him late.
      </Intro>

      <Noob show={noob} title="Using the board:">
        <ul className="mt-1.5 mb-0.5 list-disc space-y-1 pl-5">
          <li>When it's your pick, take the highest-ranked player left (position needs permitting). If his <b>ADP</b> is much higher than his rank here, he'll likely still be there next round — don't reach.</li>
          <li>Chips: <Call v="buy" /> better than his price · <Call v="solid" /> fairly priced · <Call v="risk" /> only at a discount · <Call v="avoid" /> the price ignores a real problem. Hover any small tag for its meaning.</li>
          <li>Press <b>✕</b> when anyone drafts a player, <b>★</b> when the pick is yours. "Hide drafted" shows only who's left.</li>
          <li>Set <b>My slot</b> and the status bar will suggest who to take next — mark every pick to keep the advice accurate. Marks are saved on this device.</li>
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
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player or team…"
          aria-label="Search players"
          className="min-w-[220px] rounded-[5px] border border-line bg-surface px-3.5 py-1.5 text-[0.9rem] text-ink placeholder:text-ink-3"
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
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-[0.85rem] font-semibold text-ink-2">
          My slot
          <select
            value={String(mySlot)}
            onChange={(e) => setMySlot(parseInt(e.target.value) || 0)}
            className="rounded-[5px] border border-line bg-surface px-2 py-1.5 text-[0.88rem] font-semibold text-ink"
          >
            <option value="0">—</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AdvisorStrip DS={DS} mySlot={mySlot} />

      <div className="card max-h-[76vh] overflow-y-auto overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th title="Mark drafted / mine">Track</th>
              <th>Rk</th>
              <th>Player</th>
              <th>Pos</th>
              <th className="!text-right">ADP</th>
              <th>Call</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {shown > 0 ? (
              rows
            ) : (
              <tr>
                <td colSpan={7} className="!p-5 text-ink-3">
                  No players match — clear the search or the position filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
