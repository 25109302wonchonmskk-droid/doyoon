import {espnSeasonResults} from './streaks.mjs';

const integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const zero=()=>({played:0,wins:0,ties:0,losses:0,otLosses:0});
export function validRecentForm(record,season){
 if(!record||!['played','wins','ties','losses','otLosses'].every(k=>integer(record[k])))return null;
 if(!integer(season.played)||record.played!==Math.min(10,season.played)||record.wins+record.ties+record.losses+record.otLosses!==record.played)return null;
 if(['wins','ties','losses','otLosses'].some(k=>integer(season[k])&&record[k]>season[k]))return null;
 return record;
}
export function earlySeasonForm(stats,sport){
 if(stats.played===0)return zero();
 if(!integer(stats.played)||stats.played>10)return null;
 return validRecentForm({played:stats.played,wins:stats.wins,losses:stats.losses,ties:stats.ties??(['soccer','football'].includes(sport)?null:0),otLosses:sport==='hockey'?stats.otLosses:0},stats);
}
export function espnRecentForm(source,stats,sport){
 const early=earlySeasonForm(stats,sport);if(early)return early;
 const item=source.find(s=>s.type==='lasttengames'||s.name==='Last Ten Games');
 if(!item||sport==='soccer')return null;
 const parts=String(item.summary??item.displayValue??'').trim().match(/^(\d+)-(\d+)(?:-(\d+))?(?:,\s*\d+\s+PTS)?$/);
 if(!parts||(sport==='hockey'&&!parts[3]))return null;
 return validRecentForm({played:Number(parts[1])+Number(parts[2])+Number(parts[3]||0),wins:Number(parts[1]),losses:Number(parts[2]),ties:sport==='hockey'?0:Number(parts[3]||0),otLosses:sport==='hockey'?Number(parts[3]):0},stats);
}
export function recentFormFromGames(games){
 const result=zero();
 for(const game of games.slice(0,10)){result.played++;result[{W:'wins',D:'ties',L:'losses',O:'otLosses'}[game.result]]++;}
 return result;
}
export async function addEspnRecentForm(result,league,fetcher,now,deadline){
 const needsStreak=row=>league.sport==='soccer'&&row.losingStreak===null&&(row.stats.losses===null||row.stats.losses>=3);
 const candidates=result.groups.flatMap(g=>g.rows).filter(row=>!row.recentForm||needsStreak(row));
 await Promise.all(candidates.map(async row=>{
  try{
   const url=new URL(`https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.id}/teams/${encodeURIComponent(row.team.id)}/schedule`);
   url.searchParams.set('season',result.season.year);
   if(league.sport!=='soccer')url.searchParams.set('seasontype','2');
   const response=await fetcher(url.href,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(Math.max(1,Math.min(16000,deadline-Date.now())))});
   if(!response.ok)return;
   const games=espnSeasonResults(await response.json(),row,league,result.season.year,now);
   if(!games)return;
   row.recentForm=validRecentForm(recentFormFromGames(games),row.stats);
   if(league.sport==='soccer'){let count=0;for(const game of games){if(game.result!=='L')break;count++;}row.losingStreak=count;}
  }catch{/* An unavailable history must not remove the season standings. */}
 }));
}

export const KBO_RECENT_URL='https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx';
const kboIds={KT:'KT','삼성':'SS',KIA:'HT',LG:'LG','두산':'OB',SSG:'SK',NC:'NC','롯데':'LT','한화':'HH','키움':'WO'};
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,'').trim();
export function parseKboRecentForm(html,year){
 const selected=id=>{const select=[...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)].find(m=>new RegExp(`id=["'][^"']*${id}["']`,'i').test(m[0]));return select?.[0].match(/<option\b[^>]*selected[^>]*>[\s\S]*?<\/option>/i)?.[0].match(/value=["']([^"']+)["']/i)?.[1];};
 if(selected('ddlYear')!==String(year)||selected('ddlSeries')!=='0')throw new Error('KBO 최근 전적 시즌 불일치');
 const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
 const table=tables.find(m=>/최근\s*10\s*경기/.test(m[0]));
 if(!table)throw new Error('KBO 최근 전적 표 없음');
 const head=table[0].match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]||'';
 const columns=[...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>plain(m[1]));
 if(!['팀명','경기','승','패','무','최근10경기'].every(c=>columns.includes(c)))throw new Error('KBO 최근 전적 열 오류');
 const rows=new Map();
 for(const match of table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>plain(m[1]));
  if(!cells.length)continue;
  const cell=name=>cells[columns.indexOf(name)],id=kboIds[cell('팀명')];
  if(!id||rows.has(id))throw new Error('KBO 최근 전적 팀 오류');
  const number=name=>/^\d+$/.test(cell(name)||'')?Number(cell(name)):null;
  const stats={played:number('경기'),wins:number('승'),losses:number('패'),ties:number('무'),otLosses:0};
  const parts=cell('최근10경기')?.match(/^(\d+)승(\d+)무(\d+)패$/);
  const recentForm=parts?validRecentForm({played:Number(parts[1])+Number(parts[2])+Number(parts[3]),wins:Number(parts[1]),ties:Number(parts[2]),losses:Number(parts[3]),otLosses:0},stats):earlySeasonForm(stats,'baseball');
  rows.set(id,{stats,recentForm});
 }
 return rows;
}
export async function addKboRecentForm(result,fetcher,deadline){
 const rows=result.groups.flatMap(g=>g.rows);
 if(rows.every(row=>row.recentForm))return;
 result.recentFormSource={name:'KBO',url:KBO_RECENT_URL};
 try{
  const response=await fetcher(KBO_RECENT_URL,{signal:AbortSignal.timeout(Math.max(1,Math.min(16000,deadline-Date.now())))});
  if(!response.ok)return;
  const official=parseKboRecentForm(await response.text(),result.season.year);
  for(const row of rows){
   const source=official.get(row.team.id);
   // Do not combine snapshots from before and after a completed game.
   if(source&&['played','wins','ties','losses'].every(k=>source.stats[k]===row.stats[k]))row.recentForm=source.recentForm;
  }
 }catch{/* Display unavailable rather than an invented recent record. */}
}
