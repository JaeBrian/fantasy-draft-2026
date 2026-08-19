/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-policy.mjs
 *
 * A better simulation than the template studies.
 *
 * The template approach ("RB-WR-WR-RB") has a flaw that only showed up under scrutiny: it
 * fixes the POSITION each round and then takes whoever our board lists first at it. At seat 6
 * that means the RB-first template drafts Christian McCaffrey (board #6) instead of Jonathan
 * Taylor (board #9) about half the time — and McCaffrey is worth 1.8 pts/wk less. The study
 * then reports "opening WR is better", which is a fact about our board order, not about
 * position. Templates cannot separate the two.
 *
 * So simulate POLICIES — complete ways of deciding — and let each pick whoever it wants:
 *
 *   adp        take the player the market takes next. the naive baseline.
 *   board      take our highest-ranked player, roster caps only.
 *   vorp       take the largest value over replacement, ignoring scarcity.
 *   scarcity   vorp plus the drop-off you would eat by waiting a turn at that position.
 *              this is the advisor's logic, isolated.
 *   needs      scarcity, but refusing to start a position you cannot use.
 *
 * Everything is scored WEEK BY WEEK with byes live, on paired seasons: every policy meets the
 * same opponents and the same player outcomes, so the difference is the decision rule alone. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');



const PPG={QB:r=>Math.max(14,23.5-0.32*r),RB:r=>12.5*Math.exp(-(r-1)/20)+5.8,
  WR:r=>11.5*Math.exp(-(r-1)/26)+6.2,TE:r=>8.5*Math.exp(-(r-1)/7)+5};
const REPL={QB:PPG.QB(14),RB:PPG.RB(32),WR:PPG.WR(34),TE:PPG.TE(13)};
const RISK={buy:1.02,solid:1,risk:0.93,avoid:0.86};
const BASE_CV={QB:0.26,RB:0.44,WR:0.40,TE:0.42},RISK_CV={buy:0.95,solid:1.0,risk:1.22,avoid:1.32};
const BASE_MISS={QB:0.14,RB:0.30,WR:0.22,TE:0.24};

const POOL=[];{const c={QB:0,RB:0,WR:0,TE:0};
  P.forEach((r,i)=>{if(c[r[1]]===undefined)return;const pr=++c[r[1]];
    const ffc=MKT[r[0]]?MKT[r[0]][0]:r[3],s=SLP[r[0]]||{};
    const mkt=s.adp!==undefined?0.75*s.adp+0.25*ffc:ffc;
    const hurt=['O','IR','PUP','SUS'].includes(s.inj)?0.85:s.inj==='D'?0.95:1;
    const proj = (PROJ[r[0]] !== undefined ? PROJ[r[0]] : PPG[r[1]](pr)) * (RISK[r[4]] || 1) * hurt;
    POOL.push({name:r[0],pos:r[1],ourRank:i+1,idx:POOL.length,proj,
      vorp:Math.max(0.2,proj-REPL[r[1]]),
      cv: riskOf(r[0], r[1], r[4]).cv,
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(0.5,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0});});}

const snap=p=>{const r=Math.ceil(p/12),i=p-(r-1)*12;return r%2?i:13-i;};
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const gauss=rnd=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const NEED=t=>{const c={QB:0,RB:0,WR:0,TE:0};t.forEach(x=>c[x.pos]++);return c;};
function ncdf(z){if(z<-8)return 0;if(z>8)return 1;
  const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return z>0?1-p:p;}
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

/* expected best projection still there at `nextPick`, per position */
function evLater(avail,pos,cur,nextPick){
  let ev=REPL[pos],pAll=1;
  for(const p of avail.filter(x=>x.pos===pos).slice(0,26)){
    const Fk=ncdf((nextPick-p.mkt)/p.sig),Fc=ncdf((cur-p.mkt)/p.sig);
    const den=1-Fc; const pg=den<=0.03?0.97:Math.min(0.97,Math.max(0.01,(Fk-Fc)/den));
    ev+=pAll*(1-pg)*(p.proj-REPL[pos]); pAll*=pg;
  }
  return ev;
}
const CAP=(c,pos,late)=>pos==='QB'?c.QB<(late?2:1):pos==='TE'?c.TE<(late?2:1):c[pos]<6;

function choose(policy,avail,team,cur,nextPick,myCount){
  const c=NEED(team), late=myCount>=10;
  let cs=avail.filter(p=>CAP(c,p.pos,late)); if(!cs.length)cs=avail;
  if(policy==='adp')   return cs.slice().sort((a,b)=>a.mkt-b.mkt)[0];
  if(policy==='board') return cs.slice().sort((a,b)=>a.ourRank-b.ourRank)[0];
  if(policy==='vorp')  return cs.slice().sort((a,b)=>b.vorp-a.vorp)[0];
  const ev={}; for(const pos of ['QB','RB','WR','TE']) ev[pos]=evLater(avail,pos,cur,nextPick);
  const gapOf=p=>Math.max(0,p.proj-ev[p.pos]);
  if(policy==='scarcity') return cs.slice().sort((a,b)=>(b.vorp+1.25*gapOf(b))-(a.vorp+1.25*gapOf(a)))[0];
  /* needs: same, but a position you cannot yet start is worth less */
  const w=p=>{const n=c[p.pos];
    if(p.pos==='QB')return n===0?1:0.5;
    if(p.pos==='TE')return n===0?0.9:0.45;
    return n<2?1.05:(c.RB+c.WR+c.TE<7?0.8:0.45);};
  return cs.slice().sort((a,b)=>w(b)*(b.vorp+1.25*gapOf(b))-w(a)*(a.vorp+1.25*gapOf(a)))[0];
}
function weekly(R){let tot=0;
  for(let wk=1;wk<=17;wk++){
    const live=R.filter(x=>x.bye!==wk);
    const by=pos=>live.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
    const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
    const used=new Set();let pts=0;
    const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
    take(qb,1);take(rb,2);take(wr,2);take(te,1);
    take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
    tot+=pts;}
  return tot/17;}
function run(slot,policy,w){
  const rnd=mul(20000+w),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  const myPicks=[];for(let r=1;r<=14;r++)myPicks.push((r-1)*12+(r%2?slot:13-slot));
  let mine=0;
  for(let pick=1;pick<=168;pick++){if(!avail.length)break;const t=snap(pick);let p;
    if(t===slot){
      const nx=myPicks[mine+1]||pick+12;
      p=choose(policy,avail,teams[t],pick,nx,mine); mine++;
    } else p=oppPick(avail,teams[t],rnd);
    if(!p)break;teams[t].push(p);avail.splice(avail.indexOf(p),1);}
  return {pts:weekly(teams[slot].map(p=>({...p,real:realiseFor(p,w)}))),
          opener:teams[slot][0]?teams[slot][0].name:'-'};}

const W=4000,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const pct=(a,q)=>a.slice().sort((x,y)=>x-y)[Math.floor(q*(a.length-1))];
const POLICIES=['adp','board','vorp','scarcity','needs'];
const SEATS={1:'ASHLEY (1)',6:'BRIAN JK (6)',10:'EMILY (10)'};

for(const slot of [1,6,10]){
  console.log(`\n${'='.repeat(86)}\n${SEATS[slot]} — ${W.toLocaleString()} paired seasons, scored week by week with byes live\n`);
  const res={},open={},h2h={};
  POLICIES.forEach(a=>{h2h[a]={};POLICIES.forEach(b=>h2h[a][b]=0);});
  for(let w=0;w<W;w++){
    const got={};
    for(const pol of POLICIES){const r=run(slot,pol,w);
      (res[pol]=res[pol]||[]).push(r.pts);
      (open[pol]=open[pol]||{})[r.opener]=((open[pol]||{})[r.opener]||0)+1;
      got[pol]=r.pts;}
    POLICIES.forEach(a=>POLICIES.forEach(b=>{if(a!==b&&got[a]>got[b])h2h[a][b]++;}));
  }
  console.log('  policy      mean    bad yr  good yr   beats the others   usual opening pick');
  POLICIES.map(p=>({p,m:mean(res[p]),lo:pct(res[p],0.1),hi:pct(res[p],0.9),
      beat:mean(POLICIES.filter(x=>x!==p).map(x=>h2h[p][x]/W*100)),
      top:Object.entries(open[p]).sort((a,b)=>b[1]-a[1])[0]}))
    .sort((a,b)=>b.m-a.m)
    .forEach(r=>console.log(`  ${r.p.padEnd(11)} ${r.m.toFixed(2).padStart(6)} ${r.lo.toFixed(1).padStart(8)} ${r.hi.toFixed(1).padStart(8)} ${r.beat.toFixed(0).padStart(15)}%   ${r.top[0]} ${(r.top[1]/W*100).toFixed(0)}%`));
}
console.log('');
