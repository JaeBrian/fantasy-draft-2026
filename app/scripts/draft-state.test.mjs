import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({entryPoints:['src/lib/draft-state.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.simcache/draft-state.cjs',logLevel:'silent'});
const {markDraft,parseDraftState,parseDraftOrder}=createRequire(import.meta.url)('../.simcache/draft-state.cjs');
test('undo restores the original pick position and ownership',()=>{
 const DS={A:'gone',B:'mine',C:'gone'},ord=['A','B','C'];
 const removed=markDraft(DS,ord,'B','');
 assert.deepEqual(removed.ord,['A','C']);
 const undone=markDraft(removed.DS,removed.ord,'B','mine',1);
 assert.deepEqual(undone,{DS,ord});
 assert.deepEqual(markDraft(DS,ord,'B','gone').ord,ord,'ownership edits preserve pick order');
 assert.deepEqual(markDraft(DS,ord,'D','gone').ord,[...ord,'D']);
 assert.deepEqual(ord,['A','B','C'],'input remains unchanged');
});
test('malformed saved state is recovered without discarding valid picks',()=>{
 for(const raw of ['null','[]','"text"','42','{bad']) assert.deepEqual(parseDraftState(raw),{});
 assert.deepEqual(parseDraftState('{"A":"gone","B":"mine","C":"other"}'),{A:'gone',B:'mine'});
 const state={A:'gone',B:'mine',C:'gone'};
 for(const raw of ['null','{}','"text"','{bad']) assert.deepEqual(parseDraftOrder(raw,state),['A','B','C']);
 assert.deepEqual(parseDraftOrder('["B","B",null,"missing","A"]',state),['B','A','C']);
});
