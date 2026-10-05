import test from 'node:test';
import assert from 'node:assert/strict';
import {espnLosingStreak,kboLosingStreak,soccerLosingStreak,addSoccerStreaks} from '../streaks.mjs';

test('provider streaks distinguish losses from wins, draws, missing data and an unopened season',()=>{
 assert.equal(espnLosingStreak([{name:'streak',value:-3,displayValue:'L3'}],10),3);
 assert.equal(espnLosingStreak([{name:'streak',value:4,displayValue:'W4'}],10),0);
 assert.equal(espnLosingStreak([{name:'streak',value:-4}],10),4);
 assert.equal(espnLosingStreak([{name:'streak',value:-3,displayValue:'T1'}],10),0);
 assert.equal(espnLosingStreak([],10),null);
 assert.equal(espnLosingStreak([{name:'streak',value:-3}],0),0);
 assert.equal(espnLosingStreak([{name:'streak',value:-7}],3),null);
 assert.equal(kboLosingStreak('8패',140),8);
 assert.equal(kboLosingStreak('3연패',100),3);
 assert.equal(kboLosingStreak('6승',140),0);
 assert.equal(kboLosingStreak('1무',140),0);
 assert.equal(kboLosingStreak(undefined,140),null);
 assert.equal(kboLosingStreak('<b>3패</b>',140),null);
});

const league={id:'eng.1'},now=new Date('2026-10-05T09:00:00Z');
const event=(id,result)=>({id:String(id),date:`2026-09-${String(id).padStart(2,'0')}T12:00:00Z`,league:{slug:'eng.1'},season:{year:2026},competitions:[{status:{type:{state:'post',completed:true,name:'STATUS_FULL_TIME'}},competitors:[{team:{id:'other'},score:{value:result==='L'?2:0}},{team:{id:'team'},score:{value:result==='W'?2:0}}]}]});
const fixture=results=>{
 const events=results.map((r,i)=>event(i+1,r));
 const row={team:{id:'team'},losingStreak:null,stats:{played:results.length,wins:results.filter(r=>r==='W').length,ties:results.filter(r=>r==='D').length,losses:results.filter(r=>r==='L').length}};
 return {row,data:{team:{id:'team'},season:{year:2026},events}};
};

test('soccer counts the latest league losses in date order, excluding other seasons and unplayed matches',()=>{
 const {row,data}=fixture(['W','L','L','L']);
 data.events.reverse();data.events.push(structuredClone(data.events[0]));
 const cup=event(5,'W');cup.league.slug='eng.fa';data.events.push(cup);
 const old=event(6,'W');old.season.year=2025;data.events.push(old);
 for(const name of ['STATUS_POSTPONED','STATUS_CANCELED','STATUS_SUSPENDED']){const e=event(7,'W');e.competitions[0].status.type.name=name;data.events.push(e);}
 const upcoming=event(8,'W');upcoming.competitions[0].status.type={state:'pre',completed:false};data.events.push(upcoming);
 assert.equal(soccerLosingStreak(data,row,league,2026,now),3);
});

test('a draw or win breaks a soccer losing streak and incomplete records are never guessed',()=>{
 for(const [results,expected] of [[['L','L','L','D'],0],[['L','L','L','W'],0],[['L','D','L','L'],2],[['L','L','L','L'],4]]){
  const {row,data}=fixture(results);assert.equal(soccerLosingStreak(data,row,league,2026,now),expected);
  data.events.pop();assert.equal(soccerLosingStreak(data,row,league,2026,now),null);
 }
 const {row,data}=fixture(['W','L','L','L']);
 assert.equal(soccerLosingStreak(data,row,league,2027,now),null);
 data.events[0].competitions[0].competitors[0].score.value=null;
 assert.equal(soccerLosingStreak(data,row,league,2026,now),null);
});

test('optional soccer history failures preserve standings and teams below the threshold need no extra request',async()=>{
 const {row,data}=fixture(['W','L','L','L']);const below=fixture(['L','L']).row;below.team.id='below';
 const result={season:{year:2026},groups:[{rows:[row,below]}]};let calls=0;
 await addSoccerStreaks(result,league,async url=>{calls++;assert.match(url,/eng\.1\/teams\/team\/schedule\?season=2026/);return Response.json(data);},now);
 assert.equal(calls,1);assert.equal(row.losingStreak,3);
 row.losingStreak=null;
 await addSoccerStreaks(result,league,async()=>{throw Error('offline');},now);
 assert.equal(row.losingStreak,null);assert.equal(result.groups[0].rows.length,2);
});
