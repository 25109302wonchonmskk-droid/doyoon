export const VERSION = 1;
export const MAX_MINUTES = 600;
const MAX_DURATION_MS = MAX_MINUTES * 60000;
export const SUBJECTS = ['자율 학습', '국어', '수학', '영어', '과학', '사회', '기타'];
export const MODES = {focus: 25, short: 5, long: 15};
export const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function dateKey(value = Date.now()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(+d) && dateKey(d) === value;
}
export function newTimer(mode = 'focus', minutes = MODES[mode] || 25, subject = '자율 학습') {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) throw new Error(`시간은 1~${MAX_MINUTES}분 사이의 정수로 입력해 주세요.`);
  return {id:id(), mode, durationMs:minutes*60000, remainingMs:minutes*60000, running:false, endsAt:null, runStartedAt:null, segments:[], subject, taskId:null, taskTitle:''};
}
// Duration edits are only allowed before starting; keep the selected plan.
export function resizeTimer(timer, minutes) {
  if (timer.running || elapsed(timer) > 0) throw new Error('진행 중인 타이머의 시간은 바꿀 수 없습니다.');
  return {...newTimer(timer.mode, minutes, timer.subject), taskId:timer.taskId, taskTitle:timer.taskTitle};
}
export function timerForTask(task) {
  return {...newTimer('focus', task.minutes, task.subject), taskId:task.id, taskTitle:task.title};
}
export function remaining(timer, now = Date.now()) { return timer.running ? Math.max(0, timer.endsAt-now) : timer.remainingMs; }
export function start(timer, now = Date.now()) {
  if (timer.running) return timer;
  return {...timer, running:true, runStartedAt:now, endsAt:now+timer.remainingMs};
}
export function pause(timer, now = Date.now()) {
  if (!timer.running) return timer;
  const end = Math.max(timer.runStartedAt, Math.min(now, timer.endsAt));
  const segments = end > timer.runStartedAt ? [...timer.segments, {start:timer.runStartedAt,end}] : timer.segments;
  return {...timer, running:false, remainingMs:remaining(timer,now), endsAt:null,runStartedAt:null,segments};
}
export function elapsed(timer, now = Date.now()) {
  return Math.max(0,timer.durationMs-remaining(timer,now));
}
export function finish(timer, now = Date.now()) {
  const stopped = pause(timer, now);
  const durationMs = stopped.segments.reduce((n,s)=>n+s.end-s.start,0);
  if (timer.mode !== 'focus' || durationMs < 1000) return null;
  return {id:timer.id,subject:timer.subject,taskId:timer.taskId,taskTitle:timer.taskTitle,durationMs,segments:stopped.segments,endedAt:stopped.segments.at(-1).end};
}
// Split active study intervals at the user's local midnight, excluding pauses.
export function dailyTotals(sessions) {
  const totals = {};
  for (const session of sessions) for (const segment of session.segments) {
    let cursor = segment.start;
    while (cursor < segment.end) {
      const boundary = new Date(cursor); boundary.setHours(24,0,0,0);
      const end = Math.min(+boundary,segment.end);
      if (end <= cursor) break;
      const key = dateKey(cursor); totals[key]=(totals[key]||0)+end-cursor;
      cursor=end;
    }
  }
  return totals;
}
export function durationOnDay(session, day) { return dailyTotals([session])[day] || 0; }
export function initialState() { return {version:VERSION,tasks:[],sessions:[],timer:newTimer(),sound:false}; }
const finite = n => typeof n === 'number' && Number.isFinite(n);
function validateSegments(segments, maxMs=MAX_DURATION_MS) {
  if (!Array.isArray(segments) || segments.length>20000) throw new Error('잘못된 집중 기록입니다.');
  let prev=0,total=0;
  for (const s of segments) {
    if (!s || !finite(s.start) || !finite(s.end) || s.start<0 || s.end<=s.start || s.start<prev || s.end>8640000000000000) throw new Error('잘못된 집중 기록입니다.');
    total+=s.end-s.start; prev=s.end;
  }
  if (total>maxMs+1000) throw new Error('집중 시간이 유효하지 않습니다.');
  return segments.map(s=>({start:s.start,end:s.end}));
}
export function validateData(raw, includeTimer = false) {
  if (!raw || raw.version!==VERSION || !Array.isArray(raw.tasks) || !Array.isArray(raw.sessions) || raw.tasks.length>10000 || raw.sessions.length>20000) throw new Error('doyoon study 백업 파일이 아닙니다.');
  const cleanId = value => typeof value==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  const tasks=raw.tasks.map(t=>{
    if (!t || !cleanId(t.id) || typeof t.title!=='string' || !t.title.trim() || t.title.length>100 || !SUBJECTS.includes(t.subject) || !validDate(t.date) || !Number.isInteger(t.minutes) || t.minutes<1 || t.minutes>MAX_MINUTES) throw new Error('학습 계획 형식이 올바르지 않습니다.');
    return {id:t.id,title:t.title,subject:t.subject,date:t.date,minutes:t.minutes,done:t.done===true,important:t.important===true};
  });
  const sessions=raw.sessions.map(s=>{
    if (!s || !cleanId(s.id) || !SUBJECTS.includes(s.subject) || !finite(s.endedAt) || typeof s.taskTitle!=='string' || s.taskTitle.length>100) throw new Error('공부 기록 형식이 올바르지 않습니다.');
    const segments=validateSegments(s.segments);
    return {id:s.id,subject:s.subject,taskId:cleanId(s.taskId)?s.taskId:null,taskTitle:s.taskTitle,segments,durationMs:segments.reduce((n,p)=>n+p.end-p.start,0),endedAt:segments.at(-1)?.end||s.endedAt};
  });
  const state={...initialState(),tasks:[...new Map(tasks.map(t=>[t.id,t])).values()],sessions:[...new Map(sessions.map(s=>[s.id,s])).values()],sound:raw.sound===true};
  if (includeTimer && raw.timer) {
    const t=raw.timer;
    const valid=cleanId(t.id) && Object.hasOwn(MODES,t.mode) && finite(t.durationMs) && t.durationMs>=60000 && t.durationMs<=MAX_DURATION_MS && finite(t.remainingMs) && t.remainingMs>=0 && t.remainingMs<=t.durationMs && SUBJECTS.includes(t.subject) && typeof t.taskTitle==='string' && t.taskTitle.length<=100;
    if (valid && (!t.running || (finite(t.endsAt) && finite(t.runStartedAt) && t.endsAt>=t.runStartedAt && t.endsAt-t.runStartedAt<=t.durationMs))) {
      try { state.timer={id:t.id,mode:t.mode,durationMs:t.durationMs,remainingMs:t.remainingMs,running:t.running===true,endsAt:t.endsAt,runStartedAt:t.runStartedAt,segments:validateSegments(t.segments,t.durationMs),subject:t.subject,taskId:cleanId(t.taskId)?t.taskId:null,taskTitle:t.taskTitle}; } catch { /* Keep valid saved records, reset only a damaged timer. */ }
    }
  }
  return state;
}

// Backups merge data only. A running timer and sound preference stay local.
export function mergeBackup(current, raw, policy = 'keep') {
  if (!['keep', 'replace'].includes(policy)) throw new Error('불러오기 방식을 선택해 주세요.');
  const incoming = validateData(raw);
  const tasks = new Map(current.tasks.map(task => [task.id, task]));
  const sessions = new Map(current.sessions.map(session => [session.id, session]));
  const counts = {addedTasks:0, updatedTasks:0, keptTasks:0, addedSessions:0};
  const fields = ['title', 'subject', 'date', 'minutes', 'done', 'important'];
  for (const task of incoming.tasks) {
    const existing = tasks.get(task.id);
    if (!existing) {tasks.set(task.id, task); counts.addedTasks++;}
    else if (fields.some(key => existing[key] !== task[key])) {
      if (policy === 'replace') {tasks.set(task.id, task); counts.updatedTasks++;}
      else counts.keptTasks++;
    }
  }
  for (const session of incoming.sessions) {
    if (!sessions.has(session.id)) {sessions.set(session.id, session); counts.addedSessions++;}
  }
  if (tasks.size > 10000 || sessions.size > 20000) throw new Error('합친 데이터가 저장 한도(계획 10,000개, 기록 20,000개)를 넘습니다.');
  return {state:{...current, tasks:[...tasks.values()], sessions:[...sessions.values()]}, counts};
}
