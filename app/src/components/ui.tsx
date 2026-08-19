import { SLP } from "../sleeper";
import { NEWS } from "../news";
import { topNews } from "../lib/news";
import { SLEEPER_ICON } from "../brand";
import { useRef, useState, type ReactNode } from "react";
import { TAGS, TAGCLASS, VLBL, type Pos, type Verdict } from "../data";
import { TEAM_LOGOS } from "../teams-logos";

/** Styled hover/focus tooltip. Rendered position:fixed so it never gets
 *  clipped by the table's scroll container. */
export function Tip({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150);
    setPos({ x, y: r.bottom + 7 });
  };
  const hide = () => setPos(null);
  return (
    <span
      ref={ref}
      tabIndex={0}
      className="inline-flex outline-none"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && (
        <span role="tooltip" className="tipbox" style={{ left: pos.x, top: pos.y, transform: "translateX(-50%)" }}>
          {tip}
        </span>
      )}
    </span>
  );
}

/** Small "i" dot for column headers — hover or focus it for the explanation. */
export function Info({ tip }: { tip: ReactNode }) {
  return (
    <Tip tip={tip}>
      <span aria-label="What this column means" className="info-dot">
        i
      </span>
    </Tip>
  );
}

export function TeamIcon({ team, size = 18 }: { team: string; size?: number }) {
  const src = TEAM_LOGOS[team];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="inline-block shrink-0 align-[-0.18em]"
      style={{ filter: "drop-shadow(0 0 1px rgba(233,237,243,0.35))" }}
    />
  );
}

const POS_BG: Record<Pos, string> = {
  QB: "bg-qb",
  RB: "bg-rb",
  WR: "bg-wr",
  TE: "bg-te",
  K: "bg-k",
  DST: "bg-dst",
};

export function Sticker({ pos }: { pos: Pos }) {
  return <span className={`sticker ${POS_BG[pos]}`}>{pos}</span>;
}

const CALL_STYLE: Record<Verdict, string> = {
  buy: "text-value bg-value/12",
  solid: "text-solid bg-solid/12",
  risk: "text-risky bg-risky/12",
  avoid: "text-avoid bg-avoid/12",
};

const VDESC: Record<Verdict, string> = {
  buy: "Priced below his real value — happy to take him a little before his ADP.",
  solid: "Fairly priced — take him at or after his ADP.",
  risk: "Real upside, real red flags — only at a discount.",
  avoid: "The price ignores a live problem — let someone else pay it.",
};

export function Call({ v, label, explain }: { v: Verdict; label?: string; explain?: boolean }) {
  const chip = <span className={`call ${CALL_STYLE[v]}`}>{label ?? VLBL[v]}</span>;
  if (!explain) return chip;
  return (
    <Tip
      tip={
        <>
          <b className="text-ink">{VLBL[v]}</b> — {VDESC[v]}
        </>
      }
    >
      {chip}
    </Tip>
  );
}

export function TagChips({ tags, max }: { tags: string[] | undefined; max?: number }) {
  const list = (tags ?? []).slice(0, max ?? tags?.length ?? 0);
  return (
    <>
      {list.map((t) =>
        TAGS[t] ? (
          <Tip
            key={t}
            tip={
              <>
                <b className="text-ink">{TAGS[t][0]}</b> — {TAGS[t][1]}
              </>
            }
          >
            <span className={`tag ${TAGCLASS[t] ?? ""}`}>{TAGS[t][0]}</span>
          </Tip>
        ) : null
      )}
    </>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`eyebrow mb-2.5 ${className}`}>{children}</div>;
}

/** Panel intro: eyebrow + condensed display headline + lede. */
export function Intro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display m-0 text-[2.1rem] text-ink">{title}</h2>
      {children && <p className="mt-2 mb-0 max-w-[70ch] text-[1.01rem] text-ink-2">{children}</p>}
    </div>
  );
}

/** Beginner-mode callout. Hidden entirely when beginner mode is off. */
export function Noob({ show, title, children }: { show: boolean; title?: ReactNode; children: ReactNode }) {
  if (!show) return null;
  return (
    <div className="rounded-md border border-wr/25 bg-wr/8 px-4.5 py-3.5 text-[0.93rem] leading-relaxed">
      {title && <b className="text-wr">{title}</b>} {children}
    </div>
  );
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.93rem]">
      {rows.map(([k, v], i) => (
        <FragmentRow key={i} k={k} v={v} />
      ))}
    </dl>
  );
}

function FragmentRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <>
      <dt className="whitespace-nowrap font-semibold text-ink">{k}</dt>
      <dd className="m-0 text-ink-2">{v}</dd>
    </>
  );
}

/** Sleeper wordmark/icon — used wherever Sleeper's live data appears. */
export function SleeperMark({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle" title="Data: Sleeper (read-only public API)">
      <img src={SLEEPER_ICON} width={size} height={size} alt="Sleeper" className="inline-block rounded-[3px]" />
      {label && <span className="text-[0.72rem] text-ink-3">{label}</span>}
    </span>
  );
}

/** Live injury designation straight from Sleeper. */
export function InjChip({ name, className = "" }: { name: string; className?: string }) {
  const inj = SLP[name]?.inj;
  if (!inj) return null;
  const soft = inj === "Q" || inj === "D";
  const full = inj === "Q" ? "Questionable" : inj === "D" ? "Doubtful" : inj === "O" ? "Out" : inj;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1 font-mono text-[0.62rem] font-bold ${soft ? "border-risky/60 text-risky" : "border-avoid/60 text-avoid"} ${className}`}
      title={`Sleeper live injury designation: ${full}`}
    >
      <img src={SLEEPER_ICON} width={10} height={10} alt="Sleeper" className="rounded-[2px] opacity-80" />
      {inj}
    </span>
  );
}

/** 24h waiver heat across Sleeper leagues. */
export function TrendChip({ name }: { name: string }) {
  const t = SLP[name]?.trend;
  if (t === undefined) return null;
  const k = Math.max(1, Math.round(Math.abs(t) / 1000));
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-[0.65rem] text-ink-3"
      title={`${Math.abs(t).toLocaleString()} Sleeper leagues ${t > 0 ? "added" : "dropped"} him in the last 24 hours`}
    >
      <img src={SLEEPER_ICON} width={9} height={9} alt="Sleeper" className="rounded-[2px] opacity-70" />
      {t > 0 ? `\u{1F525}${k}k` : `\u{1F9CA}${k}k`}
    </span>
  );
}

/** Stacked priority chevrons, the way an issue tracker marks severity — one arrow for a
 *  nudge, three for drop-what-you-are-doing. Stacked vertically rather than strung out
 *  sideways because at a glance you read the HEIGHT of the stack rather than counting glyphs,
 *  and a draft board is somewhere you are always glancing. */
export function Chevrons({ n, dir, title }: { n: 1 | 2 | 3; dir: "up" | "down"; title?: string }) {
  const h = 4 + n * 3.2;
  return (
    <svg
      viewBox={`0 0 10 ${h}`}
      width={9}
      height={h * 0.9}
      className="inline-block shrink-0 align-middle"
      aria-hidden="true"
      focusable="false"
    >
      {title && <title>{title}</title>}
      {Array.from({ length: n }, (_, i) => {
        /* stack away from the point, so the tip stays put as the stack grows */
        const y = dir === "up" ? 1.6 + i * 3.2 : h - 1.6 - i * 3.2;
        const tip = dir === "up" ? y - 1.6 : y + 1.6;
        return (
          <polyline
            key={i}
            points={`1,${y} 5,${tip} 9,${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1 - i * 0.12}
          />
        );
      })}
    </svg>
  );
}

/* ---- the wire ---------------------------------------------------------------------------
 * Sleeper's per-player news, filtered to items that trace back to a named reporter or a
 * direct quote. Worth its own place on the board for one reason: the season projections do
 * not move. Pulling them two days apart shifted exactly zero players. So between now and the
 * draft the wire is the only input that changes, and a projection built on a workhorse
 * assumption cannot tell you that the coach has said he will not use one. */

/** How much a tag should change what you do, and what it looks like. */
const NEWS_TAGS: Record<string, { label: string; cls: string; rank: number }> = {
  out:       { label: "OUT",       cls: "border-avoid/70 bg-avoid/15 text-avoid",   rank: 0 },
  miss:      { label: "WILL MISS", cls: "border-avoid/70 bg-avoid/15 text-avoid",   rank: 1 },
  suspended: { label: "SUSP",      cls: "border-avoid/70 bg-avoid/15 text-avoid",   rank: 2 },
  committee: { label: "COMMITTEE", cls: "border-risky/70 bg-risky/15 text-risky",   rank: 3 },
  workload:  { label: "WORKLOAD",  cls: "border-risky/70 bg-risky/15 text-risky",   rank: 4 },
  demoted:   { label: "DEMOTED",   cls: "border-risky/70 bg-risky/15 text-risky",   rank: 5 },
  holdout:   { label: "HOLDOUT",   cls: "border-risky/70 bg-risky/15 text-risky",   rank: 6 },
  hurt:      { label: "HURT",      cls: "border-risky/60 text-risky",               rank: 7 },
  promoted:  { label: "PROMOTED",  cls: "border-value/70 bg-value/15 text-value",   rank: 8 },
  back:      { label: "BACK",      cls: "border-value/60 text-value",               rank: 9 },
  hype:      { label: "BUZZ",      cls: "border-ink-3/50 text-ink-3",               rank: 10 },
};

const ago = (t: number): string => {
  const d = Math.floor((Date.now() / 1000 - t) / 86400);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
};

/** Board-row badge. Only draws for news that bears on the pick — buzz stays silent. */
export function NewsChip({ name }: { name: string }) {
  const top = topNews(name);
  if (!top || !top.g) return null;
  const meta = NEWS_TAGS[top.g];
  if (meta.rank >= 10) return null;
  const items = NEWS[name] || [];
  return (
    <Tip
      tip={
        <span className="block max-w-[22rem] text-left">
          {items.slice(0, 3).map((n, i) => (
            <span key={i} className="mb-1.5 block last:mb-0">
              <span className="text-[0.66rem] text-ink-3">
                {ago(n.t)} &middot; {n.a}
              </span>
              <span className="block text-ink">{n.d}</span>
            </span>
          ))}
          <span className="mt-1 block border-t border-ink-3/25 pt-1 text-[0.64rem] text-ink-3">
            Sourced items only &mdash; reporting the wire relayed, not its own analysis.
          </span>
        </span>
      }
    >
      <span className={`inline-flex items-center rounded-sm border px-1 font-mono text-[0.58rem] font-bold tracking-tight ${meta.cls}`}>
        {meta.label}
      </span>
    </Tip>
  );
}

/** The tag on its own, for the news page where the player is already named. */
export function NewsTag({ tag }: { tag: string }) {
  const meta = NEWS_TAGS[tag];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-sm border px-1 font-mono text-[0.58rem] font-bold tracking-tight ${meta.cls}`}>
      {meta.label}
    </span>
  );
}
