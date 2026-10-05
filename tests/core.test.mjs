import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_MINUTES,newTimer,resizeTimer,timerForTask,mergeBackup,start,pause,remaining,finish,dailyTotals,initialState,validateData,dateKey} from '../core.mjs';

test('pause excludes waiting time and resuming uses remaining duration',()=>{
  let t=start(newTimer('focus',25,'수학'),100000);
  assert.equal(remaining(t,160000),24*60000);
  t=pause(t,160000);
  assert.equal(remaining(t,500000),24*60000);
  t=start(t,500000);
  const s=finish(t,620000);
  assert.equal(s.durationMs,180000);
  assert.deepEqual(s.segments,[{start:100000,end:160000},{start:500000,end:620000}]);
});
test('a restored expired timer records only its intended focus duration',()=>{
  const state=initialState();state.timer=start(newTimer('focus',25),100000);
  const restored=validateData(JSON.parse(JSON.stringify(state)),true);
  assert.equal(remaining(restored.timer,2000000),0);
  assert.equal(finish(restored.timer,2000000).durationMs,25*60000);
  assert.equal(finish(restored.timer,2000000).endedAt,1600000);
});
test('breaks and sub-second sessions do not create study records',()=>{
  assert.equal(finish(start(newTimer('short',5),100000),400000),null);
  assert.equal(finish(start(newTimer('focus',25),100000),100500),null);
  assert.equal(finish(newTimer()),null);
});
test('focus is split at local midnight and pauses do not add time',()=>{
  const before=+new Date('2026-10-05T23:59:00');
  const after=+new Date('2026-10-06T00:01:00');
  const session=finish(start(newTimer('focus',25),before),after);
  assert.deepEqual(dailyTotals([session]),{'2026-10-05':60000,'2026-10-06':60000});
});
test('backup strips unexpected fields and deduplicates identifiers',()=>{
  const state=initialState();const task={id:'task-1',title:'<img onerror=alert(1)>',subject:'수학',minutes:30,date:'2026-10-05',done:false,important:true,unexpected:'ignored'};
  state.tasks=[task,task];state.sessions=[finish(start(newTimer(),100000),160000)];
  const clean=validateData(JSON.parse(JSON.stringify(state)));
  assert.equal(clean.tasks.length,1);assert.equal(clean.tasks[0].unexpected,undefined);
  assert.equal(clean.sessions[0].durationMs,60000);
  assert.equal(clean.timer.running,false);
});
test('malformed dates, identifiers, oversized durations and invalid segments are rejected',()=>{
  const state=initialState();state.tasks=[{id:'t1',title:'수학',subject:'수학',minutes:30,date:'2026-02-31'}];
  assert.throws(()=>validateData(state));state.tasks[0].date='2026-10-05';state.tasks[0].id='bad" onclick';assert.throws(()=>validateData(state));
  state.tasks=[];state.sessions=[{id:'s1',subject:'수학',taskTitle:'',endedAt:2000,segments:[{start:2000,end:1000}]}];assert.throws(()=>validateData(state));
  state.sessions[0].segments=[{start:1000,end:MAX_MINUTES*60000+3000}];assert.throws(()=>validateData(state));
});
test('invalid timer state does not discard valid completed records',()=>{
  const state=initialState();state.sessions=[finish(start(newTimer(),100000),160000)];state.timer.remainingMs=-1;
  const clean=validateData(state,true);assert.equal(clean.timer.remainingMs,1500000);assert.equal(clean.sessions.length,1);
});
test('remaining time never becomes negative and date uses the device calendar',()=>{
  assert.equal(remaining(start(newTimer('focus',1),1000),1000000),0);
  assert.equal(dateKey(new Date(2026,9,5,12)),'2026-10-05');
});

const plan = overrides => ({id:'plan-1',title:'수학 오답',subject:'수학',date:'2026-10-05',minutes:240,done:false,important:false,...overrides});
test('240- and 600-minute plans retain their duration through reload and completion',()=>{
  for (const minutes of [240,600]) {
    const state=initialState();state.tasks=[plan({minutes})];
    state.timer=start(timerForTask(state.tasks[0]),100000);
    const restored=validateData(JSON.parse(JSON.stringify(state)),true);
    assert.equal(restored.timer.durationMs,minutes*60000);
    const session=finish(restored.timer,100000+minutes*60000+90000);
    assert.equal(session.durationMs,minutes*60000);
    assert.equal(session.taskTitle,'수학 오답');
    assert.equal(validateData({...restored,sessions:[session]}).sessions[0].durationMs,minutes*60000);
  }
});
test('changing duration preserves the selected plan through reload and saved record',()=>{
  const timer=resizeTimer(timerForTask(plan()),30);
  const state=validateData({...initialState(),timer},true);
  assert.equal(state.timer.durationMs,1800000);
  const session=finish(start(state.timer,100000),160000);
  assert.equal(session.taskId,'plan-1');assert.equal(session.taskTitle,'수학 오답');assert.equal(session.subject,'수학');
});
test('out-of-range durations and resizing active or paused study are rejected',()=>{
  for (const minutes of [0,601,1.5,NaN,Infinity]) assert.throws(()=>newTimer('focus',minutes));
  const running=start(timerForTask(plan()),100000);
  assert.throws(()=>resizeTimer(running,30));
  assert.throws(()=>resizeTimer(pause(running,160000),30));
});
test('backup keeps local conflicting plans by default, adds new data, and never replaces a timer',()=>{
  const local=initialState();local.tasks=[plan()];local.timer=start(timerForTask(plan()),100000);local.sound=true;
  const incoming={...initialState(),tasks:[plan({title:'다른 기기에서 수정',done:true}),plan({id:'plan-2'})],sessions:[finish(start(newTimer(),100000),160000)]};
  const before=JSON.stringify(local);
  const result=mergeBackup(local,incoming);
  assert.deepEqual(result.counts,{addedTasks:1,updatedTasks:0,keptTasks:1,addedSessions:1});
  assert.equal(result.state.tasks[0].title,'수학 오답');assert.equal(result.state.timer,local.timer);assert.equal(result.state.sound,true);
  assert.equal(JSON.stringify(local),before);
});
test('explicit backup replacement updates existing plans and repeat import is idempotent',()=>{
  const local={...initialState(),tasks:[plan(),plan({id:'local-only'})]};
  const incoming={...initialState(),tasks:[plan({title:'수정된 계획',minutes:600,done:true})],sessions:[finish(start(newTimer(),100000),160000)]};
  const result=mergeBackup(local,incoming,'replace');
  assert.equal(result.counts.updatedTasks,1);assert.equal(result.state.tasks[0].title,'수정된 계획');assert.equal(result.state.tasks[0].done,true);
  assert.equal(result.state.tasks.length,2);
  const repeat=mergeBackup(result.state,incoming,'replace');
  assert.deepEqual(repeat.counts,{addedTasks:0,updatedTasks:0,keptTasks:0,addedSessions:0});
  assert.deepEqual(repeat.state.tasks,result.state.tasks);assert.equal(repeat.state.sessions.length,1);
});
test('invalid imports and combined backup overflow leave current state untouched',()=>{
  const local={...initialState(),tasks:Array.from({length:10000},(_,i)=>plan({id:`p-${i}`}))};
  const before=JSON.stringify(local);
  assert.throws(()=>mergeBackup(local,{...initialState(),tasks:[plan()]}));
  assert.throws(()=>mergeBackup(local,{...initialState(),tasks:[plan({minutes:601})]},'replace'));
  assert.throws(()=>mergeBackup(local,initialState(),'unknown'));
  assert.equal(JSON.stringify(local),before);
});
