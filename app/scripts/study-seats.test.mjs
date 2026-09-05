import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
const app=new URL('../',import.meta.url).pathname,require=createRequire(import.meta.url);
const {DRAFT_ORDER,TOOL_USERS}=require(app+'.simcache/data.cjs');
assert.equal(DRAFT_ORDER[7],'Jeff');
assert.equal(DRAFT_ORDER[2],'Aaron');
assert.equal(new Set(DRAFT_ORDER).size,12);
for(const [name,seat] of TOOL_USERS)assert.equal(DRAFT_ORDER[seat-1],name);
const picks=Array.from({length:6},(_,r)=>r*12+(r%2?13-8:8));
assert.deepEqual(picks,[8,17,32,41,56,65]);
const run=seat=>execFileSync(process.execPath,['--input-type=module','-e',"import {studyUsers} from './scripts/study-seats.mjs'; console.log(JSON.stringify(studyUsers));"],{cwd:app,env:{...process.env,SIM_SEAT:seat},encoding:'utf8',stdio:['ignore','pipe','pipe']});
assert.deepEqual(JSON.parse(run('8')),[['Jeff',8]]);
assert.deepEqual(JSON.parse(run('')),TOOL_USERS);
assert.throws(()=>run('3'),/Unknown SIM_SEAT/);
assert.throws(()=>run('08'),/Unknown SIM_SEAT/);
const file=`test-study-seats-${process.pid}.json`,path=app+'.simcache/'+file;
try{
  writeFileSync(path,JSON.stringify({1:{marker:'preserved'},8:{marker:'old'}}));
  execFileSync(process.execPath,['--input-type=module','-e',`import {writeSeatResults} from './scripts/study-seats.mjs'; writeSeatResults(${JSON.stringify(file)},{8:{marker:'new'}});`],{cwd:app,env:{...process.env,SIM_SEAT:'8'}});
  assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{1:{marker:'preserved'},8:{marker:'new'}});
}finally{rmSync(path,{force:true});}
console.log('PASS: traded order, registered seats, targeted runs, preserved results and invalid-seat rejection');
