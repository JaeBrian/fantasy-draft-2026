/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-rbslots.mjs [worlds]
 *
 * Brian: "HOW CRUCIAL is the RB room for half PPR? compared to if we dont do double RB start"
 *
 * Everything so far says take backs early. But WHY — is it something about running backs, or
 * is it just that the league forces you to start two of them? Those are different claims and
 * only one of them would survive a rules change.
 *
 * So change the rule and re-run. Same drafts, same players, same seasons; the only difference
 * is the lineup:
 *
 *   2RB   1QB / 2RB / 2WR / 1TE / 2FLEX   <- what this league actually plays
 *   1RB   1QB / 1RB / 2WR / 1TE / 3FLEX   <- one back required, the slot given to flex
 *
 * If the RB premium is about the position, it barely moves. If it is about the requirement,
 * it collapses. The gap between those two numbers is the honest answer to "how crucial".
 *
 * Reported as the cost of NOT taking backs early — the distance from the best opening shape to
 * the all-receiver one — under each rule set. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 4000);
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
const picksOf = (seat) => { const a=[]; for(let pk=1;pk<=TEAMS*ROUNDS;pk++) if(snap(pk)===seat) a.push(pk); return a; };
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

/** the only thing that differs between the two worlds */
const RULES = {
  '2RB': { QB:1, RB:2, WR:2, TE:1, FLEX:2 },
  '1RB': { QB:1, RB:1, WR:2, TE:1, FLEX:3 },
};
function season(roster, rnd, L) {
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
    take(by('QB'),L.QB); take(by('RB'),L.RB); take(by('WR'),L.WR); take(by('TE'),L.TE);
    take(real.filter(x=>!used.has(x.p.name)&&x.p.pos!=='QB').sort((a,b)=>b.v-a.v), L.FLEX);
    tot += t;
  }
  return tot/17;
}

/* One draft produces one roster; both rule sets then score THAT SAME ROSTER on the same
 * season draws. Paired to the bone, so the only thing that can move the number is the rule. */
function run(seat, mine, plan, seed) {
  const rnd = mul(seed);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  for (let pk=1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    const i = mine.indexOf(pk);
    const p = t===seat
      ? (ourPick(avail, teams[t], rnd, i>=0 && i<plan.length ? plan[i] : null) || ourPick(avail, teams[t], rnd, null))
      : oppPick(avail, teams[t], rnd);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  const out = {};
  for (const [k, L] of Object.entries(RULES)) {
    const r2 = mul(seed + 555);            // same draws for both rule sets
    out[k] = season(teams[seat], r2, L);
  }
  return out;
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const seOf = a => { const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)/a.length); };

const PLANS = [
  { k: 'RB-WR-WR-RB', p: ['RB','WR','WR','RB'] },   // two backs early
  { k: 'WR-WR-WR-WR', p: ['WR','WR','WR','WR'] },   // none
];

console.log(`\nHOW MUCH OF THE RB PREMIUM IS THE POSITION, AND HOW MUCH IS THE LINEUP RULE?`);
console.log(`${W.toLocaleString()} drafts per seat. Each roster is scored under BOTH rule sets on identical`);
console.log(`season draws, so the only thing that can move a number is the rule itself.\n`);
console.log(`   2RB = 1QB/2RB/2WR/1TE/2FLEX  (this league)      1RB = 1QB/1RB/2WR/1TE/3FLEX\n`);

for (const [who, seat] of [['Ashley', 1], ['Brian JK', 2], ['Emily', 10]]) {
  const mine = picksOf(seat);
  const res = {};
  for (const { k, p } of PLANS) {
    const acc = { '2RB': [], '1RB': [] };
    for (let w=0; w<W; w++) {
      const r = run(seat, mine, p, 30000 + w*7919);
      acc['2RB'].push(r['2RB']); acc['1RB'].push(r['1RB']);
    }
    res[k] = acc;
  }
  console.log(`${'='.repeat(78)}`);
  console.log(`  ${who} — seat ${seat}`);
  console.log(`${'='.repeat(78)}`);
  console.log('  opening         under 2RB rule      under 1RB rule');
  console.log('  ' + '-'.repeat(60));
  for (const { k } of PLANS)
    console.log(`  ${k.padEnd(14)} ${mean(res[k]['2RB']).toFixed(2)} ±${seOf(res[k]['2RB']).toFixed(2)}      ${mean(res[k]['1RB']).toFixed(2)} ±${seOf(res[k]['1RB']).toFixed(2)}`);

  for (const rule of ['2RB', '1RB']) {
    const a = res['RB-WR-WR-RB'][rule], b = res['WR-WR-WR-WR'][rule];
    const d = a.map((x,i) => x - b[i]);
    const m = mean(d), sd = Math.sqrt(d.reduce((s,x)=>s+(x-m)**2,0)/(d.length-1)/d.length);
    console.log(`\n  cost of taking NO backs early, ${rule} rule:  ${m.toFixed(2)} ±${sd.toFixed(2)} pts/wk`);
  }
  const c2 = mean(res['RB-WR-WR-RB']['2RB'].map((x,i)=>x-res['WR-WR-WR-WR']['2RB'][i]));
  const c1 = mean(res['RB-WR-WR-RB']['1RB'].map((x,i)=>x-res['WR-WR-WR-WR']['1RB'][i]));
  console.log(`  -> ${(100*(1-c1/c2)).toFixed(0)}% of the RB premium at this seat is the LINEUP RULE, not the position.\n`);
}
