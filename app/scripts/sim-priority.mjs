/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-priority.mjs [worlds]
 *
 * A PRIORITY ORDER for your first two picks. Not a shape, not a position — a list of names in
 * the order you should want them, and then a second list for each of those outcomes.
 *
 *   pick 1 of the seat:  every player who realistically reaches you, ranked by the season you
 *                        finish with if you take him
 *   pick 2 of the seat:  the same, computed SEPARATELY for each round-1 outcome, because what
 *                        you took first changes what you should want second
 *
 * Two things this does that a naive ranking does not:
 *
 * PAIRED. Two players are compared only in the drafts where BOTH were on the board. Otherwise
 * the one who slides often is judged on a different set of leagues than the one who rarely
 * slides, which is not a comparison.
 *
 * SURVIVAL. Each row carries how often he is there when the pick arrives, and — for round 1 —
 * how often he is STILL there at your next pick. A player who lasts to your next turn should
 * not be taken now however good he is, and that fact is invisible in a points ranking. Justin
 * Jefferson is the case in point: he reaches seat 10 every single time and survives to pick 15
 * every single time, so taking him at 10 spends a pick on a player nobody was going to take. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 1500);
const TEAMS = 12, ROUNDS = 14;
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };
/* Wide enough that a real option cannot fall between the two shortlists. At 6 apiece, Derrick
   Henry — the top option in the paired head-to-head — appeared in neither: too expensive for
   the by-price list, and just outside the by-value list because a 44% miss rate discounts him.
   Missing the right answer entirely is a worse failure than ranking a few extra names. */
const N1 = 9, N2 = 7;

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2], adp: +(s.adp ?? ffc).toFixed(1),
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
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
const rbShift = (base, pk) => (!base || pk > 24 || pk <= FREE) ? 0
  : pk >= FULL ? base : base * ((pk - FREE) / (FULL - FREE));

function oppPick(avail, team, rnd, lean, pk) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if (p.pos==='QB' && c.QB>=1) s += 60;
    if (p.pos==='TE' && c.TE>=1) s += 50;
    if (p.pos==='RB' && c.RB>=5) s += 25;
    if (p.pos==='WR' && c.WR>=5) s += 25;
    if (p.pos==='RB') s -= rbShift(lean, pk);
    if (s<bs){bs=s;b=p;}
  }
  return b;
}
function ourPick(avail, team, rnd) {
  const c = NEED(team), n = team.length; let b=null, bs=-Infinity;
  for (const p of avail) {
    let s = p.vorp;
    if (p.pos==='QB') s *= c.QB===0 ? (n>=8?1:0.5) : 0.05;
    if (p.pos==='TE') s *= c.TE===0 ? (n>=6?1:0.8) : 0.07;
    if (p.pos==='RB' && c.RB>=5) s *= 0.3;
    if (p.pos==='WR' && c.WR>=5) s *= 0.3;
    if (team.some(x=>x.bye===p.bye && p.bye)) s *= 0.9;
    s += gauss(rnd)*0.15;
    if (s>bs){bs=s;b=p;}
  }
  return b;
}
const LINEUP = { QB:1, RB:2, WR:2, TE:1, FLEX:2 };
function season(roster, rnd) {
  const sd = roster.map(p => p.proj * p.cv);
  let tot = 0;
  for (let wk=1; wk<=17; wk++) {
    const shock = {};
    const real = roster.map((p,i) => {
      if (p.bye===wk || rnd() < p.pMiss/17) return { p, v:0 };
      shock[p.team] ??= gauss(rnd);
      const load = p.pos==='QB'?0.585 : p.pos==='WR'?0.585 : p.pos==='TE'?0.40 : 0.12;
      const z = load*shock[p.team] + Math.sqrt(Math.max(0,1-load*load))*gauss(rnd);
      return { p, v: Math.max(0, p.proj + z*sd[i]) };
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

/** run world `w`, taking `want[pick]` where named and policy elsewhere.
 *  Returns null if any named player was already gone — that world cannot judge this plan. */
function play(seat, lean, w, want) {
  const rnd = mul(70000 + w*7919);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    let p;
    if (t === seat) {
      const nm = want[pk];
      if (nm) { p = avail.find(x => x.name === nm); if (!p) return null; }
      else p = ourPick(avail, teams[t], rnd);
    } else p = oppPick(avail, teams[t], rnd, lean, pk);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return season(teams[seat], rnd);
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;

/** rank `names` at `pick`, paired against the best of them */
function rank(seat, lean, pick, names, fixed) {
  const scores = {};
  for (const n of names) {
    const m = new Map();
    for (let w=0; w<W; w++) {
      const v = play(seat, lean, w, { ...fixed, [pick]: n });
      if (v !== null) m.set(w, v);
    }
    if (m.size >= W * 0.03) scores[n] = m;
  }
  if (!Object.keys(scores).length) return [];
  /* Rank by the PAIRED gap against a common yardstick, not by each player's own average.
     Own-averages are not comparable when availability differs: a player who only reaches you
     in the drafts where the room went sideways is averaged over easier leagues than one who is
     always there. The yardstick is whoever is available most often, so the overlap is widest
     and every comparison is against the same thing. */
  const ref = Object.keys(scores).sort((a,b) => scores[b].size - scores[a].size)[0];
  const gapTo = (n) => {
    const common = [...scores[n].keys()].filter(w => scores[ref].has(w));
    if (common.length < 60) return null;
    return mean(common.map(w => scores[n].get(w))) - mean(common.map(w => scores[ref].get(w)));
  };
  const order = Object.keys(scores).sort((a,b) => (gapTo(b) ?? -99) - (gapTo(a) ?? -99));
  return order.map((n) => {
    const common = [...scores[n].keys()].filter(w => scores[ref].has(w));
    const d = common.length >= 60
      ? mean(common.map(w => scores[n].get(w))) - mean(common.map(w => scores[ref].get(w)))
      : null;
    const diffs = common.map(w => scores[n].get(w) - scores[ref].get(w));
    const m2 = diffs.length > 1 ? mean(diffs) : 0;
    const sd = diffs.length > 1
      ? Math.sqrt(diffs.reduce((s,x)=>s+(x-m2)**2,0)/(diffs.length-1)/diffs.length) : 0;
    const p = POOL.find(x => x.name === n);
    return { name: n, pos: p.pos, adp: p.adp,
      there: Math.round(100 * scores[n].size / W),
      ppg: +mean([...scores[n].values()]).toFixed(2),
      delta: d === null ? null : +d.toFixed(2),
      tied: d !== null && Math.abs(d) < 2 * sd };
  });
}

/** who reaches this pick often enough to be worth ranking, and does he last to the next one? */
function shortlist(seat, lean, pick, nextPick, fixed, n) {
  const there = {}, later = {};
  const S = 900;
  for (let w=0; w<S; w++) {
    const rnd = mul(70000 + w*7919);
    const avail = POOL.slice(), teams = {};
    for (let t=1;t<=TEAMS;t++) teams[t]=[];
    let snapshot = null;
    for (let pk=1; pk<nextPick; pk++) {
      const t = snap(pk);
      let p;
      if (t === seat) {
        const nm = fixed[pk];
        if (nm) { p = avail.find(x => x.name === nm); if (!p) { snapshot = null; break; } }
        else p = ourPick(avail, teams[t], rnd);
      } else p = oppPick(avail, teams[t], rnd, lean, pk);
      if (!p) break;
      if (pk === pick) snapshot = avail.map(x => x.name);
      teams[t].push(p); avail.splice(avail.indexOf(p),1);
    }
    if (!snapshot) continue;
    for (const nm of snapshot) there[nm] = (there[nm]||0)+1;
    if (nextPick <= TEAMS*ROUNDS) for (const x of avail) if (there[x.name]) later[x.name] = (later[x.name]||0)+1;
  }
  /* Two different questions decide who belongs on this list, and taking only one of them
     drops the answer. Sorting by market price alone gives the big names the room is about to
     take — and at seat 10 that quietly excluded Derrick Henry, De'Von Achane and Chase Brown,
     who ARE the top options, purely because their ADP is a few picks later. Sorting by our own
     value alone would drop anyone we happen to rate low, which is exactly the player worth
     asking about. So take both lists and merge. */
  const avail = Object.entries(there).filter(([,c]) => c >= S*0.05)
    .map(([nm]) => POOL.find(p => p.name === nm)).filter(Boolean);
  const byPrice = avail.slice().sort((a,b) => a.mkt - b.mkt).slice(0, n);
  const byValue = avail.slice().sort((a,b) => b.vorp - a.vorp).slice(0, n);
  const seen = new Set(), cands = [];
  for (const p of [...byPrice, ...byValue]) if (!seen.has(p.name)) { seen.add(p.name); cands.push(p); }
  const surv = {};
  for (const p of cands) surv[p.name] = there[p.name] ? Math.round(100*(later[p.name]||0)/there[p.name]) : 0;
  return { cands: cands.map(p => p.name), surv };
}

const OUT = {};
for (const [who, seat] of [['Emily', 10], ['Brian JK', 6]]) {
  const mine = picksOf(seat);
  const [p1, p2] = mine;
  OUT[who] = { seat, p1, p2, rooms: {} };
  for (const [roomLbl, lean] of [['RB LOSS', 15], ['Market', 0]]) {
    const { cands: c1, surv } = shortlist(seat, lean, p1, p2, {}, N1);
    const r1 = rank(seat, lean, p1, c1, {}).map(r => ({ ...r, survives: surv[r.name] ?? 0 }));
    const then = {};
    for (const top of r1.slice(0, N1)) {
      const fixed = { [p1]: top.name };
      const { cands: c2 } = shortlist(seat, lean, p2, mine[2], fixed, N2);
      then[top.name] = rank(seat, lean, p2, c2, fixed);
    }
    OUT[who].rooms[roomLbl] = { round1: r1, round2: then };

    console.log(`\n\n${'='.repeat(92)}`);
    console.log(`  ${who.toUpperCase()} — seat ${seat} — ${roomLbl}   |   pick ${p1}, then pick ${p2}`);
    console.log(`${'='.repeat(92)}`);
    console.log(`  PRIORITY AT ${p1}      pos   adp   there  lasts to ${p2}   pts/wk   vs baseline`);
    console.log('  ' + '-'.repeat(88));
    r1.forEach((r, i) => {
      const warn = r.survives >= 85 ? '  <-- he will still be there; take him later' : '';
      console.log(`  ${String(i+1).padStart(2)}. ${r.name.padEnd(20)} ${r.pos.padEnd(4)} ${String(r.adp).padStart(5)}  ${String(r.there).padStart(4)}%   ${String(r.survives).padStart(8)}%   ${r.ppg.toFixed(2)}  ${r.delta === null ? '' : (r.delta === 0 ? '   —' : `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}`)}${r.tied ? ' (tied)' : ''}${warn}`);
    });
    for (const top of r1.slice(0, 3)) {
      const rows = then[top.name] || [];
      if (!rows.length) continue;
      console.log(`\n    IF YOU TOOK ${top.name}  ->  priority at ${p2}:`);
      rows.slice(0, N2).forEach((r, i) =>
        console.log(`       ${i+1}. ${r.name.padEnd(20)} ${r.pos.padEnd(4)} there ${String(r.there).padStart(3)}%   ${r.ppg.toFixed(2)}${r.delta ? `  ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}` : '   —'}${r.tied ? ' (tied)' : ''}`));
    }
  }
}
writeFileSync(CACHE + 'priority.json', JSON.stringify(OUT, null, 2));
console.log(`\n\nwrote .simcache/priority.json   (${W.toLocaleString()} worlds per option)\n`);
