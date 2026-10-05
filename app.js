import {SUBJECTS,MODES,MAX_MINUTES,resizeTimer,timerForTask,mergeBackup,id,dateKey,newTimer,remaining,start,pause,elapsed,finish,dailyTotals,durationOnDay,initialState,validateData} from './core.mjs';

const KEY='doyoon-study-v1';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const icons={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 4h2m4 0h2"/>',chart:'<path d="M4 3v17h17M9 15V9m5 6V5m5 10v-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',checklist:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10l1.5 1.5L12 9m2 1h2m-8 6h8"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="m9 5 11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',reset:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',edit:'<path d="m14 4 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',sound:'<path d="M11 4 6 8H3v8h3l5 4zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="M11 4 6 8H3v8h3l5 4zm5 5 6 6m-6 0 6-6"/>',flame:'<path d="M13 3s1 5-3 8c0 0-2-1-2-3-5 5-3 13 4 13s10-9 1-18Z"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.grid}</svg>`;
function hydrateIcons(){ $$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon)); }
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=initialState(), loadIssue=false;
try { const raw=localStorage.getItem(KEY); if(raw)state=validateData(JSON.parse(raw),true); } catch { loadIssue=true; }
let selectedDate=dateKey(),filter='all',editingTask=null,lastDay=dateKey(),toastTimeout,audioContext,storageWarning=false;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageWarning=false;return true;}catch{if(!storageWarning){toast('저장 공간을 사용할 수 없습니다. 데이터 관리에서 백업해 주세요.',9000);storageWarning=true;}return false;}}
function toast(message,duration=3600){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),duration);}
function confirmAction(title,message,okLabel='확인') {return new Promise(resolve=>{const modal=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-ok').textContent=okLabel;let closed=false;const end=value=>{if(closed)return;closed=true;modal.close();$('#confirm-ok').onclick=null;$('#confirm-cancel').onclick=null;modal.oncancel=null;resolve(value);};$('#confirm-ok').onclick=()=>end(true);$('#confirm-cancel').onclick=()=>end(false);modal.oncancel=e=>{e.preventDefault();end(false);};modal.showModal();$('#confirm-cancel').focus();});}
function timeText(ms){const seconds=Math.floor(ms/1000);if(seconds<60)return seconds?`${seconds}초`:'0분';const mins=Math.floor(seconds/60);return mins>=60?`${Math.floor(mins/60)}시간 ${mins%60}분`:`${mins}분`;}
function statTime(ms){const mins=Math.floor(ms/60000);return mins>=60?`${Math.floor(mins/60)}<small>시간</small> ${mins%60}<small>분</small>`:mins>0?`${mins}<small>분</small>`:ms>=1000?`${Math.floor(ms/1000)}<small>초</small>`:'0<small>분</small>';}
function stat(label,value,type){return `<div class="stat-card"><span class="stat-icon">${icon(type)}</span><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div></div>`;}
function empty(title,description,type='checklist'){return `<div class="empty-state"><div class="empty-icon">${icon(type)}</div><h3>${title}</h3><p>${description}</p></div>`;}
function sortedTasks(date){return state.tasks.filter(t=>t.date===date).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.important)-Number(a.important));}
function taskHTML(t){return `<div class="task-row ${t.done?'done':''}" data-task="${esc(t.id)}"><button class="task-check" data-task-action="toggle" aria-label="${esc(t.title)} ${t.done?'완료 취소':'완료'}" aria-pressed="${t.done}">${t.done?icon('check'):''}</button><div class="task-details"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="subject-pill subject-${esc(t.subject)}">${esc(t.subject)}</span><span>예상 ${t.minutes}분</span>${t.important?'<span class="important">★ 중요</span>':''}</div></div><div class="task-actions">${!t.done?`<button class="icon-button" data-task-action="focus" aria-label="${esc(t.title)} 타이머 시작 준비">${icon('play')}</button>`:''}<button class="icon-button" data-task-action="edit" aria-label="${esc(t.title)} 수정">${icon('edit')}</button><button class="icon-button task-delete" data-task-action="delete" aria-label="${esc(t.title)} 삭제">${icon('trash')}</button></div></div>`;}
function renderTasks(){
 const today=sortedTasks(dateKey()),done=today.filter(t=>t.done).length,pct=today.length?Math.round(done/today.length*100):0;
 $('#today-task-count').textContent=today.length;$('#today-percentage').textContent=`${pct}%`;$('#today-progress').style.width=`${pct}%`;$('#today-completion').textContent=today.length?`${today.length}개 중 ${done}개 완료`:'오늘 계획을 세워보세요';
 $('#today-tasks').innerHTML=today.length?today.map(taskHTML).join(''):empty('오늘의 첫 계획을 적어보세요','작은 할 일 하나부터 시작해요.<br>완료한 계획은 체크해서 정리할 수 있어요.');
 const all=sortedTasks(selectedDate),filtered=all.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 $('#planner-summary').textContent=`${selectedDate.replaceAll('-','.')} · ${all.length}개 계획 · ${all.filter(t=>t.done).length}개 완료 · 예상 ${all.reduce((n,t)=>n+t.minutes,0)}분`;
 $('#planner-tasks').innerHTML=filtered.length?filtered.map(taskHTML).join(''):empty(all.length?'해당하는 계획이 없습니다':'이날의 계획은 아직 비어 있어요',all.length?'다른 필터를 선택해 보세요.':'할 일을 추가하고 공부할 시간을 정해보세요.');
}
function lastSeven(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-6+i);return d;});}
function streak(totals){const d=new Date();d.setHours(12,0,0,0);if(!totals[dateKey(d)])d.setDate(d.getDate()-1);let count=0;while(totals[dateKey(d)]>0){count++;d.setDate(d.getDate()-1);}return count;}
function renderStats(){const totals=dailyTotals(state.sessions),today=dateKey(),tasks=sortedTasks(today),done=tasks.filter(t=>t.done).length;
 $('#desk-stats').innerHTML=stat('오늘 집중한 시간',statTime(totals[today]||0),'clock')+stat('완료한 할 일',`${done}<small>/ ${tasks.length}개</small>`,'checklist')+stat('연속 공부',`${streak(totals)}<small>일</small>`,'flame');
 const days=lastSeven(),values=days.map(d=>totals[dateKey(d)]||0),sum=values.reduce((a,b)=>a+b,0),max=Math.max(...values,60000);
 $('#week-total').innerHTML=statTime(sum);$('#week-chart').setAttribute('aria-label',days.map((d,i)=>`${d.getMonth()+1}월 ${d.getDate()}일 ${timeText(values[i])}`).join(', '));
 $('#week-chart').innerHTML=days.map((d,i)=>`<div class="chart-col ${i===6?'today':''}"><div class="bar-slot"><div class="chart-bar" style="height:${Math.max(3,values[i]/max*75)}px"><span class="bar-value">${values[i]?esc(timeText(values[i])):''}</span></div></div><span class="bar-day">${i===6?'오늘':['일','월','화','수','목','금','토'][d.getDay()]}</span></div>`).join('');
 $('#record-stats').innerHTML=stat('총 집중 시간',statTime(state.sessions.reduce((n,s)=>n+s.durationMs,0)),'clock')+stat('집중 세션',`${state.sessions.length}<small>회</small>`,'checklist')+stat('공부한 날',`${Object.keys(totals).length}<small>일</small>`,'calendar');
}
function renderRecords(){const date=$('#record-date').value||dateKey();const sessions=state.sessions.map(s=>({...s,dayMs:durationOnDay(s,date)})).filter(s=>s.dayMs>0).sort((a,b)=>b.endedAt-a.endedAt);const subjects={};for(const s of sessions)subjects[s.subject]=(subjects[s.subject]||0)+s.dayMs;
 $('#subject-summary').innerHTML=Object.entries(subjects).map(([name,ms])=>`<span class="subject-chip">${esc(name)} · ${timeText(ms)}</span>`).join('');
 $('#session-list').innerHTML=sessions.length?sessions.map(s=>`<div class="session-row"><span class="session-icon">${icon('clock')}</span><div class="session-details"><strong>${esc(s.taskTitle||s.subject)}</strong><small>${esc(s.subject)} · ${new Date(s.endedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 종료${dateKey(s.endedAt)!==date?' · 여러 날짜에 걸친 집중':''}</small></div><span class="session-duration">${timeText(s.dayMs)}</span></div>`).join(''):empty('아직 기록된 집중 시간이 없어요','집중 타이머를 마치거나 여기까지 기록 버튼을 누르면<br>공부한 시간이 자동으로 남습니다.','clock');
}
function renderAll(){renderTasks();renderStats();renderRecords();renderTimer();}
function renderDate(){const now=new Date();$('#header-date').textContent=now.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});$('#weekday-label').textContent=now.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase();$('#day-label').textContent=String(now.getDate()).padStart(2,'0');$('#month-label').textContent=now.toLocaleDateString('en-US',{month:'short',year:'numeric'});}
function route(){const view=['desk','planner','records'].includes(location.hash.slice(1))?location.hash.slice(1):'desk';$$('.view').forEach(el=>el.hidden=el.id!==`${view}-view`);$$('[data-nav]').forEach(el=>{const active=el.dataset.nav===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('#breadcrumb').textContent={desk:'공부 책상',planner:'학습 계획',records:'공부 기록'}[view];window.scrollTo({top:0,behavior:'instant'});}
function renderTimer(){const t=state.timer,ms=remaining(t),s=Math.ceil(ms/1000),text=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`,used=elapsed(t)>0;
 $('#timer-digits').textContent=text;$('#timer-digits').setAttribute('aria-label',`남은 시간 ${Math.floor(s/60)}분 ${s%60}초`);$('#ring-progress').style.strokeDashoffset=String(728.85*(1-ms/t.durationMs));
 $('#timer-caption').textContent=t.mode==='focus'?'TIME TO FOCUS':'TIME TO RECHARGE';$('#timer-status').textContent=t.running?(t.mode==='focus'?'지금, 한 가지에 집중하는 중':'잠시 쉬어가는 중'):used?'잠깐 멈췄어요':t.mode==='focus'?'집중할 준비가 되었나요?':'편하게 쉬어가세요';
 $('#start-label').textContent=t.running?'일시 정지':used?'이어서 시작':t.mode==='focus'?'집중 시작':'휴식 시작';$('#start-timer [data-icon]').innerHTML=icon(t.running?'pause':'play');$('#finish-timer').disabled=!used;$('#finish-timer').setAttribute('aria-label',t.mode==='focus'?'여기까지 기록하고 타이머 종료':'휴식 종료');
 $('#timer-subject').value=t.subject;$('#timer-subject').disabled=used||t.running||t.mode!=='focus';$('#timer-minutes').disabled=used||t.running;if(document.activeElement!==$('#timer-minutes'))$('#timer-minutes').value=t.durationMs/60000;
 $('#timer-footnote').textContent=t.taskTitle?`집중할 일: ${t.taskTitle}`:t.mode==='focus'?'집중한 시간은 공부 기록에 자동으로 쌓여요.':'휴식 시간은 공부 기록에 포함되지 않아요.';
 $$('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===t.mode)));$('#sound-toggle').setAttribute('aria-pressed',String(state.sound));$('#sound-toggle').setAttribute('aria-label',state.sound?'종료 알림 소리 끄기':'종료 알림 소리 켜기');$('#sound-toggle span').innerHTML=icon(state.sound?'sound':'mute');
 document.title=t.running?`${text} ${t.mode==='focus'?'집중 중':'휴식 중'} · doyoon study`:'doyoon study — 나만의 공부 공간';
}
function prepareAudio(){try{audioContext||=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{/* The visual completion message remains available. */}}
function chime(){if(!state.sound||!audioContext)return;try{const now=audioContext.currentTime;[523.25,659.25,783.99].forEach((freq,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=freq;o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,now+i*.18);g.gain.linearRampToValueAtTime(.15,now+i*.18+.025);g.gain.exponentialRampToValueAtTime(.001,now+i*.18+.45);o.start(now+i*.18);o.stop(now+i*.18+.5);});}catch{}}
function completeTimer(automatic=false){const t=state.timer,session=finish(t);if(session&&!state.sessions.some(s=>s.id===session.id))state.sessions.push(session);state.timer=newTimer(t.mode,t.durationMs/60000,t.subject);save();renderAll();if(automatic)chime();toast(t.mode==='focus'?(session?`${timeText(session.durationMs)} 집중 기록을 저장했어요.`:'1초 이상의 집중 시간부터 기록돼요.'):'휴식을 마쳤어요. 다음 집중을 시작해 보세요.',5000);}
async function allowReplace(){if(elapsed(state.timer)<1000&&!state.timer.running)return true;return confirmAction('진행 중인 타이머를 바꿀까요?','아직 저장하지 않은 시간이 초기화됩니다. 기록을 남기려면 취소 후 타이머 오른쪽 종료 버튼을 누르세요.','초기화');}
function openTask(date,task=null){editingTask=task?.id||null;$('#task-dialog-title').textContent=task?'학습 계획 수정':'새로운 학습 계획';$('#task-title').value=task?.title||'';$('#task-subject').value=task?.subject||'수학';$('#task-minutes').value=task?.minutes||30;$('#task-date').value=task?.date||date;$('#task-important').checked=task?.important||false;$('#task-dialog').showModal();$('#task-title').focus();}
$('#task-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#task-title').value.trim();if(!title){$('#task-title').setCustomValidity('할 일을 입력해 주세요.');$('#task-title').reportValidity();return;}const existing=state.tasks.find(t=>t.id===editingTask);const task={id:existing?.id||id(),title,subject:$('#task-subject').value,minutes:Number($('#task-minutes').value),date:$('#task-date').value,important:$('#task-important').checked,done:existing?.done||false};if(existing)state.tasks=state.tasks.map(t=>t.id===existing.id?task:t);else state.tasks.push(task);save();$('#task-dialog').close();renderAll();toast(existing?'계획을 수정했어요.':'학습 계획을 추가했어요.');});
$('#task-title').addEventListener('input',()=>$('#task-title').setCustomValidity(''));
document.addEventListener('click',async e=>{const add=e.target.closest('[data-add-task]');if(add)openTask(add.dataset.addTask==='today'?dateKey():selectedDate);const close=e.target.closest('[data-close]');if(close)$(`#${close.dataset.close}`).close();const action=e.target.closest('[data-task-action]');if(!action)return;const t=state.tasks.find(t=>t.id===action.closest('[data-task]').dataset.task);if(!t)return;
 if(action.dataset.taskAction==='toggle'){t.done=!t.done;save();renderAll();}
 if(action.dataset.taskAction==='edit')openTask(t.date,t);
 if(action.dataset.taskAction==='delete'&&await confirmAction('이 계획을 삭제할까요?',t.title,'삭제')){state.tasks=state.tasks.filter(task=>task.id!==t.id);save();renderAll();toast('계획을 삭제했어요.');}
 if(action.dataset.taskAction==='focus'&&await allowReplace()){state.timer=timerForTask(t);save();location.hash='desk';renderTimer();toast('타이머가 준비됐어요. 집중 시작을 눌러주세요.');$('#start-timer').focus();}
});
$('#start-timer').onclick=()=>{if(state.sound)prepareAudio();state.timer=state.timer.running?pause(state.timer):start(state.timer);save();renderTimer();};
$('#finish-timer').onclick=()=>completeTimer();
$('#reset-timer').onclick=async()=>{if(await allowReplace()){state.timer=newTimer(state.timer.mode,state.timer.durationMs/60000,state.timer.subject);save();renderTimer();}};
$$('[data-mode]').forEach(el=>el.onclick=async()=>{if(el.dataset.mode===state.timer.mode)return;if(await allowReplace()){state.timer=newTimer(el.dataset.mode,MODES[el.dataset.mode],state.timer.subject);save();renderTimer();}});
$('#timer-minutes').onchange=()=>{const input=$('#timer-minutes');if(!input.value||!input.checkValidity()){toast(`시간은 1~${MAX_MINUTES}분 사이의 정수로 입력해 주세요.`);input.value=state.timer.durationMs/60000;return;}state.timer=resizeTimer(state.timer,Number(input.value));save();renderTimer();};
$('#timer-subject').onchange=()=>{state.timer.subject=$('#timer-subject').value;save();};
$('#sound-toggle').onclick=()=>{state.sound=!state.sound;if(state.sound)prepareAudio();save();renderTimer();toast(state.sound?'종료 알림 소리를 켰어요.':'종료 알림 소리를 껐어요.');};
$('#plan-date').value=selectedDate;$('#plan-date').onchange=()=>{if(!$('#plan-date').value){$('#plan-date').value=selectedDate;return;}selectedDate=$('#plan-date').value;renderTasks();};
$('#go-today').onclick=()=>{selectedDate=dateKey();$('#plan-date').value=selectedDate;renderTasks();};
$$('[data-filter]').forEach(el=>el.onclick=()=>{filter=el.dataset.filter;$$('[data-filter]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===el)));renderTasks();});
$('#record-date').value=dateKey();$('#record-date').onchange=renderRecords;
$('#data-settings').onclick=()=>$('#data-dialog').showModal();
const mobileData=document.createElement('button');mobileData.className='icon-button data-mobile';mobileData.setAttribute('aria-label','데이터 관리');mobileData.innerHTML=icon('database');mobileData.onclick=()=>$('#data-dialog').showModal();$('.topbar-right').prepend(mobileData);
function exportData(){const snapshot=JSON.stringify({version:state.version,tasks:state.tasks,sessions:state.sessions,sound:state.sound,exportedAt:new Date().toISOString()},null,2);const url=URL.createObjectURL(new Blob([snapshot],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`doyoon-study-${dateKey()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 저장했어요. 진행 중인 시간은 종료 후 백업하세요.');}
$('#export-records').onclick=exportData;$('#backup-data').onclick=exportData;
function reportImport(message,duration=6000){$('#import-status').textContent=message;toast(message,duration);}
let importBusy=false;
$('#import-data').onchange=async e=>{
 const input=e.target,file=input.files[0];
 if(!file||importBusy)return;
 const policy=$('#import-policy').value;
 importBusy=true;input.disabled=true;$('#import-status').textContent='백업 파일을 확인하고 있어요.';
 try{
  if(file.size>10000000)throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
  const loaded=validateData(JSON.parse(await file.text()));
  let merged=mergeBackup(state,loaded,policy);
  if(merged.counts.updatedTasks){
   const before=JSON.stringify(state.tasks);
   const accepted=await confirmAction('기존 계획을 파일 내용으로 바꿀까요?',`내용이 다른 계획 ${merged.counts.updatedTasks}개를 변경합니다. 필요하면 취소 후 현재 데이터를 먼저 백업하세요.`,'계획 변경');
   if(!accepted){reportImport('불러오기를 취소했어요.');return;}
   if(JSON.stringify(state.tasks)!==before)throw new Error('확인 중 다른 탭에서 계획이 변경됐습니다. 파일을 다시 선택해 주세요.');
   // Timer completion and records in other tabs may change while the dialog is open.
   merged=mergeBackup(state,loaded,policy);
  }
  const previous=state;
  state=merged.state;
  if(!save()){state=previous;renderAll();reportImport('저장하지 못해 불러오기를 취소했어요. 기존 데이터는 유지됩니다.',7000);return;}
  renderAll();
  const c=merged.counts;
  reportImport(`계획 ${c.addedTasks}개 추가 · ${c.updatedTasks}개 변경 · ${c.keptTasks}개 기존 내용 유지 · 기록 ${c.addedSessions}개 추가`,7000);
 }catch(err){reportImport(err instanceof SyntaxError?'올바른 JSON 백업 파일이 아닙니다.':err.message,6000);}
 finally{input.value='';input.disabled=false;importBusy=false;}
};
window.addEventListener('hashchange',route);
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{state=validateData(JSON.parse(e.newValue),true);renderAll();}catch{toast('다른 탭의 데이터를 읽지 못했습니다.');}});
function tick(){if(state.timer.running&&remaining(state.timer)===0)completeTimer(true);else renderTimer();if(dateKey()!==lastDay){lastDay=dateKey();renderDate();renderAll();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
$('#timer-minutes').max=MAX_MINUTES;$('#task-minutes').max=MAX_MINUTES;
hydrateIcons();renderDate();renderAll();route();tick();setInterval(tick,500);
if(loadIssue)toast('저장 데이터를 읽지 못했습니다. 백업 파일이 있다면 데이터 관리에서 불러오세요.',9000);
