/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-replacement.mjs
 *
 * Replacement level decides how RB, WR and TE compare to each other, and ours was assumed:
 * RB32, WR34, TE13, QB14, picked because a 12-team league starts 24 backs and 24 receivers in
 * fixed slots plus 24 flex, and the flex "probably" splits about like that.
 *
 * That guess is load-bearing. RB value falls off faster than WR (10.8 at RB24 down to 8.9 at
 * RB32; WR only 10.7 to 9.7 at WR34), so calling RB32 the replacement while calling WR34 the
 * replacement hands running backs a structural advantage in every comparison the advisor
 * makes. Two audit failures both had the simulation preferring a receiver the advisor had
 * ranked below a back.
 *
 * So stop guessing. Simulate the league, look at who actually ends up in the twelve starting
 * lineups each week, and read the replacement rank off that. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');

const POOL = [];
P.forEach((r) => {
  if (!['QB','RB','WR','TE'].includes(r[1])) return;
  const ffc = MKT[r[0]] ? MKT[r[0]][0] : r[3];
  const s = SLP[r[0]] || {};
  const mkt = s.adp !== undefined ? 0.75 * s.adp + 0.25 * ffc : ffc;
  const rk = riskOf(r[0], r[1], r[4]);
  POOL.push({ name: r[0], pos: r[1], idx: POOL.length,
    proj: PROJ[r[0]] !== undefined ? PROJ[r[0]] : 6, cv: rk.cv, pMiss: rk.pMiss,
    mkt, sig: Math.max(0.5, MKT[r[0]] ? MKT[r[0]][1] : 0, 0.13 * mkt), bye: BYE[r[2]] || 0 });
});
/* rank within position by projection — that is what "the Nth best RB" means */
const POSRANK = {};
for (const pos of ['QB','RB','WR','TE']) {
  POOL.filter(p => p.pos === pos).sort((a,b) => b.proj - a.proj)
    .forEach((p, i) => { POSRANK[p.name] = i + 1; });
}

const snap = p => { const r=Math.ceil(p/12), i=p-(r-1)*12; return r%2?i:13-i; };
const mul = a => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const gauss = rnd => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const NEED = t => { const c={QB:0,RB:0,WR:0,TE:0}; t.forEach(x=>c[x.pos]++); return c; };
const cache = new Map();
function realise(p,w){ const k=w*100000+p.idx; let v=cache.get(k); if(v!==undefined)return v;
  const rnd=mul(w*7919+p.idx*104729+13); rnd(); rnd();
  const s=Math.sqrt(Math.log(1+p.cv*p.cv));
  v=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*(rnd()<p.pMiss?0.35+0.5*rnd():1);
  cache.set(k,v); return v; }
function oppPick(avail,team,rnd){ const c=NEED(team); let b=null,bs=Infinity;
  for(const p of avail){ let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60; if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25; if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;} } return b; }

const W = 3000;
/* how deep does each position go among players who actually start a week? */
const started = { QB: [], RB: [], WR: [], TE: [] };
for (let w = 0; w < W; w++) {
  const rnd = mul(2000000 + w), avail = POOL.slice(), teams = {};
  for (let t=1;t<=12;t++) teams[t]=[];
  for (let pick=1; pick<=168; pick++) {
    if (!avail.length) break;
    const p = oppPick(avail, teams[snap(pick)], rnd);
    if (!p) break;
    teams[snap(pick)].push(p); avail.splice(avail.indexOf(p),1);
  }
  /* one representative week: every team fields its best legal lineup */
  for (let t=1;t<=12;t++) {
    const R = teams[t].map(p => ({...p, real: realise(p, w)}));
    const by = pos => R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
    const rb=by('RB'), wr=by('WR'), te=by('TE'), qb=by('QB');
    const used = new Set(); const picked = [];
    const take = (a,n) => a.slice(0,n).forEach(x => { picked.push(x); used.add(x.name); });
    take(qb,1); take(rb,2); take(wr,2); take(te,1);
    take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real), 2);
    picked.forEach(x => started[x.pos].push(POSRANK[x.name]));
  }
}

console.log(`\nWHO ACTUALLY STARTS — ${W.toLocaleString()} drafted leagues, one week each, 12 lineups per league\n`);
console.log('  pos   starters per league   the rank of the LAST man in (p90)   currently assumed');
const ASSUMED = { QB: 14, RB: 32, WR: 34, TE: 13 };
const OUT = {};
for (const pos of ['QB','RB','WR','TE']) {
  const a = started[pos];
  const perLeague = a.length / W / 12;
  const sorted = a.slice().sort((x,y)=>x-y);
  const p90 = sorted[Math.floor(0.9 * (sorted.length - 1))];
  OUT[pos] = p90;
  console.log(`  ${pos}    ${(perLeague * 12).toFixed(1).padStart(5)} per league  ${String(p90).padStart(22)}   ${String(ASSUMED[pos]).padStart(17)}`);
}
console.log('\n  The p90 rank is the honest replacement level: the depth at which a player is still');
console.log('  starting in one league out of ten, and below which he is a bench body everywhere.');
console.log(`\n  measured:  QB${OUT.QB}  RB${OUT.RB}  WR${OUT.WR}  TE${OUT.TE}`);
console.log(`  assumed:   QB${ASSUMED.QB}  RB${ASSUMED.RB}  WR${ASSUMED.WR}  TE${ASSUMED.TE}\n`);
