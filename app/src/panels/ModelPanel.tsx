import { useState } from "react";
import { TD_MODEL, TD_MODEL_RATES } from "../data";
import { Intro, Noob, Sticker, TeamIcon } from "../components/ui";
import type { Pos } from "../data";

export function ModelPanel({ noob }: { noob: boolean }) {
  const [dir, setDir] = useState<"down" | "up">("down");
  const rows = TD_MODEL.filter((r) => (dir === "down" ? r.delta > 0 : r.delta < 0))
    .sort((a, b) => (dir === "down" ? b.delta - a.delta : a.delta - b.delta))
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="The model" title="Touchdowns are mostly opportunity — here's who got lucky">
        We fit a model on every 2025 skill player with real usage: how many touchdowns did their red-zone carries and
        red-zone targets actually predict? Opportunity explains <b className="text-ink">77%</b> of scoring. The players
        furthest from their expected total are the ones whose 2026 touchdown totals should move the most.
      </Intro>

      <Noob show={noob} title="Why this matters:">
        Touchdowns are the most volatile part of fantasy scoring, and a player's <i>chances</i> to score repeat far more
        reliably than the scores themselves. Someone who scored 11 times on 5 expected didn't get better — he got lucky,
        and next year he'll likely regress. Someone who scored 2 on 7 expected is the bargain.
      </Noob>

      <div className="card px-4 py-3 text-[0.88rem] text-ink-2">
        <b className="text-ink">What the data says a scoring chance is worth:</b>{" "}
        a red-zone carry is worth <b className="text-ink">{TD_MODEL_RATES.rzCarry.toFixed(3)}</b> touchdowns and a
        red-zone target <b className="text-ink">{TD_MODEL_RATES.rzTarget.toFixed(3)}</b> — nearly identical. Outside the
        red zone, volume barely scores at all ({TD_MODEL_RATES.nonRzTarget.toFixed(3)} per target). Fitted on{" "}
        {TD_MODEL_RATES.sample} players, R² = {TD_MODEL_RATES.r2}.
      </div>

      <div className="flex gap-1.5">
        <button type="button" className={`btn ${dir === "down" ? "on" : ""}`} onClick={() => setDir("down")}>
          Due to score less
        </button>
        <button type="button" className={`btn ${dir === "up" ? "on" : ""}`} onClick={() => setDir("up")}>
          Due to score more
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Rk</th>
              <th>Player</th>
              <th>Pos</th>
              <th className="!text-right">2025 TDs</th>
              <th className="!text-right">Expected</th>
              <th className="!text-right">Gap</th>
              <th className="!text-right">RZ chances</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="num">{r.rank}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    <TeamIcon team={r.team} />
                    <span className="pname">{r.name}</span>
                  </span>
                  <span className="pteam">{r.team}</span>
                </td>
                <td><Sticker pos={r.pos as Pos} /></td>
                <td className="num">{r.td}</td>
                <td className="num">{r.xtd.toFixed(1)}</td>
                <td className={`num font-bold ${r.delta > 0 ? "text-avoid" : "text-value"}`}>
                  {r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}
                </td>
                <td className="num">{r.rz}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="m-0 text-[0.82rem] leading-relaxed text-ink-3">
        Read the Gap column as touchdowns of luck: <b className="text-avoid">red</b> means he outscored his chances and
        should come back to earth, <b className="text-value">green</b> means his chances say he was robbed. This model was
        fit independently of our research notes — where the two agree (Goedert, Higgins, Adams, Achane going down;
        Jefferson and Lamb going up), that is two separate methods reaching the same call.
      </p>
    </div>
  );
}
