import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES,kstDate} from '../sports.mjs';
import {validMonth,monthBounds,calendarDays,parseFavoriteTeams,matchesTeam,scheduleSeason,parseTeamSchedule,parseKboMonth,getTeamSchedule} from '../team-schedule.mjs';
import {handler} from '../api/team-schedule.js';
const league=id=>LEAGUES.find(l=>l.id===id);
const event=(id='1',date='2026-10-10T16:30:00Z',state='pre')=>({id,date,season:{year:2026},league:{slug:'eng.1'},competitions:[{status:{type:{state,completed:state==='post',name:state==='post'?'STATUS_FULL_TIME':'STATUS_SCHEDULED'}},competitors:[{team:{id:'1',displayName:'Home',logos:[{href:'https://a.espncdn.com/team.png'}]},homeAway:'home',score:{value:0}},{team:{id:'2',displayName:'Away'},homeAway:'away',score:{value:2}}]}]});
const payload=events=>({team:{id:'1'},requestedSeason:{year:2026},events});

test('calendar handles leap years, month boundaries and league season years',()=>{
 assert.equal(validMonth('2026-13'),false);assert.equal(validMonth('2026-01&team=1'),false);
 assert.deepEqual(monthBounds('2024-02'),{start:'2024-02-01',end:'2024-02-29'});
 const days=calendarDays('2026-10');assert.equal(days.filter(Boolean).length,31);assert.equal(days[4],'2026-10-01');
 assert.equal(scheduleSeason(league('nba'),'2026-10'),2027);assert.equal(scheduleSeason(league('eng.1'),'2026-06'),2025);assert.equal(scheduleSeason(league('nfl'),'2027-01'),2026);
});
test('favorite teams retain validated sport and league identity and reject corrupt storage',()=>{
 const saved=parseFavoriteTeams({soccer:{league:'eng.1',id:'1',name:'Club'},baseball:{league:'kbo',id:'LG',name:'LG'},football:{league:'nfl',id:'https://bad',name:'No'},hockey:{league:'nba',id:'1',name:'No'}});
 assert.deepEqual(Object.keys(saved),['soccer','baseball']);
 const match={sport:'soccer',league:'eng.1',home:{id:'1'},away:{id:'2'}};
 assert.equal(matchesTeam(match,saved.soccer),true);assert.equal(matchesTeam({...match,sport:'basketball'},saved.soccer),false);assert.equal(matchesTeam({...match,league:'uefa.champions'},saved.soccer),false);
 assert.deepEqual(parseFavoriteTeams([]),{});
});
test('team schedule uses Korean dates, preserves future games, logos and cancellations, and rejects another team',()=>{
 const games=[event(),event('2','2026-10-31T16:30:00Z')];
 const cancelled=event('3');cancelled.competitions[0].status.type.name='STATUS_CANCELED';games.push(cancelled);
 const parsed=parseTeamSchedule(payload(games),league('eng.1'),'1','2026-10',2026,false);
 assert.equal(parsed.length,2);assert.equal(kstDate(parsed[0].date),'2026-10-11');assert.equal(parsed[0].home.score,null);assert.equal(parsed[0].home.logo,'https://a.espncdn.com/team.png');assert.equal(parsed[1].status.label,'취소');
 assert.equal(parseTeamSchedule(payload(games),league('eng.1'),'1','2026-11',2026,true).length,1);
 assert.throws(()=>parseTeamSchedule(payload(games),league('eng.1'),'7','2026-10',2026,false));
});
test('KBO month schedules require the complete response and retain doubleheaders for the selected team',()=>{
 const game=(id,time)=>({gameId:id,categoryId:'kbo',gameDate:'2026-10-05',gameDateTime:`2026-10-05T${time}`,homeTeamCode:'LG',homeTeamName:'LG',awayTeamCode:'KT',awayTeamName:'KT',statusCode:'BEFORE'});
 const data={code:200,success:true,result:{gameTotalCount:2,games:[game('20261005KTLG02026','14:00:00'),game('20261005KTLG12026','18:30:00')]}};
 const games=parseKboMonth(data,'LG','2026-10');assert.equal(games.length,2);assert.notEqual(games[0].id,games[1].id);assert.equal(games[0].home.score,null);
 assert.equal(parseKboMonth(data,'SS','2026-10').length,0);data.result.gameTotalCount=3;assert.throws(()=>parseKboMonth(data,'LG','2026-10'));
});
test('team schedule combines fixture and result requests without overwriting completed games with placeholders',async()=>{
 const completed=event('1',undefined,'post');
 const data=await getTeamSchedule('eng.1','1','2026-10',async url=>Response.json(payload(new URL(url).searchParams.get('fixture')==='true'?[event('1'),event('2')]:[completed])));
 assert.equal(data.matches.length,2);assert.equal(data.matches[0].status.state,'finished');assert.deepEqual(data.failures,[]);
});
test('unpublished postseason fixtures are empty only for an explicit success with the correct team and season',()=>{
 const data={status:'success',team:{id:'1'},season:{year:2027,type:1},events:[]};
 assert.deepEqual(parseTeamSchedule(data,league('nba'),'1','2026-10',2027,3),[]);
 assert.throws(()=>parseTeamSchedule(data,league('nba'),'2','2026-10',2027,3));
 assert.throws(()=>parseTeamSchedule(data,league('nba'),'1','2027-10',2028,3));
 assert.throws(()=>parseTeamSchedule({...data,status:'error'},league('nba'),'1','2026-10',2027,3));
});
test('invalid team schedule inputs never reach upstream, and unavailable schedules are not an empty month',async()=>{
 let calls=0;const offline=async()=>{calls++;throw Error('offline');};
 for(const query of ['league=kbo&team=1&month=2026-10','league=nba&team=1&month=2026-99','league=bad&team=1&month=2026-10'])assert.equal((await handler(new Request('https://test/api/team-schedule?'+query),offline)).status,400);
 assert.equal(calls,0);assert.equal((await handler(new Request('https://test/api/team-schedule?league=eng.1&team=1&month=2026-10'),offline)).status,502);
 const partial=await getTeamSchedule('eng.1','1','2026-10',async url=>{if(new URL(url).searchParams.get('fixture')==='true')throw Error('offline');return Response.json(payload([]));});assert.deepEqual(partial.failures,['예정 경기']);
 const empty=await handler(new Request('https://test/api/team-schedule?league=eng.1&team=1&month=2026-10'),async()=>Response.json(payload([])));assert.equal(empty.status,200);assert.deepEqual((await empty.json()).matches,[]);
});
