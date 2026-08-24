/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-seatvalue.mjs [worlds]
 *
 * "What is the best draft position?"
 *
 * Asked two ways, because they have different answers and only one of them is Brian's.
 *
 *   NAIVE   all twelve seats draft to market ADP. This is the structural value of the slot —
 *           what the position is worth before anyone is any good at drafting. One simulated
 *           league measures all twelve seats at once, so it is cheap and perfectly paired:
 *           every seat meets the same board in the same draft.
 *
 *   SHARP   one seat drafts on our value model, the other eleven to market. This is Brian's
 *           actual situation: he has the tool and the room does not. Run once per seat.
 *
 * The gap between them is the part worth knowing — whether an edge is worth MORE from some
 * seats than others. A slot with lots of near-ties is one where knowing which way to break
 * them pays; a slot where the board decides for you is one where it does not.
 *
 * winPct is honest: all twelve rosters play the same simulated season and we count who
 * finishes with the most points. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 2500);
const TEAMS = 12, ROUNDS = 14;
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2],
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
const mul = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = (rnd) => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = (t) => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };

function oppPick(avail, team, rnd) {
  const c = NEED(team); let b=null, bs=Infinity;
  for (const p of avail) {
    let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if (p.pos==='QB') s += c.QB>=2 ? 900 : c.QB>=1 ? 60 : 0;
    if (p.pos==='TE') s += c.TE>=2 ? 900 : c.TE>=1 ? 50 : 0;
    if (p.pos==='RB' && c.RB>=5) s += 25;
    if (p.pos==='WR' && c.WR>=5) s += 25;
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
    tot += t;
  }
  return tot/17;
}

/** one league; every seat in `sharp` drafts on our model, the rest to market.
 *
 *  Brian: "well im talking about emily and me ... you shoulda account for us two".
 *  Right — and it was overstating his edge. Three people in this league use this tool
 *  (Ashley at 1, Brian at 2, Emily at 10), so measuring one sharp seat against eleven ADP
 *  bots answers a question nobody is in. Sharp seats compete for the same undervalued
 *  players, which both lowers each one's edge and changes who is left for the others. */
function league(seed, sharp) {
  const S = new Set(Array.isArray(sharp) ? sharp : [sharp]);
  const rnd = mul(seed);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    const p = S.has(t) ? ourPick(avail, teams[t], rnd) : oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  const r2 = mul(seed + 4242);                 // same season for every team in this league
  const out = [];
  for (let t=1;t<=TEAMS;t++) out.push({ t, s: season(teams[t], r2) });
  out.sort((a,b)=>b.s-a.s);
  return out;
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const seOf = a => { const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length); };

/* ---- NAIVE: nobody is sharp. One league measures all twelve seats at once. ---- */
const naive = {}; for (let t=1;t<=TEAMS;t++) naive[t] = { ppg: [], wins: 0 };
for (let w=0; w<W; w++) {
  const out = league(50000 + w*7919, 0);       // seat 0 does not exist -> all market
  out.forEach(x => naive[x.t].ppg.push(x.s));
  naive[out[0].t].wins++;
}

/* ---- SHARP: our model at one seat, market at the other eleven. Once per seat. ---- */
const sharp = {};
for (let seat=1; seat<=TEAMS; seat++) {
  const ppg = []; let wins = 0;
  for (let w=0; w<W; w++) {
    const out = league(50000 + w*7919, seat);
    ppg.push(out.find(x => x.t === seat).s);
    if (out[0].t === seat) wins++;
  }
  sharp[seat] = { ppg, wins };
  process.stdout.write(`  seat ${seat} done\r`);
}

/* ---- REAL: the room as it actually is. Ashley, Brian and Emily all on the tool. ---- */
const TOOL = [1, 2, 10];
const real = {};
for (const seat of TOOL) real[seat] = { ppg: [], wins: 0 };
for (let w=0; w<W; w++) {
  const out = league(50000 + w*7919, TOOL);
  for (const seat of TOOL) real[seat].ppg.push(out.find(x => x.t === seat).s);
  if (TOOL.includes(out[0].t)) real[out[0].t].wins++;
}

console.log(`\n\nWHICH DRAFT SLOT IS BEST? — ${W.toLocaleString()} leagues per column.`);
console.log(`All twelve rosters play the same season, so "wins" is finishing top of the league on points.\n`);
console.log('  seat   ---- everyone drafts to market ----     ---- you draft on the model ----     edge');
console.log('          pts/wk           wins                   pts/wk           wins             (pts/wk)');
console.log('  ' + '-'.repeat(96));
const rows = [];
for (let t=1;t<=TEAMS;t++) {
  const nm = mean(naive[t].ppg), nw = 100*naive[t].wins/W;
  const sm = mean(sharp[t].ppg), sw = 100*sharp[t].wins/W;
  rows.push({ t, nm, nw, sm, sw, edge: sm - nm });
  console.log(`   ${String(t).padStart(2)}     ${nm.toFixed(2)} ±${seOf(naive[t].ppg).toFixed(2)}     ${nw.toFixed(1).padStart(5)}%              ${sm.toFixed(2)} ±${seOf(sharp[t].ppg).toFixed(2)}     ${sw.toFixed(1).padStart(5)}%           ${(sm-nm >= 0 ? '+' : '')}${(sm-nm).toFixed(2)}`);
}
const byNaive = rows.slice().sort((a,b)=>b.nm-a.nm);
const bySharp = rows.slice().sort((a,b)=>b.sm-a.sm);
const byEdge  = rows.slice().sort((a,b)=>b.edge-a.edge);
console.log(`\n  best slot if nobody is sharp:   ${byNaive.slice(0,4).map(r=>`#${r.t}`).join(' > ')}`);
console.log(`  best slot with the tool:        ${bySharp.slice(0,4).map(r=>`#${r.t}`).join(' > ')}`);
console.log(`  where the tool is worth most:   ${byEdge.slice(0,4).map(r=>`#${r.t} (+${r.edge.toFixed(2)})`).join('  ')}`);
console.log(`  where it is worth least:        ${byEdge.slice(-3).map(r=>`#${r.t} (+${r.edge.toFixed(2)})`).join('  ')}\n`);

/* ---- the comparison that matters to the people actually in this league ---- */
console.log(`\n\nTHE ROOM AS IT REALLY IS — Ashley (1), Brian (2) and Emily (10) all on the tool,`);
console.log(`the other nine drafting to ADP. ${W.toLocaleString()} leagues.\n`);
console.log('  seat            alone vs 11 bots        sharing with two others      cost of company');
console.log('  ' + '-'.repeat(84));
for (const seat of TOOL) {
  const a = sharp[seat], b = real[seat];
  const am = mean(a.ppg), bm = mean(b.ppg);
  const aw = 100*a.wins/W, bw = 100*b.wins/W;
  console.log(`   ${String(seat).padStart(2)}   ${am.toFixed(2)} / ${aw.toFixed(1).padStart(4)}% wins      ${bm.toFixed(2)} / ${bw.toFixed(1).padStart(4)}% wins        ${(bm-am).toFixed(2)} pts, ${(bw-aw).toFixed(1)} pts of win rate`);
}
console.log(`\n  "alone" is the number this study used to print, and it flatters every one of them:`);
console.log(`  it assumes nobody else in the league knows what they are doing. Three of twelve do.\n`);
