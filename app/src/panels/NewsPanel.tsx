import { NEWS } from "../data";
import { NEWS as WIRE } from "../news";
import { NEWS_RANK } from "../lib/news";
import { Intro, Noob, NewsTag, TeamIcon } from "../components/ui";
import { P } from "../data";
import { useState } from "react";

const POS_OF: Record<string, string> = {};
const TEAM_OF: Record<string, string> = {};
P.forEach((r) => { POS_OF[r[0]] = r[1]; TEAM_OF[r[0]] = r[2]; });

const when = (t: number): string => {
  const d = Math.floor(Date.now() / 1000 - t);
  if (d < 3600) return "just now";
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  const days = Math.floor(d / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
};

/** Every sourced item on the board, newest first — the actual wire, not a hand-written log.
 *
 *  Deduped, because both aggregators relay the same reporting: Breece Hall's groin showed up
 *  twice on the same day, both of them Zack Rosenblatt's report. One story, one line. Same
 *  player and same kind of news inside two days is treated as one item, and we keep the copy
 *  with the fuller attribution ("Zack Rosenblatt, The Athletic" over "Zack Rosenblatt"). */
function wireItems() {
  const all: { name: string; t: number; a: string; d: string; h: string; g?: string }[] = [];
  for (const [name, items] of Object.entries(WIRE))
    for (const n of items) all.push({ name, ...n });
  all.sort((a, b) => b.t - a.t);

  const kept: typeof all = [];
  for (const n of all) {
    const dup = kept.find(
      (k) => k.name === n.name && (k.g ?? "") === (n.g ?? "") && Math.abs(k.t - n.t) < 2 * 86400,
    );
    if (!dup) { kept.push(n); continue; }
    if (n.a.length > dup.a.length) { dup.a = n.a; dup.d = n.d; }   // better sourced — keep that one
  }
  return kept;
}

export function NewsPanel({ noob }: { noob: boolean }) {
  const [onlyBig, setOnlyBig] = useState(true);
  const all = wireItems();
  /* "what changes a pick" = an availability or role call, not a camp-buzz note */
  const big = all.filter((n) => n.g && NEWS_RANK[n.g] <= 6);
  const shown = (onlyBig ? big : all).slice(0, 40);

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="News" title="Recent updates">
        The wire first, then the log of what changed in the board itself. Arrows show the impact on a player's draft
        stock.
      </Intro>
      <Noob show={noob} title="Reading the feed:">
        <span className="font-bold text-value">▲</span> = good news for that player (worth more than yesterday) ·{" "}
        <span className="font-bold text-avoid">▼</span> = bad news (let someone else pay yesterday's price). Check the top
        entry the morning of your draft.
      </Noob>

      {/* ---- the live wire ---- */}
      <section className="card px-5 py-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="display m-0 text-[1.05rem] tracking-wide text-ink">
            <span className="text-clock">●</span> Live wire
          </h3>
          <button
            type="button"
            onClick={() => setOnlyBig((v) => !v)}
            className="rounded-sm border border-ink-3/40 px-2 py-0.5 font-mono text-[0.7rem] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink"
          >
            {onlyBig ? `showing ${big.length} that move a pick — show all ${all.length}` : `showing all ${all.length} — show only what moves a pick`}
          </button>
        </div>
        <p className="mb-3 mt-0 text-[0.8rem] leading-relaxed text-ink-3">
          Straight from Sleeper's per-player feed, <b className="text-ink-2">filtered to items that trace back to a named
          reporter or a direct quote</b>. 57% of the feed is thrown away — the aggregators' own analysis is
          AI-written and gets things wrong. Every line below carries who reported it, so you can weigh it yourself.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {shown.map((n, i) => (
            <li key={i} className="border-b border-ink-3/15 pb-2.5 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <TeamIcon team={TEAM_OF[n.name]} size={13} />
                <b className="text-ink">{n.name}</b>
                <span className="font-mono text-[0.68rem] text-ink-3">{POS_OF[n.name]}</span>
                {n.g && <NewsTag tag={n.g} />}
                <span className="ml-auto font-mono text-[0.68rem] text-ink-3">{when(n.t)}</span>
              </div>
              <div className="mt-0.5 text-[0.9rem] leading-relaxed text-ink-2">{n.d}</div>
              <div className="mt-0.5 font-mono text-[0.68rem] text-ink-3">— {n.a}</div>
            </li>
          ))}
          {!shown.length && <li className="text-[0.9rem] text-ink-3">Nothing sourced in the window.</li>}
        </ul>
      </section>

      {/* ---- the hand-kept log of board changes ---- */}
      {NEWS.map((u) => (
        <section key={u.when} className="card px-5 py-4">
          <h3 className="display m-0 mb-2 text-[1.05rem] tracking-wide text-ink">
            <span className="text-value">●</span> {u.when}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {u.items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[0.92rem] leading-relaxed text-ink-2">
                {it.dir && (
                  <span className={`font-bold ${it.dir === "up" ? "text-value" : "text-avoid"}`}>
                    {it.dir === "up" ? "▲" : "▼"}
                  </span>
                )}
                <span>
                  {it.player && <b className="text-ink">{it.player} — </b>}
                  {it.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
