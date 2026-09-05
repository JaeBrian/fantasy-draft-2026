import { useEffect, useRef, useState, type ReactNode } from "react";
import { P, OT, BYE, MKT, DRAFT_ORDER, type Pos } from "../data";
import { snapTeam } from "../lib/advisor";
import { type DraftState } from "../lib/advisor";
import { fillToMyTurn, gradeDraft } from "../lib/mock";
import { usePersistent } from "../lib/store";
import { SLP } from "../sleeper";
import { valueOf, valueTier } from "../lib/value";
import { SeatPicker } from "../components/SeatPicker";
import { AdvisorPanel } from "../components/AdvisorPanel";
import { getPins, setPin, togglePin, parseIntel, pinnedPick } from "../lib/intel";

import { sleeperSnapshot, offBoardPick, externalPickKey, type SleeperPick } from "../lib/sleeper-draft";
import { Call, Chevrons, Info, InjChip, NewsChip, SleeperMark, Sticker, TagChips, TeamIcon, TrendChip } from "../components/ui";
import { RB_LEAN, rbLean, setRbLean, type RbLean } from "../lib/tendency";

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
  applySync: (state: DraftState, order: string[]) => void;
  canUndo: boolean;
  mySlot: number;
  setMySlot: (n: number) => void;
}

export function BoardPanel({ noob, DS, ord, mark, undo, reset, applyRun, applySync, canUndo, mySlot, setMySlot }: BoardProps) {
  const [pos, setPos] = useState<"ALL" | Pos>("ALL");
  const [q, setQ] = useState("");
  const [offName, setOffName] = useState("");
  const [offPos, setOffPos] = useState<Pos>("K");
  const [offError, setOffError] = useState("");
  function addOffboard(want: "gone" | "mine") {
    const name = offName.trim();
    if (!name) return;
    if (Object.keys(DS).some(k => (offBoardPick(k)?.name ?? k).toLowerCase() === name.toLowerCase())) {
      setOffError("This player is already drafted. Use Undo to correct the previous pick."); return;
    }
    const row = P.find(r => r[0].toLowerCase() === name.toLowerCase());
    try { trackPick(row?.[0] ?? externalPickKey(ord.length + 1, offPos, name), want); setOffName(""); setOffError(""); }
    catch (error) { setOffError(String(error)); }
  }
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
  const [practiceBackup, setPracticeBackup] = usePersistent<{ DS: DraftState; ord: string[]; slot: number } | null>(
    "fd26-practice-backup", null, JSON.parse, JSON.stringify);
  function togglePractice() {
    if (practice) {
      if (practiceBackup) { setMySlot(practiceBackup.slot); applySync(practiceBackup.DS, practiceBackup.ord); }
      else reset();
      setPracticeBackup(null);
    } else {
      setPracticeBackup({ DS, ord: ord.slice(), slot: mySlot });
      reset();
    }
    setPractice(!practice);
  }
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
    if (!practice || !mySlot || myTurn) return;
    const run = fillToMyTurn(DS, ord, mySlot);
    if (!run.length) return;
    const t = setTimeout(() => applyRun(run), 260);
    return () => clearTimeout(t);
  }, [practice, mySlot, DS, ord, myTurn, applyRun]);

  function undoPick() {
    if (!practice) { undo(); return; }
    const lastOwn = ord.reduce((last, name, i) => DS[name] === 'mine' ? i : last, -1);
    if (lastOwn < 0) return;
    const previous = ord.slice(0, lastOwn);
    applySync(Object.fromEntries(previous.map(name => [name, DS[name]])), previous);
  }

  const grade = practiceOver && practice && mySlot && ord.length === 168 ? gradeDraft(ord, mySlot) : null;

  const toggleBlock = (name: string) =>
    setBlocked(blocked.includes(name) ? blocked.filter((x) => x !== name) : [...blocked, name]);
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
  const manual = !syncOn || practice;
  const done = practice ? practiceOver : picksMade >= 192;
  function trackPick(name: string, want: 'mine' | 'gone') {
    if (!manual || done) return;
    if (practice && (want !== 'mine' || !myTurn || DS[name])) return;
    if (want === 'mine' && (!mySlot || (!myTurn && DS[name] !== 'mine'))) return;
    mark(name, want);
  }
  const [syncMsg, setSyncMsg] = useState("");
  const [staleMarks, setStaleMarks] = useState(0);
  const DSRef = useRef(DS);
  DSRef.current = DS;
  const slotRef = useRef(mySlot);
  slotRef.current = mySlot;
  useEffect(() => {
    if (!syncOn || practice) return;
    const idMatch = sleeperId.match(/(\d{15,20})/);
    if (!idMatch) {
      setSyncMsg("Paste your Sleeper draft URL or ID first.");
      return;
    }
    const id = idMatch[1];
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
        const snapshot = sleeperSnapshot(picks, slotRef.current, P);
        const { offBoard } = snapshot;
        if (!stop) applySync(snapshot.DS, snapshot.ord);
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
  }, [syncOn, sleeperId, applySync, mySlot, practice]);

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
            <button type="button" className="bx" disabled={!manual || practice || done} aria-label={`Mark ${n} taken`} title={practice ? 'Opponents pick automatically in practice' : 'Drafted by another team (click again to undo)'} onClick={() => trackPick(n, "gone")}>
              Taken
            </button>
            <button type="button" className="bs" disabled={!manual || done || !mySlot || (!myTurn && st !== "mine") || (practice && (!myTurn || !!st))} aria-label={`Draft ${n}`} title={practice ? 'Draft this available player; use Undo to revisit your previous pick' : 'My pick (click again to undo)'} onClick={() => trackPick(n, "mine")}>
              Pick
            </button>
          </span>
        </td>
        <td className="num">{i + 1}</td>
        <td>
          <span className="inline-flex items-center gap-1.5 align-middle">
            <TeamIcon team={t} />
            <span className="pname">{n}</span><span className="mobile-position"><Sticker pos={p} /></span>
            <button
              type="button"
              onClick={() => toggleBlock(n)}
              aria-label={blocked.includes(n) ? `Restore ${n} to recommendations` : `Exclude ${n} from recommendations`}
              aria-pressed={blocked.includes(n)}
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
            aria-expanded={noteOpen(n)}
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
              mock {MKT[n] ? MKT[n][0].toFixed(1) : "—"}
            </span>
          )}
        </td>
        <td className="num hidden min-[1400px]:table-cell">
          {MKT[n] ? MKT[n][0].toFixed(1) : <span className="text-ink-3">—</span>}
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

  return <div className="draft-workspace">
    <div className="workspace-title"><div><span className="section-caption">charmin ultra strong · 12-team half-PPR</span><h1>Draft room</h1></div><span className={`mode-badge ${practice ? 'practice' : ''}`}><span />{practice ? 'Practice mode' : syncOn ? 'Live sync' : 'Manual tracking'}</span></div>
    <SeatPicker value={mySlot} onChange={setMySlot} allSeats />
    <div className={`draft-clock ${myTurn && !done ? 'your-turn' : ''}`} aria-live="polite">
      <div className="clock-pick"><small>{done ? 'Finished' : 'On the clock'}</small><b>{done ? picksMade : `#${picksMade + 1}`}</b></div>
      <div className="clock-owner"><strong>{done ? 'Review your roster' : myTurn ? "You're up" : DRAFT_ORDER[snapTeam(picksMade + 1) - 1]}</strong><span>{done ? `${myPickCount} players on your team` : `Round ${Math.ceil((picksMade + 1) / 12)} · Pick ${roundPick(picksMade + 1)}`}</span></div>
      <div className="clock-progress"><span>{myPickCount} / {practice ? 14 : 16} rostered</span><progress value={myPickCount} max={practice ? 14 : 16} aria-label="Your draft progress" /></div>
      <div className="clock-links"><a className="btn subtle" href="#draft-advisor">Your targets</a><a className="btn subtle" href="#player-pool">Player pool</a></div>
    </div>
    <div className="room-actions"><button type="button" className={`btn ${practice ? 'primary' : ''}`} disabled={!mySlot} onClick={togglePractice}>{practice ? 'Return to draft' : 'Practice draft'}</button><button type="button" className="btn" disabled={(practice ? myPickCount === 0 : !canUndo) || !manual} onClick={undoPick}>Undo last pick</button><span className="last-pick" role="status">{ord.length ? `Last pick: ${offBoardPick(ord.at(-1)!)?.name ?? ord.at(-1)}` : practice ? 'Choose your first player when your turn arrives.' : 'Choose your seat, then follow your targets.'}</span>
      <details className="room-settings"><summary className="btn">Room settings</summary><div className="settings-body">
        <label>Opponent style<select value={lean} onChange={e => { const v = e.target.value as RbLean; setLean(v); setRbLean(v); }}>{(Object.keys(RB_LEAN) as RbLean[]).map(k => <option key={k} value={k}>{RB_LEAN[k].label}</option>)}</select></label>
        <label>Known upcoming pick<input value={intelText} onChange={e => { setIntelText(e.target.value); setIntelErr(null); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyIntel(); } }} placeholder="Example: James Cook 8" /></label><button type="button" className="btn" disabled={!intelText.trim()} onClick={applyIntel}>Add intel</button>{intelErr && <p role="alert">{intelErr}</p>}
        <label>Sleeper draft URL<input value={sleeperId} onChange={e => setSleeperId(e.target.value)} aria-label="Sleeper draft URL or ID for live sync" /></label><button type="button" className="btn" disabled={practice} aria-pressed={syncOn} onClick={() => setSyncOn(!syncOn)}>{syncOn ? 'Switch to manual tracking' : 'Connect live sync'}</button>
        <button type="button" className={`btn ${resetArmed ? 'danger' : ''}`} disabled={!manual} onClick={() => { if (resetArmed) { reset(); setResetArmed(false); } else { setResetArmed(true); setTimeout(() => setResetArmed(false), 3500); } }}>{resetArmed ? 'Confirm reset' : 'Reset current board'}</button>
        <button type="button" className="btn" aria-pressed={allNotes} onClick={() => setAllNotes(!allNotes)}>{allNotes ? 'Collapse player notes' : 'Expand player notes'}</button>
        {blocked.length > 0 && <div><p>Excluded from recommendations</p>{blocked.map(name => <button type="button" className="btn" key={name} onClick={() => toggleBlock(name)}>Restore {name}</button>)}</div>}
      </div></details>
    </div>
    {practice ? <p className="mode-note">Practice against 11 simulated opponents for 14 skill rounds. Your original draft is saved and restored when you return.</p> : syncOn && <p className={`sync-status ${syncMsg.startsWith('Sync error') ? 'sync-error' : ''}`} role="status"><SleeperMark size={15} />{syncMsg || 'Connecting to Sleeper…'}{staleMarks > 0 && <span> Switch to manual tracking to keep or clear these local marks.</span>}</p>}
    {Object.keys(pins).length > 0 && <div className="intel-pins">{Object.entries(pins).map(([name, pin]) => <span key={name}><button type="button" className={`btn ${pin.on ? 'on' : ''}`} aria-pressed={pin.on} onClick={() => flipPin(name)}>{name} at #{pin.pick}</button><button type="button" className="btn subtle" aria-label={`Remove intel for ${name}`} onClick={() => dropPin(name)}>×</button></span>)}</div>}
    <div className="draft-layout"><aside className="draft-sidebar">
      {grade && <section className="practice-result"><span className="section-caption">Practice complete</span><h2>#{grade.rank} in projected starters</h2><p><b>{grade.mine.toFixed(1)} pts/wk</b> vs a {grade.median.toFixed(1)} median in this simulated room.</p><p>Projection totals for the best legal skill lineup. Results depend on the simulated opponents and exclude injuries, weekly lineup changes and K/DEF scoring.</p>{grade.gaps.length > 0 && <p className="text-risky">{grade.gaps.join(' · ')}</p>}<button type="button" className="btn primary" onClick={reset}>Practice again</button></section>}
      <AdvisorPanel DS={DS} mySlot={mySlot} ord={ord} noob={noob} blocked={blocked} lean={lean} intelVersion={JSON.stringify(pins)} manual={manual} mark={trackPick} rosterSize={practice ? 14 : 16} finished={done || myPickCount >= 16} />
    </aside><section className="player-pool" id="player-pool" aria-label="Player pool">
      <div className="pool-toolbar"><div className="pool-heading"><h2>Player pool</h2><span>{shown} shown</span></div><div className="pool-search"><input ref={searchRef} type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQ(''); if (e.key === 'Enter' && manual && query && firstUnmarked && (!practice || e.shiftKey) && (!e.shiftKey || myTurn) && !done) { trackPick(firstUnmarked, e.shiftKey ? 'mine' : 'gone'); setQ(''); } }} placeholder="Search player or team" aria-label="Search players" /><kbd>/</kbd></div>
      <div className="pool-filters"><div role="group" aria-label="Filter by position">{POS_FILTERS.map(pf => <button key={pf} type="button" aria-pressed={pos === pf} className={`btn ${pos === pf ? 'on' : ''}`} onClick={() => setPos(pf)}>{pf === 'ALL' ? 'All' : pf}</button>)}</div><label><input type="checkbox" checked={hideDrafted} onChange={e => setHideDrafted(e.target.checked)} />Available only</label></div>
      {manual && <p className="keyboard-hint">{practice ? 'Search + Shift+Enter: your pick · Escape: clear' : 'Search + Enter: taken · Shift+Enter: your pick · Escape: clear'}</p>}
      </div>
      {noob && <details className="draft-disclosure pool-help"><summary>How to use the draft room</summary><p>Choose your seat. Read the top target and alternatives. In live mode, select players in Sleeper; sync records every pick. In manual mode, use Draft for your pick and Taken for an opponent. In practice, choose your player and the opponents pick automatically. Undo revisits your previous practice decision or reverses your most recent manual action.</p><p>Green value labels indicate a favorable modeled price. Availability percentages are estimates and change with the room.</p></details>}
      {!syncOn && !practice && <details className="draft-disclosure offboard-form"><summary>Record a kicker, defense, or off-board player</summary><div className="offboard-fields"><input aria-label="Off-board player name" placeholder="Player or defense name" value={offName} onChange={e => setOffName(e.target.value)} /><select aria-label="Off-board position" value={offPos} onChange={e => setOffPos(e.target.value as Pos)}>{(['QB','RB','WR','TE','K','DST'] as Pos[]).map(p => <option key={p}>{p}</option>)}</select><button type="button" className="btn" disabled={!offName.trim() || done} onClick={() => addOffboard('gone')}>Taken off-board</button><button type="button" className="btn" disabled={!offName.trim() || !myTurn || done} onClick={() => addOffboard('mine')}>Pick off-board</button></div>{offError && <p role="alert">{offError}</p>}</details>}
      <div className="pool-table-wrap">
        <table className="tbl draft-table">
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
                  <Info tip={<>The board's overall rank for this 12-team, half-PPR league with two flex spots. Your live targets also account for roster needs, availability and the picks before your next turn.</>} />
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
                  <Info tip={<><b className="text-ink">Sleeper half-PPR average draft position</b>, compared with the current pick. Green <b className="text-value">▲</b> means the player has lasted past this market price; red <b className="text-avoid">▼</b> means an earlier selection. The advisor blends 75% Sleeper ADP with 25% mock ADP where both exist. Use the availability forecast to assess whether a player reaches your next turn.</>} />
                </span>
              </th>
              <th className="hidden !text-right min-[1400px]:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  mock
                  <Info tip={<>FantasyFootballCalculator's 12-team, half-PPR mock ADP. It contributes 25% of the advisor's market price where both this source and Sleeper ADP are available.</>} />
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
      {shown === 0 && <button type="button" className="btn" onClick={() => { setQ(''); setPos('ALL'); setHideDrafted(false); }}>Clear all filters</button>}
    </section></div>
  </div>;
}
