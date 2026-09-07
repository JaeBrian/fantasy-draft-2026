import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const app=new URL('../../../',import.meta.url).pathname,require=createRequire(import.meta.url);
execFileSync('npx',['esbuild','src/panels/test-draft/sleeper-sync.ts','--bundle','--format=cjs',`--outfile=${app}.simcache/test-sync.cjs`,'--log-level=error'],{cwd:app});
const {startSleeperSync}=require(app+'.simcache/test-sync.cjs');
const saved={fetch:global.fetch,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
const timers=new Map(),requests=[],updates=[],errors=[];let timerId=0;
global.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
global.clearTimeout=id=>timers.delete(id);
global.fetch=(url,options)=>new Promise((resolve,reject)=>{
 requests.push({url,options,resolve,reject});
 options.signal.addEventListener('abort',()=>reject(new Error('aborted')));
});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const next=async ms=>{const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`timer ${ms}`);timers.delete(entry[0]);entry[1].fn();await flush();};
const respond=async(value,status=200)=>{requests.at(-1).resolve({ok:status===200,status,json:async()=>value});await flush();};
const pick={pick_no:1,draft_slot:2,metadata:{first_name:'Brandon',last_name:'Aubrey',position:'K',team:'DAL'}};
try{
 const stop=startSleeperSync('https://sleeper.com/draft/nfl/1234567890123456789',2,[],v=>updates.push(v),e=>errors.push(e));
 assert.equal(requests[0].url,'https://api.sleeper.app/v1/draft/1234567890123456789/picks');
 await respond([]);assert.deepEqual(updates.at(-1).ord,[]);
 await next(3000);await respond([pick]);assert.equal(Object.values(updates.at(-1).DS)[0],'mine');
 await next(3000);await respond([]);assert.deepEqual(updates.at(-1).DS,{},'reset to zero clears prior picks');
 await next(3000);await respond([{...pick,pick_no:2}]);assert.equal(errors.length,1);assert.equal(updates.length,3,'bad sequences cannot replace the last good snapshot');
 await next(5000);await respond([pick]);assert.equal(updates.length,4,'recovers after an error');
 await next(3000);await next(10000);assert.equal(errors.length,2,'hung requests time out');
 await next(5000);const late=requests.at(-1);stop();late.resolve({ok:true,json:async()=>[pick]});await flush();
 assert.equal(updates.length,4,'unmounted/old draft responses cannot apply');assert.equal(timers.size,0);
 let invalid='';startSleeperSync('https://sleeper.com/i/invite',1,[],()=>assert.fail('invalid URL'),e=>invalid=e)();
 assert.match(invalid,/draft URL/);
 console.log('PASS: 3-second polling, empty reset, ownership, invalid snapshot, recovery, timeout and cancellation');
}finally{Object.assign(global,saved);}
