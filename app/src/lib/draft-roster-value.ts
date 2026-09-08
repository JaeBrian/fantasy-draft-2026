export interface RosterValuePlayer {name:string;pos:string;points:number;bye:number;miss:number;knownMiss:number;handcuff?:{starter:RosterValuePlayer;uplift:number}}
const slots:Record<string,number>={QB:1,RB:2,WR:2,TE:1};
const draws=24;
function uniform(name:string,week:number,draw:number){
 let h=2166136261;for(let i=0;i<name.length;i++)h=Math.imul(h^name.charCodeAt(i),16777619);
 h^=Math.imul(week,7919)^Math.imul(draw+1,104729);h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return((h^(h>>>16))>>>0)/4294967296;
}
function available(p:RosterValuePlayer,week:number,draw:number){
 const known=Math.min(1,Math.max(0,p.knownMiss));
 if(p.bye===week||week<=Math.round(17*known))return false;
 const residual=known>=1?1:Math.max(0,p.miss-known)/(1-known);
 return uniform(p.name,week,draw)>=residual;
}
function projectedPoints(p:RosterValuePlayer,week:number,draw:number){
 return p.points+(p.handcuff&&!available(p.handcuff.starter,week,draw)?p.handcuff.uplift:0);
}
function points(group:Record<string,number[]>){
 let total=0;const flex:number[]=[];
 for(const[pos,n]of Object.entries(slots)){const a=group[pos]??[];for(let i=0;i<Math.min(n,a.length);i++)total+=a[i];if(pos!=='QB')flex.push(...a.slice(n));}
 flex.sort((a,b)=>b-a);return total+(flex[0]??0)+(flex[1]??0);
}
/** Marginal starter points from a roster addition, with known byes and sampled absences.
 * Uses projections to choose starters; never observes future performance. No waiver pickups.
 * Fixed shared availability draws make candidate comparisons deterministic. */
export function rosterGainEvaluator(roster:RosterValuePlayer[]){
 const states:{week:number;draw:number;group:Record<string,number[]>;base:number}[]=[];
 for(let week=1;week<=17;week++)for(let draw=0;draw<draws;draw++){
  const group:Record<string,number[]>={QB:[],RB:[],WR:[],TE:[]};
  for(const p of roster)if(group[p.pos]&&available(p,week,draw))group[p.pos].push(projectedPoints(p,week,draw));
  for(const a of Object.values(group))a.sort((a,b)=>b-a);
  states.push({week,draw,group,base:points(group)});
 }
 return(p:RosterValuePlayer)=>{
  if(!slots[p.pos]||roster.some(r=>r.name===p.name))return 0;
  let gain=0;
  for(const s of states){if(!available(p,s.week,s.draw))continue;const a=[...s.group[p.pos],projectedPoints(p,s.week,s.draw)].sort((a,b)=>b-a);gain+=points({...s.group,[p.pos]:a})-s.base;}
  return gain/states.length;
 };
}
