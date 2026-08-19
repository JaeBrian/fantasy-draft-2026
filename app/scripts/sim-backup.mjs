/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-backup.mjs
 *
 * The advisor's positional weights collapse to ~0.05 once you own a QB, and ~0.07 once you own
 * a TE, so it finishes every draft with exactly one of each. On that player's bye you field
 * nobody in the slot. Byes already cost 3+ pts/wk, so: is a backup worth a roster spot?
 *
 * Scored WEEK BY WEEK with byes live — a season average cannot see this at all. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');



const PPG={QB:r=>Math.max(14,23.5-0.32*r),RB:r=>12.5*Math.exp(-(r-1)/20)+5.8,
  WR:r=>11.5*Math.exp(-(r-1)/26)+6.2,TE:r=>8.5*Math.exp(-(r-1)/7)+5};
const RISK={buy:1.02,solid:1,risk:0.93,avoid:0.86};
const BASE_CV={QB:0.26,RB:0.44,WR:0.40,TE:0.42},RISK_CV={buy:0.95,solid:1.0,risk:1.22,avoid:1.32};
const BASE_MISS={QB:0.14,RB:0.30,WR:0.22,TE:0.24};
const POOL=[];{const c={QB:0,RB:0,WR:0,TE:0};
  P.forEach((r,i)=>{if(c[r[1]]===undefined)return;const pr=++c[r[1]];
    const ffc=MKT[r[0]]?MKT[r[0]][0]:r[3],s=SLP[r[0]]||{};
    const mkt=s.adp!==undefined?0.75*s.adp+0.25*ffc:ffc;
    const hurt=['O','IR','PUP','SUS'].includes(s.inj)?0.85:s.inj==='D'?0.95:1;
    POOL.push({name:r[0],pos:r[1],ourRank:i+1,idx:POOL.length,
      proj: (PROJ[r[0]] !== undefined ? PROJ[r[0]] : PPG[r[1]](pr)) * (RISK[r[4]] || 1) * hurt,
      cv: riskOf(r[0], r[1], r[4]).cv,
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(0.5,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0});});}
const snap=p=>{const r=Math.ceil(p/12),i=p-(r-1)*12;return r%2?i:13-i;};
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const gauss=rnd=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const NEED=t=>{const c={QB:0,RB:0,WR:0,TE:0};t.forEach(x=>c[x.pos]++);return c;};
const cache=new Map();
function realiseFor(p,w){const k=w*100000+p.idx;let v=cache.get(k);if(v!==undefined)return v;
  const rnd=mul(w*7919+p.idx*104729+13);rnd();rnd();
  const s=Math.sqrt(Math.log(1+p.cv*p.cv));
  v=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2)*(rnd()<p.pMiss?0.35+0.5*rnd():1);
  cache.set(k,v);return v;}
function oppPick(avail,team,rnd){const c=NEED(team);let b=null,bs=Infinity;
  for(const p of avail){let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60;if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25;if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;}}return b;}
/* caps: how many QB / TE we are willing to roster */
function myPick(avail,team,capQB,capTE){
  const c=NEED(team);
  const ok=['RB','WR','TE','QB'].filter(pos=>
    pos==='QB'?c.QB<capQB:pos==='TE'?c.TE<capTE:c[pos]<6);
  const cs=avail.filter(p=>ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];}
/* one week: anyone on bye scores nothing and cannot be started */
function week(R,wk){
  const live=R.filter(x=>x.bye!==wk);
  const by=pos=>live.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set();let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}
function season(slot,capQB,capTE,w){
  const rnd=mul(80000+w),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  for(let pick=1;pick<=168;pick++){if(!avail.length)break;const t=snap(pick);
    const p=t===slot?myPick(avail,teams[t],capQB,capTE):oppPick(avail,teams[t],rnd);
    if(!p)break;teams[t].push(p);avail.splice(avail.indexOf(p),1);}
  const R=teams[slot].map(p=>({...p,real:realiseFor(p,w)}));
  let tot=0;for(let wk=1;wk<=17;wk++)tot+=week(R,wk);
  return tot/17;}

const W=3000,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const SEATS={1:'ASHLEY (1)',6:'BRIAN JK (6)',10:'EMILY (10)'};
console.log('\nIs a backup QB or TE worth a roster spot? Scored week by week, byes live.\n');
console.log('  seat            1QB+1TE   2QB+1TE   1QB+2TE   2QB+2TE   best');
for(const slot of [1,6,10]){
  const r={};
  for(const [label,q,t] of [['1/1',1,1],['2/1',2,1],['1/2',1,2],['2/2',2,2]]){
    const out=[];for(let w=0;w<W;w++)out.push(season(slot,q,t,w));
    r[label]=mean(out);
  }
  const best=Object.entries(r).sort((a,b)=>b[1]-a[1])[0];
  console.log(`  ${SEATS[slot].padEnd(15)}${r['1/1'].toFixed(2).padStart(7)}${r['2/1'].toFixed(2).padStart(10)}`+
    `${r['1/2'].toFixed(2).padStart(10)}${r['2/2'].toFixed(2).padStart(10)}   ${best[0]} (+${(best[1]-r['1/1']).toFixed(2)} vs 1/1)`);
}
console.log('\n  The advisor currently caps at 2 QB / 2 TE but its weights make it take 1 of each.');
console.log('  A positive number in the best column means the extra bench spot pays for itself.\n');
