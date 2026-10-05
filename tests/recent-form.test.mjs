import test from 'node:test';
import assert from 'node:assert/strict';
import {earlySeasonForm,espnRecentForm,validRecentForm,recentFormFromGames,addEspnRecentForm,parseKboRecentForm,addKboRecentForm} from '../recent-form.mjs';
import {espnSeasonResults} from '../streaks.mjs';

test('recent records use actual season games below ten and distinguish zero games from missing data',()=>{
 const stats={played:4,wins:2,ties:1,losses:1};
 assert.deepEqual(earlySeasonForm(stats,'soccer'),{...stats,otLosses:0});
 assert.equal(earlySeasonForm({...stats,played:5},'soccer'),null);
 assert.equal(earlySeasonForm({...stats,ties:null},'football'),null);
 assert.equal(earlySeasonForm({played:null},'soccer'),null);
 assert.equal(earlySeasonForm({played:0},'basketball').played,0);
 assert.equal(earlySeasonForm({played:11,wins:11,ties:0,losses:0},'soccer'),null);
});

test('ESPN last-ten records retain hockey overtime losses and reject truncated or malformed summaries',()=>{
 const source=summary=>[{name:'Last Ten Games',type:'lasttengames',summary}];
 const stats={played:30,wins:18,losses:9,otLosses:3,ties:0};
 assert.deepEqual(espnRecentForm(source('6-3-1'),stats,'hockey'),{played:10,wins:6,losses:3,ties:0,otLosses:1});
 assert.equal(espnRecentForm(source('6-3'),stats,'hockey'),null);
 assert.equal(espnRecentForm(source('6-4'),{played:30,wins:18,losses:12},'basketball').wins,6);
 for(const value of ['6-3','6-5','bad','-1-11'])assert.equal(espnRecentForm(source(value),{played:30,wins:18,losses:12},'baseball'),null);
 assert.equal(validRecentForm({played:10,wins:8,losses:2,ties:0,otLosses:0},{played:12,wins:7,losses:5}),null);
});

const now=new Date('2026-10-05T10:00:00Z');
const soccer={id:'eng.1',sport:'soccer'},nfl={id:'nfl',sport:'football'};
const fixture=(league=soccer)=>{
 const results=['W','W','D','W','L','W','D','L','W','L','L','L'];
 const events=results.map((result,i)=>({id:String(i+1),date:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`,season:{year:2026},seasonType:{type:2},league:{slug:league.id},competitions:[{status:{type:{state:'post',completed:true,name:'STATUS_FINAL'}},competitors:[{team:{id:'1'},score:{value:result==='W'?2:0}},{team:{id:'2'},score:{value:result==='L'?2:0}}]}]}));
 return {data:{team:{id:'1'},requestedSeason:{year:2026,type:2},events},row:{team:{id:'1'},stats:{played:12,wins:5,ties:2,losses:5},losingStreak:null,recentForm:null}};
};

test('soccer histories count exactly the latest ten completed league games with wins and draws retained',()=>{
 const {data,row}=fixture();data.events.reverse();
 const duplicate=structuredClone(data.events[0]);data.events.push(duplicate);
 const cup=structuredClone(data.events[0]);cup.id='cup';cup.league.slug='eng.fa';data.events.push(cup);
 const games=espnSeasonResults(data,row,soccer,2026,now);
 assert.deepEqual(recentFormFromGames(games),{played:10,wins:3,ties:2,losses:5,otLosses:0});
 data.events=data.events.filter(e=>e.id!=='5');assert.equal(espnSeasonResults(data,row,soccer,2026,now),null);
});

test('NFL histories exclude preseason and postseason games when computing regular-season last ten',()=>{
 const {data,row}=fixture(nfl);
 for(const type of [1,3]){const e=structuredClone(data.events[0]);e.id='extra-'+type;e.seasonType.type=type;data.events.push(e);}
 const games=espnSeasonResults(data,row,nfl,2026,now);
 assert.equal(games.length,12);assert.deepEqual(recentFormFromGames(games),{played:10,wins:3,ties:2,losses:5,otLosses:0});
});

test('soccer recent form and losing streak share one history request and failures preserve standings',async()=>{
 const {data,row}=fixture();const result={season:{year:2026},groups:[{rows:[row]}]};let calls=0;
 await addEspnRecentForm(result,soccer,async()=>{calls++;return Response.json(data);},now,Date.now()+1000);
 assert.equal(calls,1);assert.equal(row.recentForm.played,10);assert.equal(row.losingStreak,3);
 row.recentForm=null;
 await addEspnRecentForm(result,soccer,async()=>{throw Error('unavailable');},now,Date.now()+1000);
 assert.equal(row.recentForm,null);assert.equal(row.losingStreak,3);assert.equal(result.groups[0].rows.length,1);
});

const kboHtml=()=>`<select id="record_ddlYear"><option value="2026" selected="selected">2026</option></select><select id="record_ddlSeries"><option selected="selected" value="0">정규시즌</option></select><table><thead><tr>${['팀명','경기','승','패','무','최근10경기'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody><tr>${['LG','139','75','63','1','2승0무8패'].map(x=>`<td>${x}</td>`).join('')}</tr></tbody></table>`;
test('KBO official recent-ten parsing validates season and column names, and does not accept five games as ten',()=>{
 const html=kboHtml();const source=parseKboRecentForm(html,2026).get('LG');
 assert.deepEqual(source.recentForm,{played:10,wins:2,ties:0,losses:8,otLosses:0});
 assert.throws(()=>parseKboRecentForm(html,2025));
 assert.throws(()=>parseKboRecentForm(html.replace('value="0"','value="1"'),2026));
 assert.equal(parseKboRecentForm(html.replace('2승0무8패','2승0무3패'),2026).get('LG').recentForm,null);
});

test('KBO recent records are attached only to the same team and matching standings snapshot',async()=>{
 const row={team:{id:'LG'},stats:{played:139,wins:75,losses:63,ties:1},recentForm:null};
 const result={season:{year:2026},groups:[{rows:[row]}]};
 await addKboRecentForm(result,async()=>new Response(kboHtml()),Date.now()+1000);
 assert.equal(row.recentForm.losses,8);
 row.stats.played=140;row.stats.losses=64;row.recentForm=null;
 await addKboRecentForm(result,async()=>new Response(kboHtml()),Date.now()+1000);
 assert.equal(row.recentForm,null);
});
