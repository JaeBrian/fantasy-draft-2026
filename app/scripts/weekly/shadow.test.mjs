import test from 'node:test';import assert from 'node:assert/strict';
import {forecastArchive,scoreArchive} from './shadow.mjs';
const now=Date.parse('2026-09-07T00:00:00Z');const kickoff=now+2*86400000;
const dataset={schemaVersion:1,season:'2026',generatedAt:new Date(now).toISOString(),scoring:{rec:.5},modelVersion:'test',sources:[{name:'Sleeper week 1 projections',status:'ok'}],weeks:{1:{week:1,players:Object.fromEntries(Array.from({length:100},(_,i)=>[String(i),{id:String(i),positions:['WR'],mean:5,kickoff}]))}}};
test('archive excludes first-kickoff and later snapshots',()=>{assert.equal(forecastArchive(dataset,1,kickoff),null);assert.equal(forecastArchive(dataset,1,kickoff+1),null);assert.equal(forecastArchive(dataset,1,now).predictions.length,100);});
test('future, stale, incomplete and stale-source forecasts rejected',()=>{assert.throws(()=>forecastArchive({...dataset,generatedAt:new Date(now+1).toISOString()},1,now));assert.throws(()=>forecastArchive({...dataset,generatedAt:new Date(now-86400001).toISOString()},1,now));assert.throws(()=>forecastArchive({...dataset,schemaVersion:2},1,now));assert.throws(()=>forecastArchive({...dataset,sources:[]},1,now));});
test('score only after completion buffer, missing actual stays excluded',()=>{const a=forecastArchive(dataset,1,now);assert.equal(scoreArchive(a,{},kickoff),null);const actual=Object.fromEntries(Array.from({length:300},(_,i)=>[String(i+1),{rec:8}]));const report=scoreArchive(a,actual,kickoff+86400000);assert.equal(report.n,99);assert.equal(report.missingActual,1);assert.equal(report.mae,1);assert.equal(report.status,'shadow');assert.throws(()=>scoreArchive({...a,archivedAt:new Date(kickoff).toISOString()},actual,kickoff+86400000));});
test('research archive enforces provenance and scores only matched candidate rows',()=>{
 const d=structuredClone(dataset);d.research={season:'2026',week:1,generatedAt:new Date(now).toISOString(),model:{name:'ridge'},sources:[]};
 d.weeks[1].players['0'].research={candidateMean:3};d.weeks[1].players['1'].research={candidateMean:3};d.weeks[1].players['2'].research={candidateMean:4};
 const a=forecastArchive(d,1,now);assert.equal(a.research.model.name,'ridge');
 const actual=Object.fromEntries(Array.from({length:300},(_,i)=>[String(i+1),{rec:8}]));const scored=scoreArchive(a,actual,kickoff+86400000);
 assert.deepEqual(scored.researchComparison,{n:2,researchMAE:.5,providerMAE:1});
 for(const bad of [{...d.research,week:2},{...d.research,generatedAt:new Date(now+1).toISOString()},{...d.research,generatedAt:new Date(now-86400001).toISOString()}])assert.throws(()=>forecastArchive({...d,research:bad},1,now),/provenance/);
});
