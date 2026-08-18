import type { ReactNode } from "react";
import { TAGS, TAGCLASS, VLBL, type Pos, type Verdict } from "../data";

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

export function Call({ v, label }: { v: Verdict; label?: string }) {
  return <span className={`call ${CALL_STYLE[v]}`}>{label ?? VLBL[v]}</span>;
}

export function TagChips({ tags, max }: { tags: string[] | undefined; max?: number }) {
  const list = (tags ?? []).slice(0, max ?? tags?.length ?? 0);
  return (
    <>
      {list.map((t) =>
        TAGS[t] ? (
          <span key={t} className={`tag ${TAGCLASS[t] ?? ""}`} title={TAGS[t][1]}>
            {TAGS[t][0]}
          </span>
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
