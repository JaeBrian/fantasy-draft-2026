import { useEffect, useMemo, useState } from 'react';
import { BYE, DRAFT_ORDER, SIM_PLANS } from '../data';
import { advise, needText, rosterSlots, type DraftState } from '../lib/advisor';
import { runForecast, type Forecast } from '../lib/forecast';
import type { RbLean } from '../lib/tendency';
import { offBoardPick } from '../lib/sleeper-draft';
import { CEIL } from '../ceilings';
import { InjChip, Sticker, TeamIcon } from './ui';

type Props = {
  DS: DraftState; ord: string[]; mySlot: number; blocked: string[]; lean: RbLean;
  manual: boolean; finished: boolean; rosterSize: 14 | 16; noob: boolean; intelVersion: string;
  mark: (name: string, want: 'mine' | 'gone') => void;
};

export function AdvisorPanel({ DS, ord, mySlot, blocked, lean, manual, finished, rosterSize, noob, intelVersion, mark }: Props) {
  const a = useMemo(() => advise(DS, mySlot, ord, new Set(blocked)), [DS, mySlot, ord, blocked, lean, intelVersion]);
  const [fc, setFc] = useState<Forecast | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [forecastError, setForecastError] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setFc(null); setForecastError(false); setProgress(null);
    if (!mySlot || finished || ord.length >= 168) return;
    setProgress(0);
    runForecast(DS, ord, mySlot, 5000, (done, total) => { if (active) setProgress(Math.round(100 * done / total)); }, controller.signal)
      .then(value => { if (active) { setFc(value); setProgress(null); } })
      .catch(() => { if (active) { setForecastError(true); setProgress(null); } });
    return () => { active = false; controller.abort(); };
  }, [DS, ord, mySlot, lean, finished, intelVersion]);
  const slots = rosterSlots(DS);
  const skillOnly = rosterSize === 14;
  const visibleSlots = skillOnly ? slots.filter(s => !['K', 'DST'].includes(s.label)) : slots;
  const starterTotal = skillOnly ? 8 : 10;
  const missingSpecial = slots.slice(0, 10).filter(s => ['K', 'DST'].includes(s.label) && !s.player);
  const waiting = !a.onClock;
  const candidates = a.cands.slice(0, 3);
  const top = candidates[0];
  const plan = SIM_PLANS[mySlot];
  const starterCount = slots.slice(0, starterTotal).filter(s => s.player).length;
  const displayName = (name: string) => offBoardPick(name)?.name ?? name;

  return <section id="draft-advisor" className={`advisor-panel ${a.onClock && !finished ? 'is-on-clock' : ''}`} aria-label="Draft recommendations">
    <div className="advisor-heading">
      <div><span className="section-caption">{mySlot ? DRAFT_ORDER[mySlot - 1] : 'Your team'}</span><h2>{finished ? 'Draft complete' : waiting ? 'Plan your next pick' : 'Your pick'}</h2></div>
      {mySlot > 0 && <span className="round-token">{a.myCount}<small> / {rosterSize}</small></span>}
    </div>
    {!mySlot ? <div className="empty-state"><h3>Choose your seat to begin</h3><p>Select Ashley, Brian JK, Emily, or another seat above. Your targets and roster will appear here.</p></div>
    : finished ? <p className="advisor-summary">Your roster is ready to review below.</p>
    : a.myCount >= 14 && missingSpecial.length ? <div className="pick-special"><h3>Fill your {missingSpecial[0].label === 'K' ? 'kicker' : 'defense'} slot</h3><p>Compare available starters in Sleeper. {manual ? 'Record your selection with the off-board pick form.' : 'Live sync will record your selection.'}</p></div>
    : <>
      <p className="advisor-summary">{waiting ? `Targets for pick ${a.nextPick}. Rankings update as players come off the board.` : 'Compare your top choices, then make your pick.'}</p>
      <div className="recommendations">
        {candidates.map((c, i) => {
          const name = c.now.r[0];
          const chance = Math.round(100 * (fc?.survive[name] ?? (waiting ? c.pReach : 1 - c.pGone)));
          const hasFuture = waiting || a.horizon.back <= 168;
          return <article key={name} className={`recommendation ${i === 0 ? 'recommended' : ''}`}>
            <div className="recommendation-label"><span>{i === 0 ? 'Top target' : `Alternative ${i}`}</span>{c.tied && <span className="close-call">Close call</span>}</div>
            <h3><TeamIcon team={c.now.r[2]} size={24} />{name}</h3>
            <div className="player-meta"><Sticker pos={c.p} /><span>{c.now.r[2]} · Bye {BYE[c.now.r[2]] ?? '—'}</span><InjChip name={name} /></div>
            <div className="pick-metrics"><span><b>{c.proj.toFixed(1)}</b> projected pts/wk</span>{hasFuture && <span><b>{chance}%</b> {waiting ? 'reaches your pick' : 'returns if you pass'}{fc ? '' : ' (estimate)'}</span>}</div>
            <p>{c.cuffOf ? `Backup for your ${c.cuffOf}.` : needText(c.p, a)}{c.clash ? ` Shares a Week ${c.bye} bye with ${a.byeCount[c.bye!]} rostered players.` : c.fell >= 6 ? ` Available ${Math.round(c.fell)} picks past market ADP.` : ''}</p>
            {manual && <div className="recommendation-actions"><button type="button" className={i === 0 ? 'btn primary' : 'btn'} disabled={!a.onClock} onClick={() => mark(name, 'mine')}>Draft {name.split(' ').at(-1)}</button>{!skillOnly && <button type="button" className="btn subtle" onClick={() => mark(name, 'gone')} aria-label={`Mark ${name} taken`}>Taken</button>}</div>}
          </article>;
        })}
      </div>
      {!manual && <p className="sync-hint">Make your selection in Sleeper. Picks update here automatically.</p>}
      {progress !== null && <div className="forecast-progress" role="status"><span>Updating availability… {progress}%</span><progress value={progress} max={100} aria-label="Availability forecast progress" /></div>}
      {forecastError && <p className="sync-hint" role="status">Forecast unavailable. Showing ADP estimates; it will retry after the next pick.</p>}
      {fc && <p className="forecast-caption">Availability modeled across {fc.sims.toLocaleString()} drafts{fc.sims === 0 ? '; no intervening opponent picks' : ''}.</p>}
      {a.warnings.length > 0 && <div className="roster-warning"><b>Roster needs</b><p>{(noob ? a.plainWarn : a.warnings).join(' · ') || a.warnings.join(' · ')}</p></div>}
      <details className="draft-disclosure"><summary>Why these picks?</summary>
        {top && <p>{top.gap > 0 ? `The projected ${top.p} options lose about ${top.gap.toFixed(1)} points per week before your next turn.` : 'The remaining positional options project similarly; compare roster fit and availability.'}</p>}
        {a.look && a.look.edge >= 0.8 && <p>{a.look.first.p} now and {a.look.second.p} later leads the reverse order by about {a.look.edge.toFixed(1)} modeled pts/wk.</p>}
        {top && CEIL[top.now.r[0]]?.games >= 6 && <p>Historical 2025 weekly range for {top.now.r[0]}: {CEIL[top.now.r[0]].p10.toFixed(0)}–{CEIL[top.now.r[0]].p90.toFixed(0)} points (10th–90th percentile).</p>}
        {fc?.runs.filter(r => r.p >= 0.5 && r.expected >= 2).map(r => <p key={r.pos}>{Math.round(r.p * 100)}% modeled chance that at least three {r.pos}s go before the forecasted turn.</p>)}
        {a.dream && <p>If {a.dream.o.r[0]} falls, compare him again on the live board.</p>}
      </details>
      {fc && fc.room.length > 0 && <details className="draft-disclosure"><summary>Teams picking before the forecasted turn <span>{fc.room.length}</span></summary><ul className="rival-list">{fc.room.map(r => <li key={r.pick}><span>#{r.pick} {DRAFT_ORDER[r.team - 1]}</span><small>{r.needs.length ? `Needs ${r.needs.join(', ')}` : r.has}</small></li>)}</ul></details>}
    </>}
    {mySlot > 0 && <details className="draft-disclosure roster-disclosure" open><summary>Your roster <span>{starterCount}/{starterTotal} {skillOnly ? 'skill starters' : 'starters'}</span></summary><div className="roster-grid">{visibleSlots.map((s, i) => <div key={i} className={s.player ? 'filled' : ''}><span>{s.label}</span><b>{s.player ? displayName(s.player) : 'Open slot'}</b></div>)}</div></details>}
    {plan && <details className="draft-disclosure"><summary>Six-round reference plan</summary><p>Selection frequencies from 4,000 modeled drafts. Use the live targets above as picks change.</p><ol className="reference-picks">{plan.picks.map(p => <li key={p.pick}><b>#{p.pick}</b><span>{p.opts.map(([name, pct]) => `${name} ${pct}%`).join(' / ')}</span></li>)}</ol></details>}
  </section>;
}
