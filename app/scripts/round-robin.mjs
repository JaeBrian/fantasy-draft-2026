export function roundRobin(teamCount) {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount % 2) throw new Error('An even team count is required');
  const ring=Array.from({length:teamCount},(_,i)=>i+1),rounds=[];
  for(let r=0;r<teamCount-1;r++){
    rounds.push(Array.from({length:teamCount/2},(_,i)=>[ring[i],ring[teamCount-1-i]]));
    ring.splice(1,0,ring.pop());
  }
  return rounds;
}
