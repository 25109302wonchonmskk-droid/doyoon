import {kstDate,validDate,scoreValue,safeUrl} from './sports.mjs';

const TEAM_NAMES={LG:'LG 트윈스',OB:'두산 베어스',HT:'KIA 타이거즈',SS:'삼성 라이온즈',HH:'한화 이글스',LT:'롯데 자이언츠',NC:'NC 다이노스',KT:'KT 위즈',SK:'SSG 랜더스',WO:'키움 히어로즈'};
const state=(state,label,phase='',finished=false)=>({state,label,phase,clock:'',finished});
export function kboStatus(game){
 const info=String(game.statusInfo||'').slice(0,40),code=game.statusCode;
 if(game.cancel===true||/CANCEL|POSTPONE/.test(code)||/취소|연기/.test(info))return state('other',/연기|POSTPONE/.test(info+' '+code)?'연기':'취소');
 if(game.suspended===true||/SUSPEND/.test(code)||/중단|서스펜디드/.test(info))return state('other','중단');
 if(/DELAY/.test(code)||/지연/.test(info))return state('other','지연');
 if(code==='ENDED'||code==='RESULT')return state('finished',game.winner==='DRAW'?'무승부 종료':'경기 종료','',true);
 if(code==='STARTED')return state('live',info||'진행 중',info||'LIVE');
 if(code==='BEFORE'||code==='READY')return state('scheduled','경기 예정');
 return state('other','상태 확인 중');
}
export function normalizeKboGame(game,date){
 if(!game||game.categoryId!=='kbo'||game.gameDate!==date)return null;
 if(!/^[A-Z0-9]{8,32}$/.test(game.gameId||'')||!game.homeTeamName||!game.awayTeamName)throw new Error('KBO 경기 응답 형식 오류');
 // Naver's timezone-free gameDateTime is Korean local time, not UTC.
 const raw=String(game.gameDateTime||'');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(raw))throw new Error('KBO 경기 시각 형식 오류');
 const start=new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)?raw:raw+'+09:00');
 if(!Number.isFinite(+start)||kstDate(start)!==date)throw new Error('KBO 경기 날짜 불일치');
 const status=kboStatus(game),played=['live','finished'].includes(status.state);
 const team=side=>{const code=String(game[side+'TeamCode']||''),shortName=String(game[side+'TeamName']);return {id:code,name:TEAM_NAMES[code]||shortName,shortName,abbreviation:shortName,logo:safeUrl(game[side+'TeamEmblemUrl'],['sports-phinf.pstatic.net']),score:played?scoreValue(game[side+'TeamScore']):null,penalties:null,winner:status.finished&&game.winner===side.toUpperCase(),segments:[]};};
 return {id:'kbo-'+game.gameId,sport:'baseball',league:'kbo',source:'네이버 스포츠',date:start.toISOString(),timeTbd:game.timeTbd===true,status,home:team('home'),away:team('away'),venue:String(game.stadium||''),note:String(game.title||''),seasonType:'',detailUrl:`https://m.sports.naver.com/game/${game.gameId}/record`};
}
export function parseKbo(data,date){
 if(!validDate(date)||data?.success!==true||data.code!==200||!Array.isArray(data.result?.games))throw new Error('KBO 경기 응답 형식 오류');
 if(data.result.gameTotalCount>data.result.games.length)throw new Error('KBO 경기 목록 일부 누락');
 return {matches:data.result.games.map(g=>normalizeKboGame(g,date)).filter(Boolean),dates:[]};
}
export async function fetchKbo(date,fetcher=fetch){
 const url=new URL('https://api-gw.sports.naver.com/schedule/games');
 url.search=new URLSearchParams({fields:'basic,stadium,timeTbd,roundCode,title,seriesGameNo',upperCategoryId:'kbaseball',categoryId:'kbo',fromDate:date,toDate:date}).toString();
 const response=await fetcher(url.href,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw new Error(`KBO_UPSTREAM_${response.status}`);
 return parseKbo(await response.json(),date);
}
