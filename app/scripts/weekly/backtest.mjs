import {fileURLToPath} from 'node:url';
import {ROOT,POSITIONS,source,realScoring,validateProjections,exactScore,kickerBounds,atomicJSON,quantile} from './data.mjs';
export function metrics(rows,key='prediction') {
  if(!rows.length)return {n:0};const errors=rows.map(r=>r.actual-r[key]);
  return {n:rows.length,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/rows.length,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/rows.length),bias:errors.reduce((s,e)=>s+e,0)/rows.length};
}
export function evaluate(rows) {
  const residuals={};const slices={};
  for(const pos of POSITIONS){const train=rows.filter(r=>r.position===pos&&r.week<=10);const test=rows.filter(r=>r.position===pos&&r.week>10);residuals[pos]=train.length>=30?train.map(r=>r.actual-r.prediction):[];const lo=quantile(residuals[pos],.1),hi=quantile(residuals[pos],.9);slices[pos]={trainingN:train.length,holdout:metrics(test),coverage80:test.length&&lo!==null?test.filter(r=>r.actual>=r.prediction+lo&&r.actual<=r.prediction+hi).length/test.length:null};}
  const holdout=rows.filter(r=>r.week>10);const paired=holdout.filter(r=>r.trailing!==null);return {residuals,slices,baseline:metrics(holdout),ablation:{sample:paired.length,provider:metrics(paired),trailingThreeGames:metrics(paired,'trailing')}};
}
export async function backtest() {
  const {scoring}=await realScoring();const rows=[],history=new Map();let missingActual=0,incompleteScoring=0;const sources=[];
  for(let week=1;week<=18;week++) {
    const projection=await source(`https://api.sleeper.com/projections/nfl/2025/${week}?season_type=regular`,{ttl:30*86400000});
    const actual=await source(`https://api.sleeper.app/v1/stats/nfl/regular/2025/${week}`,{ttl:30*86400000});sources.push({url:projection.url,fetchedAt:projection.fetchedAt},{url:actual.url,fetchedAt:actual.fetchedAt});
    validateProjections(projection.data,'2025',week);const byId=new Map(projection.data.map(p=>[p.player_id,p]));if(!actual.data||Array.isArray(actual.data)||Object.keys(actual.data).length<300)throw new Error('Incomplete actual weekly stats');
    for(const p of projection.data){const position=p.player?.position;if(!POSITIONS.includes(position))continue;const prediction=exactScore(p.stats,scoring,position).mean??(position==='K'?kickerBounds(p.stats,scoring)?.low??null:null);if(prediction===null){incompleteScoring++;continue;}if(prediction<=0)continue;
      const a=actual.data[p.player_id];if(!a){missingActual++;continue;}const actualPoints=exactScore(a,scoring,position).mean;if(actualPoints===null)continue;
      const prior=history.get(p.player_id)||[];rows.push({week,id:p.player_id,position,prediction,actual:actualPoints,trailing:prior.length>=3?prior.slice(-3).reduce((s,x)=>s+x,0)/3:null});
    }
    // Append actuals only after predicting this week; missing game rows remain missing.
    for(const [id,a]of Object.entries(actual.data)){const prior=history.get(id)||[];const position=byId.get(id)?.player?.position;if(!POSITIONS.includes(position))continue;const points=exactScore(a,scoring,position).mean;if(points!==null){prior.push(points);history.set(id,prior);}}
    console.log(`Historical week ${week}: ${rows.length} scored player-weeks`);
  }
  const result=evaluate(rows);const limitations=['Retrospective diagnostic only: archived pre-kickoff forecasts are unavailable and provider historical forecasts were revised after games. This cannot establish prospective accuracy or improvement.','Training weeks 1–10 and heldout weeks 11–18 of 2025; current 2026 league scoring applied to both forecasts and actual component statistics.','Only positive projected rows with actual records and complete scoring enter evaluation. Missing actual records are excluded, never assigned zero; inactive/missing-game risk is underrepresented.','Position residual intervals are experimental, unconditioned on projection size, injury, player or opponent. No matchup, weather, coverage, correlation or trade superiority is established.','Kicker forecasts use conservative minimum-score distance-allocation bounds because exact distance buckets are incomplete; K residuals calibrate that bound baseline against exact-scored actuals, not a complete forecast.'];
  const output={schemaVersion:1,generatedAt:new Date().toISOString(),status:'baseline',season:'2025',split:{training:[1,10],heldout:[11,18]},scoring,...result,excluded:{missingActual,incompleteScoring},limitations,sources};
  await atomicJSON(new URL('public/weekly/validation.json',ROOT),output);
  await atomicJSON(new URL('../analysis/weekly/validation-summary.json',ROOT),{...output,residuals:undefined,sources:undefined});return output;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await backtest();
