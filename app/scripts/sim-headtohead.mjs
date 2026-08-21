/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-headtohead.mjs [worlds]
 *
 * "Should 10 take the receiver on the card, or force a running back?"
 *
 * The shape study (sim-rbrun.mjs) answers a DIFFERENT question. It says two backs and two
 * receivers across your first four picks beats one or three. It does not say "take a back at
 * pick 10 whoever is standing there", because it always hands each shape the best player at
 * that position — so "RB first" quietly means "RB first, when the best back available is worth
 * it". At an actual draft you are looking at two named players, not two positions.
 *
 * So compare the players. Force one specific player at the pick, run the normal policy from
 * there, play the season out.
 *
 * PAIRED, which is the part that matters. Two players are only compared in the worlds where
 * BOTH were on the board — otherwise the one who falls more often is judged on a different set
 * of drafts than the one who falls rarely, and that is not a comparison, it is two different
 * leagues. Every pair below is scored on its own common subset, and the count is printed so a
 * thin one is visible rather than quietly averaged. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const W = Number(process.argv[2] || 8000);
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

/** board state the instant `seat` is on the clock for the first time */
function boardAt(seat, lean, w) {
  const rnd = mul(70000 + w*7919);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=TEAMS;t++) teams[t]=[];
  const first = (() => { for (let pk=1;;pk++) if (snap(pk)===seat) return pk; })();
  for (let pk=1; pk<first; pk++) {
    const p = oppPick(avail, teams[snap(pk)], rnd, lean, pk);
    if (!p) break; teams[snap(pk)].push(p); avail.splice(avail.indexOf(p),1);
  }
  return { avail, teams, first, rnd };
}

/** force `name` at the seat's first pick, then policy, then score */
function playForcing(seat, lean, w, name) {
  const { avail, teams, first, rnd } = boardAt(seat, lean, w);
  const forced = avail.find(p => p.name === name);
  if (!forced) return null;                       // not on the board — this world does not count
  teams[seat].push(forced); avail.splice(avail.indexOf(forced),1);
  for (let pk=first+1; pk<=TEAMS*ROUNDS; pk++) {
    if (!avail.length) break;
    const t = snap(pk);
    const p = t===seat ? ourPick(avail, teams[t], rnd) : oppPick(avail, teams[t], rnd, lean, pk);
    if (!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  return season(teams[seat], rnd);
}

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;

for (const [seat, who] of [[10, 'EMILY'], [6, 'BRIAN JK']]) {
  const first = (() => { for (let pk=1;;pk++) if (snap(pk)===seat) return pk; })();
  for (const [roomLbl, lean] of [['RB LOSS (very RB-heavy room)', 15], ['Market room', 0]]) {
    /* who is actually there often enough to be worth asking about? */
    const seen = {};
    for (let w=0; w<1500; w++) {
      const { avail } = boardAt(seat, lean, w);
      /* by market price, not by our own value — the question is "who is sitting there when
         I am on the clock", and the room decides that, not us. Ranking the shortlist by our
         VORP would quietly drop anyone we happen to rate low, which is exactly the player
         worth asking about. */
      avail.slice().sort((a,b)=>a.mkt-b.mkt).slice(0,16)
        .forEach(p => { seen[p.name] = (seen[p.name]||0)+1; });
    }
    const cands = Object.entries(seen).filter(([,c]) => c >= 120)
      .map(([n]) => POOL.find(p => p.name === n))
      .sort((a,b) => a.mkt - b.mkt).slice(0, 10);

    console.log(`\n\n${'='.repeat(94)}`);
    console.log(`  ${who} — PICK ${first}   ${roomLbl}`);
    console.log(`${'='.repeat(94)}`);

    /* score every candidate over the same world indices, then compare pairwise on overlap */
    const scores = {};                      // name -> Map(world -> ppg)
    for (const c of cands) {
      const m = new Map();
      for (let w=0; w<W; w++) { const v = playForcing(seat, lean, w, c.name); if (v !== null) m.set(w, v); }
      scores[c.name] = m;
    }
    const bestByOwn = cands.slice().sort((a,b) =>
      mean([...scores[b.name].values()]) - mean([...scores[a.name].values()]));

    console.log('  player                pos   adp   there    season pts/wk   vs the top option (paired)');
    console.log('  ' + '-'.repeat(92));
    const ref = bestByOwn[0];
    for (const c of bestByOwn) {
      const there = 100 * scores[c.name].size / W;
      const own = mean([...scores[c.name].values()]);
      let cmp = '  —  (this is the top option)';
      if (c !== ref) {
        const common = [...scores[c.name].keys()].filter(w => scores[ref.name].has(w));
        if (common.length < 200) cmp = `  too few shared worlds (${common.length}) to compare`;
        else {
          const d = mean(common.map(w => scores[c.name].get(w))) - mean(common.map(w => scores[ref.name].get(w)));
          const diffs = common.map(w => scores[c.name].get(w) - scores[ref.name].get(w));
          const m2 = mean(diffs);
          const sd = Math.sqrt(diffs.reduce((s,x)=>s+(x-m2)**2,0)/(diffs.length-1)/diffs.length);
          cmp = `  ${d>=0?'+':''}${d.toFixed(2)} ±${sd.toFixed(2)}  over ${common.length} shared worlds${Math.abs(d) < 2*sd ? '   (a coin flip)' : ''}`;
        }
      }
      console.log(`  ${c.name.padEnd(21)} ${c.pos.padEnd(4)} ${c.adp.toFixed(1).padStart(5)}  ${there.toFixed(0).padStart(4)}%    ${own.toFixed(2).padStart(7)}      ${cmp}`);
    }
    console.log('\n  "there %" is how often he was still on the board at this pick.');
    console.log('  Pairwise column compares ONLY the worlds where both were available.');
  }
}
console.log('');
