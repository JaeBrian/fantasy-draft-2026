import type {SavedRoster} from './workspace';
import type {WeeklyDataset} from './types';
import {sameScoring} from './workspace';
export function analysisBlock(saved:SavedRoster|null,dataset:WeeklyDataset|null,week:number,now=Date.now()):string|null {
  if(!saved)return 'Click Update roster to load the real league.';
  if(saved.snapshot.stage==='waiting')return 'Waiting for the September 8 draft at 8 p.m. Pacific. Update roster after the draft to analyze your players.';
  if(saved.snapshot.stage==='drafting')return 'The draft is still in progress. Update roster when it finishes.';
  if(saved.snapshot.stage!=='rosters-ready')return 'Roster ownership or the completed draft needs to be verified before recommendations are available.';
  if(!dataset?.weeks[week])return 'Weekly forecast data is unavailable.';
  if(!sameScoring(saved.snapshot.scoring,dataset.scoring))return 'League scoring changed. The published projections must be rebuilt under the current rules.';
  if(dataset.sources.some(s=>s.name===`Sleeper week ${week} projections`&&s.status!=='ok'))return 'This week’s upstream projections need a fresh update before start/sit recommendations are available.';
  if(now-Date.parse(saved.snapshot.checkedAt)>86400000)return 'Your roster snapshot is over a day old. Click Update roster before using recommendations.';
  if(now-Date.parse(dataset.generatedAt)>36*3600000)return 'Forecasts are over 36 hours old. Reload forecasts; new recommendations stay paused until the model feed is refreshed.';
  return null;
}
