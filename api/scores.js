import {SPORTS,LEAGUES,leaguesForSport,matchKey,kstDate,validDate,queryDates,parseLeague} from '../sports.mjs';
export async function getScores(date,leagueId='all',fetcher=fetch,sport='soccer'){
 const available=leaguesForSport(sport);
 const leagues=leagueId==='all'?available:available.filter(l=>l.id===leagueId);
 if(!validDate(date)||!leagues.length)throw new Error('INVALID_QUERY');
 const results=await Promise.allSettled(leagues.map(async league=>{
  const days=await Promise.all(queryDates(date).map(async day=>{
   const url=`https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.id}/scoreboard?dates=${day}`;
   const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
   if(!response.ok)throw new Error(`UPSTREAM_${response.status}`);
   return parseLeague(await response.json(),league,date);
  }));
  return {matches:days.flatMap(d=>d.matches),dates:days.flatMap(d=>d.dates),league:league.id};
 }));
 const matches=[],failures=[],calendar=[],loaded=[];
 results.forEach((result,index)=>{if(result.status==='fulfilled'){matches.push(...result.value.matches);calendar.push(...result.value.dates);loaded.push(leagues[index].id);}else failures.push({id:leagues[index].id,name:leagues[index].name});});
 const ordered=[...new Map(matches.map(m=>[matchKey(m),m])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 const past=[...new Set(calendar.filter(d=>d<date))].sort(),future=[...new Set(calendar.filter(d=>d>date))].sort();
 return {date,sport,timeZone:'Asia/Seoul',source:'ESPN',fetchedAt:new Date().toISOString(),matches:ordered,loadedLeagues:loaded,failures,previousMatchDate:past.at(-1)||null,nextMatchDate:future[0]||null};
}
export async function handler(request,fetcher=fetch){
 if(request.method!=='GET')return Response.json({error:'GET 요청만 지원합니다.'},{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
 const url=new URL(request.url),date=url.searchParams.get('date')||kstDate(),league=url.searchParams.get('league')||'all',sport=url.searchParams.get('sport')||'soccer';
 if(!validDate(date)||!SPORTS.some(s=>s.id===sport)||!(league==='all'||LEAGUES.some(l=>l.id===league&&l.sport===sport)))return Response.json({error:'날짜, 종목 또는 리그가 올바르지 않습니다.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{const data=await getScores(date,league,fetcher,sport);const unavailable=data.loadedLeagues.length===0;
  return Response.json({...data,...(unavailable?{error:'경기 데이터 제공처에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'}:{})},{status:unavailable?502:200,headers:{'Cache-Control':unavailable||data.failures.length?'no-store':'public, max-age=0, s-maxage=15','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'경기 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
export default {fetch:request=>handler(request)};
