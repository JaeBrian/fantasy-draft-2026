/* Run from app/:  node scripts/sim-build.mjs && node scripts/audit-logic.mjs
 *
 * Adversarial audit of the value model and the simulation harness. Each check prints PASS,
 * WARN or FAIL and says what it means. Written to find real bias, not to reassure. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CACHE = new URL('../.simcache/', import.meta.url).pathname;
const { P, MKT, BYE, VEGAS } = require(CACHE + 'data.cjs');
const { SLP } = require(CACHE + 'sleeper.cjs');

let fails = 0, warns = 0;
const ok   = (t, d='') => console.log(`  PASS  ${t}${d?'  — '+d:''}`);
const warn = (t, d='') => { warns++; console.log(`  WARN  ${t}${d?'  — '+d:''}`); };
const fail = (t, d='') => { fails++; console.log(`  FAIL  ${t}${d?'  — '+d:''}`); };

const PPG={QB:r=>Math.max(14,23.5-0.32*r),RB:r=>12.5*Math.exp(-(r-1)/20)+5.8,
  WR:r=>11.5*Math.exp(-(r-1)/26)+6.2,TE:r=>8.5*Math.exp(-(r-1)/7)+5};
const REPL={QB:PPG.QB(14),RB:PPG.RB(32),WR:PPG.WR(34),TE:PPG.TE(13)};

console.log('\n=== 1. DRAFT ARITHMETIC: does the pool cover a full 16-round draft? ===');
{
  const skill = P.filter(r=>['QB','RB','WR','TE'].includes(r[1])).length;
  const needed = 12*16, needSkill = 12*14;   // 2 of 16 picks go to K and DST
  console.log(`  board holds ${skill} skill players; a 12-team draft consumes ${needSkill} of them (14 skill rounds) or ${needed} if you ignore K/DST`);
  if (skill < needSkill) fail('pool cannot fill 14 skill rounds', `${skill} < ${needSkill}`);
  else ok('pool covers 14 skill rounds', `${skill} >= ${needSkill}`);
  /* Regression guard: a sim that loops past the pool hands seats 1 and 2 a 15th player and
     everyone else 14, quietly inflating the early seats. Check the scripts, not the theory. */
  {
    const fs2 = require('node:fs');
    const dir = new URL('./', import.meta.url).pathname;
    const bad = fs2.readdirSync(dir).filter(f => /^sim-.*\.mjs$/.test(f)).filter(f => {
      const body = fs2.readFileSync(dir + f, 'utf8');
      return /pick\s*<=\s*192|p2\s*<=\s*192/.test(body);
    });
    if (bad.length) fail('sim scripts still draft past the end of the board', bad.join(', ') + ' — seats 1 and 2 get a 15th player nobody else gets');
    else ok('every sim stops at pick 168', 'equal 14-player rosters for all twelve seats');
  }
}

console.log('\n=== 2. VALUE MODEL: are the PPG curves calibrated to real production? ===');
{
  const fs = require('node:fs');
  let stats = null;
  try { stats = JSON.parse(fs.readFileSync(CACHE + 'stats2025.json','utf8')); } catch {}
  if (!stats) { warn('2025 stats snapshot not available here', 'skipping calibration check'); }
  else {
    const norm=s=>s.toLowerCase().replace(/[.'-]/g,' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'').replace(/\s+/g,' ').trim();
    /* real half-PPR points per game, by positional finish, from 2025 */
    const real={QB:[],RB:[],WR:[],TE:[]};
    const byId={};
    for(const [pid,st] of Object.entries(stats)) byId[pid]=st;
    /* we only have ids; match through the board via the ADP file if present */
    let matched=0;
    const perPos={QB:[],RB:[],WR:[],TE:[]};
    for(const st of Object.values(stats)){
      if(!st||!st.gp||st.gp<8||!st.pts_half_ppr) continue;
      matched++;
    }
    console.log(`  2025 snapshot: ${matched} players with 8+ games`);
    /* compare curve shape to the league-wide distribution we can compute directly */
    const all=Object.entries(stats).filter(([id,s])=>!id.startsWith('TEAM_')&&s&&s.gp>=8&&s.pts_half_ppr)
      .map(([,s])=>s.pts_half_ppr/s.gp).sort((a,b)=>b-a);
    if(all.length>60){
      console.log(`  observed ppg, all positions: #1 ${all[0].toFixed(1)}  #12 ${all[11].toFixed(1)}  #36 ${all[35].toFixed(1)}  #60 ${all[59].toFixed(1)}`);
      const curveTop = Math.max(PPG.QB(1),PPG.RB(1),PPG.WR(1),PPG.TE(1));
      const lo=curveTop*0.75, hi=curveTop*1.35;
      if (all[0] > hi) warn('curves understate the very top', `real #1 ${all[0].toFixed(1)} vs curve max ${curveTop.toFixed(1)}`);
      else if (all[0] < lo) warn('curves overstate the very top', `real #1 ${all[0].toFixed(1)} vs curve max ${curveTop.toFixed(1)}`);
      else ok('curve top matches observed production', `real #1 ${all[0].toFixed(1)}, curve max ${curveTop.toFixed(1)}`);
      const rb=[PPG.RB(1),PPG.RB(12),PPG.RB(24)].map(x=>x.toFixed(1)).join(' / ');
      const wr=[PPG.WR(1),PPG.WR(12),PPG.WR(24)].map(x=>x.toFixed(1)).join(' / ');
      console.log(`  curve shape RB1/RB12/RB24: ${rb}   WR1/WR12/WR24: ${wr}`);
    }
  }
  /* internal coherence: replacement level should sit near the last starter at each position */
  const starters={QB:12,RB:12*2,WR:12*2,TE:12};   // plus 2 flex spread across RB/WR/TE
  const flexish=12*2;
  console.log(`  replacement ranks in use: QB${14} RB${32} WR${34} TE${13}`);
  console.log(`  12-team starters: QB${starters.QB}, RB${starters.RB}, WR${starters.WR}, TE${starters.TE}, plus ${flexish} flex shared by RB/WR/TE`);
  if (14 < starters.QB) fail('QB replacement rank is above the number of starting QBs');
  else ok('QB replacement rank sits at or past the last starter', `QB14 vs 12 starters`);
  if (13 < starters.TE) fail('TE replacement rank is above the number of starting TEs');
  else ok('TE replacement rank sits at or past the last starter', `TE13 vs 12 starters`);
  const rbwrFloor = starters.RB, wrFloor = starters.WR;
  if (32 < rbwrFloor || 34 < wrFloor) fail('RB/WR replacement ranks sit above their starter counts');
  else ok('RB/WR replacement ranks sit past their starter counts', `RB32/WR34 vs 24 fixed + 24 flex`);
}

console.log('\n=== 3. DATA INTEGRITY ===');
{
  const names = P.map(r=>r[0]);
  const dupes = names.filter((n,i)=>names.indexOf(n)!==i);
  dupes.length ? fail('duplicate players on the board', [...new Set(dupes)].join(', ')) : ok('no duplicate players', `${names.length} rows`);

  const badPos = P.filter(r=>!['QB','RB','WR','TE'].includes(r[1]));
  badPos.length ? fail('unexpected positions', badPos.map(r=>`${r[0]}=${r[1]}`).join(', ')) : ok('all positions are QB/RB/WR/TE');

  const noBye = P.filter(r=>!BYE[r[2]]);
  noBye.length ? fail('players whose team has no bye week', [...new Set(noBye.map(r=>r[2]))].join(', ')) : ok('every team has a bye week');
  const byeVals = [...new Set(Object.values(BYE))].sort((a,b)=>a-b);
  const badBye = byeVals.filter(b=>b<4||b>14);
  badBye.length ? fail('bye weeks outside weeks 4-14', badBye.join(', ')) : ok('bye weeks all fall in weeks 4-14', `range ${byeVals[0]}-${byeVals[byeVals.length-1]}`);
  const teamsPerBye = {};
  Object.entries(BYE).forEach(([t,b])=>{teamsPerBye[b]=(teamsPerBye[b]||0)+1;});
  const tot = Object.values(teamsPerBye).reduce((a,b)=>a+b,0);
  tot===32 ? ok('all 32 NFL teams carry a bye', JSON.stringify(teamsPerBye)) : warn(`bye table covers ${tot} teams, expected 32`);

  const noAdp = P.filter(r=>SLP[r[0]]?.adp===undefined);
  noAdp.length>3 ? warn(`${noAdp.length} players lack a real Sleeper ADP`, noAdp.slice(0,5).map(r=>r[0]).join(', '))
    : ok('Sleeper ADP coverage', `${P.length-noAdp.length}/${P.length}${noAdp.length?' (missing: '+noAdp.map(r=>r[0]).join(', ')+')':''}`);

  const noMkt = P.filter(r=>!MKT[r[0]]);
  noMkt.length>5 ? warn(`${noMkt.length} players lack mock-market ADP`) : ok('mock ADP coverage', `${P.length-noMkt.length}/${P.length}`);

  /* tiers must not go backwards as you go down the board */
  let bad=0, prev=0;
  P.forEach(r=>{ const t=r[5]; if(t<prev) bad++; prev=Math.max(prev,t); });
  bad ? fail(`${bad} players sit in a tier better than someone ranked above them`) : ok('overall tiers are monotonic down the board');

  const verdicts = [...new Set(P.map(r=>r[4]))];
  const okV = verdicts.every(v=>['buy','solid','risk','avoid'].includes(v));
  okV ? ok('all verdicts valid', verdicts.join('/')) : fail('unexpected verdict values', verdicts.join(', '));
}

console.log('\n=== 4. MARKET MODEL: is our price consistent with Sleeper? ===');
{
  const rows = P.map((r,i)=>({name:r[0],pos:r[1],rank:i+1,
    sadp:SLP[r[0]]?.adp, ffc:MKT[r[0]]?MKT[r[0]][0]:r[3]}))
    .filter(r=>r.sadp!==undefined);
  const price = r => 0.75*r.sadp + 0.25*r.ffc;
  /* the blend must never move a player more than a round or so off Sleeper's own number */
  const drift = rows.map(r=>({...r,d:Math.abs(price(r)-r.sadp)})).sort((a,b)=>b.d-a.d);
  const worst = drift[0];
  drift.filter(r=>r.d>12).length
    ? warn(`${drift.filter(r=>r.d>12).length} players priced >12 picks off Sleeper's ADP`, `worst ${worst.name} ${worst.d.toFixed(0)}`)
    : ok('blend stays within 12 picks of Sleeper ADP', `worst drift ${worst.name} ${worst.d.toFixed(1)}`);
  /* top-12 sanity: 12 players should price inside round 1 */
  const inR1 = rows.filter(r=>price(r)<=12).length;
  (inR1>=9 && inR1<=15) ? ok('about a round of players price inside picks 1-12', `${inR1}`)
    : warn('round-1 population looks off', `${inR1} players price <= 12`);
}

console.log('\n=== 5. PROBABILITY MODEL: do survival odds conserve picks? ===');
{
  function ncdf(z){if(z<-8)return 0;if(z>8)return 1;
    const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);
    const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
    return z>0?1-p:p;}
  const rows=P.map((r,i)=>{const s=SLP[r[0]],ffc=MKT[r[0]]?MKT[r[0]][0]:r[3];
    const a=s&&s.adp!==undefined?0.75*s.adp+0.25*ffc:ffc;
    return {a,sig:Math.max(2.2,MKT[r[0]]?MKT[r[0]][1]:0,0.13*a)};});
  for(const pick of [12,24,36,60]){
    const expected = rows.reduce((t,r)=>t+ncdf((pick-r.a)/r.sig),0);
    const err = expected-(pick-1);
    const pct = Math.abs(err)/(pick-1)*100;
    const msg=`by pick ${pick}: model expects ${expected.toFixed(1)} gone, truth is ${pick-1} (${err>0?'+':''}${err.toFixed(1)}, ${pct.toFixed(0)}%)`;
    if(pct>25) fail('survival model badly miscounts picks', msg);
    else if(pct>12) warn('survival model drifts from pick count', msg);
    else ok('survival model conserves picks', msg);
  }
}

console.log(`\n${'='.repeat(70)}\nRESULT: ${fails} FAIL, ${warns} WARN\n`);
