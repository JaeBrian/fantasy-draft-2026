const round=x=>Math.round(x*100)/100;
export function relativeScoringRates(scores,median){
 if(median<=0||!scores.length)return {boom:null,bust:null};
 return {boom:round(scores.filter(x=>x>=median*1.5).length/scores.length),bust:round(scores.filter(x=>x<=median*.5).length/scores.length)};
}
export function validRisk({cv,pMiss,knownMiss}){
 return Number.isFinite(cv)&&cv>=0&&[pMiss,knownMiss].every(p=>Number.isFinite(p)&&p>=0&&p<=1);
}
