// Compare the production advisor on identical draft states under projection perturbations.
// An external forecast is a stress input, not a replacement projection or performance label.
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {playerNameKey} from './player-name.mjs';
const app=new URL('../',import.meta.url).pathname,cache=app+'.simcache/',require=createRequire(import.meta.url);
const {P,MKT}=require(cache+'data.cjs'),{SLP}=require(cache+'sleeper.cjs'),{PROJW}=require(cache+'projections.cjs');
const externalPath=process.argv[2];
if(!externalPath)throw Error('Supply a JSON array of {name,total} external season projections');
const external=new Map(JSON.parse(readFileSync(externalPath,'utf8')).map(p=>[playerNameKey(p.name),p.total]));
const cases={baseline:{},'external-clipped':{},'RB-minus-10-percent':{},'WR-minus-10-percent':{},'QB-plus-10-percent':{}};
for(const p of P){
 const ext=external.get(playerNameKey(p[0])),total=PROJW[p[0]]?.total;
 cases['external-clipped'][p[0]]=ext>0&&total>0?Math.max(0.8,Math.min(1.2,ext/total)):1;
 cases['RB-minus-10-percent'][p[0]]=p[1]==='RB'?0.9:1;
 cases['WR-minus-10-percent'][p[0]]=p[1]==='WR'?0.9:1;
 cases['QB-plus-10-percent'][p[0]]=p[1]==='QB'?1.1:1;
}
const advisors={};
for(const [label,scales] of Object.entries(cases)){
 const outfile=cache+`sensitivity-${label}.cjs`;
 await build({entryPoints:[app+'src/lib/advisor.ts'],bundle:true,format:'cjs',outfile,logLevel:'silent',plugins:[{name:'projection-stress',setup(b){b.onLoad({filter:/\/src\/projections\.ts$/},args=>({loader:'ts',contents:readFileSync(args.path,'utf8')+`\nconst scales:Record<string,number>=${JSON.stringify(scales)};for(const name of Object.keys(PROJ))PROJ[name]*=scales[name]??1;`}))}}]});
 advisors[label]=require(outfile).advise;
}
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const snap=p=>{const r=Math.ceil(p/12),i=p-(r-1)*12;return r%2?i:13-i;};
const pool=P.map(r=>({name:r[0],pos:r[1],mkt:0.75*(SLP[r[0]]?.adp??MKT[r[0]]?.[0]??r[3])+0.25*(MKT[r[0]]?.[0]??r[3])}));
const states=[];
for(let world=0;world<30;world++){
 const rnd=mul(221000+world),teams=Array.from({length:13},()=>[]),ord=[],avail=pool.slice();
 for(let pick=1;pick<=72;pick++){
  const seat=snap(pick),team=teams[seat];let p;
  if([1,2,10].includes(seat)){
   const own=new Set(team.map(p=>p.name)),state=Object.fromEntries(ord.map(n=>[n,own.has(n)?'mine':'gone']));
   const choice=advisors.baseline(state,seat,ord).cands[0]?.now.r[0];
   p=avail.find(p=>p.name===choice);if(!p)throw Error(`Invalid baseline pick ${pick}`);
   if([0,2,5].includes(team.length))states.push({seat,round:team.length+1,state,ord:ord.slice(),baseline:choice});
  }else{
   const c=Object.fromEntries(['QB','RB','WR','TE'].map(pos=>[pos,team.filter(p=>p.pos===pos).length]));let best=Infinity;
   for(const candidate of avail){let score=candidate.mkt+(rnd()-0.5)*0.3*candidate.mkt;
    if(['QB','TE'].includes(candidate.pos))score+=c[candidate.pos]>=2?900:c[candidate.pos]>=1?60:0;
    if(['RB','WR'].includes(candidate.pos)&&c[candidate.pos]>=5)score+=25;
    if(score<best){best=score;p=candidate;}
   }
  }
  team.push(p);ord.push(p.name);avail.splice(avail.indexOf(p),1);
 }
}
const results={};
for(const [label,advise] of Object.entries(advisors)){
 const rows={};let changed=0;
 for(const s of states){const a=advise(s.state,s.seat,s.ord),name=a.cands[0]?.now.r[0];if(!name||s.state[name]||!a.onClock)throw Error(`${label}: illegal recommendation`);
  changed+=Number(name!==s.baseline);const key=`seat${s.seat}-round${s.round}`;
  rows[key]??={states:0,changed:0,choices:{}};rows[key].states++;rows[key].changed+=Number(name!==s.baseline);rows[key].choices[name]=(rows[key].choices[name]??0)+1;
 }
 results[label]={states:states.length,changed,rows};
}
writeFileSync(cache+'sensitivity.json',JSON.stringify({method:'270 identical states from 30 seeded drafts. External season-total ratios clipped to +/-20%; role and availability assumptions differ. This measures decision stability, not forecast accuracy.',results},null,2));
for(const [label,r] of Object.entries(results))console.log(`${label}: ${r.changed}/${r.states} first recommendations changed`);
console.log(`RESULT: 0 FAIL; ${states.length*Object.keys(cases).length} valid recommendations across five projection scenarios`);
