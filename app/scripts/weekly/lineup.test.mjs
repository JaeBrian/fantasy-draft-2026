import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled = await build({entryPoints:['src/lib/weekly/lineup.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {optimizeLineup} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const player=(id,positions,mean,kickoff=200)=>({id,name:id,positions,mean,kickoff,availability:'available'});
const run=(players,slots,extra={})=>optimizeLineup({players:Object.fromEntries(players.map(p=>[p.id,p])),rosterIds:players.map(p=>p.id),slots,now:100,...extra});
const trap=run([player('dual',['RB','WR'],30),player('rb',['RB'],29),player('wr',['WR'],28),player('te',['TE'],27)],['RB','WR','FLEX','FLEX']);
assert.equal(trap.total,114); assert.equal(trap.complete,true); assert.equal(new Set(trap.assignments.map(a=>a.playerId)).size,4);
const restricted=run([player('dual',['RB','WR'],30),player('rb',['RB'],29)],['RB','WR']);
assert.equal(restricted.total,59);assert.equal(restricted.assignments[1].playerId,'dual');
const locked=run([player('old',['RB'],1,50),player('new',['RB'],20)],['RB'],{currentStarters:['old']});
assert.equal(locked.assignments[0].playerId,'old'); assert.equal(locked.assignments[0].locked,true);
assert.equal(run([player('bench',['RB'],30,50)],['RB']).complete,false);
assert.equal(run([{...player('out',['RB'],30,50),availability:'out'},player('new',['RB'],20)],['RB'],{currentStarters:['out']}).assignments[0].playerId,'out');
assert.equal(run([player('unknown',['RB'],30,null),player('new',['RB'],20)],['RB'],{currentStarters:['unknown']}).complete,false);
assert.equal(run([player('unknown',['RB'],30,null)],['RB']).assignments[0].playerId,null);
const flex=run([player('late',['RB'],20,300),player('early',['RB'],10,200)],['RB','FLEX']);
assert.equal(flex.assignments[1].playerId,'late');
assert.equal(run([player('k',['K'],5),player('d',['DST'],-2)],['K','DEF']).total,3);
assert.equal(run([{...player('bye',['WR'],99),availability:'bye'},player('nan',['WR'],NaN)],['WR']).total,0);
assert.equal(run([player('wr',['WR'],4)],['RB','WR'],{currentStarters:['0','wr']}).assignments[1].playerId,'wr');
assert.equal(run([player('a',['RB'],10,50)],['RB','FLEX'],{currentStarters:['a','a']}).complete,false);
assert.equal(run([player('a',['RB'],1e308),player('b',['RB'],1e308)],['RB','FLEX']).complete,false);
assert.equal(run([player('a',['RB'],10),player('unknown',['WR'],null)],['RB']).complete,false);
assert.equal(run([player('a',['RB'],10)],['RB'],{rosterIds:['a','unmapped']}).complete,false);
const many=Array.from({length:80},(_,i)=>player(String(i),['QB','RB','WR','TE','K','DEF'],i));
assert.equal(run(many,['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF']).total,745);
for(let fixture=0;fixture<40;fixture++) {
  const candidates=Array.from({length:7},(_,i)=>player(String(i),[['RB'],['WR'],['TE'],['RB','WR']][(i+fixture)%4],(i*13+fixture*7)%31-3));
  const slots=['RB','WR','FLEX','FLEX'];
  function brute(index,used,total) {
    if(index===slots.length) return total;
    return Math.max(...candidates.filter(p=>!used.includes(p.id) && (slots[index]==='FLEX' || p.positions.includes(slots[index])))
      .map(p=>brute(index+1,[...used,p.id],total+p.mean)));
  }
  assert.equal(run(candidates,slots).total,brute(0,[],0));
}
console.log('weekly lineup fixtures passed');
