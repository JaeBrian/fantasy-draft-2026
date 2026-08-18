/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-timing.mjs
 *
 * Four questions the earlier studies never asked, for Ashley (1), Brian JK (6), Emily (10):
 *   A. QB TIMING  — what round should each seat take a quarterback?
 *   B. TE TIMING  — given Sleeper's rooms overpay for tight ends, is paying early ever right?
 *   C. BYE COST   — what does a stacked bye week actually cost, scored week by week?
 *   D. INTERFERENCE — all three draft off the same board. What does that cost each of them? */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');
const { PROJ } = require(CACHE + 'projections.cjs');
const { riskOf } = require(CACHE + 'risk.cjs');



const PPG = { QB: r=>Math.max(14,23.5-0.32*r), RB: r=>12.5*Math.exp(-(r-1)/20)+5.8,
  WR: r=>11.5*Math.exp(-(r-1)/26)+6.2, TE: r=>8.5*Math.exp(-(r-1)/7)+5 };
const RISK={buy:1.02,solid:1,risk:0.93,avoid:0.86};
const BASE_CV={QB:0.26,RB:0.44,WR:0.40,TE:0.42}, RISK_CV={buy:0.95,solid:1.0,risk:1.22,avoid:1.32};
const BASE_MISS={QB:0.14,RB:0.30,WR:0.22,TE:0.24};

const POOL=[]; { const c={QB:0,RB:0,WR:0,TE:0};
  P.forEach((r,i)=>{ if(c[r[1]]===undefined)return; const pr=++c[r[1]];
    const ffc=MKT[r[0]]?MKT[r[0]][0]:r[3], s=SLP[r[0]]||{};
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
/* best available, honouring roster caps; optional forced position this round */
function myPick(avail,team,want){const c=NEED(team);
  if(want){const k=avail.filter(p=>p.pos===want);if(k.length)return k.sort((a,b)=>a.ourRank-b.ourRank)[0];}
  const ok=['RB','WR','TE','QB'].filter(pos=>pos==='QB'?c.QB<1:pos==='TE'?c.TE<1:c[pos]<6);
  const cs=avail.filter(p=>ok.includes(p.pos));
  return (cs.length?cs:avail).sort((a,b)=>a.ourRank-b.ourRank)[0];}
/* season-average lineup, ignoring byes */
function lineupFlat(R){const by=pos=>R.filter(x=>x.pos===pos).sort((a,b)=>b.real-a.real);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set();let pts=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{pts+=x.real;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.real-a.real),2);
  return pts;}
/* week-by-week: a player on bye scores nothing and you start whoever is left */
function lineupWeekly(R){
  let total=0;
  for(let wk=1;wk<=17;wk++){
    const live=R.filter(x=>x.bye!==wk);
    total+=lineupFlat(live);
  }
  return total/17;}

function draft(slot, forcedByRound, seed, toolSeats, weekly){
  const rnd=mul(seed),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  for(let pick=1;pick<=168;pick++){ if(!avail.length)break;
    const t=snap(pick), round=Math.ceil(pick/12); let p;
    if(t===slot) p=myPick(avail,teams[t],forcedByRound[round]);
    else if(toolSeats && toolSeats.includes(t)) p=myPick(avail,teams[t],undefined);
    else p=oppPick(avail,teams[t],rnd);
    if(!p)break; teams[t].push(p); avail.splice(avail.indexOf(p),1);}
  const R=teams[slot].map(p=>({...p,real:realiseFor(p,seed-60000)}));
  return weekly?lineupWeekly(R):lineupFlat(R);}

const W=2500, mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const SEATS={1:'ASHLEY (1)',6:'BRIAN JK (6)',10:'EMILY (10)'};
const OTHER=[1,6,10];

/* ---------- A. QB TIMING ---------- */
console.log('\n' + '='.repeat(78) + '\nA. WHAT ROUND SHOULD YOU TAKE A QUARTERBACK?\n');
for(const slot of [1,6,10]){
  const rows=[];
  for(const r of [3,4,5,6,7,8,9,10,11,12,13]){
    const f={}; f[r]='QB';
    const out=[]; for(let w=0;w<W;w++) out.push(draft(slot,f,60000+w,null,false));
    rows.push({r,m:mean(out)});
  }
  const best=rows.reduce((a,b)=>b.m>a.m?b:a);
  console.log(`${SEATS[slot]}  best round for QB: ${best.r}  (${best.m.toFixed(2)} pts/wk)`);
  console.log('   ' + rows.map(x=>`r${x.r}:${x.m.toFixed(1)}`).join('  '));
  const early=rows.find(x=>x.r===3), late=rows.find(x=>x.r===12);
  console.log(`   taking one in round 3 instead of round ${best.r} costs ${(best.m-early.m).toFixed(2)} pts/wk`);
  console.log(`   waiting all the way to round 12 costs ${(best.m-late.m).toFixed(2)} pts/wk\n`);
}

/* ---------- B. TE TIMING ---------- */
console.log('='.repeat(78) + '\nB. WHAT ROUND SHOULD YOU TAKE A TIGHT END?\n');
for(const slot of [1,6,10]){
  const rows=[];
  for(const r of [1,2,3,4,5,6,7,8,9,10,11,12]){
    const f={}; f[r]='TE';
    const out=[]; for(let w=0;w<W;w++) out.push(draft(slot,f,60000+w,null,false));
    rows.push({r,m:mean(out)});
  }
  const best=rows.reduce((a,b)=>b.m>a.m?b:a);
  console.log(`${SEATS[slot]}  best round for TE: ${best.r}  (${best.m.toFixed(2)} pts/wk)`);
  console.log('   ' + rows.map(x=>`r${x.r}:${x.m.toFixed(1)}`).join('  '));
  const r2=rows.find(x=>x.r===2), r10=rows.find(x=>x.r===10);
  console.log(`   paying up in round 2: ${(r2.m-best.m).toFixed(2)} vs best   ·   waiting to round 10: ${(r10.m-best.m).toFixed(2)} vs best\n`);
}

/* ---------- C. BYE-WEEK COST ---------- */
console.log('='.repeat(78) + '\nC. WHAT DOES A BYE-WEEK PILE-UP ACTUALLY COST?\n');
console.log('  (same rosters scored two ways: season-average, then week by week with byes live)');
for(const slot of [1,6,10]){
  const flat=[],wk=[];
  for(let w=0;w<W;w++){ flat.push(draft(slot,{},60000+w,null,false)); wk.push(draft(slot,{},60000+w,null,true)); }
  console.log(`  ${SEATS[slot].padEnd(14)} ignoring byes ${mean(flat).toFixed(2)}   week-by-week ${mean(wk).toFixed(2)}   bye drag ${(mean(flat)-mean(wk)).toFixed(2)} pts/wk`);
}

/* ---------- D. SEAT INTERFERENCE ---------- */
console.log('\n' + '='.repeat(78) + '\nD. WHAT DOES IT COST YOU THAT THE OTHER TWO USE THE SAME BOARD?\n');
for(const slot of [1,6,10]){
  const alone=[],together=[];
  for(let w=0;w<W;w++){
    alone.push(draft(slot,{},60000+w,null,false));                              // only you use the tool
    together.push(draft(slot,{},60000+w,OTHER.filter(s=>s!==slot),false));      // all three do
  }
  const d=mean(alone)-mean(together);
  console.log(`  ${SEATS[slot].padEnd(14)} alone ${mean(alone).toFixed(2)}   all three on the board ${mean(together).toFixed(2)}   costs you ${d.toFixed(2)} pts/wk`);
}
console.log('');
