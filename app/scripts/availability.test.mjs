import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {missShareOf,seasonAvailability,regularSeasonAbsence,unavailableInWeek}=require('../.simcache/risk.cjs');
assert.equal(regularSeasonAbsence(1,Date.UTC(2026,7,17)/1000),0);
assert.equal(regularSeasonAbsence(8.6,Date.UTC(2026,7,17)/1000),6);
assert.equal(missShareOf({pMiss:0.3,knownMiss:0}),0.12);
assert.equal(missShareOf({pMiss:0.3,knownMiss:1}),1);
assert.equal(missShareOf({pMiss:0.3,knownMiss:9/17}),9/17);
let seed=19;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(const knownMiss of [0,0.05,4/17,9/17,1]){
 const risk={pMiss:0.3,knownMiss};let sum=0;
 for(let n=0;n<100000;n++){const v=seasonAvailability(risk,rnd);assert.ok(v>=0 && v<=1-knownMiss+1e-12);sum+=v;}
 assert.ok(Math.abs(sum/100000-(1-missShareOf(risk)))<0.003);
}
console.log('PASS: known absences respected and simulated expectation matches advisor');

for(let w=1;w<=6;w++) assert.equal(unavailableInWeek({pMiss:0.3,knownMiss:6/17},w,()=>1),true);
assert.equal(unavailableInWeek({pMiss:0.3,knownMiss:6/17},7,()=>1),false);
