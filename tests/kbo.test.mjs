import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKbo,normalizeKboGame,kboStatus,fetchKbo} from '../kbo.mjs';
import {parseFavorites,matchKey} from '../sports.mjs';
import {handler,getScores} from '../api/scores.js';

// Minimal fixture based on the public Naver schedule response shape.
const game=()=>({gameId:'20261005HTLG02026',categoryId:'kbo',gameDate:'2026-10-05',gameDateTime:'2026-10-05T14:00:00',timeTbd:false,stadium:'잠실',homeTeamCode:'LG',homeTeamName:'LG',homeTeamScore:4,awayTeamCode:'HT',awayTeamName:'KIA',awayTeamScore:3,statusCode:'STARTED',statusInfo:'9회초',cancel:false,suspended:false,winner:'DRAW',homeTeamEmblemUrl:'https://sports-phinf.pstatic.net/team/kbo/default/LG.png'});
const response=(games=[game()])=>({code:200,success:true,result:{games,gameTotalCount:games.length}});

test('KBO local time, home and away, scores and live inning are preserved',()=>{
 const m=normalizeKboGame(game(),'2026-10-05');
 assert.equal(m.date,'2026-10-05T05:00:00.000Z');assert.equal(m.home.name,'LG 트윈스');assert.equal(m.away.name,'KIA 타이거즈');assert.equal(m.home.score,4);assert.equal(m.away.score,3);assert.equal(m.status.phase,'9회초');assert.equal(m.status.clock,'');assert.equal(m.home.winner,false);assert.equal(m.venue,'잠실');assert.equal(m.source,'네이버 스포츠');
});
test('KBO cancelled, suspended and future games do not show zero placeholders',()=>{
 for(const changes of [{cancel:true,statusInfo:'경기취소'},{suspended:true},{statusCode:'BEFORE',statusInfo:'경기전'}]){const m=normalizeKboGame({...game(),...changes},'2026-10-05');assert.equal(m.home.score,null);assert.equal(m.away.score,null);assert.notEqual(m.status.state,'finished');}
 assert.equal(kboStatus({...game(),cancel:true}).label,'취소');assert.equal(kboStatus({...game(),suspended:true}).label,'중단');assert.equal(kboStatus({...game(),statusCode:'BEFORE',statusInfo:'경기전'}).state,'scheduled');
});
test('KBO ended and confirmed results distinguish winners and draws',()=>{
 for(const statusCode of ['ENDED','RESULT']){const m=normalizeKboGame({...game(),statusCode,winner:'HOME'},'2026-10-05');assert.equal(m.status.state,'finished');assert.equal(m.home.winner,true);assert.equal(m.away.winner,false);}
 assert.equal(kboStatus({...game(),statusCode:'RESULT',winner:'DRAW'}).label,'무승부 종료');
});
test('KBO excludes other competitions and dates, and accepts a valid empty day',()=>{
 const data=response([game(),{...game(),categoryId:'agbaseball'},{...game(),gameDate:'2026-10-06'}]);assert.equal(parseKbo(data,'2026-10-05').matches.length,1);assert.deepEqual(parseKbo(response([]),'2026-10-05').matches,[]);
});
test('KBO malformed or incomplete upstream data is an error, not an empty day',()=>{
 for(const data of [{},response().result,{...response(),success:false},{...response(),result:{games:[],gameTotalCount:5}},response([{...game(),gameDateTime:'not-a-date'}])])assert.throws(()=>parseKbo(data,'2026-10-05'));
});
test('KBO favorites survive reload without colliding with existing MLB favorites',()=>{
 const m=normalizeKboGame(game(),'2026-10-05'),key=matchKey(m);const raw={[key]:{date:'2026-10-05',sport:'baseball'},'baseball:401123':{date:'2026-10-05'},'basketball:kbo-20261005HTLG02026':{date:'2026-10-05'}};const saved=parseFavorites(JSON.parse(JSON.stringify(raw)));assert.equal(saved[key].sport,'baseball');assert.ok(saved['baseball:401123']);assert.equal(Object.keys(saved).length,2);
});
test('KBO request uses the exact Korean date and rejects unsafe image or game IDs',async()=>{
 let url;const result=await fetchKbo('2026-10-05',async u=>{url=new URL(u);return Response.json(response());});assert.equal(url.searchParams.get('fromDate'),'2026-10-05');assert.equal(url.searchParams.get('toDate'),'2026-10-05');assert.equal(url.searchParams.get('categoryId'),'kbo');assert.equal(result.matches.length,1);assert.equal(normalizeKboGame({...game(),homeTeamEmblemUrl:'https://evil.test/logo'},'2026-10-05').home.logo,'');assert.throws(()=>normalizeKboGame({...game(),gameId:'<script>'},'2026-10-05'));
});
test('KBO failure leaves MLB available with a visible KBO failure',async()=>{
 const fetcher=async url=>{if(url.includes('naver.com'))throw new Error('upstream failure');return Response.json({leagues:[{calendar:[]}],events:[]});};const result=await getScores('2026-10-05','all',fetcher,'baseball');assert.deepEqual(result.loadedLeagues,['mlb']);assert.deepEqual(result.failures.map(f=>f.id),['kbo']);
 const r=await handler(new Request('https://test/api/scores?sport=baseball&league=kbo&date=2026-10-05'),fetcher);assert.equal(r.status,502);
});
test('KBO-only API fetches one source and returns provider attribution',async()=>{
 const urls=[];const r=await handler(new Request('https://test/api/scores?sport=baseball&league=kbo&date=2026-10-05'),async url=>{urls.push(url);return Response.json(response());});const data=await r.json();assert.equal(r.status,200);assert.equal(urls.length,1);assert.equal(data.source,'네이버 스포츠');assert.deepEqual(data.loadedLeagues,['kbo']);assert.equal(data.matches[0].league,'kbo');
});
