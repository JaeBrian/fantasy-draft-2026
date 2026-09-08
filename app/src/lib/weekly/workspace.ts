import { useEffect, useState } from 'react';
import { usePersistent } from '../store';
import { collectWeeklySnapshot, type WeeklySnapshot } from './snapshot';
import { WEEKLY_LEAGUE_ID, WEEKLY_SEASON } from './config';
import type { WeeklyDataset } from './types';

export type Matchup = {rosterId:number;matchupId:number|null;starters:string[];points:number};
export type SavedRoster = {snapshot:WeeklySnapshot;matchups:Matchup[];matchupWeek:number;warning:string|null};
function restore(raw:string):SavedRoster|null {
  const value=JSON.parse(raw) as SavedRoster|null;
  const s=value?.snapshot;
  if (!s || s.version!==1 || s.leagueId!==WEEKLY_LEAGUE_ID || s.season!==WEEKLY_SEASON || !Number.isFinite(Date.parse(s.checkedAt)) ||
    !Array.isArray(s.managers) || !Array.isArray(s.rosters) || !Array.isArray(value?.matchups) ||
    s.rosters.some(r=>!Array.isArray(r.players)||!Array.isArray(r.starterSlots)||!Array.isArray(r.reserve)) ||
    s.managers.some(m=>!Array.isArray(m.players)||!Array.isArray(m.starterSlots))) return null;
  return value;
}
export function validateDataset(raw:unknown):WeeklyDataset {
  const d=raw as WeeklyDataset;
  if (!d || d.schemaVersion!==1 || d.season!==WEEKLY_SEASON || !Number.isFinite(Date.parse(d.generatedAt)) ||
    !d.weeks || !d.scoring || !Array.isArray(d.sources) || !d.calibration?.residuals || !d.validation?.limitations)
    throw new Error('Weekly analysis has an unsupported format');
  for (const [key,week] of Object.entries(d.weeks)) {
    if (+key<1 || +key>18 || week.week!==+key || !week.players || !Array.isArray(week.warnings)) throw new Error('Invalid weekly forecast');
    for (const [id,p] of Object.entries(week.players)) {
      if (p.id!==id || !Array.isArray(p.positions) || !Array.isArray(p.evidence) || (p.mean!==null && !Number.isFinite(p.mean)) ||
        (p.kickoff!==null && !Number.isFinite(p.kickoff))) throw new Error('Invalid player forecast');
    }
  }
  return d;
}
export function sameScoring(a:Record<string,number>,b:Record<string,number>):boolean {
  return Object.keys(a).length===Object.keys(b).length && Object.entries(a).every(([k,v])=>b[k]===v);
}
export function useWeeklyWorkspace() {
  const [saved,setSaved]=usePersistent<SavedRoster|null>('fd26-weekly-roster-v1',null,restore,JSON.stringify);
  const [dataset,setDataset]=useState<WeeklyDataset|null>(null);
  const [dataError,setDataError]=useState('');
  const [loading,setLoading]=useState(false);
  const [dataRefresh,setDataRefresh]=useState(0);
  const [week,setWeek]=usePersistent('fd26-weekly-week',1,r=>Math.min(18,Math.max(1,Number(r)||1)),String);
  const [request,setRequest]=useState(0),[checking,setChecking]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),15000);
    setLoading(true);
    fetch(new URL('./weekly/latest.json',window.location.href),{signal:controller.signal,cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('Weekly analysis is not published yet');return r.json();})
      .then(raw=>{if(active){setDataset(validateDataset(raw));setDataError('');}})
      .catch(e=>{if(active)setDataError(e instanceof Error?e.message:'Analysis unavailable');})
      .finally(()=>{clearTimeout(timeout);if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[dataRefresh]);
  useEffect(()=>{
    if(!request)return;
    const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),30000);
    setChecking(true);setError('');
    async function update() {
      const snapshot=await collectWeeklySnapshot(controller.signal);
      let matchups:Matchup[]=[],warning:string|null=null;
      try {
        const response=await fetch(`https://api.sleeper.app/v1/league/${WEEKLY_LEAGUE_ID}/matchups/${week}`,{signal:controller.signal});
        if(!response.ok)throw new Error('Matchup unavailable');
        const rows=await response.json();
        if(!Array.isArray(rows))throw new Error('Invalid matchup');
        matchups=rows.map(r=>{
          if(!Number.isInteger(r.roster_id)||!Array.isArray(r.starters)||r.starters.some((id:unknown)=>typeof id!=='string')||!Number.isFinite(r.points))throw new Error('Incomplete matchup');
          return {rosterId:r.roster_id,matchupId:Number.isInteger(r.matchup_id)?r.matchup_id:null,starters:r.starters,points:r.points};
        });
      } catch { warning='Opponent matchup could not be verified. Update roster again to retry.'; }
      if(active)setSaved({snapshot,matchups,matchupWeek:week,warning});
    }
    void update().catch(e=>{if(active)setError(e instanceof Error?e.message:'Roster update failed');})
      .finally(()=>{clearTimeout(timeout);if(active)setChecking(false);});
    return ()=>{active=false;controller.abort();};
    // Changing week does not contact Sleeper. Update roster explicitly fetches the selected week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[request,setSaved]);
  return {saved,dataset,dataError,loading,week,setWeek,checking,error,
    updateRoster:()=>setRequest(n=>n+1),reloadAnalysis:()=>setDataRefresh(n=>n+1)};
}
