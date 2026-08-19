/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-kdef-check.mjs
 * sim-build.mjs transpiles src/data.ts and src/sleeper.ts into .simcache/.
 * Opponents are priced off Sleeper's real half-PPR ADP (SLP[name].adp). */
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
function tplPick(avail,team,tpl,round){const c=NEED(team),want=tpl[round-1];
  if(want){const k=avail.filter(p=>p.pos===want);if(k.length)return k.sort((a,b)=>a.ourRank-b.ourRank)[0];}
  const ok=['RB','WR','TE','QB'].filter(pos=>pos==='QB'?c.QB<2:pos==='TE'?c.TE<2:c[pos]<6);
  const cs=avail.filter(p=>ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];}
function lineup(R){const by=pos=>R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set();let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}
/* kdef=true -> rounds 15 and 16 are spent on K/DEF by every team, so no skill player moves */
function run(slot,tpl,seed,kdef){
  const rnd=mul(seed),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  const lastRound = kdef ? 14 : 16;
  for(let pick=1;pick<=lastRound*12;pick++){if(!avail.length)break;const t=snap(pick);
    const p=t===slot?tplPick(avail,teams[t],tpl,Math.ceil(pick/12)):oppPick(avail,teams[t],rnd);
    if(!p)break;teams[t].push(p);avail.splice(avail.indexOf(p),1);}
  return lineup(teams[slot].map(p=>({...p,real:realiseFor(p,seed-20000)})));}

const FIN={
  1:{'RB-WR-WR-RB':['RB','WR','WR','RB','TE','QB'],'RB-RB-WR-RB':['RB','RB','WR','RB','TE','QB'],
     'RB-WR-RB-WR':['RB','WR','RB','WR','TE','QB'],'RB-RB-WR-WR':['RB','RB','WR','WR','TE','QB'],
     'WR-RB-RB-WR':['WR','RB','RB','WR','TE','QB']},
  6:{'WR-RB-WR-RB':['WR','RB','WR','RB','TE','QB'],'WR-RB-RB-WR':['WR','RB','RB','WR','TE','QB'],
     'RB-RB-WR-WR':['RB','RB','WR','WR','TE','QB'],'RB-WR-RB-WR':['RB','WR','RB','WR','TE','QB'],
     'RB-RB-QB-WR':['RB','RB','QB','WR','WR','TE']},
  10:{'RB-RB-WR-WR':['RB','RB','WR','WR','TE','QB'],'WR-RB-WR-RB':['WR','RB','WR','RB','TE','QB'],
     'WR-RB-RB-WR':['WR','RB','RB','WR','TE','QB'],'RB-WR-WR-RB':['RB','WR','WR','RB','TE','QB'],
     'RB-WR-RB-WR':['RB','WR','RB','WR','TE','QB']},
};
const W=4000, mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
for(const slot of [1,6,10]){
  console.log(`\nseat ${slot}`);
  console.log('  strategy          16 skill rounds   14 skill + K/DEF    diff');
  const res=[];
  for(const [label,tpl] of Object.entries(FIN[slot])){
    const a=[],b=[];
    for(let w=0;w<W;w++){a.push(run(slot,tpl,20000+w,false));b.push(run(slot,tpl,20000+w,true));}
    res.push({label,old:mean(a),neu:mean(b)});
  }
  const rkOld=res.slice().sort((x,y)=>y.old-x.old).map(r=>r.label);
  const rkNew=res.slice().sort((x,y)=>y.neu-x.neu).map(r=>r.label);
  res.sort((x,y)=>y.neu-x.neu).forEach(r=>console.log(
    `  ${r.label.padEnd(16)} ${r.old.toFixed(2).padStart(13)} ${r.neu.toFixed(2).padStart(18)} ${(r.neu-r.old).toFixed(3).padStart(8)}`));
  console.log(`  ordering identical: ${JSON.stringify(rkOld)===JSON.stringify(rkNew) ? 'YES' : 'NO -> ' + rkNew.join(' > ')}`);
}
