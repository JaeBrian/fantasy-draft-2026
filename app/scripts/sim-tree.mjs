/* Run: npx esbuild src/data.ts src/sleeper.ts --format=cjs --outdir=<TSOUT>
 * then point the two requires below at <TSOUT> and `node` this file.
 * Opponents are priced off Sleeper's real half-PPR ADP (SLP[name].adp). */
/* CONDITIONAL DRAFT TREE.
 *   "If I land X at pick 1, who should I take at pick 2? then pick 3?"
 *
 * For every plausible first pick we force it, then force each candidate second pick, let the
 * rest of the draft run on best-available, play the season out, and rank. Then we repeat one
 * level deeper on the winning second pick.
 *
 * Pairing: each player's season is drawn from a seed derived from (world, his name), so a
 * given player has the IDENTICAL season in every branch of the tree. Comparisons between
 * branches therefore differ only by the picks, never by luck.
 */
const fs = require('fs');
const { P, MKT, BYE } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/data.js');
const { SLP } = require('/Users/brianlee/.claude/jobs/142115c6/tmp/tsout/sleeper.js');

const PPG = { QB: r => Math.max(14, 23.5 - 0.32*r), RB: r => 12.5*Math.exp(-(r-1)/20)+5.8,
  WR: r => 11.5*Math.exp(-(r-1)/26)+6.2, TE: r => 8.5*Math.exp(-(r-1)/7)+5 };
const RISK = { buy: 1.02, solid: 1, risk: 0.93, avoid: 0.86 };
const BASE_CV = { QB: 0.26, RB: 0.44, WR: 0.40, TE: 0.42 };
const RISK_CV = { buy: 0.95, solid: 1.0, risk: 1.22, avoid: 1.32 };
const BASE_MISS = { QB: 0.14, RB: 0.30, WR: 0.22, TE: 0.24 };

const POOL = [];
{ const c = { QB:0,RB:0,WR:0,TE:0 };
  P.forEach((r, i) => { if (c[r[1]] === undefined) return;
    const pr = ++c[r[1]], ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3], s = SLP[r[0]] || {};
    const mkt = s.adp !== undefined ? 0.75*s.adp + 0.25*ffc : ffc;
    const hurt = ['O','IR','PUP','SUS'].includes(s.inj) ? 0.85 : s.inj === 'D' ? 0.95 : 1;
    POOL.push({ name: r[0], pos: r[1], team: r[2], ourRank: i+1, idx: POOL.length,
      proj: PPG[r[1]](pr) * (RISK[r[4]] || 1) * hurt,
      cv: BASE_CV[r[1]] * (RISK_CV[r[4]] || 1) * (s.inj ? 1.15 : 1),
      pMiss: BASE_MISS[r[1]] * (r[4]==='risk'?1.3:r[4]==='avoid'?1.5:1) * (s.inj ? 1.4 : 1),
      mkt, sig: Math.max(2.2, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13*mkt), bye: BYE[r[2]] || 0 }); }); }
const IDX = new Map(POOL.map(p => [p.name, p]));

const snap = p => { const r = Math.ceil(p/12), i = p-(r-1)*12; return r%2 ? i : 13-i; };
const mul = a => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = rnd => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = t => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };

/* Per-player season, keyed on (world, player) so it is identical across every branch. */
const seasonCache = new Map();
function realiseFor(p, world) {
  const key = world * 100000 + p.idx;
  let v = seasonCache.get(key);
  if (v !== undefined) return v;
  const rnd = mul(world * 7919 + p.idx * 104729 + 13);
  rnd(); rnd();
  const s = Math.sqrt(Math.log(1 + p.cv*p.cv));
  const ppg = p.proj * Math.exp(gauss(rnd)*s - (s*s)/2);
  v = ppg * (rnd() < p.pMiss ? 0.35 + 0.5*rnd() : 1);
  seasonCache.set(key, v);
  return v;
}
function oppPick(avail, team, rnd) {
  const c = NEED(team); let b = null, bs = Infinity;
  for (const p of avail) { let s = p.mkt + gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;} } return b;
}
function bestAvail(avail, team) {
  const c = NEED(team);
  const ok = ['RB','WR','TE','QB'].filter(pos => pos==='QB'?c.QB<2:pos==='TE'?c.TE<2:c[pos]<6);
  const cs = avail.filter(p => ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];
}
/* forced: names to take at my 1st/2nd/3rd pick (undefined = best available).
   Returns null if a forced player was already gone. */
function runTree(slot, forced, world) {
  const rnd = mul(20000 + world);
  const avail = POOL.slice(), teams = {};
  for (let t=1;t<=12;t++) teams[t]=[];
  let mine = 0;
  for (let pick=1; pick<=192; pick++) {
    if(!avail.length) break;
    const t = snap(pick);
    let p;
    if (t === slot) {
      const want = forced[mine];
      if (want) { p = IDX.get(want); if (!p || !avail.includes(p)) return null; }
      else p = bestAvail(avail, teams[t]);
      mine++;
    } else p = oppPick(avail, teams[t], rnd);
    if(!p) break;
    teams[t].push(p); avail.splice(avail.indexOf(p),1);
  }
  const roster = teams[slot].map(p => ({ ...p, real: realiseFor(p, world) }));
  const by = pos => roster.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'), wr=by('WR'), te=by('TE'), qb=by('QB');
  const used=new Set(); let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1); take(rb,2); take(wr,2); take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;
}
/* Who is actually on the board at my Nth pick? */
function availability(slot, forced, worlds) {
  const myPicks = []; for (let r=1;r<=4;r++) myPicks.push((r-1)*12 + (r%2?slot:13-slot));
  const target = myPicks[forced.length];
  const seen = {};
  for (let w=0; w<worlds; w++) {
    const rnd = mul(20000+w);
    const avail = POOL.slice(), teams={}; for(let t=1;t<=12;t++)teams[t]=[];
    let mine=0, ok=true;
    for (let pick=1; pick<target; pick++) {
      const t=snap(pick); let p;
      if (t===slot) { const want=forced[mine];
        if (want){ p=IDX.get(want); if(!p||!avail.includes(p)){ok=false;break;} }
        else p=bestAvail(avail,teams[t]); mine++; }
      else p=oppPick(avail,teams[t],rnd);
      if(!p) break; teams[t].push(p); avail.splice(avail.indexOf(p),1);
    }
    if(!ok) continue;
    avail.forEach(p=>{ seen[p.name]=(seen[p.name]||0)+1; });
  }
  return { seen, worlds, target };
}

const WORLDS = 700;
const SEATS = { 1: 'ASHLEY (1)', 6: 'BRIAN JK (6)', 10: 'EMILY (10)' };
const out = {};

for (const slot of Object.keys(SEATS).map(Number)) {
  const myPicks = []; for (let r=1;r<=4;r++) myPicks.push((r-1)*12 + (r%2?slot:13-slot));
  console.log(`\n${'='.repeat(96)}\n${SEATS[slot]} — picks ${myPicks.slice(0,3).join(', ')}\n`);

  /* --- candidate FIRST picks: on the board at least 25% of the time --- */
  const a1 = availability(slot, [], WORLDS);
  const firstCands = POOL.filter(p => (a1.seen[p.name]||0)/WORLDS >= 0.25)
    .sort((a,b)=>a.ourRank-b.ourRank).slice(0, 5);

  const seatOut = [];
  for (const F of firstCands) {
    const availF = Math.round((a1.seen[F.name]||0)/WORLDS*100);
    /* --- rank SECOND picks given F --- */
    const a2 = availability(slot, [F.name], WORLDS);
    const secondCands = POOL.filter(p => p.name!==F.name && (a2.seen[p.name]||0)/WORLDS >= 0.30)
      .sort((a,b)=>a.ourRank-b.ourRank).slice(0, 10);
    const scored2 = [];
    for (const S of secondCands) {
      let sum=0,n=0;
      for (let w=0;w<WORLDS;w++){ const v=runTree(slot,[F.name,S.name],w); if(v!==null){sum+=v;n++;} }
      if (n >= WORLDS*0.25) scored2.push({ name:S.name, pos:S.pos, pts:sum/n,
        avail: Math.round((a2.seen[S.name]||0)/WORLDS*100) });
    }
    scored2.sort((a,b)=>b.pts-a.pts);
    /* --- rank THIRD picks given F + best S --- */
    let scored3 = [];
    if (scored2.length) {
      const S = scored2[0];
      const a3 = availability(slot, [F.name, S.name], WORLDS);
      const thirdCands = POOL.filter(p => p.name!==F.name && p.name!==S.name && (a3.seen[p.name]||0)/WORLDS >= 0.30)
        .sort((a,b)=>a.ourRank-b.ourRank).slice(0, 10);
      for (const T of thirdCands) {
        let sum=0,n=0;
        for (let w=0;w<WORLDS;w++){ const v=runTree(slot,[F.name,S.name,T.name],w); if(v!==null){sum+=v;n++;} }
        if (n >= WORLDS*0.25) scored3.push({ name:T.name, pos:T.pos, pts:sum/n,
          avail: Math.round((a3.seen[T.name]||0)/WORLDS*100) });
      }
      scored3.sort((a,b)=>b.pts-a.pts);
    }
    seatOut.push({ first:{ name:F.name, pos:F.pos, avail:availF },
      second: scored2.slice(0,6).map(x=>({...x, pts:+x.pts.toFixed(2)})),
      third:  scored3.slice(0,6).map(x=>({...x, pts:+x.pts.toFixed(2)})) });

    console.log(`IF YOU GET ${F.name} (${F.pos})  — on the board ${availF}% of the time`);
    console.log(`   pick ${myPicks[1]} — best to worst:`);
    scored2.slice(0,6).forEach((s,i)=>console.log(`      ${i+1}. ${s.name.padEnd(24)} ${s.pos}   ${s.pts.toFixed(2)} pts/wk   there ${s.avail}%`));
    if (scored2[0]) {
      console.log(`   then pick ${myPicks[2]}, having taken ${scored2[0].name}:`);
      scored3.slice(0,6).forEach((s,i)=>console.log(`      ${i+1}. ${s.name.padEnd(24)} ${s.pos}   ${s.pts.toFixed(2)} pts/wk   there ${s.avail}%`));
    }
    console.log('');
  }
  out[slot] = { picks: myPicks.slice(0,3), worlds: WORLDS, branches: seatOut };
}
fs.writeFileSync('/Users/brianlee/.claude/jobs/142115c6/tmp/tree.json', JSON.stringify(out, null, 2));
console.log('wrote tree.json');
