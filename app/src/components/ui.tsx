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
      className="inline-block shrink-0 self-center"
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
