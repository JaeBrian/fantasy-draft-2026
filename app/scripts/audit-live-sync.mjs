/* End-to-end test of the live-sync path against a REAL Sleeper draft that has picks:
   fetch actual pick payloads and run the app's exact resolution logic on them. */
const { P } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');

const normName = (s) =>
  s.toLowerCase().replace(/[.'-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();

const lookup = new Map(P.map((r) => [normName(r[0]), r[0]]));
const teamOf = new Map(P.map((r) => [r[0], r[2]]));
const byLast = new Map();
P.forEach((r) => {
  const parts = normName(r[0]).split(' ');
  const key = parts[parts.length - 1] + '|' + parts[0][0];
  byLast.set(key, [...(byLast.get(key) ?? []), r[0]]);
});
const resolve = (raw, team) => {
  const k = normName(raw);
  const e = lookup.get(k);
  if (e) return e;
  const parts = k.split(' ');
  if (parts.length < 2 || !parts[0] || !team) return undefined;
  const c = byLast.get(parts[parts.length - 1] + '|' + parts[0][0]);
  if (!c || c.length !== 1) return undefined;
  return teamOf.get(c[0]) === team ? c[0] : undefined;
};
const snap = (p) => { const r = Math.ceil(p / 12), i = p - (r - 1) * 12; return r % 2 ? i : 13 - i; };

(async () => {
  const DRAFT = process.argv[2] || '257270643320426496';
  const picks = await (await fetch(`https://api.sleeper.app/v1/draft/${DRAFT}/picks`)).json();
  if (!Array.isArray(picks) || !picks.length) { console.log('no picks in draft', DRAFT); return; }
  console.log(`draft ${DRAFT}: ${picks.length} real picks\n`);

  const MY_SLOT = 6;
  const DS = {};
  let matched = 0, offBoard = 0, mine = 0, slotErrors = 0;
  const offBoardNames = [];
  picks.sort((a, b) => a.pick_no - b.pick_no).forEach((pk) => {
    const raw = `${pk.metadata?.first_name ?? ''} ${pk.metadata?.last_name ?? ''}`.trim();
    const nm = resolve(raw, pk.metadata?.team);
    /* verify the draft_slot Sleeper reports matches snake math for that pick number */
    if (pk.draft_slot && snap(pk.pick_no) !== pk.draft_slot) slotErrors++;
    if (!nm) { offBoard++; if (offBoardNames.length < 8) offBoardNames.push(`${raw} (${pk.metadata?.position})`); return; }
    matched++;
    const want = pk.draft_slot === MY_SLOT ? 'mine' : 'gone';
    DS[nm] = want;
    if (want === 'mine') mine++;
  });

  console.log(`resolved to our board : ${matched}`);
  console.log(`off-board (K/DST/deep): ${offBoard}  e.g. ${offBoardNames.join(', ')}`);
  console.log(`marked as MY picks    : ${mine} (slot ${MY_SLOT})`);
  console.log(`snake-math mismatches : ${slotErrors} ${slotErrors ? '❌' : '✓'}`);

  const { advise } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/lib/advisor.js');
  const ord = picks.sort((a, b) => a.pick_no - b.pick_no)
    .map((pk) => resolve(`${pk.metadata?.first_name ?? ''} ${pk.metadata?.last_name ?? ''}`.trim(), pk.metadata?.team))
    .filter(Boolean);
  const a = advise(DS, MY_SLOT, ord);
  console.log(`\nadvisor on that live state: pick ${a.cur}, recommends ${a.cands[0] ? a.cands[0].now.r[0] : '(none)'} ` +
    `— roster QB${a.qb}/RB${a.rb}/WR${a.wr}/TE${a.te}`);
  console.log(a.cands.length ? '✓ advisor produced a live recommendation from real Sleeper data' : '❌ advisor returned nothing');
})();
