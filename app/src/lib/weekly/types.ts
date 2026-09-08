export type WeeklyPlayer = {
  id:string; name:string; positions:string[]; team:string|null; opponent:string|null;
  kickoff:number|null; gameId:string|null; status:string|null;
  availability:'available'|'out'|'bye'|'unknown';
  mean:number|null; median:number|null; p10:number|null; p90:number|null;
  components:Record<string,number>; evidence:string[];
  projectionBounds?:{low:number;high:number;reason:string};
  recentMean?:number|null; recentUsage?:number|null; previousUsage?:number|null;
};
export type WeeklySource = {name:string;url:string;fetchedAt:string;status:'ok'|'missing'|'stale';note?:string};
export type WeeklyDataset = {
  schemaVersion:1; season:string; generatedAt:string; modelVersion:string;
  scoring:Record<string,number>;
  weeks:Record<string,{week:number;players:Record<string,WeeklyPlayer>;warnings:string[]}>;
  sources:WeeklySource[];
  calibration:{residuals:Record<string,number[]>;note:string};
  validation:{status:'baseline'|'validated';summary:string;metrics:Record<string,number>;limitations:string[]};
};
export type LineupAssignment={index:number;slot:string;playerId:string|null;mean:number|null;locked:boolean};
export type LineupResult={assignments:LineupAssignment[];total:number;complete:boolean;issues:string[]};
