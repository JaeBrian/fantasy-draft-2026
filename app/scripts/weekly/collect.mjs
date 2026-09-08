// Run from app/: npm run weekly:snapshot. Saves a local, timestamped league snapshot.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
execFileSync('npx',['esbuild','src/lib/weekly/snapshot.ts','--bundle','--platform=node','--format=cjs','--outfile=.simcache/weekly-snapshot.cjs','--log-level=error']);
const {collectWeeklySnapshot}=require('../../.simcache/weekly-snapshot.cjs');
const snapshot=await collectWeeklySnapshot(AbortSignal.timeout(30000));
const body=JSON.stringify(snapshot,null,2)+'\n';
const hash=createHash('sha256').update(body).digest('hex');
const folder='.simcache/weekly';mkdirSync(folder,{recursive:true});
writeFileSync(`${folder}/${snapshot.checkedAt.replaceAll(':','-')}.json`,body);
writeFileSync(`${folder}/latest.tmp`,body);renameSync(`${folder}/latest.tmp`,`${folder}/latest.json`);
console.log(JSON.stringify({checkedAt:snapshot.checkedAt,sha256:hash,stage:snapshot.stage,rosteredPlayers:snapshot.rosteredPlayers,managers:snapshot.managers.map(({name,username,rosterId,issue})=>({name,username,rosterId,issue}))},null,2));
