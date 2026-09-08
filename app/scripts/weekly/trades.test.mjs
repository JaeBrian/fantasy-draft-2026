import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['src/lib/weekly/trades.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {generateTradeTargets}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const player=(id,pos,mean)=>({id,name:id,positions:[pos],mean,kickoff:9999999999999,availability:'available'});
const players=Object.fromEntries([
  player('ar','RB',25),player('ar2','RB',20),player('aw','WR',3),player('ax','WR',2),
  player('br','RB',3),player('bw','WR',25),player('bw2','WR',20),player('bx','WR',1),
].map(p=>[p.id,p]));
const dataset={weeks:{2:{players},3:{players},4:{players}}};
const base={dataset,rosters:[{rosterId:1,owner:'Emily',playerIds:['ar','ar2','aw','ax']},{rosterId:2,owner:'Brian',playerIds:['br','bw','bw2','bx']}],managerRosterId:1,slots:['RB','WR'],selectedWeek:2,currentWeek:1,tradeDeadline:10,rosterLimit:4,seasonEndWeek:4,maxResults:1000};
const report=generateTradeTargets(base);
assert.ok(report.offers.length>0);
for(const offer of report.offers){
  assert.ok(offer.manager.rosGain>0&&offer.counterparty.rosGain>0);
  assert.equal(new Set([...offer.incoming,...offer.outgoing].map(p=>p.id)).size,offer.incoming.length+offer.outgoing.length);
  assert.equal(offer.category,'roster-fit');
  assert.equal(offer.incoming[0].owner,'Brian');
  assert.ok(offer.sensitivity.low<=offer.manager.rosGain);
}
const two=report.offers.find(o=>o.outgoing.length===2&&o.incoming.length===1);
assert.ok(two,'two-for-one exists');assert.equal(two.counterparty.drops.length,1);
assert.ok(two.counterparty.weeks.every(w=>!w.after.assignments.some(a=>two.counterparty.drops.includes(a.playerId))));
assert.ok(generateTradeTargets({...base,managerRosterId:2}).offers.length>0,'both supported managers evaluated independently');
assert.ok(generateTradeTargets({...base,rosters:base.rosters.map(r=>({...r,owner:'Unsupported name'}))}).offers.length>0);
assert.equal(generateTradeTargets({...base,currentWeek:11}).offers.length,0);
assert.equal(generateTradeTargets({...base,tradeDeadline:null}).offers.length,0);
assert.equal(generateTradeTargets({...base,seasonEndWeek:5}).offers.length,0);
assert.equal(generateTradeTargets({...base,rosters:[...base.rosters,{rosterId:3,owner:'duplicate',playerIds:['ar']}]}).offers.length,0);
const missing=structuredClone(base);missing.dataset.weeks[3].players.ar2.mean=null;
assert.equal(generateTradeTargets(missing).offers.length,0);
const flex=generateTradeTargets({...base,slots:['RB','FLEX']});
for(const o of flex.offers)for(const side of [o.manager,o.counterparty])for(const w of side.weeks){assert.equal(w.after.complete,true);assert.equal(new Set(w.after.assignments.map(a=>a.playerId)).size,2);}
const waivers=structuredClone(base);for(const week of Object.values(waivers.dataset.weeks))week.players.free=player('free','WR',100);
assert.ok(generateTradeTargets(waivers).offers.every(o=>o.manager.gainOverWaivers>0));
assert.equal(generateTradeTargets({...base,now:9999999999999,processingDays:2}).offers.length,0);
// A foreseeable kicker bye can use the same hypothetical streaming baseline on both sides.
const bye=structuredClone(base);bye.slots.push('K');bye.rosterLimit=5;
for(const [i,r] of bye.rosters.entries())r.playerIds.push(`k${i}`);
for(const [week,data] of Object.entries(bye.dataset.weeks)){
  data.players.k0={...player('k0','K',5),availability:week==='3'?'bye':'available'};
  data.players.k1=player('k1','K',5);data.players.stream=player('stream','K',4);
}
assert.ok(generateTradeTargets(bye).offers.length>0);
assert.ok(generateTradeTargets({...base,currentWeek:10,selectedWeek:11,seasonEndWeek:11,dataset:{weeks:{11:{players}}}}).offers.length>0,'deadline-week trades can value later weeks');
if(process.env.WEEKLY_BENCHMARK){
  const positions=['QB','RB','RB','WR','WR','TE','RB','WR','K','DEF','RB','WR','TE','QB','WR','RB'];
  const bigPlayers={};const rosters=Array.from({length:12},(_,team)=>({rosterId:team,owner:`Team ${team}`,playerIds:positions.map((pos,j)=>{const id=`${team}_${j}`;bigPlayers[id]=player(id,pos,5+((team*7+j*3)%20));return id;})}));
  const weeks=Object.fromEntries(Array.from({length:16},(_,i)=>[i+2,{players:bigPlayers}]));
  const began=performance.now();generateTradeTargets({...base,dataset:{weeks},rosters,managerRosterId:0,slots:positions.slice(0,6).concat(['FLEX','FLEX','K','DEF']),rosterLimit:16,seasonEndWeek:17});
  console.log(`12 rosters × 16 future weeks: ${Math.round(performance.now()-began)} ms`);
}
const reserves=structuredClone(base);
for(const [i,r] of reserves.rosters.entries()){r.playerIds.push(`ir${i}`);r.reserveIds=[`ir${i}`];}
for(const data of Object.values(reserves.dataset.weeks))for(let i=0;i<2;i++)data.players[`ir${i}`]={...player(`ir${i}`,'WR',0),availability:'out'};
const reserveReport=generateTradeTargets(reserves);
assert.ok(reserveReport.offers.length>0,'retained IR does not block trade analysis');
for(const offer of reserveReport.offers){
  assert.equal(offer.manager.baselineDrops.length,0);assert.equal(offer.counterparty.baselineDrops.length,0);
  assert.ok(!offer.manager.drops.includes('ir0'));assert.ok(!offer.counterparty.drops.includes('ir1'));
}
const reserveTwo=reserveReport.offers.find(o=>o.outgoing.length===2&&o.incoming.length===1);
assert.ok(reserveTwo);assert.equal(reserveTwo.counterparty.drops.length,1,'incoming players need active space despite retained IR');
const returns=structuredClone(reserves);
for(const data of Object.values(returns.dataset.weeks))data.players.ir0=player('ir0','WR',4);
const returnReport=generateTradeTargets(returns);
assert.ok(returnReport.offers.length>0);
assert.ok(returnReport.offers.every(o=>o.manager.baselineDrops.length===1),'return activation needs space in hold baseline');
assert.equal(generateTradeTargets({...base,rosters:base.rosters.map(r=>({...r,reserveIds:['unowned']}))}).offers.length,0);

console.log('weekly trade fixtures passed');
