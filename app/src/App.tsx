import { useCallback, useEffect, useRef, useState } from "react";
import { NEWS } from "./data";
import { usePersistent } from "./lib/store";
import type { DraftState, Mark } from "./lib/advisor";
import { StartPanel } from "./panels/StartPanel";
import { NewsPanel } from "./panels/NewsPanel";
import { SimPanel } from "./panels/SimPanel";
import { ModelPanel } from "./panels/ModelPanel";
import { PlanPanel } from "./panels/PlanPanel";
import { RookiesPanel } from "./panels/RookiesPanel";
import { AvoidPanel } from "./panels/AvoidPanel";
import { VegasPanel } from "./panels/VegasPanel";
import { BoardPanel } from "./panels/BoardPanel";
import { AdpPanel } from "./panels/AdpPanel";
import { TiersPanel } from "./panels/TiersPanel";

const TABS = [
  ["start", "Start Here"],
  ["board", "Draft"],
  ["adp", "Sleeper ADP"],
  ["news", "News"],
  ["sims", "Simulations"],
  ["model", "TD Model"],
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
  /* remember the tab you were on across refreshes */
  const [tab, setTab] = usePersistent<TabKey>(
    "fd26-tab",
    "start",
    (raw) => (TABS.some(([k]) => k === raw) ? (raw as TabKey) : "start"),
    (v) => v
  );
  const [noob, setNoob] = usePersistent("fd26-noob", true, (r) => r === "1", (v) => (v ? "1" : "0"));
  const [mySlot, setMySlot] = usePersistent("fd26-slot", 0, (r) => parseInt(r) || 0, String);
  const [DS, setDS] = usePersistent<DraftState>("fd26-draft", {}, parseDS, JSON.stringify);
  // Pick order (overall pick 1, 2, 3…) — the advisor rebuilds every team's
  // roster from it. Reconciled against DS on load, same as the v1 page did.
  const [ord, setOrd] = useState<string[]>(() => {
    let o: string[] = [];
    try {
      o = JSON.parse(localStorage.getItem("fd26-ord") || "[]") as string[];
    } catch {
      o = [];
    }
    o = o.filter((n) => DS[n]);
    Object.keys(DS).forEach((n) => {
      if (!o.includes(n)) o.push(n);
    });
    return o;
  });
  useEffect(() => {
    try {
      localStorage.setItem("fd26-ord", JSON.stringify(ord));
    } catch {
      /* storage unavailable */
    }
  }, [ord]);
  const hist = useRef<{ n: string; prev: Mark | "" }[]>([]);
  const [histSize, setHistSize] = useState(0);

  const applyMark = useCallback(
    (n: string, state: Mark | "") => {
      const next = { ...DS };
      if (state) {
        if (!next[n]) setOrd((o) => [...o, n]);
        next[n] = state;
      } else {
        delete next[n];
        setOrd((o) => o.filter((x) => x !== n));
      }
      setDS(next);
    },
    [DS, setDS]
  );

  /* publish the real header height as --hdr so sticky panels always clear it, at any zoom */
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--hdr", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mark = useCallback(
    (n: string, want: Mark) => {
      hist.current.push({ n, prev: DS[n] ?? "" });
      if (hist.current.length > 200) hist.current.shift();
      setHistSize(hist.current.length);
      applyMark(n, DS[n] === want ? "" : want);
    },
    [DS, applyMark]
  );

  const undo = useCallback(() => {
    const h = hist.current.pop();
    setHistSize(hist.current.length);
    if (!h) return;
    applyMark(h.n, h.prev);
  }, [applyMark]);

  /* Practice draft: apply a run of AI picks in a single write. Looping `mark` would read a
   * stale DS from its own closure and drop all but the last pick. */
  const applyRun = useCallback(
    (names: string[]) => {
      if (!names.length) return;
      names.forEach((n) => {
        hist.current.push({ n, prev: DS[n] ?? "" });
      });
      if (hist.current.length > 200) hist.current = hist.current.slice(-200);
      setHistSize(hist.current.length);
      const next = { ...DS };
      names.forEach((n) => {
        next[n] = "gone";
      });
      setOrd((o) => [...o, ...names.filter((n) => !DS[n])]);
      setDS(next);
    },
    [DS, setDS],
  );

  const applySync = useCallback((state: DraftState, order: string[]) => {
    setDS(previous => JSON.stringify(previous) === JSON.stringify(state) ? previous : state);
    setOrd(previous => JSON.stringify(previous) === JSON.stringify(order) ? previous : order);
    hist.current = [];
    setHistSize(0);
  }, [setDS]);

  const reset = useCallback(() => {
    hist.current = [];
    setHistSize(0);
    setOrd([]);
    setDS({});
  }, [setDS]);

  const switchTab = (t: TabKey) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-line bg-field/95 backdrop-blur">
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
            <span className="text-[0.83rem] text-ink-3">12-team · half-PPR · updated {NEWS[0].when.split(" · ")[0]}</span>
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


      <main className={`mx-auto px-5 pt-7 pb-16 ${tab === "board" ? "max-w-[1560px]" : "max-w-[1100px]"}`}>
        {tab === "start" && <StartPanel noob={noob} />}
        {tab === "adp" && <AdpPanel noob={noob} />}
        {tab === "news" && <NewsPanel noob={noob} />}
        {tab === "sims" && <SimPanel noob={noob} />}
        {tab === "model" && <ModelPanel noob={noob} />}
        {tab === "board" && (
          <BoardPanel
            noob={noob}
            DS={DS}
            ord={ord}
            mark={mark}
            undo={undo}
            reset={reset}
            applyRun={applyRun}
            applySync={applySync}
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
          Refreshed September 4, 2026: Sleeper half-PPR ADP, component projections scored under this league’s rules,
          2025 game logs, player status and attributed news; FantasyFootballCalculator mock ADP; official team reports.
          Hashtag Football projections provide an independent reasonableness and sensitivity check.
          Older expert commentary, implied totals and player profiles are background context. Verify injury news on draft day.
        </footer>
      </main>
    </>
  );
}
