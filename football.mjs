export const LEAGUES = [
 {id:'eng.1',name:'프리미어리그',english:'Premier League',country:'잉글랜드',code:'PL',color:'#6b4096'},
 {id:'esp.1',name:'라리가',english:'LaLiga',country:'스페인',code:'LL',color:'#df655c'},
 {id:'ger.1',name:'분데스리가',english:'Bundesliga',country:'독일',code:'BL',color:'#ce4b52'},
 {id:'ita.1',name:'세리에 A',english:'Serie A',country:'이탈리아',code:'SA',color:'#5681c8'},
 {id:'fra.1',name:'리그 1',english:'Ligue 1',country:'프랑스',code:'L1',color:'#647d5d'},
 {id:'uefa.champions',name:'챔피언스리그',english:'Champions League',country:'유럽',code:'CL',color:'#4657a2'}
];
export function kstDate(value=Date.now()) {const d=new Date(new Date(value).getTime()+9*3600000);return Number.isFinite(+d)?d.toISOString().slice(0,10):'';}
export function validDate(value){return typeof value==='string'&&/^(20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(+new Date(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;}
export function shiftDate(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function queryDates(date){return [shiftDate(date,-1),date].map(d=>d.replaceAll('-',''));}
export function safeUrl(value,hosts){try{const u=new URL(value);return u.protocol==='https:'&&hosts.includes(u.hostname)?u.href:'';}catch{return '';}}
export function scoreValue(value){if(value===null||value===undefined||value==='')return null;const n=Number(typeof value==='object'?value.value??value.displayValue:value);return Number.isInteger(n)&&n>=0&&n<100?n:null;}
export function matchStatus(status={}){const type=status.type||{},name=type.name||'';const special={STATUS_POSTPONED:'연기',STATUS_CANCELED:'취소',STATUS_CANCELLED:'취소',STATUS_SUSPENDED:'중단',STATUS_ABANDONED:'중단',STATUS_DELAYED:'지연'};
 if(special[name])return {state:'other',label:special[name],clock:'',finished:false};
 if(type.completed||type.state==='post')return {state:'finished',label:/PEN/.test(name)?'승부차기 종료':/EXTRA/.test(name)?'연장 종료':'경기 종료',clock:'',finished:true};
 if(type.state==='in')return {state:'live',label:name==='STATUS_HALFTIME'?'하프타임':/EXTRA/.test(name)?'연장전':/PENALT/.test(name)?'승부차기':'진행 중',clock:String(status.displayClock||''),finished:false};
 if(type.state==='pre')return {state:'scheduled',label:'경기 예정',clock:'',finished:false};
 return {state:'other',label:type.description||'상태 확인 중',clock:'',finished:false};
}
function normalizeTeam(c,status){const t=c.team||{};const played=status.state==='live'||status.state==='finished';return {id:String(t.id||c.id||''),name:String(t.displayName||t.name||'팀 미정'),shortName:String(t.shortDisplayName||t.displayName||'팀 미정'),abbreviation:String(t.abbreviation||''),logo:safeUrl(t.logo,['a.espncdn.com']),score:played?scoreValue(c.score):null,penalties:played?scoreValue(c.shootoutScore):null,winner:status.finished&&c.winner===true};}
export function normalizeEvent(event,league){const c=event.competitions?.[0];if(!c||!event.id||!Number.isFinite(+new Date(event.date)))return null;const competitors=c.competitors||[],home=competitors.find(t=>t.homeAway==='home'),away=competitors.find(t=>t.homeAway==='away');if(!home||!away)return null;const status=matchStatus(c.status||event.status);
 return {id:String(event.id),league:league.id,date:new Date(event.date).toISOString(),status,home:normalizeTeam(home,status),away:normalizeTeam(away,status),venue:String(c.venue?.fullName||c.venue?.displayName||event.venue?.displayName||''),note:(c.notes||[]).map(n=>n.headline||n.text||'').filter(Boolean).join(' · ').slice(0,500),detailUrl:safeUrl(event.links?.find(l=>l.rel?.includes('summary'))?.href||event.links?.[0]?.href,['www.espn.com','www.espn.co.uk','www.espn.in'])};
}
export function parseLeague(data,league,date){if(!data||!Array.isArray(data.events)||!Array.isArray(data.leagues)||!data.leagues.length)throw new Error('경기 응답 형식 오류');const matches=data.events.map(e=>normalizeEvent(e,league)).filter(m=>m&&kstDate(m.date)===date);const calendar=data.leagues[0].calendar||[];const dates=calendar.filter(d=>typeof d==='string'&&Number.isFinite(+new Date(d))).map(d=>kstDate(d));return {matches,dates};}
