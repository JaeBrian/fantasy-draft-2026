import { NEWS } from "../data";
import { Intro, Noob } from "../components/ui";

export function NewsPanel({ noob }: { noob: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="News" title="Recent updates">
        Everything that changed, newest first — refreshed automatically every morning at 7 AM PT. Arrows show the
        impact on a player's draft stock.
      </Intro>
      <Noob show={noob} title="Reading the feed:">
        <span className="font-bold text-value">▲</span> = good news for that player (worth more than yesterday) ·{" "}
        <span className="font-bold text-avoid">▼</span> = bad news (let someone else pay yesterday's price). Check the top
        entry the morning of your draft.
      </Noob>
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
