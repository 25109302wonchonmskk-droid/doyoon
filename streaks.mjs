const integer=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const bounded=(count,played)=>integer(count)&&(!integer(played)||count<=played)?count:null;

export function espnLosingStreak(stats,played){
 if(played===0)return 0;
 const streak=stats.find(s=>s.name==='streak');
 if(!streak)return null;
 const label=String(streak.displayValue??'').trim().match(/^([WLTD])\s*(\d+)$/i);
 if(label)return bounded(label[1].toUpperCase()==='L'?Number(label[2]):0,played);
 if(typeof streak.value!=='number'||!Number.isSafeInteger(streak.value))return null;
 return bounded(Math.max(0,-streak.value),played);
}

export function kboLosingStreak(value,played){
 if(played===0)return 0;
 const label=String(value??'').trim().match(/^(\d+)\s*(?:연)?([승패무])$/);
 return label?bounded(label[2]==='패'?Number(label[1]):0,played):null;
}

// Require the complete, matching league-season record. A missing game must not
// turn three losses separated by a draw or win into a losing streak.
export function espnSeasonResults(data,row,league,year,now=new Date()){
 if(String(data?.team?.id)!==row.team.id||Number(data.requestedSeason?.year??data.season?.year)!==year||!Array.isArray(data.events))return null;
 const soccer=league.sport==='soccer'||league.id.includes('.');
 const record={...row.stats,ties:row.stats.ties??(soccer||league.sport==='football'?null:0),otLosses:league.sport==='hockey'?row.stats.otLosses:0};
 if(!['played','wins','ties','losses','otLosses'].every(k=>integer(record[k])))return null;
 const games=new Map();
 for(const event of data.events){
  const competition=event.competitions?.[0],status=competition?.status?.type??event.status?.type;
  if(!status?.completed||status.state!=='post'||/CANCEL|POSTPON|SUSPEND|ABANDON/i.test(status.name||''))continue;
  if(Number(event.season?.year)!==year)continue;
  if(soccer?event.league?.slug!==league.id:Number(event.seasonType?.type??event.seasonType?.id)!==2)continue;
  const date=Date.parse(competition.date||event.date),competitors=competition.competitors;
  if(!event.id||!Number.isFinite(date)||date>Number(now)||!Array.isArray(competitors)||competitors.length!==2)return null;
  const own=competitors.find(c=>String(c.team?.id)===row.team.id),other=competitors.find(c=>String(c.team?.id)!==row.team.id);
  if(!own||!other)return null;
  const score=c=>{const raw=typeof c.score==='object'?c.score?.value:c.score;return raw===null||raw===undefined||raw===''?null:Number(raw);};
  const a=score(own),b=score(other);
  if(!integer(a)||!integer(b))return null;
  if(league.sport==='hockey'&&a<b&&!integer(competition.status?.period))return null;
  const result=a<b?(league.sport==='hockey'&&competition.status.period>3?'O':'L'):a>b?'W':'D';
  const previous=games.get(String(event.id));
  if(previous&&(previous.result!==result||previous.date!==date))return null;
  games.set(String(event.id),{date,result});
 }
 const sorted=[...games.values()].sort((a,b)=>b.date-a.date);
 if(sorted.length!==record.played||sorted.filter(g=>g.result==='W').length!==record.wins||sorted.filter(g=>g.result==='D').length!==record.ties||sorted.filter(g=>g.result==='L').length!==record.losses||sorted.filter(g=>g.result==='O').length!==record.otLosses)return null;
 return sorted;
}

export function soccerLosingStreak(data,row,league,year,now=new Date()){
 const games=espnSeasonResults(data,row,league,year,now);
 if(!games)return null;
 let count=0;for(const game of games){if(game.result!=='L')break;count++;}
 return count;
}

export async function addSoccerStreaks(result,league,fetcher,now,deadline=Date.now()+16000){
 const rows=result.groups.flatMap(g=>g.rows);
 // Teams with fewer than three season losses cannot receive a badge.
 const candidates=rows.filter(row=>row.losingStreak===null&&(row.stats.losses===null||row.stats.losses>=3));
 await Promise.all(candidates.map(async row=>{
  try{
   const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/teams/${encodeURIComponent(row.team.id)}/schedule?season=${result.season.year}`;
   const remaining=Math.max(1,Math.min(16000,deadline-Date.now()));
   const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(remaining)});
   if(response.ok)row.losingStreak=soccerLosingStreak(await response.json(),row,league,result.season.year,now);
  }catch{/* Keep the standings available when an optional streak request fails. */}
 }));
}
