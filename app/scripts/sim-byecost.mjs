/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-byecost.mjs [worlds]
 *
 * Brian, on being recommended Jayden Reed after taking Christian Watson: "two GB recievers?"
 *
 * The same-team WR penalty was removed earlier on evidence — teammate receivers correlate
 * +0.006 in weekly scoring against a control of -0.003, so they do not eat each other's lunch.
 * That measurement stands. But it answers the wrong half of his question.
 *
 * The half it does not answer: two Packers share a BYE. Week 11 you start neither. That is not
 * a correlation effect, it is a hole in the schedule, and the advisor prices it with a 0.88
 * multiplier I picked by judgement and never measured.
 *
 * So measure it. Build two rosters with IDENTICAL players and identical projections, differing
 * only in how their byes line up, and play the season out. The gap is what a bye stack actually
 * costs — and whether 0.88 is anywhere near right. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, BYE } = require(CACHE + 'data.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 20000);
const mul = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = (rnd) => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };

const LINEUP = { QB:1, RB:2, WR:2, TE:1, FLEX:2 };
function season(roster, rnd) {
  const sd = roster.map(p => p.proj * p.cv);
  let tot = 0;
  for (let wk=1; wk<=17; wk++) {
    const real = roster.map((p,i) => {
      if (p.bye===wk || rnd() < p.pMiss/17) return { p, v:0 };
      return { p, v: Math.max(0, p.proj + gauss(rnd)*sd[i]) };
    });
    const by = ps => real.filter(x=>x.p.pos===ps).sort((a,b)=>b.v-a.v);
    const used = new Set(); let t = 0;
    const take = (a,n) => a.slice(0,n).forEach(x=>{ t += x.v; used.add(x.p.name); });
    take(by('QB'),LINEUP.QB); take(by('RB'),LINEUP.RB);
    take(by('WR'),LINEUP.WR); take(by('TE'),LINEUP.TE);
    take(real.filter(x=>!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.v-a.v), LINEUP.FLEX);
    tot += t;
  }
  return tot/17;
}

/* a plausible 14-man roster, built from the board so the numbers are real */
const pick = (pos, n) => P.filter(r => r[1] === pos && PROJ[r[0]] !== undefined)
  .sort((a,b) => PROJ[b[0]] - PROJ[a[0]]).slice(0, n)
  .map(r => { const k = riskOf(r[0], r[1], r[4]);
    return { name: r[0], pos: r[1], proj: PROJ[r[0]], cv: k.cv, pMiss: k.pMiss, bye: BYE[r[2]] || 0 }; });

const base = [...pick('QB',2), ...pick('RB',5), ...pick('WR',5), ...pick('TE',2)];

/* Reassign byes only. Everything else — projections, spread, miss rates — is identical, so the
 * gap between these two rosters is the bye alignment and nothing else. */
const spread = base.map((p,i) => ({ ...p, bye: 5 + (i % 10) }));

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const seOf = a => { const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length); };

function run(roster) {
  const out = [];
  for (let w=0; w<W; w++) out.push(season(roster, mul(6100 + w*7919)));
  return out;
}

console.log(`\nWHAT DOES A SHARED BYE ACTUALLY COST? — ${W.toLocaleString()} seasons per roster.`);
console.log(`Identical players and projections throughout; only the BYE WEEKS differ.\n`);
console.log('  how many of your starters share one bye week      pts/wk      cost vs spread');
console.log('  ' + '-'.repeat(74));

const ref = run(spread);
const rm = mean(ref);
console.log(`  none (byes spread across ten weeks)              ${rm.toFixed(2)} ±${seOf(ref).toFixed(2)}          —`);

for (const n of [2, 3, 4]) {
  /* stack the n best WR/RB on one week, leave the rest spread */
  const stacked = spread.map((p, i) => {
    const flexIdx = spread.filter(x => x.pos === 'WR' || x.pos === 'RB').indexOf(p);
    return flexIdx >= 0 && flexIdx < n ? { ...p, bye: 11 } : p;
  });
  const out = run(stacked);
  const m = mean(out), d = m - rm;
  const sed = Math.sqrt(seOf(out)**2 + seOf(ref)**2);
  console.log(`  ${String(n)} starters on the same bye                       ${m.toFixed(2)} ±${seOf(out).toFixed(2)}      ${d.toFixed(2)} ±${sed.toFixed(2)}`);
}

console.log(`\n  The advisor currently multiplies a clashing candidate's score by 0.88 (a second player`);
console.log(`  on a bye already used) or 0.78 (a third). Those were judgement, never measured.`);
console.log(`  Compare the cost above against a candidate's value over replacement to see whether`);
console.log(`  a 12% haircut is too little, about right, or too much.\n`);
