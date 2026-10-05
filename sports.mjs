export const SOCCER_LEAGUES = [
 {id:'eng.1',name:'프리미어리그',english:'Premier League',country:'잉글랜드',code:'PL',color:'#6b4096'},
 {id:'esp.1',name:'라리가',english:'LaLiga',country:'스페인',code:'LL',color:'#df655c'},
 {id:'ger.1',name:'분데스리가',english:'Bundesliga',country:'독일',code:'BL',color:'#ce4b52'},
 {id:'ita.1',name:'세리에 A',english:'Serie A',country:'이탈리아',code:'SA',color:'#5681c8'},
 {id:'fra.1',name:'리그 1',english:'Ligue 1',country:'프랑스',code:'L1',color:'#647d5d'},
 {id:'uefa.champions',name:'챔피언스리그',english:'Champions League',country:'유럽',code:'CL',color:'#4657a2'}
].map(league=>({...league,sport:"soccer"}));
export const SPORTS = [
 {id:'soccer',name:'축구',icon:'ball',summary:'유럽 주요 6개 리그',guide:'경과 시간을 분 단위로 표시합니다.'},
 {id:'basketball',name:'농구',icon:'basketball',summary:'NBA · WNBA',guide:'쿼터와 남은 시간, 연장전을 표시합니다.'},
 {id:'baseball',name:'야구',icon:'baseball',summary:'MLB',guide:'이닝과 초·말을 표시합니다.'},
 {id:'football',name:'미식축구',icon:'football',summary:'NFL',guide:'쿼터와 남은 시간을 표시합니다.'},
 {id:'hockey',name:'아이스하키',icon:'hockey',summary:'NHL',guide:'피리어드와 남은 시간, 연장전을 표시합니다.'}
];
export const LEAGUES = [...SOCCER_LEAGUES,
 {id:'nba',sport:'basketball',name:'NBA',english:'NBA',country:'미국·캐나다',code:'NBA',color:'#4778bb'},
 {id:'wnba',sport:'basketball',name:'WNBA',english:'WNBA',country:'미국·캐나다',code:'WN',color:'#d27939'},
 {id:'mlb',sport:'baseball',name:'MLB',english:'MLB',country:'미국·캐나다',code:'MLB',color:'#526992'},
 {id:'nfl',sport:'football',name:'NFL',english:'NFL',country:'미국',code:'NFL',color:'#b64e54'},
 {id:'nhl',sport:'hockey',name:'NHL',english:'NHL',country:'미국·캐나다',code:'NHL',color:'#638a9a'}
];
export const leaguesForSport = sport=>LEAGUES.filter(l=>l.sport===sport);
export const matchKey = match=>`${match.sport||'soccer'}:${match.id}`;
export function parseFavorites(raw){const entries={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return entries;for(const [key,value] of Object.entries(raw).slice(0,1000)){const full=/^\d+$/.test(key)?`soccer:${key}`:key;const [sport,id]=full.split(':');if(SPORTS.some(s=>s.id===sport)&&/^\d+$/.test(id||'')&&full===`${sport}:${id}`&&validDate(value?.date))entries[full]={date:value.date,sport};}return entries;}
export function kstDate(value=Date.now()) {const d=new Date(new Date(value).getTime()+9*3600000);return Number.isFinite(+d)?d.toISOString().slice(0,10):'';}
export function validDate(value){return typeof value==='string'&&/^(20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(+new Date(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;}
export function shiftDate(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function queryDates(date){return [shiftDate(date,-1),date].map(d=>d.replaceAll('-',''));}
export function safeUrl(value,hosts){try{const u=new URL(value);return u.protocol==='https:'&&hosts.includes(u.hostname)?u.href:'';}catch{return '';}}
export function scoreValue(value){if(value===null||value===undefined||value==='')return null;const n=Number(typeof value==='object'?value.value??value.displayValue:value);return Number.isInteger(n)&&n>=0&&n<=999?n:null;}
export function periodLabel(sport,period){if(!Number.isInteger(period)||period<1)return '';if(sport==='baseball')return `${period}회`;if(sport==='hockey')return period<=3?`${period}P`:period===4?'OT':`${period-3}OT`;if(sport==='basketball'||sport==='football')return period<=4?`${period}Q`:period===5?'OT':`${period-4}OT`;return '';}
export function matchStatus(status={},sport='soccer'){
 const type=status.type||{},name=type.name||'',period=Number(status.period)||0,detail=String(type.shortDetail||type.detail||'');
 const special={STATUS_POSTPONED:'연기',STATUS_CANCELED:'취소',STATUS_CANCELLED:'취소',STATUS_SUSPENDED:'중단',STATUS_ABANDONED:'중단',STATUS_DELAYED:'지연'};
 const state=(state,label,phase='',clock='',finished=false)=>({state,label,phase,clock,finished});
 if(special[name])return state('other',special[name]);
 if(type.completed||type.state==='post'){
  let label='경기 종료';
  if(sport==='soccer'&&/PEN/.test(name))label='승부차기 종료';
  else if(sport==='hockey'&&(/SHOOTOUT|FINAL_SO/.test(name)||/\bSO\b/i.test(detail)))label='슛아웃 종료';
  else if(/EXTRA|OVERTIME/.test(name)||/\b\d?OT\b/.test(detail)||(sport==='baseball'&&period>9)||(sport==='hockey'&&period>3)||(['basketball','football'].includes(sport)&&period>4))label='연장 종료';
  return state('finished',label,'','',true);
 }
 if(type.state==='in'){
  if(name==='STATUS_HALFTIME')return state('live','하프타임','HT');
  if(sport==='baseball'){
   let phase=period?`${period}회`:'';
   const description=`${name} ${type.detail||''} ${detail}`;
   if(/TOP/i.test(description))phase+='초';else if(/BOTTOM|BOT\b/i.test(description))phase+='말';else if(/MIDDLE|MID\b/i.test(description))phase+=' 공수교대';else if(/END/i.test(description))phase+=' 종료';
   return state('live',phase||detail||'진행 중',phase||'LIVE');
  }
  if(sport!=='soccer'){
   if(/SHOOTOUT/.test(name))return state('live','슛아웃','SO');
   let phase=periodLabel(sport,period),clock=String(status.displayClock||'');
   if(/END_PERIOD|END_OF|INTERMISSION/.test(name)){phase=`${phase} 종료`.trim();clock='';}
   return state('live',phase||'진행 중',phase||'LIVE',clock);
  }
  return state('live',/EXTRA/.test(name)?'연장전':/PENALT/.test(name)?'승부차기':'진행 중','',String(status.displayClock||''));
 }
 if(type.state==='pre')return state('scheduled','경기 예정');
 return state('other',type.description||'상태 확인 중');
}
function normalizeTeam(c,status,sport){const t=c.team||{},played=['live','finished'].includes(status.state);
 const segments=played?(c.linescores||[]).map((s,i)=>({period:Number(s.period)||i+1,value:String(s.displayValue??s.value??'–').slice(0,8)})).filter(s=>Number.isInteger(s.period)&&s.period>0&&s.period<=50):[];
 return {id:String(t.id||c.id||''),name:String(t.displayName||t.name||'팀 미정'),shortName:String(t.shortDisplayName||t.displayName||'팀 미정'),abbreviation:String(t.abbreviation||''),logo:safeUrl(t.logo,['a.espncdn.com']),score:played?scoreValue(c.score):null,penalties:played&&sport==='soccer'?scoreValue(c.shootoutScore):null,winner:status.finished&&c.winner===true,segments};
}
export function normalizeEvent(event,league){const c=event.competitions?.[0];if(!c||!event.id||!Number.isFinite(+new Date(event.date)))return null;const competitors=c.competitors||[],home=competitors.find(t=>t.homeAway==='home'),away=competitors.find(t=>t.homeAway==='away');if(!home||!away)return null;const sport=league.sport||'soccer',status=matchStatus(c.status||event.status,sport);
 return {id:String(event.id),sport,league:league.id,date:new Date(event.date).toISOString(),status,home:normalizeTeam(home,status,sport),away:normalizeTeam(away,status,sport),venue:String(c.venue?.fullName||c.venue?.displayName||event.venue?.displayName||''),note:(c.notes||[]).map(n=>n.headline||n.text||'').filter(Boolean).join(' · ').slice(0,500),seasonType:String(event.season?.slug||''),detailUrl:safeUrl(event.links?.find(l=>l.rel?.includes('summary'))?.href||event.links?.[0]?.href,['www.espn.com','www.espn.co.uk','www.espn.in'])};
}
export function parseLeague(data,league,date){if(!data||!Array.isArray(data.events)||!Array.isArray(data.leagues)||!data.leagues.length)throw new Error('경기 응답 형식 오류');const matches=data.events.map(e=>normalizeEvent(e,league)).filter(m=>m&&kstDate(m.date)===date);const calendar=data.leagues[0].calendar||[];const dates=calendar.filter(d=>typeof d==='string'&&Number.isFinite(+new Date(d))).map(d=>kstDate(d));return {matches,dates};}
