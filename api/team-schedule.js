import {LEAGUES} from '../sports.mjs';
import {validMonth,validTeamId,getTeamSchedule} from '../team-schedule.mjs';
export async function handler(request,fetcher=fetch){
 if(request.method!=='GET')return Response.json({error:'GET 요청만 지원합니다.'},{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
 const query=new URL(request.url).searchParams,league=LEAGUES.find(l=>l.id===query.get('league')),team=query.get('team'),month=query.get('month');
 if(!league||!validTeamId(league,team)||!validMonth(month))return Response.json({error:'리그, 팀 또는 월이 올바르지 않습니다.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{const data=await getTeamSchedule(league.id,team,month,fetcher);return Response.json(data,{headers:{'Cache-Control':data.failures.length?'no-store':'public, max-age=0, s-maxage=300','X-Content-Type-Options':'nosniff'}});}
 catch{return Response.json({error:'팀 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
export default {fetch:request=>handler(request)};
