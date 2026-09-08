import {source,exactScore,teamCode} from './data.mjs';
import {snapshotFeatures,leaguePoints,playerMapping} from './research-stats.mjs';
export const OPPORTUNITY=['pointsMean','attempts','carries','targets','receptions','receiving_air_yards','target_share','air_yards_share','recentTargets','recentCarries','previousTargets','previousCarries','passing_yards','rushing_yards','receiving_yards','sampleGames'];
export const ROLE=['offense_pct','offense_snaps','redZoneTargets','redZoneCarries','inside5Carries'];
export const OPPONENT=['defensivePassEPA','defensiveRushEPA','defensiveSackRate','defensiveQBHitRate','defensivePassExplosiveRate','defensiveRushExplosiveRate','scheduleAdjustedPassEPA','scheduleAdjustedRushEPA','offensiveDropbacks','offensiveCarries'].map(k=>'opponent_'+k);
const POS=['QB','RB','WR','TE'];
const value=(r,k)=>k.startsWith('opponent_')?r.opponentFeatures?.[k.slice(9)]:r.features?.[k];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function fitRidge(rows,keys,lambda=10){
 if(rows.length<20)return null;
 const means=keys.map(k=>{const a=rows.map(r=>value(r,k)).filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;});
 const scales=keys.map((k,i)=>Math.sqrt(rows.reduce((s,r)=>s+((value(r,k)??means[i])-means[i])**2,0)/rows.length)||1);
 const vector=r=>[1,...keys.map((k,i)=>((value(r,k)??means[i])-means[i])/scales[i])];
 const n=keys.length+1,A=Array.from({length:n},()=>Array(n+1).fill(0));
 for(const r of rows){const x=vector(r);for(let i=0;i<n;i++){for(let j=0;j<n;j++)A[i][j]+=x[i]*x[j];A[i][n]+=x[i]*r.actual;}}
 for(let i=1;i<n;i++)A[i][i]+=lambda;
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;[A[i],A[pivot]]=[A[pivot],A[i]];const d=A[i][i];if(Math.abs(d)<1e-10)return null;for(let k=i;k<=n;k++)A[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const m=A[j][i];for(let k=i;k<=n;k++)A[j][k]-=m*A[i][k];}}
 return {keys,means,scales,coefficients:A.map(a=>a[n]),lambda,n:rows.length};
}
function predict(m,r){if(!m)return null;return Math.max(0,dot(m.coefficients,[1,...m.keys.map((k,i)=>((value(r,k)??m.means[i])-m.means[i])/m.scales[i])]));}
export function predictResearch(model,row){return predict(model?.[row.position],row);}
export function metrics(rows,key='candidate'){const a=rows.filter(r=>Number.isFinite(r[key])&&Number.isFinite(r.actual));return {n:a.length,mae:a.length?a.reduce((s,r)=>s+Math.abs(r.actual-r[key]),0)/a.length:null,rmse:a.length?Math.sqrt(a.reduce((s,r)=>s+(r.actual-r[key])**2,0)/a.length):null};}
export function pairedWeekCI(rows,a='candidate',b='provider'){
 const groups=new Map();for(const r of rows){if(!Number.isFinite(r[a])||!Number.isFinite(r[b]))continue;const k=`${r.season}:${r.week}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(Math.abs(r.actual-r[a])-Math.abs(r.actual-r[b]));}
 const weeks=[...groups.values()];if(weeks.length<8)return null;let seed=98371;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const samples=[];
 for(let i=0;i<2000;i++){let total=0,n=0;for(let j=0;j<weeks.length;j++){const w=weeks[Math.floor(rand()*weeks.length)];total+=w.reduce((s,x)=>s+x,0);n+=w.length;}samples.push(total/n);}samples.sort((a,b)=>a-b);return {low:samples[50],high:samples[1949],method:'2000 paired week-cluster bootstrap replicates, 95% interval of candidate minus baseline absolute error',weeks:weeks.length};
}
export function admissionDecision(rows){const ci=pairedWeekCI(rows);const positions=Object.fromEntries(POS.map(p=>{const r=rows.filter(x=>x.position===p);return[p,{candidate:metrics(r),provider:metrics(r,'provider')}];}));const passed=!!ci&&ci.high<0&&Object.values(positions).every(p=>p.candidate.n>=100&&p.candidate.mae<=p.provider.mae);return {qualityGatePassed:passed,ci,positions};}
export function historicalRows(input,scoring,now){const out=[];for(let season=2023;season<=2025;season++)for(let week=1;week<=18;week++){
 const snapshot=snapshotFeatures(input,{season,week,now},scoring);
 for(const r of input.playerRows.filter(r=>Number(r.season)===season&&Number(r.week)===week)){
  const prior=snapshot.players[r.player_id];if(!prior||prior.sampleGames<2)continue;
  out.push({season,week,gsisId:r.player_id,position:r.position,features:prior.features,opponentFeatures:snapshot.teams[teamCode(r.opponent_team)]?.features||{},actual:leaguePoints(r,scoring),trailing:prior.features.pointsMean});
 }
 }return out;}
export async function validateResearchModel(input,scoring,now){
 const rows=historicalRows(input,scoring,now),train=rows.filter(r=>r.season===2023),validation=rows.filter(r=>r.season===2024),test=rows.filter(r=>r.season===2025);
 const groups={opportunity:OPPORTUNITY,opportunityAndRole:[...OPPORTUNITY,...ROLE],full:[...OPPORTUNITY,...ROLE,...OPPONENT]};
 const experiments={},models={};
 for(const[name,keys]of Object.entries(groups)){
  const modelsByPosition={},tuning={};
  for(const p of POS){const training=train.filter(r=>r.position===p),val=validation.filter(r=>r.position===p);const candidates=[1,10,100,1000].map(lambda=>{const m=fitRidge(training,keys,lambda);return {lambda,mae:metrics(val.map(r=>({...r,candidate:predict(m,r)}))).mae};}).sort((a,b)=>a.mae-b.mae);tuning[p]=candidates;modelsByPosition[p]=fitRidge([...training,...val],keys,candidates[0].lambda);}
  const predicted=test.map(r=>({...r,candidate:predictResearch(modelsByPosition,r)}));experiments[name]={test:metrics(predicted),byPosition:Object.fromEntries(POS.map(p=>[p,metrics(predicted.filter(r=>r.position===p))])),validationTuning:tuning};models[name]=modelsByPosition;
 }
 // Feature family selection uses 2024 validation scores exclusively, before inspecting 2025 test.
 const selected=Object.keys(groups).sort((a,b)=>{const score=n=>POS.reduce((s,p)=>s+experiments[n].validationTuning[p][0].mae*validation.filter(r=>r.position===p).length,0);return score(a)-score(b);})[0];
 const scored=test.map(r=>({...r,candidate:predictResearch(models[selected],r)}));const mapping=playerMapping(input.people,input.registry,input.crosswalk);const providerSources=[];let providerError=null;
 try{for(let week=1;week<=18;week++){const s=await source(`https://api.sleeper.com/projections/nfl/2025/${week}?season_type=regular`,{ttl:30*86400000});providerSources.push({url:s.url,fetchedAt:s.fetchedAt});const byId=new Map(s.data.map(r=>[String(r.player_id),r]));for(const r of scored.filter(r=>r.week===week)){const provider=byId.get(mapping.get(r.gsisId));if(provider)r.provider=exactScore(provider.stats,scoring,r.position).mean;}}}catch(e){providerError=e.message;}
 const paired=scored.filter(r=>Number.isFinite(r.provider)&&r.provider>0),gate=admissionDecision(paired);
 const validationResult={status:'experimental',selected,admitted:false,...gate,reason:gate.qualityGatePassed?'Retrospective statistical gate passed, but revised provider archives and conditional participation samples do not establish prospective lineup gains. Research remains a displayed second opinion.':'Measured candidate fails the paired provider error/position gate. Retain provider means and display the research forecast as an experimental second opinion.',split:{training:'2023 regular season, 2022 priors',validation:'2024 selects feature family and ridge penalty',heldout:'2025 untouched until selection; coefficients refit on 2023–2024'},scoring,experiments,selectedTest:metrics(scored),trailingBaseline:metrics(scored,'trailing'),pairedComparison:{candidate:metrics(paired),provider:metrics(paired,'provider'),trailing:metrics(paired,'trailing'),...gate},providerSources,providerError,limitations:['Historical provider values may have been revised after kickoff. Comparison is retrospective, not an archived pregame forecast evaluation.','Rows require two prior played games and a recorded current game; inactive outcomes and debut players are excluded.','Historical opportunity features use only completed games before each target week. Later source corrections remain a vintage-data limitation.','No roster-constrained lineup decision gain or availability model has been established. MAE gate requires 95% paired week-cluster interval below zero and no position MAE regression with at least 100 matched rows each.','Feature family and ridge penalty selected on 2024 only. 2025 is reporting-only and does not determine hyperparameters.']};
 // Production candidate refit includes all completed historical seasons after reporting untouched evaluation.
 const model=Object.fromEntries(POS.map(p=>[p,fitRidge(rows.filter(r=>r.position===p),groups[selected],experiments[selected].validationTuning[p][0].lambda)]));return {model,validation:validationResult};
}
