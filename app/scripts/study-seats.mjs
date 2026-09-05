import {createRequire} from 'node:module';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const cache=new URL('../.simcache/',import.meta.url);
export const {TOOL_USERS}=require(new URL('data.cjs',cache).pathname);
const selected=process.env.SIM_SEAT;
if(selected && !TOOL_USERS.some(([,seat])=>String(seat)===selected))
  throw new Error(`Unknown SIM_SEAT ${selected}; expected ${TOOL_USERS.map(([,seat])=>seat).join(', ')}`);
export const studyUsers=TOOL_USERS.filter(([,seat])=>!selected||String(seat)===selected);
export const studySlots=studyUsers.map(([,seat])=>seat);
// A targeted rerun replaces that seat while preserving the other published study results.
export function writeSeatResults(file,results){
  const path=new URL(file,cache);
  const previous=selected&&existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
  writeFileSync(path,JSON.stringify({...previous,...results},null,2));
}
