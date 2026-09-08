import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=new URL('../../../',import.meta.url).pathname;
execFileSync('npx',['esbuild','src/panels/test-draft/context.ts','--bundle','--format=cjs',`--outfile=${app}.simcache/test-context.cjs`,'--log-level=error'],{cwd:app});
const code=readFileSync(app+'.simcache/test-context.cjs','utf8');
function load(search=''){
 const assigned=[];const box={module:{exports:{}},URL,URLSearchParams,window:{location:{search,href:'http://localhost/'+search,assign:u=>assigned.push(u)}}};
 vm.runInNewContext(code,box);return {...box.module.exports,assigned};
}
const real=load(),test=load('?test-draft=1402814176023322624');
assert.equal(real.IS_TEST_DRAFT,false);assert.equal(test.IS_TEST_DRAFT,true);
for(const key of ['fd26-draft','fd26-ord','fd26-slot','fd26-intel','fd26-tendency','fd26-practice','fd26-practice-backup','fd26-blocked','fd26-wait-te','fd26-sleeper','fd26-sync-on']){
 assert.equal(real.draftStorageKey(key),key);
 assert.notEqual(test.draftStorageKey(key),key);
 assert.equal(test.draftStorageKey(key),'fd26-test-1402814176023322624:'+key);
}
assert.equal(load('?test-draft=untrusted').IS_TEST_DRAFT,false);
assert.equal(real.switchDraftContext('board'),false);
assert.equal(real.switchDraftContext('test-draft'),true);
assert.match(real.assigned[0],/test-draft=1402814176023322624/);
assert.equal(test.switchDraftContext('test-draft'),false);
assert.equal(test.switchDraftContext('board'),true);
assert.equal(test.assigned[0],'http://localhost/#board');
console.log('PASS: real storage unchanged, all test keys isolated, hard-coded endpoint, full navigation between contexts');

// Module-level simulation assumptions must load and write only their own context.
for (const [name, key, getter, setter, realValue, testValue] of [
 ['intel','fd26-intel','pinnedPick','setPin',3,8],
 ['tendency','fd26-tendency','rbLean','setRbLean','heavy','extreme'],
]) {
 const outfile=app+`.simcache/test-${name}.cjs`;
 execFileSync('npx',['esbuild',`src/lib/${name}.ts`,'--bundle','--format=cjs',`--outfile=${outfile}`,'--log-level=error'],{cwd:app});
 const source=readFileSync(outfile,'utf8');
 const prefix='fd26-test-1402814176023322624:';
 const storage=new Map([[key,name==='intel'?JSON.stringify({Player:realValue}):realValue]]);
 const run=search=>{
  const box={module:{exports:{}},URLSearchParams,window:{location:{search}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(source,box);return box.module.exports;
 };
 const isolated=run('?test-draft=1402814176023322624');
 assert.equal(isolated[getter]('Player'),name==='intel'?undefined:'market');
 if(name==='intel') isolated[setter]('Player',testValue); else isolated[setter](testValue);
 assert.ok(storage.has(prefix+key));
 assert.equal(run('')[getter]('Player'),realValue);
 assert.equal(run('?test-draft=1402814176023322624')[getter]('Player'),testValue);
}
console.log('PASS: real simulation assumptions preserved; test pins and tendencies persist separately');
