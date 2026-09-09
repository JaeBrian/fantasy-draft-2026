import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
await build({stdin:{contents:'export {AdvisorPanel} from "./src/components/AdvisorPanel"; export {P} from "./src/data"; export {snapTeam,mktADP} from "./src/lib/advisor";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],outfile:'.simcache/teammate-warning-test.cjs',logLevel:'silent'});
const {AdvisorPanel,P,snapTeam,mktADP}=createRequire(import.meta.url)('../.simcache/teammate-warning-test.cjs');
function render(owned,target,manual=true){
 const others=P.filter(r=>!owned.includes(r[0])&&r[0]!==target).sort((a,b)=>mktADP(a)-mktADP(b)).map(r=>r[0]);
 const ord=[],DS={};let count=0;
 for(let pick=1;count<owned.length||snapTeam(pick)!==2;pick++){
  const mine=snapTeam(pick)===2,name=mine?owned[count++]:others.shift();
  ord.push(name);DS[name]=mine?'mine':'gone';
 }
 return renderToStaticMarkup(createElement(AdvisorPanel,{DS,ord,mySlot:2,blocked:P.filter(r=>r[0]!==target).map(r=>r[0]),lean:'market',manual,finished:false,rosterSize:16,noob:true,intelVersion:'test',waitOnTightEnds:false,mark:()=>{}}));
}
for(const [owned,target] of [
 [['Chase Brown'],'Tee Higgins'],
 [['Derrick Henry'],'Zay Flowers'],
 [['Christian Watson'],'Jayden Reed'],
 [['Joe Burrow'],'Tee Higgins'],
 [['Chase Brown'],'Joe Burrow'],
 [['Trey McBride'],'Marvin Harrison Jr.'],
 [['Jaylen Warren'],'Rico Dowdle'],
 [['Chase Brown',"Ja'Marr Chase"],'Tee Higgins'],
])for(const manual of [true,false]){
 const html=render(owned,target,manual);
 assert.ok(html.includes(target),`${target} must reach the rendered recommendations`);
 const warning=html.match(/<[^>]+role="note"[^>]*>[\s\S]*?<\/div>/)?.[0];
 assert.ok(warning,`${owned.join(', ')} -> ${target}: show shared-team warning`);
 for(const name of owned)assert.ok(warning.includes(name.replaceAll("'",'&#x27;')),`name the owned teammate ${name}`);
 assert.match(warning,/RB1|WR1|QB|TE/,'show the current roster slot');
}
assert.ok(!render(['Chase Brown'],'Ladd McConkey').includes('aria-label="Shared NFL team"'),'another team must not trigger the notice, including players marked gone');
const bench=render(['Jahmyr Gibbs','Bijan Robinson','Christian McCaffrey','Jonathan Taylor','Chase Brown'],'Tee Higgins');
assert.match(bench,/Chase Brown \(Bench\)/,'include an owned bench teammate without labeling them a starter');
console.log('PASS: rendered teammate warnings across positions, manual/live views, multiple teammates, bench and unrelated teams');
