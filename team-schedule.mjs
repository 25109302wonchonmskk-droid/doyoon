import {LEAGUES,kstDate,validDate,shiftDate,normalizeEvent,matchKey,safeUrl} from './sports.mjs';
import {normalizeKboGame} from './kbo.mjs';

export function validMonth(month){return typeof month==='string'&&/^\d{4}-\d{2}$/.test(month)&&validDate(month+'-01');}
export function monthBounds(month){
 if(!validMonth(month))throw new Error('INVALID_MONTH');
 const start=month+'-01',next=new Date(start+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 return {start,end:shiftDate(next.toISOString().slice(0,10),-1)};
}
export function calendarDays(month){
 const {start,end}=monthBounds(month),offset=new Date(start+'T12:00:00Z').getUTCDay();
 return [...Array(offset).fill(null),...Array.from({length:Number(end.slice(-2))},(_,i)=>shiftDate(start,i))];
}
export function validTeamId(league,id){return typeof id==='string'&&(league?.id==='kbo'?/^(LG|OB|HT|SS|HH|LT|NC|KT|SK|WO)$/.test(id):/^\d{1,12}$/.test(id));}
export function parseFavoriteTeams(raw){
 const result={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const [sport,value] of Object.entries(raw)){
  const league=LEAGUES.find(l=>l.id===value?.league&&l.sport===sport);
  if(!league||!validTeamId(league,value.id)||typeof value.name!=='string'||!value.name.trim())continue;
  result[sport]={id:value.id,name:value.name.slice(0,100),shortName:String(value.shortName||value.name).slice(0,100),abbreviation:String(value.abbreviation||'').slice(0,12),logo:safeUrl(value.logo,['a.espncdn.com','sports-phinf.pstatic.net']),sport,league:league.id};
 }
 return result;
}
export function matchesTeam(match,team){return !team||(match.sport===team.sport&&match.league===team.league&&(match.home.id===team.id||match.away.id===team.id));}
export function scheduleSeason(league,month){
 const [year,m]=month.split('-').map(Number);
 if(league.sport==='soccer')return m>=7?year:year-1;
 if(league.id==='nba'||league.id==='nhl')return m>=7?year+1:year;
 if(league.id==='nfl')return m>=3?year:year-1;
 return year;
}
export function parseTeamSchedule(data,league,teamId,month,season,type){
 if(!Array.isArray(data?.events)||String(data.team?.id)!==teamId||Number(data.requestedSeason?.year??data.season?.year)!==season)throw new Error('팀 일정 응답 오류');
 // ESPN explicitly returns an empty success without requestedSeason for a
 // phase that has no published fixtures yet (for example next spring's playoffs).
 if(data.events.length===0&&data.status==='success'&&!data.requestedSeason)return [];
 if(league.sport!=='soccer'&&Number(data.requestedSeason?.type??data.season?.type)!==type)throw new Error('팀 일정 시즌 구분 오류');
 const matches=[];
 for(const event of data.events){
  if(Number(event.season?.year)!==season)continue;
  if(league.sport==='soccer'&&event.league?.slug!==league.id)continue;
  if(league.sport!=='soccer'&&event.seasonType&&Number(event.seasonType.type??event.seasonType.id)!==type)continue;
  const competition=event.competitions?.[0];if(!competition)throw new Error('경기 정보 누락');
  const fixed={...event,competitions:[{...competition,competitors:competition.competitors?.map(c=>({...c,team:{...c.team,logo:c.team?.logo||c.team?.logos?.[0]?.href}}))}]};
  const match=normalizeEvent(fixed,league);
  if(!match)throw new Error('경기 정보 형식 오류');
  if(!matchesTeam(match,{sport:league.sport,league:league.id,id:teamId}))throw new Error('팀 일정 불일치');
  if(kstDate(match.date).slice(0,7)!==month)continue;
  match.timeTbd=event.timeValid===false||competition.timeValid===false;
  match.seasonType=league.sport==='soccer'?'regular':type===1?'preseason':type===3?'postseason':'regular';
  matches.push(match);
 }
 return matches;
}
export function parseKboMonth(data,teamId,month){
 if(data?.success!==true||data.code!==200||!Array.isArray(data.result?.games)||!Number.isInteger(data.result.gameTotalCount)||data.result.gameTotalCount!==data.result.games.length)throw new Error('KBO 일정 누락');
 return data.result.games.filter(g=>g.categoryId==='kbo'&&g.gameDate?.slice(0,7)===month&&(g.homeTeamCode===teamId||g.awayTeamCode===teamId)).map(g=>normalizeKboGame(g,g.gameDate));
}
export async function getTeamSchedule(leagueId,teamId,month,fetcher=fetch){
 const league=LEAGUES.find(l=>l.id===leagueId);
 if(!league||!validTeamId(league,teamId)||!validMonth(month))throw new Error('INVALID_QUERY');
 const {start,end}=monthBounds(month),requests=[];
 if(league.id==='kbo'){
  const url=new URL('https://api-gw.sports.naver.com/schedule/games');
  url.search=new URLSearchParams({fields:'basic,stadium,timeTbd,roundCode,title,seriesGameNo',upperCategoryId:'kbaseball',categoryId:'kbo',fromDate:start,toDate:end,size:'500'}).toString();
  requests.push({url:url.href,label:'KBO 일정',parse:d=>parseKboMonth(d,teamId,month)});
 }else{
  const season=scheduleSeason(league,month),base=`https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.id}/teams/${teamId}/schedule`;
  const types=league.sport==='soccer'?[false,true]:[1,2,3];
  for(const type of types){
   const url=new URL(base);url.searchParams.set('season',season);
   if(league.sport==='soccer')url.searchParams.set('fixture',String(type));else url.searchParams.set('seasontype',type);
   requests.push({url:url.href,label:league.sport==='soccer'?(type?'예정 경기':'경기 결과'):{1:'프리시즌',2:'정규시즌',3:'포스트시즌'}[type],parse:d=>parseTeamSchedule(d,league,teamId,month,season,type)});
  }
 }
 const responses=await Promise.allSettled(requests.map(async request=>{const response=await fetcher(request.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error('UPSTREAM_'+response.status);return request.parse(await response.json());}));
 const failures=[],matches=new Map();let loaded=0;
 responses.forEach((response,i)=>{if(response.status==='rejected'){failures.push(requests[i].label);return;}loaded++;for(const m of response.value){const key=matchKey(m),previous=matches.get(key);if(previous&&['finished','live'].includes(previous.status.state)&&m.status.state==='scheduled')continue;matches.set(key,m);}});
 if(!loaded)throw new Error('일정 데이터에 연결하지 못했습니다.');
 return {sport:league.sport,league:league.id,teamId,month,timeZone:'Asia/Seoul',matches:[...matches.values()].sort((a,b)=>a.date.localeCompare(b.date)),failures,source:league.id==='kbo'?'네이버 스포츠':'ESPN',fetchedAt:new Date().toISOString()};
}
