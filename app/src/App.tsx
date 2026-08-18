import { useCallback, useRef, useState } from "react";
import { usePersistent } from "./lib/store";
import type { DraftState, Mark } from "./lib/advisor";
import { StartPanel } from "./panels/StartPanel";
import { PlanPanel } from "./panels/PlanPanel";
import { RookiesPanel } from "./panels/RookiesPanel";
import { AvoidPanel } from "./panels/AvoidPanel";
import { VegasPanel } from "./panels/VegasPanel";
import { BoardPanel } from "./panels/BoardPanel";
import { TiersPanel } from "./panels/TiersPanel";

const TABS = [
  ["start", "Start Here"],
  ["board", "Big Board"],
  ["tiers", "Position Tiers"],
  ["plan", "Draft Plan"],
  ["rookies", "Rookies"],
  ["avoid", "Do Not Draft"],
  ["vegas", "Vegas Board"],
] as const;

type TabKey = (typeof TABS)[number][0];

const parseDS = (raw: string): DraftState => {
  try {
    return JSON.parse(raw) as DraftState;
  } catch {
    return {};
  }
};

export default function App() {
  const [tab, setTab] = useState<TabKey>("start");
  const [noob, setNoob] = usePersistent("fd26-noob", true, (r) => r === "1", (v) => (v ? "1" : "0"));
  const [mySlot, setMySlot] = usePersistent("fd26-slot", 0, (r) => parseInt(r) || 0, String);
  const [DS, setDS] = usePersistent<DraftState>("fd26-draft", {}, parseDS, JSON.stringify);
  const hist = useRef<{ n: string; prev: Mark | "" }[]>([]);
  const [histSize, setHistSize] = useState(0);

  const mark = useCallback(
    (n: string, want: Mark) => {
      hist.current.push({ n, prev: DS[n] ?? "" });
      if (hist.current.length > 200) hist.current.shift();
      setHistSize(hist.current.length);
      const next = { ...DS };
      if (next[n] === want) delete next[n];
      else next[n] = want;
      setDS(next);
    },
    [DS, setDS]
  );

  const undo = useCallback(() => {
    const h = hist.current.pop();
    setHistSize(hist.current.length);
    if (!h) return;
    setDS((prev) => {
      const next = { ...prev };
      if (h.prev) next[h.n] = h.prev;
      else delete next[h.n];
      return next;
    });
  }, [setDS]);

  const reset = useCallback(() => {
    hist.current = [];
    setHistSize(0);
    setDS({});
  }, [setDS]);

  const switchTab = (t: TabKey) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-field/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-3.5 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="display text-[1.6rem] font-bold uppercase leading-none tracking-[0.02em] text-ink">
                Fantasy Draft
              </span>
              <span className="display rounded-sm bg-clock px-1.5 pt-px pb-0.5 text-[1.05rem] font-bold leading-none text-[#171204]">
                '26
              </span>
            </div>
            <span className="text-[0.83rem] text-ink-3">12-team · half-PPR · updated Aug 17, 2026</span>
            <button
              type="button"
              aria-pressed={noob}
              onClick={() => setNoob(!noob)}
              className={`ml-auto flex items-center gap-2 rounded-[5px] border px-3.5 py-1.5 text-[0.83rem] font-semibold transition-colors ${
                noob ? "border-wr/50 text-wr" : "border-line text-ink-2 hover:border-ink-3"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${noob ? "bg-wr" : "bg-ink-3"}`} />
              Beginner mode
            </button>
          </div>
          <nav className="-mx-1 flex overflow-x-auto [scrollbar-width:none]" aria-label="Sections">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={`display whitespace-nowrap border-b-[3px] px-3 pt-2 pb-1.5 text-[1.02rem] font-semibold uppercase tracking-[0.07em] transition-colors ${
                  tab === key ? "border-clock text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pt-7 pb-16">
        {tab === "start" && <StartPanel noob={noob} />}
        {tab === "board" && (
          <BoardPanel
            noob={noob}
            DS={DS}
            mark={mark}
            undo={undo}
            reset={reset}
            canUndo={histSize > 0}
            mySlot={mySlot}
            setMySlot={setMySlot}
          />
        )}
        {tab === "tiers" && <TiersPanel noob={noob} DS={DS} />}
        {tab === "plan" && <PlanPanel noob={noob} />}
        {tab === "rookies" && <RookiesPanel noob={noob} />}
        {tab === "avoid" && <AvoidPanel noob={noob} />}
        {tab === "vegas" && <VegasPanel noob={noob} />}

        <footer className="mt-10 border-t border-line pt-6 text-[0.8rem] leading-relaxed text-ink-3">
          Sources: FantasyPros (live half-PPR expert consensus + tiers, pulled Aug 17), Justin Boone's Yahoo top-300
          (updated Aug 17), ESPN (Field Yates, xTD models, 10-analyst panel), CBS Sports, NBC/Rotoworld, PFF, 4for4
          (Underdog ADP tool, 713 players, Aug 17 pull), Establish The Run, RotoWire, Sharp Football Analysis (implied
          totals &amp; O-line ranks), DraftKings lines via Action-market aggregators, Footballguys, PlayerProfiler,
          Draft Sharks injury model, team beat coverage, and BDGE's Aug 11 "Official Top 50" video. Compiled Aug 17,
          2026 — verify injury news on draft day. Not betting advice; it's a fantasy draft guide.
        </footer>
      </main>
    </>
  );
}
