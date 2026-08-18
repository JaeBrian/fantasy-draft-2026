/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-followup.mjs
 *
 * Two claims the timing study suggests but does NOT establish. Testing before believing:
 *   E. Byes drag scoring down ~3 pts/wk. Does drafting AROUND byes recover any of it,
 *      or is it just a fact of the calendar you have to eat?
 *   F. Brian (pick 6) loses the most to Ashley and Emily sharing his board. Does he gain
 *      by deliberately deviating from it? */
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
    POOL.push({name:r[0],pos:r[1],team:r[2],ourRank:i+1,idx:POOL.length,
      proj: (PROJ[r[0]] !== undefined ? PROJ[r[0]] : PPG[r[1]](pr)) * (RISK[r[4]] || 1) * hurt,
      cv: riskOf(r[0], r[1], r[4]).cv,
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(2.2,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0});});}
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
function lineupFlat(R){const by=pos=>R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set();let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}
function lineupWeekly(R){let t=0;for(let wk=1;wk<=17;wk++)t+=lineupFlat(R.filter(x=>x.bye!==wk));return t/17;}

/* pickers: 'plain' = board order; 'bye' = board order with a penalty for stacking a bye;
   'deviate' = board order but skip to the next man when the top choice is one the other
   tool seats are equally likely to want (i.e. deliberately zag) */
function choose(mode,avail,team){
  const c=NEED(team);
  const ok=['RB','WR','TE','QB'].filter(pos=>pos==='QB'?c.QB<1:pos==='TE'?c.TE<1:c[pos]<6);
  let cs=avail.filter(p=>ok.includes(p.pos));
  if(!cs.length)cs=avail;
  if(mode==='plain') return cs.sort((a,b)=>a.ourRank-b.ourRank)[0];
  if(mode==='bye'){
    const cnt={}; team.forEach(x=>{cnt[x.bye]=(cnt[x.bye]||0)+1;});
    return cs.slice().sort((a,b)=>
      (a.ourRank + (cnt[a.bye]>=2?9:0) + (cnt[a.bye]>=3?12:0)) -
      (b.ourRank + (cnt[b.bye]>=2?9:0) + (cnt[b.bye]>=3?12:0)))[0];
  }
  /* deviate: among the top few by board, take the one the market prices LATEST -- i.e. the
     one least likely to be sniped, banking the better-priced player now */
  const top=cs.slice().sort((a,b)=>a.ourRank-b.ourRank).slice(0,4);
  return top.sort((a,b)=>a.mkt-b.mkt)[0];
}
function draft(slot,mode,seed,toolSeats,weekly){
  const rnd=mul(seed),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  for(let pick=1;pick<=168;pick++){if(!avail.length)break;
    const t=snap(pick);let p;
    if(t===slot)p=choose(mode,avail,teams[t]);
    else if(toolSeats&&toolSeats.includes(t))p=choose('plain',avail,teams[t]);
    else p=oppPick(avail,teams[t],rnd);
    if(!p)break;teams[t].push(p);avail.splice(avail.indexOf(p),1);}
  const R=teams[slot].map(p=>({...p,real:realiseFor(p,seed-60000)}));
  return weekly?lineupWeekly(R):lineupFlat(R);}

const W=3000,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const SEATS={1:'ASHLEY (1)',6:'BRIAN JK (6)',10:'EMILY (10)'};

console.log('\n' + '='.repeat(82));
console.log('E. DOES DRAFTING AROUND BYES RECOVER THE ~3 PTS/WK THEY COST?');
console.log('   both columns scored week by week, byes live. only the draft policy differs.\n');
for(const slot of [1,6,10]){
  const a=[],b=[];
  for(let w=0;w<W;w++){a.push(draft(slot,'plain',60000+w,null,true));b.push(draft(slot,'bye',60000+w,null,true));}
  const d=mean(b)-mean(a);
  console.log(`  ${SEATS[slot].padEnd(14)} ignore byes ${mean(a).toFixed(2)}   draft around them ${mean(b).toFixed(2)}   gain ${d>0?'+':''}${d.toFixed(2)} pts/wk`);
}
console.log('\n' + '='.repeat(82));
console.log('F. DOES BRIAN GAIN BY DEVIATING FROM THE BOARD THE OTHER TWO ALSO USE?');
console.log('   all three tool seats active in every run; only the tested seat changes policy.\n');
const OTHER=[1,6,10];
for(const slot of [1,6,10]){
  const a=[],b=[];
  for(let w=0;w<W;w++){
    a.push(draft(slot,'plain',60000+w,OTHER.filter(s=>s!==slot),false));
    b.push(draft(slot,'deviate',60000+w,OTHER.filter(s=>s!==slot),false));
  }
  const d=mean(b)-mean(a);
  console.log(`  ${SEATS[slot].padEnd(14)} follow the board ${mean(a).toFixed(2)}   deviate ${mean(b).toFixed(2)}   ${d>0?'gain +':'cost '}${d.toFixed(2)} pts/wk`);
}
console.log('');
