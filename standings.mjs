import {LEAGUES,kstDate,safeUrl} from './sports.mjs';

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const stat=(stats,...names)=>{for(const name of names){const item=stats.find(s=>s.name===name);const value=finite(item?.value);if(value!==null)return value;}return null;};
const groupNames={'Eastern Conference':'동부 컨퍼런스','Western Conference':'서부 컨퍼런스','League Phase':'리그 페이즈','American League East':'아메리칸리그 동부','American League Central':'아메리칸리그 중부','American League West':'아메리칸리그 서부','National League East':'내셔널리그 동부','National League Central':'내셔널리그 중부','National League West':'내셔널리그 서부','AFC East':'AFC 동부','AFC North':'AFC 북부','AFC South':'AFC 남부','AFC West':'AFC 서부','NFC East':'NFC 동부','NFC North':'NFC 북부','NFC South':'NFC 남부','NFC West':'NFC 서부'};
export function standingsColumns(league){
 const labels={played:['경기','경기 수'],wins:['승','승리'],ties:['무','무승부'],losses:['패','패배'],pct:['승률','승률'],points:['승점','승점'],otLosses:['OT패','연장·슛아웃 패배']};
 const keys=league.sport==='soccer'?['played','wins','ties','losses','points']:league.sport==='hockey'?['wins','losses','otLosses','points']:league.id==='kbo'||league.sport==='football'?['wins','ties','losses','pct']:['wins','losses','pct'];
 return keys.map(key=>({key,label:labels[key][0],title:labels[key][1]}));
}
export function standingsTables(node){
 if(!node||typeof node!=='object')return [];
 const children=Array.isArray(node.children)?node.children.flatMap(standingsTables):[];
 if(children.length)return children;
 return Array.isArray(node.standings?.entries)?[node]:[];
}
export function parseEspnStandings(data,league){
 const tables=standingsTables(data);
 if(!tables.length)throw new Error('순위 응답 형식 오류');
 const years=[...new Set(tables.map(t=>finite(t.standings.season)).filter(y=>y!==null))];
 if(years.length!==1)throw new Error('순위 시즌 정보 오류');
 const year=years[0],metadata=data.seasons?.find(s=>s.year===year)||(data.season?.year===year?data.season:null);
 const types=[...new Set(tables.map(t=>Number(t.standings.seasonType)))];
 const expectedType=league.sport==='soccer'?1:2;
 if(types.some(t=>t!==expectedType))throw new Error('정규시즌 순위가 아닙니다.');
 const divisions=['mlb','nfl'].includes(league.id);
 const groups=tables.map((table,index)=>{
  const rows=table.standings.entries.map(entry=>{
   if(!entry.team?.id||!entry.team.displayName||!Array.isArray(entry.stats))throw new Error('팀 순위 형식 오류');
   const s=entry.stats,wins=stat(s,'wins'),losses=stat(s,'losses'),ties=stat(s,'ties'),otLosses=stat(s,'otLosses','overtimeLosses');
   const played=stat(s,'gamesPlayed')??(wins!==null&&losses!==null?wins+losses+(ties||0)+(league.sport==='hockey'?(otLosses||0):0):null);
   const rank=stat(s,'rank','playoffSeed');
   return {rank:played===0||rank===null||rank<1?null:rank,team:{id:String(entry.team.id),name:String(entry.team.displayName),shortName:String(entry.team.shortDisplayName||entry.team.displayName),abbreviation:String(entry.team.abbreviation||''),logo:safeUrl(entry.team.logos?.[0]?.href,['a.espncdn.com'])},stats:{played,wins,losses,ties,pct:stat(s,'winPercent'),points:stat(s,'points'),otLosses}};
  });
  rows.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
  // A conference seed establishes order within each division, not its rank number.
  if(divisions&&rows.length&&rows.every(r=>r.rank!==null))rows.forEach((row,i)=>row.rank=i+1);
  const rawName=String(table.name||'');
  return {id:String(table.id||index),name:groupNames[rawName]||(league.sport==='soccer'&&tables.length===1?league.name:rawName||league.name),rows};
 });
 const display=String(metadata?.seasonYears||metadata?.displayName||year),seasonLabel=display.match(/20\d\d(?:[-/]\d{2,4})?/)?.[0]||String(year);
 return {season:{year,label:seasonLabel,type:league.id==='uefa.champions'?'리그 페이즈':'정규시즌'},groups,notStarted:groups.every(g=>g.rows.every(r=>r.stats.played===0)),source:'ESPN',sourceUrl:league.sport==='soccer'?`https://www.espn.com/soccer/standings/_/league/${league.id}`:`https://www.espn.com/${league.id}/standings`};
}
export function parseKboStandings(data,year){
 const teams=data?.result?.seasonTeamStats;
 if(data?.success!==true||data.code!==200||!Array.isArray(teams)||data.result.gameType!=='REGULAR_SEASON')throw new Error('KBO 순위 응답 형식 오류');
 const rows=teams.map(t=>{
  if(t.categoryId!=='kbo'||Number(t.seasonId)!==year||!t.teamId||!t.teamName)throw new Error('KBO 순위 시즌 정보 오류');
  const played=finite(t.gameCount),rank=finite(t.ranking);
  return {rank:played===0||rank===null||rank<1?null:rank,team:{id:String(t.teamId),name:String(t.keyword||t.teamName),shortName:String(t.teamShortName||t.teamName),abbreviation:String(t.teamShortName||t.teamName),logo:safeUrl(t.teamImageUrl,['sports-phinf.pstatic.net'])},stats:{played,wins:finite(t.winGameCount),ties:finite(t.drawnGameCount),losses:finite(t.loseGameCount),pct:finite(t.wra)}};
 });
 rows.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
 return {season:{year,label:String(year),type:'정규시즌'},groups:[{id:'kbo',name:'KBO 리그',rows}],notStarted:rows.every(r=>r.stats.played===0),source:'네이버 스포츠',sourceUrl:'https://m.sports.naver.com/kbaseball/record/index?category=kbo'};
}
export async function getStandings(leagueId,fetcher=fetch,now=new Date()){
 const league=LEAGUES.find(l=>l.id===leagueId);if(!league)throw new Error('INVALID_LEAGUE');
 let result;
 if(leagueId==='kbo'){
  const year=Number(kstDate(now).slice(0,4));
  const response=await fetcher(`https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${year}/teams`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw new Error(`UPSTREAM_${response.status}`);
  result=parseKboStandings(await response.json(),year);
 }else{
  const url=new URL(`https://site.web.api.espn.com/apis/v2/sports/${league.sport}/${league.id}/standings`);
  url.searchParams.set('seasontype',league.sport==='soccer'?'1':'2');
  url.searchParams.set('level',['mlb','nfl'].includes(leagueId)?'3':'2');
  const response=await fetcher(url.href,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw new Error(`UPSTREAM_${response.status}`);
  result=parseEspnStandings(await response.json(),league);
 }
 return {league:league.id,sport:league.sport,...result,columns:standingsColumns(league),fetchedAt:new Date(now).toISOString()};
}
