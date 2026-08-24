/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-rbrun.mjs [worlds]
 *
 * THE RB LOSS. What happens when the room empties the running backs before you are on the
 * clock, and is it still worth taking a back whose ADP says he belongs a round later?
 *
 * Three seats:
 *   Ashley, seat  1 — picks 1, 24, 25, 48, 49. The first pick in the draft, then a
 *                    twenty-three pick wait, then TWO PICKS BACK TO BACK at the turn. A
 *                    different problem from either of the others: nothing survives the gap,
 *                    but at 24/25 she takes two players before anyone else takes one.
 *   Emily, seat 10 — picks 10, 15, 34, 39, 58, 63.  Ten and fifteen are five apart, a tight
 *                    turn, then a twenty-pick wait.
 *   Brian, seat  2 — picks  2, 23, 26, 47, 50, 71.  One of the two best players in football,
 *                    then the longest wait on the board — twenty-one picks — and a very tight
 *                    turn at 23/26, only three apart.
 *
 * The room is set to Very RB-heavy — 16.7 of the first 24 picks are backs, measured in
 * sim-tendency.mjs — because that is the scenario being asked about, not the one the market
 * predicts. Everything is also run against a Market room so the cost of the run is visible
 * rather than assumed.
 *
 * Strategies are POSITION SEQUENCES over the first four picks, not named players. Naming a
 * player conditions the comparison on the worlds where he happened to fall, which compares
 * different leagues rather than different decisions. Every strategy gets whoever is actually
 * best at that position in that world, and picks five onward run on the normal policy. */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 20000);
const TEAMS = 12, ROUNDS = 14;
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2], adp: s.adp ?? ffc,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
/* Value the way the SEASON is scored, not the way the projection reads.
 *
 * Sleeper projects points in games a player PLAYS. The season loop below then rolls his miss
 * rate every week — so a policy that drafts on the raw projection is buying healthy weeks and
 * being paid in real ones. The two halves of this script disagreed, and it showed: De'Von
 * Achane projects 15.61, the highest back on the board, on a 45% miss rate our own board calls
 * "avoid". Raw, he is the clear pick at 10. Availability-adjusted he is 12.80 and Chase Brown
 * is 13.02 on a 30% miss rate.
 *
 * Same discount the advisor applies (1 - 0.4*pMiss), and replacement level is measured on the
 * adjusted numbers too, or the baseline drifts against the players. */
const adj = (p) => p.proj * (1 - 0.4 * p.pMiss);
const REPL = {};
for (const pos of ['QB','RB','WR','TE']) {
  const v = POOL.filter(p => p.pos === pos).map(adj).sort((a,b) => b-a);
  REPL[pos] = v[Math.min(REPL_RANK[pos]-1, v.length-1)] || 0;
}
POOL.forEach(p => { p.vorp = Math.max(0.2, adj(p) - REPL[p.pos]); });

const snap = (pk) => { const r = Math.ceil(pk/TEAMS), i = pk-(r-1)*TEAMS; return r%2 ? i : TEAMS+1-i; };
const picksOf = (seat) => { const a=[]; for(let pk=1;pk<=TEAMS*ROUNDS;pk++) if(snap(pk)===seat) a.push(pk); return a; };
const mul = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = (rnd) => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = (t) => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };

const FREE = 5, FULL = 12;
const rbShift = (base, pk) => {
  if (!base || pk > 24 || pk <= FREE) return 0;
  return pk >= FULL ? base : base * ((pk - FREE) / (FULL - FREE));
};

function oppPick(avail, team, rnd, lean, pk) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if (p.pos==='QB') s += c.QB>=2 ? 900 : c.QB>=1 ? 60 : 0;
    if (p.pos==='TE') s += c.TE>=2 ? 900 : c.TE>=1 ? 50 : 0;
    if (p.pos==='RB' && c.RB>=5) s += 25;
    if (p.pos==='WR' && c.WR>=5) s += 25;
    if (p.pos==='RB') s -= rbShift(lean, pk);
    if (s<bs){bs=s;b=p;}
  }
  return b;
}
function ourPick(avail, team, rnd, forcePos) {
  const c = NEED(team), n = team.length;
  const cs = forcePos ? avail.filter(p => p.pos === forcePos) : avail;
  if (!cs.length) return null;
  let b=null, bs=-Infinity;
  for (const p of cs) {
    let s = p.vorp;
    if (!forcePos) {
      if (p.pos==='QB') s *= c.QB===0 ? (n>=8?1:0.5) : 0.05;
      if (p.pos==='TE') s *= c.TE===0 ? (n>=6?1:0.8) : 0.07;
      if (p.pos==='RB' && c.RB>=5) s *= 0.3;
      if (p.pos==='WR' && c.WR>=5) s *= 0.3;
      if (team.some(x=>x.bye===p.bye && p.bye)) s *= 0.9;
    }
    s += gauss(rnd)*0.15;
    if (s>bs){bs=s;b=p;}
  }
  return b;
}

const LINEUP = { QB:1, RB:2, WR:2, TE:1, FLEX:2 };
function season(roster, rnd) {
  const sd = roster.map(p => p.proj * p.cv);
  let tot = 0; const wk_ = [];
  for (let wk=1; wk<=17; wk++) {
    const shock = {};
    const real = roster.map((p,i) => {
      if (p.bye===wk || rnd() < p.pMiss/17) return { p, v:0 };
      shock[p.team] ??= gauss(rnd);
      /* Loadings on one shared team shock. The shock IS the quarterback's own deviation, so a
           receiver's correlation to him is his loading directly, and receiver-to-receiver falls out
           as the product of two loadings rather than being forced equal to it.
           Measured targets: QB-WR +0.342, QB-TE +0.236, QB-RB +0.071, WR-WR +0.006.
           With QB at 1.0 and WR at 0.342, WR-WR lands at 0.117 — still above the measured 0.006,
           but a third of the 0.342 the old symmetric form produced. A single factor cannot hold a
           high QB-WR and a near-zero WR-WR at once; two receivers share the quarterback's good day
           and split his targets, and only a second factor captures both. Documented, not hidden. */
        const load = p.pos==='QB'?1.0 : p.pos==='WR'?0.342 : p.pos==='TE'?0.236 : 0.071;
      const z = load*shock[p.team] + Math.sqrt(Math.max(0,1-load*load))*gauss(rnd);
      return { p, v: Math.max(0, p.proj + z*sd[i]) };
    });
    const by = ps => real.filter(x=>x.p.pos===ps).sort((a,b)=>b.v-a.v);
    const used = new Set(); let t = 0;
    const take = (a,n) => a.slice(0,n).forEach(x=>{ t += x.v; used.add(x.p.name); });
    take(by('QB'),LINEUP.QB); take(by('RB'),LINEUP.RB);
    take(by('WR'),LINEUP.WR); take(by('TE'),LINEUP.TE);
    take(real.filter(x=>!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.v-a.v), LINEUP.FLEX);
    tot += t; wk_.push(t);
  }
  return { ppg: tot/17, weeks: wk_ };
}

function run(seat, mine, lean, plan, seed) {
  const rnd = mul(seed);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  const got = [];
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    let p;
    if (t === seat) {
      const i = mine.indexOf(pk);
      p = ourPick(avail, teams[t], rnd, i >= 0 && i < plan.length ? plan[i] : null);
      if (!p) p = ourPick(avail, teams[t], rnd, null);
      if (i >= 0 && i < 4 && p) got.push({ pk, name: p.name, pos: p.pos, adp: p.adp });
    } else {
      p = oppPick(avail, teams[t], rnd, lean, pk);
    }
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  const s = season(teams[seat], rnd);
  return { ppg: s.ppg, weeks: s.weeks, got };
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const se = a => { const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length); };

/* Named openings. Four picks is where the shape of a roster is decided; after that the
 * policy fills holes and the differences wash out. */
const PLANS = [
  { k: 'RB-RB-WR-WR', p: ['RB','RB','WR','WR'] },
  { k: 'RB-WR-RB-WR', p: ['RB','WR','RB','WR'] },
  { k: 'RB-WR-WR-RB', p: ['RB','WR','WR','RB'] },
  { k: 'RB-WR-WR-WR', p: ['RB','WR','WR','WR'] },   // hero RB
  { k: 'WR-RB-RB-WR', p: ['WR','RB','RB','WR'] },
  { k: 'WR-RB-WR-RB', p: ['WR','RB','WR','RB'] },
  { k: 'WR-WR-RB-RB', p: ['WR','WR','RB','RB'] },
  { k: 'WR-WR-WR-RB', p: ['WR','WR','WR','RB'] },
  { k: 'WR-WR-WR-WR', p: ['WR','WR','WR','WR'] },   // zero RB
  { k: 'WR-WR-TE-RB', p: ['WR','WR','TE','RB'] },
  { k: 'WR-TE-RB-WR', p: ['WR','TE','RB','WR'] },
];

/* Limit to one seat from the command line so a single seat can be regenerated without
   recomputing the others:  node scripts/sim-rbrun.mjs 10000 Ashley                       */
/* join the rest of argv: a two-word seat name survives losing its quotes */
const ONLY = process.argv.slice(3).join(" ") || undefined;
const SEATS = [
  { who: 'Ashley',   seat: 1 },
  { who: 'Emily',    seat: 10 },
  { who: 'Brian JK', seat: 2 },
].filter((s) => !ONLY || s.who === ONLY);
/* fail loudly on a name that matches nothing — see sim-priority.mjs for why: an unquoted
   "Brian JK" arrives as "Brian", filters to zero seats, and the script rewrites the cache
   with the old data while reporting success. */
if (ONLY && !SEATS.length) {
  console.error(`unknown seat name ${JSON.stringify(ONLY)} — nothing to run`);
  process.exit(1);
}
const ROOMS = [
  { label: 'Very RB-heavy (RB LOSS — worst case)', lean: 15 },
  { label: 'Market', lean: 0 },
];

const OUT = {};
for (const { who, seat } of SEATS) {
  const mine = picksOf(seat);
  OUT[who] = { seat, picks: mine.slice(0, 6), rooms: {} };
  for (const { label, lean } of ROOMS) {
    console.log(`\n\n${'='.repeat(88)}\n  ${who.toUpperCase()} — SEAT ${seat} (picks ${mine.slice(0,4).join(', ')} …)   ${label}\n${'='.repeat(88)}`);
    const res = PLANS.map(({ k, p: plan }) => {
      const out = [], seen = [];
      for (let w=0; w<W; w++) {
        const r = run(seat, mine, lean, plan, 40000 + w*7919);
        out.push(r.ppg);
        if (w < 800) seen.push(r.got);
      }
      const flat = out.slice().sort((a,b)=>a-b);
      return {
        k, m: mean(out), s: se(out),
        p10: flat[Math.floor(0.10*(flat.length-1))],
        p90: flat[Math.floor(0.90*(flat.length-1))],
        seen,
      };
    }).sort((a,b) => b.m - a.m);

    const top = res[0];
    console.log('  opening        pts/wk          floor  ceil     vs best    typical picks 1-4');
    console.log('  ' + '-'.repeat(86));
    const rows = [];
    for (const r of res) {
      const d = r.m - top.m, sed = Math.sqrt(r.s**2 + top.s**2);
      const tied = r !== top && Math.abs(d) < 2*sed;
      const tag = r===top ? 'BEST' : tied ? 'tied' : d.toFixed(2);
      const common = [0,1,2,3].map(i => {
        const m = {};
        r.seen.forEach(g => { if (g[i]) m[g[i].name] = (m[g[i].name]||0)+1; });
        const [n, c] = Object.entries(m).sort((a,b)=>b[1]-a[1])[0] || ['—', 0];
        return `${n.split(' ').slice(-1)[0]}${c ? ` ${(100*c/r.seen.length).toFixed(0)}%` : ''}`;
      });
      rows.push({ k: r.k, ppg: +r.m.toFixed(2), se: +r.s.toFixed(2), floor: +r.p10.toFixed(1),
                  ceil: +r.p90.toFixed(1), delta: +d.toFixed(2), tied, common });
      console.log(`  ${r.k.padEnd(13)} ${r.m.toFixed(2)} ±${r.s.toFixed(2)}   ${r.p10.toFixed(0).padStart(4)}  ${r.p90.toFixed(0).padStart(4)}   ${tag.padStart(8)}    ${common.join(', ')}`);
    }
    OUT[who].rooms[label] = rows;
  }
}
/* merge, never overwrite — a single-seat run must not wipe the other two */
let merged = OUT;
try { merged = { ...JSON.parse(readFileSync(CACHE + 'rbloss.json', 'utf8')), ...OUT }; } catch { /* first run */ }
writeFileSync(CACHE + 'rbloss.json', JSON.stringify(merged, null, 2));
console.log('\nwrote .simcache/rbloss.json');
