import {LEAGUES} from '../sports.mjs';
import {getStandings} from '../standings.mjs';
export async function handler(request,fetcher=fetch){
 if(request.method!=='GET')return Response.json({error:'GET 요청만 지원합니다.'},{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
 const league=new URL(request.url).searchParams.get('league');
 if(!LEAGUES.some(l=>l.id===league))return Response.json({error:'리그가 올바르지 않습니다.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await getStandings(league,fetcher),{headers:{'Cache-Control':'public, max-age=0, s-maxage=300','X-Content-Type-Options':'nosniff'}});}
 catch{return Response.json({error:'순위 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
export default {fetch:request=>handler(request)};
