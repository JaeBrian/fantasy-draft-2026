/* Run from app/:  node scripts/sim-build.mjs && node scripts/sim-title.mjs
 *
 * Every study so far optimised SEASON-AVERAGE POINTS. That is not what this league pays out on.
 * Pulled from Sleeper: 12 teams, 14-week regular season, SEVEN of twelve make the playoffs,
 * bracket runs weeks 15-17. So the objective is:  make the field, then win three in a row.
 *
 * Those two things want different rosters. Getting in is easy at 7-of-12 — a median team makes
 * it. Winning three straight against the best remaining teams rewards weekly upside. Average
 * points cannot see that distinction at all, which means the "you cannot buy a ceiling"
 * finding was measured against the wrong target and needs re-testing here.
 *
 * Simulates full seasons: real weekly scores (week-to-week variance, not just season-long),
 * byes live, a round-robin schedule, seeding on record then points, then the bracket. */
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
/* season-long spread (does he live up to his projection at all?) */
const SEASON_CV={QB:0.26,RB:0.44,WR:0.40,TE:0.42},RISK_CV={buy:0.95,solid:1.0,risk:1.22,avoid:1.32};
/* week-to-week spread around whatever level he settles at — much larger, and the thing that
   actually decides a single playoff game */
const WEEK_CV={QB:0.36,RB:0.58,WR:0.66,TE:0.70};
const BASE_MISS={QB:0.14,RB:0.30,WR:0.22,TE:0.24};

const POOL=[];{const c={QB:0,RB:0,WR:0,TE:0};
  P.forEach((r,i)=>{if(c[r[1]]===undefined)return;const pr=++c[r[1]];
    const ffc=MKT[r[0]]?MKT[r[0]][0]:r[3],s=SLP[r[0]]||{};
    const mkt=s.adp!==undefined?0.75*s.adp+0.25*ffc:ffc;
    const hurt=['O','IR','PUP','SUS'].includes(s.inj)?0.85:s.inj==='D'?0.95:1;
    const proj=(PROJ[r[0]]!==undefined?PROJ[r[0]]:PPG[r[1]](pr))*(RISK[r[4]]||1)*hurt;
    POOL.push({name:r[0],pos:r[1],ourRank:i+1,idx:POOL.length,proj,
      scv: riskOf(r[0], r[1], r[4]).cv,
      wcv:WEEK_CV[r[1]],
      pMiss: riskOf(r[0], r[1], r[4]).pMiss,
      mkt,sig:Math.max(0.5,MKT[r[0]]?MKT[r[0]][1]:0,0.13*mkt),bye:BYE[r[2]]||0});});}
const REPL={};for(const pos of ['QB','RB','WR','TE']){
  const v=POOL.filter(p=>p.pos===pos).map(p=>p.proj).sort((a,b)=>b-a);
  REPL[pos]=v[Math.min({QB:14,RB:32,WR:34,TE:13}[pos]-1,v.length-1)]||0;}
POOL.forEach(p=>{p.vorp=Math.max(0.2,p.proj-REPL[p.pos]);});

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
function oppPick(avail,team,rnd){const c=NEED(team);let b=null,bs=Infinity;
  for(const p of avail){let s=p.mkt+gauss(rnd)*p.sig*0.8;
    if(p.pos==='QB'&&c.QB>=1)s+=60;if(p.pos==='TE'&&c.TE>=1)s+=50;
    if(p.pos==='RB'&&c.RB>=5)s+=25;if(p.pos==='WR'&&c.WR>=5)s+=25;
    if(s<bs){bs=s;b=p;}}return b;}
function evLater(avail,pos,cur,nextPick){
  let ev=REPL[pos],pAll=1;
  for(const p of avail.filter(x=>x.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0,26)){
    const Fk=ncdf((nextPick-p.mkt)/p.sig),Fc=ncdf((cur-p.mkt)/p.sig);
    const den=1-Fc;const pg=den<=0.03?0.97:Math.min(0.97,Math.max(0.01,(Fk-Fc)/den));
    ev+=pAll*(1-pg)*(p.proj-REPL[pos]);pAll*=pg;}
  return ev;}
/* tilt: negative prefers steady players, positive prefers volatile ones */
function myPick(avail,team,cur,nextPick,myCount,tilt){
  const c=NEED(team),late=myCount>=10;
  let cs=avail.filter(p=>p.pos==='QB'?c.QB<(late?2:1):p.pos==='TE'?c.TE<(late?2:1):c[p.pos]<6);
  if(!cs.length)cs=avail;
  const ev={};for(const pos of ['QB','RB','WR','TE'])ev[pos]=evLater(avail,pos,cur,nextPick);
  const w=p=>{const n=c[p.pos];
    if(p.pos==='QB')return n===0?1:0.5;
    if(p.pos==='TE')return n===0?0.9:0.45;
    return n<2?1.05:(c.RB+c.WR+c.TE<7?0.8:0.45);};
  /* Tilt on the PLAYER's own spread, not his position's. Weekly variance is position-constant
     in this model, so tilting on it would just be "draft more tight ends" wearing a disguise.
     scv carries the player-specific part: our risk verdict and any injury designation. */
  const score=p=>w(p)*(p.vorp+1.25*Math.max(0,p.proj-ev[p.pos]))*(1+tilt*(p.scv-0.42)*2.2);
  return cs.slice().sort((a,b)=>score(b)-score(a))[0];}

/* one team's score in one week */
function weekScore(roster,wk,rnd){
  const live=roster.filter(x=>x.bye!==wk&&!(x.outFrom&&wk>=x.outFrom&&wk<x.outTo));
  const draw=x=>{const s=Math.sqrt(Math.log(1+x.wcv*x.wcv));
    return x.level*Math.exp(gauss(rnd)*s-(s*s)/2);};
  const scored=live.map(x=>({...x,pts:draw(x)}));
  const by=pos=>scored.filter(x=>x.pos===pos).sort((a,b)=>b.pts-a.pts);
  const rb=by('RB'),wr=by('WR'),te=by('TE'),qb=by('QB');
  const used=new Set();let t=0;
  const take=(a,n)=>a.slice(0,n).forEach(x=>{t+=x.pts;used.add(x.name);});
  take(qb,1);take(rb,2);take(wr,2);take(te,1);
  take([...rb,...wr,...te].filter(x=>!used.has(x.name)).sort((a,b)=>b.pts-a.pts),2);
  return t+14;   /* K + DST, near-identical across teams */
}
/* full season for all 12 teams -> champion */
function season(slot,tilt,seed){
  const rnd=mul(seed),avail=POOL.slice(),teams={};
  for(let t=1;t<=12;t++)teams[t]=[];
  const myPicks=[];for(let r=1;r<=14;r++)myPicks.push((r-1)*12+(r%2?slot:13-slot));
  let mine=0;
  for(let pick=1;pick<=168;pick++){if(!avail.length)break;const t=snap(pick);let p;
    if(t===slot){p=myPick(avail,teams[t],pick,myPicks[mine+1]||pick+12,mine,tilt);mine++;}
    else p=oppPick(avail,teams[t],rnd);
    if(!p)break;teams[t].push(p);avail.splice(avail.indexOf(p),1);}
  /* each player settles at a season level, and may miss a stretch */
  const rosters={};
  for(let t=1;t<=12;t++) rosters[t]=teams[t].map(p=>{
    const s=Math.sqrt(Math.log(1+p.scv*p.scv));
    const level=p.proj*Math.exp(gauss(rnd)*s-(s*s)/2);
    let outFrom=0,outTo=0;
    if(rnd()<p.pMiss){outFrom=1+Math.floor(rnd()*12);outTo=outFrom+2+Math.floor(rnd()*6);}
    return {...p,level,outFrom,outTo};});
  /* 14-week regular season, round robin */
  const rec={},pf={};for(let t=1;t<=12;t++){rec[t]=0;pf[t]=0;}
  for(let wk=1;wk<=14;wk++){
    const sc={};for(let t=1;t<=12;t++){sc[t]=weekScore(rosters[t],wk,rnd);pf[t]+=sc[t];}
    /* rotating pairing so every team meets a spread of opponents */
    for(let i=0;i<6;i++){
      const a=1+((wk-1+i)%11), b=1+((11-i+(wk-1))%11);
      const x=a===b?12:a, y=a===b?11:b===a?12:b;
      if(x!==y&&sc[x]!==undefined&&sc[y]!==undefined) rec[sc[x]>sc[y]?x:y]++;
    }
  }
  const seeds=Object.keys(rec).map(Number).sort((a,b)=>rec[b]-rec[a]||pf[b]-pf[a]);
  const field=seeds.slice(0,7);
  const madeIt=field.includes(slot);
  /* weeks 15-17: seed 1 gets a bye, then straight bracket by seed */
  let alive=field.slice();
  const play=(a,b,wk)=>weekScore(rosters[a],wk,rnd)>=weekScore(rosters[b],wk,rnd)?a:b;
  /* round 1 (wk 15): 2v7, 3v6, 4v5 — seed 1 idle */
  let r2=[alive[0],play(alive[1],alive[6],15),play(alive[2],alive[5],15),play(alive[3],alive[4],15)];
  /* semis (wk 16) */
  r2.sort((a,b)=>field.indexOf(a)-field.indexOf(b));
  const fin=[play(r2[0],r2[3],16),play(r2[1],r2[2],16)];
  const champ=play(fin[0],fin[1],17);
  return {madeIt,champ:champ===slot,seed:seeds.indexOf(slot)+1,pf:pf[slot]/14};
}

const W=4000,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const SEATS={1:'ASHLEY (1)',6:'BRIAN JK (6)',10:'EMILY (10)'};
console.log('\nWHAT THE LEAGUE ACTUALLY PAYS OUT ON');
console.log('12 teams · 14-week season · SEVEN of twelve make the playoffs · bracket weeks 15-17');
console.log(`${W.toLocaleString()} full seasons per row, weekly scores drawn, byes and injury stretches live.\n`);
console.log('  seat            approach        pts/wk   playoffs   TITLE');
for(const slot of [1,6,10]){
  for(const [label,tilt] of [['steady',-1],['balanced',0],['high-variance',1]]){
    const made=[],won=[],pf=[];
    for(let w=0;w<W;w++){const r=season(slot,tilt,90000+w);
      made.push(r.madeIt?1:0);won.push(r.champ?1:0);pf.push(r.pf);}
    console.log(`  ${SEATS[slot].padEnd(15)} ${label.padEnd(15)}${mean(pf).toFixed(1).padStart(6)}`+
      `${(mean(made)*100).toFixed(0).padStart(10)}%${(mean(won)*100).toFixed(1).padStart(8)}%`);
  }
  console.log('');
}
console.log('  A random team makes the playoffs 58% of the time and wins the title 8.3%.\n');
