import {apiUrl} from './api-url.mjs';
import {LEAGUES,leaguesForSport} from './sports.mjs';

export function createStandingsPanel({getSport,getLeague,onLeagueChange,onData,onError,isTeamFavorite=()=>false,onTeamFavorite,teamName,logo,esc,time}){
 const $=selector=>document.querySelector(selector),cache=new Map();
 let currentLeague='',groupId='',data=null,error='',loading=false,requestId=0,controller;
 const leagueSelect=$('#standings-league'),groupSelect=$('#standings-group');
 const cell=value=>value===null||value===undefined?'–':String(value);
 function render(){
  $('#standings-panel').setAttribute('aria-busy',String(loading));
  $('#standings-refresh').disabled=loading;
  $('#standings-season').textContent=data?`${data.season.label} · ${data.season.type}`:loading?'시즌 정보를 확인하는 중':'시즌 정보 없음';
  const groups=data?.groups||[];
  if(!groups.some(g=>g.id===groupId))groupId=groups[0]?.id||'';
  groupSelect.innerHTML=groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');groupSelect.value=groupId;
  $('#standings-group-label').hidden=groups.length<=1;
  $('#standings-notice').hidden=!error;
  $('#standings-notice').textContent=error?(data?'갱신에 실패해 마지막 순위를 표시합니다. ': '')+error:'';
  if(!data){$('#standings-content').innerHTML=loading?'<div class="standings-empty"><span class="loader"></span><p>순위를 가져오는 중</p></div>':'<div class="standings-empty"><p>순위를 불러오지 못했어요.</p><button class="small-button" id="standings-retry">다시 불러오기</button></div>';$('#standings-foot').textContent='';$('#standings-retry')?.addEventListener('click',()=>sync(true));return;}
  const group=groups.find(g=>g.id===groupId),rows=group?.rows||[];
  const league=LEAGUES.find(l=>l.id===currentLeague);
  if(!rows.length){$('#standings-content').innerHTML='<div class="standings-empty"><p>아직 등록된 순위가 없습니다.</p></div>';}
  else{
   const value=(row,key)=>key==='pct'?(row.stats.pct===null?'–':Number(row.stats.pct).toFixed(3).replace(/^0/,'')):cell(row.stats[key]);
   const recentCell=row=>{
    const record=row.recentForm;
    if(!record)return '<span class="recent-unavailable">확인 불가</span>';
    if(record.played===0)return '<span class="recent-unavailable">경기 없음</span>';
    const text=data.sport==='hockey'?`${record.wins}승 ${record.losses}패 ${record.otLosses}OT패`:data.sport==='soccer'||data.sport==='football'||data.league==='kbo'||record.ties?`${record.wins}승 ${record.ties}무 ${record.losses}패`:`${record.wins}승 ${record.losses}패`;
    return `<span class="recent-record">${esc(text)}</span>${record.played<10?`<small>최근 ${record.played}경기</small>`:''}`;
   };
   const streakBadge=row=>Number.isSafeInteger(row.losingStreak)&&row.losingStreak>=3?`<span class="rank-loss-streak" title="${esc(league.name)} 현재 ${row.losingStreak}연패">${row.losingStreak}연패</span>`:'';
   $('#standings-content').innerHTML=`${data.notStarted?'<p class="standings-opening">정규시즌 개막 전 · 순위 미정</p>':''}<div class="standings-scroll" tabindex="0" aria-label="${esc(group.name)} 전체 순위"><table class="standings-table"><caption>${esc(league.name)} · ${esc(group.name)} 순위</caption><thead><tr><th scope="col" class="rank-number">순위</th><th scope="col" class="rank-team-heading">팀</th>${data.columns.map(c=>`<th scope="col" title="${esc(c.title)}" aria-label="${esc(c.title)}">${esc(c.label)}</th>`).join('')}<th scope="col" class="rank-recent-heading" title="현재 시즌 해당 리그의 최근 최대 10경기">최근 10경기</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="rank-number ${row.rank===1?'rank-first':''}">${cell(row.rank)}</td><th scope="row"><span class="rank-team" title="${esc(teamName(row.team))}">${onTeamFavorite?`<button class="team-star" data-rank-favorite="${esc(row.team.id)}" aria-label="${esc(teamName(row.team))} 팀 즐겨찾기 ${isTeamFavorite({...row.team,sport:data.sport,league:data.league})?'해제':'추가'}" aria-pressed="${isTeamFavorite({...row.team,sport:data.sport,league:data.league})}">${isTeamFavorite({...row.team,sport:data.sport,league:data.league})?'★':'☆'}</button>`:''}${logo(row.team)}<span class="rank-team-label"><span class="rank-team-name">${esc(teamName(row.team))}</span>${streakBadge(row)}</span></span></th>${data.columns.map(c=>`<td class="${['points','pct'].includes(c.key)?'rank-key-stat':''}">${esc(value(row,c.key))}</td>`).join('')}<td class="rank-recent">${recentCell(row)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  $('#standings-foot').innerHTML=`<span>경기 날짜와 관계없는 최신 시즌 순위</span><span>3연패 이상 표시 · 선택한 리그 기록 기준</span><span>최근 전적: 현재 시즌 해당 리그의 최대 10경기</span>${data.recentFormIncomplete?'<span>일부 팀의 최근 전적을 확인하지 못했습니다.</span>':''}${data.streaksIncomplete?'<span>일부 팀의 연패 기록을 확인하지 못했습니다.</span>':''}${data.sport==='hockey'?'<span>OT패: 연장·슛아웃 패배</span>':''}<span>${esc(time(data.fetchedAt))} 확인 · 5분마다 갱신</span><a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(data.source)} 순위 원문 ↗</a>${data.recentFormSource?`<a href="${esc(data.recentFormSource.url)}" target="_blank" rel="noopener noreferrer">${esc(data.recentFormSource.name)} 최근 10경기 원문 ↗</a>`:''}`;
 }
 async function sync(force=false){
  const available=leaguesForSport(getSport()),selected=getLeague();
  const next=selected!=='all'?selected:available.some(l=>l.id===currentLeague)?currentLeague:available[0].id;
  const changed=next!==currentLeague;
  if(!changed&&!force)return;
  const thisRequest=++requestId;controller?.abort();currentLeague=next;
  leagueSelect.innerHTML=available.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');leagueSelect.value=next;
  if(changed){data=null;groupId='';error='';}
  const saved=cache.get(next);
  if(!force&&saved&&Date.now()-saved.savedAt<300000){data=saved.data;loading=false;error='';onData?.(data);render();return;}
  controller=new AbortController();const signal=controller.signal;
  const timeout=setTimeout(()=>{if(thisRequest===requestId)controller.abort();},28000);
  loading=true;error='';render();
  try{
   const response=await fetch(apiUrl(`/api/standings?league=${encodeURIComponent(next)}`),{signal,headers:{Accept:'application/json'},cache:'no-store'});const json=await response.json();
   if(thisRequest!==requestId)return;
   if(!response.ok)throw new Error(json.error||'순위 데이터를 불러오지 못했습니다.');
   if(json.league!==next||json.sport!==getSport()||!json.season||!Array.isArray(json.groups)||!Array.isArray(json.columns))throw new Error('순위 데이터의 형식을 확인할 수 없습니다.');
   data=json;cache.set(next,{data:json,savedAt:Date.now()});onData?.(json);
  }catch(e){if(thisRequest!==requestId)return;error=e.name==='AbortError'?'응답 시간이 초과되었습니다.':e instanceof SyntaxError?'서버 응답을 읽지 못했습니다.':e.message;onError?.(next,error);}
  finally{clearTimeout(timeout);if(thisRequest===requestId){loading=false;render();}}
 }
 leagueSelect.addEventListener('change',()=>onLeagueChange(leagueSelect.value));
 groupSelect.addEventListener('change',()=>{groupId=groupSelect.value;render();});
 $('#standings-refresh').addEventListener('click',()=>sync(true));
 $('#standings-content').addEventListener('click',event=>{const button=event.target.closest('[data-rank-favorite]');if(!button||!data)return;const row=data.groups.flatMap(g=>g.rows).find(r=>r.team.id===button.dataset.rankFavorite);if(row)onTeamFavorite?.({...row.team,sport:data.sport,league:data.league});});
 return {sync,render,refreshIfDue(){const saved=cache.get(currentLeague);if(!loading&&currentLeague&&(!saved||Date.now()-saved.savedAt>=300000))sync(true);}};
}
