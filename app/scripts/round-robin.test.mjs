import assert from 'node:assert/strict';
import {roundRobin} from './round-robin.mjs';
const rounds=roundRobin(12),pairs=new Set();
assert.equal(rounds.length,11);
for(let week=0;week<14;week++){
 const games=rounds[week%11];assert.equal(games.length,6);
 assert.deepEqual(games.flat().sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
 if(week<11)for(const pair of games)pairs.add(pair.slice().sort((a,b)=>a-b).join('-'));
}
assert.equal(pairs.size,66);
assert.throws(()=>roundRobin(11));
console.log('PASS: every team plays once per week; every pairing occurs once in 11 rounds');
