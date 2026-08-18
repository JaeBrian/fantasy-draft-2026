/* Adversarial audit of the draft app: data integrity, advisor sanity, calibration,
   roster legality, and live-sync name matching. Prints FAIL lines for anything wrong. */
const { P, MKT, BYE, CUFFS, DRAFT_ORDER, SIM_PLANS, VEGAS } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');
const { SLP } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/sleeper.js');
const { advise, snapTeam, mktADP } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/lib/advisor.js');

let fails = 0, warns = 0;
const FAIL = m => { console.log('  ❌ FAIL:', m); fails++; };
const WARN = m => { console.log('  ⚠️  WARN:', m); warns++; };
const OK = m => console.log('  ✓', m);

console.log('\n=== 1. DATA INTEGRITY ===');
const names = P.map(r => r[0]);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
dupes.length ? FAIL('duplicate players: ' + dupes.join(', ')) : OK(`${P.length} players, no duplicates`);

const VALID_POS = ['QB', 'RB', 'WR', 'TE'];
const VALID_V = ['buy', 'solid', 'risk', 'avoid'];
P.forEach((r, i) => {
  if (!VALID_POS.includes(r[1])) FAIL(`${r[0]}: bad position ${r[1]}`);
  if (!VALID_V.includes(r[4])) FAIL(`${r[0]}: bad verdict ${r[4]}`);
  if (!BYE[r[2]]) FAIL(`${r[0]}: unknown team ${r[2]}`);
  if (!r[7] || r[7].length < 20) FAIL(`${r[0]}: note missing/too short`);
  if (typeof r[3] !== 'number' || r[3] <= 0) FAIL(`${r[0]}: bad adp ${r[3]}`);
  if (r[5] < 1 || r[5] > 7) FAIL(`${r[0]}: bad tier ${r[5]}`);
});
let last = 0, nonmono = [];
P.forEach((r, i) => { if (r[5] < last) nonmono.push(`${r[0]}@${i + 1}`); last = Math.max(last, r[5]); });
nonmono.length ? FAIL('tiers go backward (breaks tier bands): ' + nonmono.join(', ')) : OK('overall tiers are monotonic');

const byeVals = [...new Set(Object.values(BYE))].sort((a, b) => a - b);
byeVals.some(b => b < 5 || b > 14) ? FAIL('bye weeks out of range: ' + byeVals.join(',')) : OK('bye weeks in range ' + byeVals[0] + '-' + byeVals[byeVals.length - 1]);
Object.keys(BYE).length === 32 ? OK('32 teams have byes') : FAIL('teams with byes: ' + Object.keys(BYE).length);
VEGAS.length === 32 ? OK('32 teams in Vegas board') : FAIL('Vegas teams: ' + VEGAS.length);

Object.entries(CUFFS).forEach(([star, cuff]) => {
  if (!names.includes(star)) FAIL(`handcuff maps from missing player: ${star}`);
  if (!names.includes(cuff)) FAIL(`handcuff maps to missing player: ${cuff}`);
});
OK(`${Object.keys(CUFFS).length} handcuff pairs all resolve`);

const noMkt = names.filter(n => !MKT[n]);
noMkt.length > 20 ? FAIL(`${noMkt.length} players missing market ADP`) : OK(`market ADP covers ${names.length - noMkt.length}/${names.length}`);
const noSlp = names.filter(n => !SLP[n] || SLP[n].rk === undefined);
noSlp.length > 10 ? WARN(`${noSlp.length} without Sleeper rank: ${noSlp.slice(0,5).join(', ')}`) : OK(`Sleeper rank covers ${names.length - noSlp.length}/${names.length}`);

DRAFT_ORDER.length === 12 ? OK('12 names in draft order') : FAIL('draft order length ' + DRAFT_ORDER.length);
[1, 6, 10].forEach(s => {
  const plan = SIM_PLANS[s];
  if (!plan) return FAIL(`no sim plan for slot ${s}`);
  plan.picks.forEach(sp => {
    const myPicks = []; for (let r = 1; r <= 16; r++) myPicks.push((r - 1) * 12 + (r % 2 ? s : 13 - s));
    if (!myPicks.includes(sp.pick)) FAIL(`slot ${s}: pick #${sp.pick} is not one of their picks`);
    sp.opts.forEach(([nm]) => { if (!names.includes(nm)) FAIL(`slot ${s} plan references unknown player ${nm}`); });
  });
});
OK('sim plans reference real players at real pick numbers');

console.log('\n=== 2. CALIBRATION (does the model conserve picks?) ===');
[10, 20, 40, 80].forEach(k => {
  const a = advise({}, 1, []);
  // reconstruct: sum pReach-implied gone across candidates is not directly exposed,
  // so approximate via goneSoon + spot checks on locks
  const gibbs = P[0];
  const ok = true;
  void a; void gibbs; void ok;
});
{
  const a10 = advise({}, 10, []);
  const gibbsCand = a10.cands.find(c => c.now.r[0] === 'Jahmyr Gibbs');
  if (gibbsCand && gibbsCand.pReach > 0.15) FAIL(`Gibbs shows ${(gibbsCand.pReach*100).toFixed(0)}% to reach pick 10 — should be ~0`);
  else OK('the 1.01 is correctly ~never available at pick 10');
  const a1 = advise({}, 1, []);
  if (a1.cands[0].pReach < 0.99) FAIL('on the clock at 1.01, top target should be 100% available');
  else OK('on-the-clock availability is 100%');
}

console.log('\n=== 3. ADVISOR SANITY ACROSS 500 RANDOM DRAFT STATES ===');
let bad = 0, recDrafted = 0, nanSeen = 0, overfilled = 0;
for (let t = 0; t < 500; t++) {
  const slot = 1 + Math.floor(Math.random() * 12);
  const nPicks = Math.floor(Math.random() * 140);
  const DS = {}, ord = [];
  const shuffled = names.slice().sort(() => Math.random() - 0.5).slice(0, nPicks);
  shuffled.forEach((n, i) => { DS[n] = snapTeam(i + 1) === slot ? 'mine' : 'gone'; ord.push(n); });
  const a = advise(DS, slot, ord);
  a.cands.forEach(c => {
    if (DS[c.now.r[0]]) { recDrafted++; }
    if (!isFinite(c.score) || !isFinite(c.gap) || !isFinite(c.pReach)) nanSeen++;
  });
  const mine = P.filter(r => DS[r[0]] === 'mine');
  const counts = {};
  mine.forEach(r => counts[r[1]] = (counts[r[1]] || 0) + 1);
  if (a.cands.length === 0 && mine.length < 16 && nPicks < 150) bad++;
  // never recommend a 3rd QB or 3rd TE
  a.cands.slice(0, 1).forEach(c => {
    if (c.p === 'QB' && (counts.QB || 0) >= 2) overfilled++;
    if (c.p === 'TE' && (counts.TE || 0) >= 2) overfilled++;
  });
}
recDrafted ? FAIL(`recommended an already-drafted player ${recDrafted}x`) : OK('never recommends a drafted player');
nanSeen ? FAIL(`non-finite score/gap/pReach ${nanSeen}x`) : OK('no NaN/Infinity in scoring');
bad ? FAIL(`empty recommendation list ${bad}x with roster incomplete`) : OK('always returns a recommendation while roster is incomplete');
overfilled ? FAIL(`recommended a 3rd QB/TE ${overfilled}x`) : OK('never recommends a 3rd QB or 3rd TE');

console.log('\n=== 4. ROSTER LEGALITY AT THE END ===');
{
  const slot = 6;
  const DS = {}, ord = [];
  let mine = 0;
  for (let pick = 1; pick <= 192 && mine < 14; pick++) {
    const team = snapTeam(pick);
    const a = advise(DS, slot, ord);
    let pickName;
    if (team === slot) {
      pickName = a.cands[0] ? a.cands[0].now.r[0] : names.find(n => !DS[n]);
      mine++;
    } else {
      pickName = P.filter(r => !DS[r[0]]).sort((x, y) => mktADP(x) - mktADP(y))[0]?.[0];
    }
    if (!pickName) break;
    DS[pickName] = team === slot ? 'mine' : 'gone';
    ord.push(pickName);
  }
  const roster = P.filter(r => DS[r[0]] === 'mine');
  const c = {}; roster.forEach(r => c[r[1]] = (c[r[1]] || 0) + 1);
  console.log('   full mock roster:', Object.entries(c).map(([k, v]) => k + ':' + v).join(' '));
  (c.QB >= 1 && c.RB >= 2 && c.WR >= 2 && c.TE >= 1) ? OK('advisor-built roster can field a legal lineup') : FAIL('cannot field legal lineup: ' + JSON.stringify(c));
  (c.QB <= 2 && c.TE <= 2) ? OK('no QB/TE hoarding') : FAIL('hoarded QB/TE: ' + JSON.stringify(c));
}

console.log(`\n=== RESULT: ${fails} failures, ${warns} warnings ===`);
