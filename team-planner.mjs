import {apiUrl} from './api-url.mjs';
import {SAVED_TEAMS_KEY,favoriteTeamKey,readSavedTeams,parseSavedTeams} from './favorite-teams.mjs';
import {LEAGUES,leaguesForSport,kstDate} from './sports.mjs';
import {parseFavoriteTeams,matchesTeam,validMonth,calendarDays} from './team-schedule.mjs';

export const TEAM_STORAGE_KEY='doyoon-score-favorite-teams';
export function readFavoriteTeams(){try{return parseFavoriteTeams(JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY)||'{}'));}catch{return {};}}
export function createTeamPlanner({getSport,getLeague,getDate,onLeagueChange,onTeamChange,onDateChange,onReloadTeams,onFavoritesChange,teamName,esc,time,initialPreferences=readFavoriteTeams()}){
 const $=s=>document.querySelector(s),rosters=new Map(),rosterErrors=new Map(),cache=new Map();
 let savedTeams=readSavedTeams(initialPreferences);
 let preferences=initialPreferences,key='',data=null,error='',loading=false,requestId=0,controller,savedAt=0;
 const selectedTeam=()=>{const team=preferences[getSport()];return team&&(getLeague()==='all'||getLeague()===team.league)?team:null;};
 const rosterLeague=()=>getLeague()==='all'?(selectedTeam()?.league||leaguesForSport(getSport())[0].id):getLeague();
 const month=()=>getDate().slice(0,7);
 function save(){try{localStorage.setItem(TEAM_STORAGE_KEY,JSON.stringify(preferences));}catch{$('#team-picker-status').textContent='팀은 선택했지만 브라우저에 저장하지 못했습니다.';}}
 function saveTeams(){try{localStorage.setItem(SAVED_TEAMS_KEY,JSON.stringify(savedTeams));}catch{$('#team-picker-status').textContent='브라우저에 즐겨찾기를 저장하지 못했습니다.';}}
 function renderSaved(){
  const teams=Object.values(savedTeams),active=selectedTeam();
  $('#saved-team-list').innerHTML=teams.length?teams.map(t=>`<button class="saved-team-chip ${active&&favoriteTeamKey(active)===favoriteTeamKey(t)?'selected':''}" data-saved-team="${esc(favoriteTeamKey(t))}" aria-pressed="${!!active&&favoriteTeamKey(active)===favoriteTeamKey(t)}"><span>★ ${esc(teamName(t))}</span><small>${esc(LEAGUES.find(l=>l.id===t.league).code)}</small></button>`).join(''):'<p class="saved-team-empty">좋아하는 팀을 선택하거나 순위표의 ☆을 눌러 추가하세요.</p>';
  $('#saved-team-count').textContent=String(teams.length);
 }
 function selectTeam(team){
  if(team){preferences[team.sport]=team;savedTeams[favoriteTeamKey(team)]=team;saveTeams();}
  else delete preferences[getSport()];
  save();onTeamChange(team);renderRoster();onFavoritesChange?.();return load();
 }
 function toggleFavorite(team){
  const clean=parseSavedTeams({team}),value=Object.values(clean)[0];if(!value)return;
  const id=favoriteTeamKey(value);
  if(savedTeams[id]){delete savedTeams[id];saveTeams();if(preferences[value.sport]&&favoriteTeamKey(preferences[value.sport])===id)delete preferences[value.sport];save();onTeamChange(selectedTeam());renderRoster();onFavoritesChange?.();return load();}
  return selectTeam(value);
 }
 function renderRoster(){
  renderSaved();
  const league=rosterLeague(),teams=rosters.get(league),favorite=selectedTeam();
  $('#favorite-team-league').innerHTML=leaguesForSport(getSport()).map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');$('#favorite-team-league').value=league;
  const available=[...(teams||[])];if(favorite&&!available.some(t=>t.id===favorite.id))available.unshift(favorite);
  $('#favorite-team').innerHTML='<option value="">전체 팀</option>'+available.map(t=>`<option value="${esc(t.id)}">${esc(teamName(t))}</option>`).join('');$('#favorite-team').value=favorite?.id||'';
  $('#favorite-team').disabled=!available.length;$('#clear-favorite-team').disabled=!favorite;
  $('#team-list-retry').hidden=!rosterErrors.has(league);
  $('#team-picker-status').textContent=rosterErrors.get(league)||(!teams?'팀 목록을 불러오는 중입니다.':favorite?`${teamName(favorite)} 일정 표시 중 · 즐겨찾기에 저장됨`:'좋아하는 팀을 선택하면 그 팀의 일정만 표시됩니다.');
 }
 function render(){
  const team=selectedTeam(),currentMonth=month(),[year,m]=currentMonth.split('-');
  $('#calendar-month').textContent=`${year}년 ${Number(m)}월`;
  const move=amount=>{const d=new Date(currentMonth+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+amount);return d.toISOString().slice(0,7);};
  $('#calendar-previous').disabled=!validMonth(move(-1));$('#calendar-next').disabled=!validMonth(move(1));
  $('#team-schedule-refresh').disabled=!team||loading;
  $('#team-calendar').setAttribute('aria-busy',String(loading));
  const counts=new Map();for(const match of data?.matches||[]){const day=kstDate(match.date);counts.set(day,(counts.get(day)||0)+1);}
  const incomplete=!!error||!!data?.failures?.length;
  $('#team-calendar-days').innerHTML=calendarDays(currentMonth).map(day=>{
   if(!day)return '<span class="calendar-blank" aria-hidden="true"></span>';
   const count=counts.get(day)||0,description=team?(loading?'확인 중':data?(count?`${count}경기`:incomplete?'확인 불가':'경기 없음'):'확인 불가'):'일정 보기';
   return `<button class="calendar-day ${day===getDate()?'selected':''} ${day===kstDate()?'today':''} ${count?'has-games':''}" data-plan-date="${day}" aria-label="${day} ${esc(description)}" aria-pressed="${day===getDate()}"><span>${Number(day.slice(-2))}</span><small>${team?(loading?'…':count?`${count}경기`:incomplete?'–':''):day===kstDate()?'오늘':''}</small></button>`;
  }).join('');
  $('#team-calendar-note').textContent=team?`${teamName(team)} · ${LEAGUES.find(l=>l.id===team.league).name} · 한국 시간`:'날짜를 누르면 해당 날짜의 경기 일정과 결과가 표시됩니다.';
  $('#team-agenda').hidden=!team;
  if(!team)return;
  $('#team-agenda-title').textContent=`${teamName(team)} · ${Number(m)}월 일정`;
  $('#team-schedule-notice').hidden=!error&&!data?.failures?.length;
  $('#team-schedule-notice').textContent=error?(data?'새로고침에 실패해 이전 일정을 표시합니다. ':'')+error:data?.failures?.length?`${data.failures.join(', ')}을 불러오지 못해 일부 일정만 표시합니다.`:'';
  if(!data){$('#team-agenda-list').innerHTML=`<p class="planner-empty">${loading?'팀 일정을 불러오는 중입니다.':'일정을 불러오지 못했습니다. 새로고침해 주세요.'}</p>`;$('#team-agenda-foot').textContent='';return;}
  $('#team-agenda-list').innerHTML=data.matches.length?data.matches.map(match=>{
   const day=kstDate(match.date),home=match.home.id===team.id,other=home?match.away:match.home,played=['live','finished'].includes(match.status.state);
   const result=played?`${match.home.score??'–'} : ${match.away.score??'–'}`:match.status.label;
   const phase=match.seasonType==='preseason'?' · 프리시즌':match.seasonType==='postseason'?' · 포스트시즌':'';
   return `<button class="plan-game ${day===getDate()?'selected':''}" data-plan-date="${day}" aria-label="${day} ${esc(teamName(match.home))} 대 ${esc(teamName(match.away))} ${esc(match.status.label)}"><span class="plan-game-date"><strong>${Number(day.slice(5,7))}.${Number(day.slice(-2))}</strong><small>${match.timeTbd?'시간 미정':esc(time(match.date))}</small></span><span class="plan-game-opponent"><strong>${esc(teamName(other))}</strong><small>${home?'홈':'원정'}${phase}</small></span><span class="plan-game-state ${match.status.state==='live'?'live':''}">${esc(result)}${played?`<small>${esc(match.status.label)}</small>`:''}</span></button>`;
  }).join(''):`<p class="planner-empty">${incomplete?'확인된 일정이 없습니다. 일부 일정은 불러오지 못했습니다.':'이달에 등록된 팀 경기가 없습니다. 다른 달을 선택하세요.'}</p>`;
  $('#team-agenda-foot').textContent=`${time(data.fetchedAt)} 확인 · ${data.source} · 5분마다 갱신`;
 }
 async function load(force=false){
  const team=selectedTeam(),next=team?`${team.league}:${team.id}:${month()}`:'';
  if(next===key&&!force){render();return;}
  const changed=next!==key,thisRequest=++requestId;controller?.abort();key=next;
  if(changed){data=null;error='';savedAt=0;}
  if(!team){loading=false;render();return;}
  const stored=cache.get(next);
  if(!force&&stored&&Date.now()-stored.savedAt<300000){data=stored.data;savedAt=stored.savedAt;loading=false;error='';render();return;}
  controller=new AbortController();const signal=controller.signal,timeout=setTimeout(()=>controller?.signal===signal&&controller.abort(),25000);
  loading=true;error='';render();
  try{
   const response=await fetch(apiUrl(`/api/team-schedule?${new URLSearchParams({league:team.league,team:team.id,month:month()})}`),{signal,headers:{Accept:'application/json'},cache:'no-store'});const json=await response.json();
   if(thisRequest!==requestId)return;
   if(!response.ok)throw new Error(json.error||'팀 일정을 불러오지 못했습니다.');
   if(json.league!==team.league||json.teamId!==team.id||json.sport!==team.sport||json.month!==month()||!Array.isArray(json.matches)||!Array.isArray(json.failures)||!json.matches.every(m=>matchesTeam(m,team)&&kstDate(m.date).slice(0,7)===json.month))throw new Error('팀 일정 응답이 올바르지 않습니다.');
   data=json;savedAt=Date.now();cache.set(next,{data,savedAt});if(cache.size>24)cache.delete(cache.keys().next().value);
  }catch(e){if(thisRequest!==requestId)return;error=e.name==='AbortError'?'연결 시간이 초과되었습니다. 새로고침해 주세요.':e.message;}
  finally{clearTimeout(timeout);if(thisRequest===requestId){loading=false;render();}}
 }
 $('#favorite-team-league').addEventListener('change',()=>onLeagueChange($('#favorite-team-league').value));
 $('#favorite-team').addEventListener('change',()=>{
  const id=$('#favorite-team').value,league=rosterLeague(),team=rosters.get(league)?.find(t=>t.id===id);
  if(id&&!team)return;
  selectTeam(team?{...team,sport:getSport(),league}:null);
 });
 $('#clear-favorite-team').addEventListener('click',()=>selectTeam(null));
 $('#team-list-retry').addEventListener('click',onReloadTeams);
 for(const [id,amount] of [['#calendar-previous',-1],['#calendar-next',1]])$(id).addEventListener('click',()=>{const d=new Date(month()+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+amount);const date=d.toISOString().slice(0,10);if(validMonth(date.slice(0,7)))onDateChange(date);});
 $('#calendar-today').addEventListener('click',()=>onDateChange(kstDate()));
 $('#team-schedule-refresh').addEventListener('click',()=>load(true));
 $('#team-planner').addEventListener('click',event=>{const saved=event.target.closest('[data-saved-team]');if(saved){const team=savedTeams[saved.dataset.savedTeam];if(team)selectTeam(team);return;}const button=event.target.closest('[data-plan-date]');if(button)onDateChange(button.dataset.planDate);});
 window.addEventListener('storage',event=>{if(event.key===SAVED_TEAMS_KEY){try{savedTeams=parseSavedTeams(JSON.parse(event.newValue||'{}'));}catch{savedTeams={};}renderSaved();onFavoritesChange?.();return;}if(event.key!==TEAM_STORAGE_KEY)return;try{preferences=parseFavoriteTeams(JSON.parse(event.newValue||'{}'));}catch{preferences={};}onTeamChange(selectedTeam());renderRoster();load();});
 return {
  toggleFavorite,isFavorite:team=>!!savedTeams[favoriteTeamKey(team)],
  getSelectedTeam:selectedTeam,preferredLeague:sport=>preferences[sport]?.league||'all',
  sync(){renderRoster();return load();},refresh(){return load(true);},refreshIfDue(){if(selectedTeam()&&!loading&&Date.now()-savedAt>=300000)load(true);},
  receiveStandings(json){rosters.set(json.league,json.groups.flatMap(g=>g.rows.map(r=>r.team)));rosterErrors.delete(json.league);renderRoster();},
  receiveError(league,message){rosterErrors.set(league,message);renderRoster();},
  updateDay(json){const team=selectedTeam();if(!data||!team||json.sport!==team.sport||json.date.slice(0,7)!==month()||!json.loadedLeagues?.includes(team.league))return;data={...data,matches:[...data.matches.filter(m=>kstDate(m.date)!==json.date),...json.matches.filter(m=>matchesTeam(m,team))].sort((a,b)=>a.date.localeCompare(b.date))};cache.set(key,{data,savedAt});render();}
 };
}
