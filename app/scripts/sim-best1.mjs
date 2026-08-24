/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-best1.mjs [worlds]
 *
 * "What is the best pick, 1 through 12?"
 *
 * Pick 1 is the only clean place to ask. Everywhere else the answer is contaminated by who
 * happens to still be on the board, and by whether the player would have lasted to your next
 * turn — real considerations, but they are about the SEAT, not about the player. At pick one
 * every player is available to everyone, so forcing each in turn and playing the season out
 * measures the thing itself.
 *
 * The season is played 14 rounds deep with the rest of the roster chosen by policy, so this
 * is not "who scores most" — it is "which first pick leaves you with the best TEAM", which
 * already prices positional scarcity: taking a back costs you the receiver you would otherwise
 * have had, and the simulation makes you live with that trade.
 *
 * Every candidate meets the identical eleven opponents and the identical season draws. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE, VEGAS } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 4000);
const TEAMS = 12, ROUNDS = 14, SEAT = 1;
const REPL_RANK = { QB: 12, RB: 31, WR: 40, TE: 13 };

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], team: r[2], adp: +(s.adp ?? ffc).toFixed(1), verdict: r[4],
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss, flags: rk.flags,
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
  let tot = 0; const weeks = [];
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
    tot += t; weeks.push(t);
  }
  return { ppg: tot/17, weeks };
}

function play(w, forced) {
  const rnd = mul(88000 + w*7919);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    let p;
    if (t === SEAT) p = (pk === 1 ? avail.find(x => x.name === forced) : null) || ourPick(avail, teams[t], rnd);
    else p = oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return season(teams[SEAT], rnd);
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;

/* anyone the market prices inside the first two rounds is a candidate for "best pick" */
const CANDS = POOL.filter(p => p.mkt <= 26).sort((a,b) => a.mkt - b.mkt).slice(0, 18);

const res = CANDS.map((c) => {
  const ppg = [], wk = [];
  for (let w=0; w<W; w++) { const r = play(w, c.name); ppg.push(r.ppg); wk.push(...r.weeks); }
  wk.sort((a,b)=>a-b);
  const m = mean(ppg);
  const sd = Math.sqrt(ppg.reduce((s,x)=>s+(x-m)**2,0)/(ppg.length-1)/ppg.length);
  return { c, m, sd, floor: wk[Math.floor(0.10*(wk.length-1))], ceil: wk[Math.floor(0.90*(wk.length-1))] };
}).sort((a,b) => b.m - a.m);

const top = res[0];
console.log(`\nBEST PICK IN THE DRAFT — every candidate forced at pick 1, ${W.toLocaleString()} seasons each,`);
console.log(`identical opponents and identical season draws. The rest of the roster is drafted by`);
console.log(`policy afterwards, so this is "which first pick leaves the best TEAM", not "who scores most".\n`);
console.log('  #   player                pos  adp   verdict  team pts/wk        wk floor/ceil   vs #1');
console.log('  ' + '-'.repeat(94));
res.forEach((r, i) => {
  const d = r.m - top.m;
  const sed = Math.sqrt(r.sd**2 + top.sd**2);
  const tag = i === 0 ? 'BEST' : `${d.toFixed(2)}${Math.abs(d) < 2*sed ? ' (tied)' : ''}`;
  console.log(`  ${String(i+1).padStart(2)}. ${r.c.name.padEnd(20)} ${r.c.pos.padEnd(4)} ${String(r.c.adp).padStart(5)}  ${r.c.verdict.padEnd(7)}  ${r.m.toFixed(2)} ±${r.sd.toFixed(2)}   ${r.floor.toFixed(0).padStart(4)} / ${r.ceil.toFixed(0).padStart(4)}   ${tag.padStart(14)}`);
});

console.log('\n\nWHAT THE TOP OF THE BOARD IS CARRYING\n');
console.log('  player                proj   miss%   spread   flags');
console.log('  ' + '-'.repeat(88));
for (const r of res.slice(0, 10))
  console.log(`  ${r.c.name.padEnd(20)} ${r.c.proj.toFixed(1).padStart(5)}  ${(100*r.c.pMiss).toFixed(0).padStart(4)}%   ${r.c.cv.toFixed(3)}   ${r.c.flags.slice(0,2).join(' | ').slice(0,52)}`);
console.log('');
