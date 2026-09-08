export type WeeklyPlayer = {
  id:string; name:string; positions:string[]; team:string|null; opponent:string|null;
  kickoff:number|null; gameId:string|null; status:string|null;
  availability:'available'|'out'|'bye'|'unknown';
  mean:number|null; median:number|null; p10:number|null; p90:number|null;
  components:Record<string,number>; evidence:string[];
  projectionBounds?:{low:number;high:number;reason:string};
  research?:PlayerResearch;
  recentMean?:number|null; recentUsage?:number|null; previousUsage?:number|null;
};
export type WeeklySource = {name:string;url:string;fetchedAt:string;status:'ok'|'missing'|'stale';note?:string};
export type WeeklyDataset = {
  schemaVersion:1; season:string; generatedAt:string; modelVersion:string;
  scoring:Record<string,number>;
  weeks:Record<string,{week:number;players:Record<string,WeeklyPlayer>;warnings:string[]}>;
  currentWeek?:number;
  research?:WeeklyResearch;
  sources:WeeklySource[];
  calibration:{residuals:Record<string,number[]>;note:string};
  validation:{status:'baseline'|'validated';summary:string;metrics:Record<string,number>;limitations:string[]};
};
export type LineupAssignment={index:number;slot:string;playerId:string|null;mean:number|null;locked:boolean};
export type LineupResult={assignments:LineupAssignment[];total:number;complete:boolean;issues:string[]};
export type ResearchSignal={label:string;value:string;note?:string};
export type PlayerResearch={
  basis:string;sampleGames:number|null;candidateMean:number|null;
  signals:ResearchSignal[];notes:string[];
  officialStatus:{status:string|null;practice:string|null;injury:string|null;sourceUrl:string;reportedAt:string|null}|null;
};
export type ResearchGame={
  gameId:string;homeTeam:string;awayTeam:string;kickoff:number|null;venue:string;roof:string;
  weather:ResearchSignal[];notes:string[];market:ResearchSignal[];
};
export type WeeklyResearch={
  schemaVersion:1;season:string;week:number;generatedAt:string;
  games:ResearchGame[];sources:WeeklySource[];limitations:string[];
  model:{name:string;summary:string;metrics:Record<string,number>;admitted:boolean};
  changes:{playerId:string|null;title:string;detail:string}[];
};
