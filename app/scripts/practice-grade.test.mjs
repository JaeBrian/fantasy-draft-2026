import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const app=new URL('../',import.meta.url).pathname,require=createRequire(import.meta.url);
await build({entryPoints:[app+'src/lib/mock.ts'],bundle:true,format:'cjs',outfile:app+'.simcache/test-mock.cjs',logLevel:'silent'});
const {gradeDraft,fillToMyTurn}=require(app+'.simcache/test-mock.cjs');
const {P}=require(app+'.simcache/data.cjs');
assert.throws(()=>gradeDraft(P.slice(0,159).map(r=>r[0]),10),/168/,'a partial room must not receive a final grade');
for(const [seat,lastOwnPick] of [[1,168],[2,167],[10,159]]){
  const before=P.slice(0,lastOwnPick).map(r=>r[0]);
  const tail=fillToMyTurn(Object.fromEntries(before.map(n=>[n,'gone'])),before,seat);
  assert.equal(tail.length,168-lastOwnPick,`finish the opponents after seat ${seat}'s final pick`);
  const order=[...before,...tail];
  assert.equal(new Set(order).size,168);
  const grade=gradeDraft(order,seat);
  assert.equal(grade.field.length,12);
  assert.equal(grade.median,(grade.field[5]+grade.field[6])/2,'an even-sized room uses both middle scores');
}
console.log('PASS: practice grades require a completed room and use the twelve-team median');
