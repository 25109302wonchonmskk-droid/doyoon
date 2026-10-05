import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES} from '../sports.mjs';
import {parseEspnStandings,parseKboStandings,getStandings,standingsColumns} from '../standings.mjs';
import {handler} from '../api/standings.js';
const league=id=>LEAGUES.find(l=>l.id===id);
const entry=(id,values)=>({team:{id,displayName:'Team '+id,logos:[{href:'https://a.espncdn.com/team.png'}]},stats:Object.entries(values).map(([name,value])=>({name,value}))});
const table=(entries,{season=2026,seasonType=1,name='League',id='one'}={})=>({id,name,standings:{season,seasonType,entries}});
const payload=tables=>({season:{year:2027,displayName:'2027'},seasons:[{year:2026,displayName:'2026-27'}],children:tables});

test('soccer standings preserve source rank and points, including deductions',()=>{
 const data=payload([table([entry('b',{rank:2,gamesPlayed:3,wins:2,points:4}),entry('a',{rank:1,gamesPlayed:3,wins:2,points:6})])]);
 const result=parseEspnStandings(data,league('eng.1'));assert.deepEqual(result.groups[0].rows.map(r=>r.team.id),['a','b']);assert.equal(result.groups[0].rows[1].stats.points,4);assert.equal(result.season.year,2026);assert.equal(result.season.label,'2026-27');
});
test('nested divisions use source seed order with ranks local to the division',()=>{
 const data=payload([{name:'AFC',children:[table([entry('b',{playoffSeed:7,wins:2,losses:2}),entry('a',{playoffSeed:3,wins:3,losses:1})],{seasonType:2,name:'AFC East'})]}]);
 const group=parseEspnStandings(data,league('nfl')).groups[0];assert.equal(group.name,'AFC 동부');assert.deepEqual(group.rows.map(r=>[r.rank,r.team.id]),[[1,'a'],[2,'b']]);
});
test('NBA with zero regular-season games displays unranked teams',()=>{
 const data=payload([table([entry('a',{playoffSeed:1,wins:0,losses:0,winPercent:0})],{seasonType:2})]);const result=parseEspnStandings(data,league('nba'));assert.equal(result.notStarted,true);assert.equal(result.groups[0].rows[0].rank,null);assert.equal(result.groups[0].rows[0].stats.pct,0);
});
test('NHL overtime losses are counted once and distinct from regular losses',()=>{
 const data=payload([table([entry('a',{playoffSeed:1,wins:3,losses:1,otLosses:2,overtimeLosses:2,points:8})],{seasonType:2})]);const row=parseEspnStandings(data,league('nhl')).groups[0].rows[0];assert.equal(row.stats.played,6);assert.equal(row.stats.otLosses,2);assert.equal(row.stats.points,8);assert.equal(standingsColumns(league('nhl')).find(c=>c.key==='otLosses').label,'OT패');
});
test('malformed, mixed-season and preseason data are rejected',()=>{
 assert.throws(()=>parseEspnStandings({},league('eng.1')));
 assert.throws(()=>parseEspnStandings(payload([table([],{season:2026}),table([],{season:2027})]),league('eng.1')));
 assert.throws(()=>parseEspnStandings(payload([table([],{seasonType:1})]),league('nba')));
 assert.deepEqual(parseEspnStandings(payload([table([])]),league('eng.1')).groups[0].rows,[]);
});
test('KBO preserves official tied ranks, draws and win percentage',()=>{
 const team=(teamId,ranking)=>({categoryId:'kbo',seasonId:'2026',teamId,teamName:teamId,ranking,gameCount:100,winGameCount:60,drawnGameCount:5,loseGameCount:35,wra:.632});const data={code:200,success:true,result:{gameType:'REGULAR_SEASON',seasonTeamStats:[team('LG',2),team('KT',1),team('KIA',2)]}};
 const result=parseKboStandings(data,2026);assert.deepEqual(result.groups[0].rows.map(r=>r.rank),[1,2,2]);assert.equal(result.groups[0].rows[0].stats.ties,5);assert.equal(result.groups[0].rows[0].stats.pct,.632);assert.throws(()=>parseKboStandings(data,2027));
});
test('standings fetch requests regular season and appropriate group level',async()=>{
 let url;await getStandings('mlb',async u=>{url=new URL(u);return Response.json(payload([table([],{seasonType:2})]));});assert.equal(url.searchParams.get('seasontype'),'2');assert.equal(url.searchParams.get('level'),'3');
 await getStandings('kbo',async u=>{url=new URL(u);return Response.json({code:200,success:true,result:{gameType:'REGULAR_SEASON',seasonTeamStats:[]}});},new Date('2026-10-05T08:00:00Z'));assert.ok(url.pathname.includes('/2026/'));
});
test('invalid standings queries and methods never call upstream',async()=>{
 let called=0;const fetcher=()=>{called++;throw Error('unexpected');};for(const q of ['','?league=unknown','?league=all']){const r=await handler(new Request('https://test/api/standings'+q),fetcher);assert.equal(r.status,400);}assert.equal((await handler(new Request('https://test/api/standings?league=kbo',{method:'POST'}),fetcher)).status,405);assert.equal(called,0);
});
test('standings source failure returns 502, successful data has a five minute cache',async()=>{
 const request=new Request('https://test/api/standings?league=eng.1');const fail=await handler(request,async()=>new Response('error',{status:500}));assert.equal(fail.status,502);assert.equal(fail.headers.get('cache-control'),'no-store');
 const ok=await handler(request,async()=>Response.json(payload([table([])])));assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/s-maxage=300/);assert.equal((await ok.json()).league,'eng.1');
});
test('standings logos only accept approved HTTPS providers',()=>{
 const e=entry('a',{rank:1,gamesPlayed:1});e.team.logos=[{href:'javascript:alert(1)'}];const row=parseEspnStandings(payload([table([e])]),league('eng.1')).groups[0].rows[0];assert.equal(row.team.logo,'');assert.equal(row.stats.losses,null);
});
