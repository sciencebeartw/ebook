'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../../gifted_homework_status');
const planId='hw_'+'a'.repeat(64),assignment={planId,segmentId:'week-1'},key=planId+'|week-1';
const post={date:'2026/10/25',className:'測試班',hw1:'[課本作業]https://school.example/ebook/?gifted='+planId};
const exam={examId:'exam-test',className:'測試班',date:'2026/10/25作業',exam:'理化第12章｜概念一',score:''};
function response(status='submitted',score=9,sheet='pending'){return {planId,classId:'測試班',grades:[{targetId:'week-1',lessonDate:'2026-10-25',title:exam.exam,status:sheet,submission:{status,submittedAt:status==='submitted'?1000:null,score:status==='submitted'?score:null,maxScore:11}}]};}
function setup(read){const api=create({parseAssignment:()=>assignment,readSummary:read});api.activate('student-a');api.observe([post],[exam],'測試班');return api;}
test('pending Sheet still shows submitted score, including zero',async()=>{for(const score of [0,9]){const api=setup(async()=>response('submitted',score));assert.equal(api.display(exam).label,'確認繳交狀態中');await api.load(key);assert.equal(api.display(exam).score,score);assert.match(api.display(exam).note,/已繳交/);assert.match(api.display(exam).note,/同步中/);}});
test('reopening uses Firebase again and never requires the prior browser cache',async()=>{const a=setup(async()=>response());await a.load(key);const b=setup(async()=>response());await b.load(key);assert.equal(b.display(exam).score,9);});
test('manual grade remains untouched even when source automatic score differs',async()=>{const api=setup(async()=>response());await api.load(key);for(const score of [0,8,'假'])assert.equal(api.display({...exam,score}),null);assert.equal(exam.score,'');});
test('offline / invalid identity never turns an unknown status into 未繳',async()=>{for(const read of [async()=>{throw Error('offline');},async()=>({...response(),classId:'其他班'}),async()=>({...response(),planId:'wrong'})]){const api=setup(read);await api.load(key);assert.equal(api.display(exam).label,'暫時無法確認');assert.equal(api.display(exam).retry,true);}});
test('real not-submitted result returns to the ordinary missing display; draft is not promoted',async()=>{const api=setup(async()=>response('not_submitted'));await api.load(key);assert.equal(api.display(exam),null);});
test('logout and switching users discard outstanding private results',async()=>{let finish;const api=setup(()=>new Promise(r=>finish=r));const task=api.load(key);api.activate('student-b');finish(response());await task;assert.equal(api.display(exam),null);});
test('changed title and duplicate homework columns fail closed',async()=>{const api=setup(async()=>{const r=response();r.grades[0].title='另一份';return r;});await api.load(key);assert.equal(api.display(exam).score,null);api.observe([post],[exam,{...exam,examId:'other'}],'測試班');assert.equal(api.display(exam),null);});
test('a confirmed submission immediately survives a later summary network failure',async()=>{const api=setup(async()=>{throw Error('offline');});api.submitted(assignment,{status:'submitted',receiptId:'receipt',submittedAt:1000});await new Promise(setImmediate);assert.equal(api.display(exam).label,'已繳交');assert.match(api.display(exam).note,/已繳交/);});
test('duplicate renders share one lookup and do not poll completed reads',async()=>{let count=0,finish;const api=setup(()=>{count++;return new Promise(r=>finish=r);});const p=api.load(key);await api.load(key);finish(response());await p;await api.load(key);assert.equal(count,1);});

test('a stale pre-submit summary cannot erase the newly confirmed receipt',async()=>{
 let finish,count=0;const api=setup(()=>++count===1?new Promise(r=>finish=r):Promise.resolve(response()));
 const before=api.load(key);api.submitted(assignment,{status:'submitted',receiptId:'receipt',submittedAt:1000});
 finish(response('not_submitted'));await before;await new Promise(setImmediate);
 assert.equal(api.display(exam).score,9);assert.equal(count,2);
});

test('returning after another device submitted rechecks the scoped receipt without polling',async()=>{
 let time=0,result=response('not_submitted'),count=0;const api=create({parseAssignment:()=>assignment,readSummary:async()=>{count++;return result},now:()=>time});
 api.activate('student');api.observe([post],[exam],'測試班');await api.load(key);assert.equal(api.display(exam),null);
 api.refresh();await api.load(key);assert.equal(count,1);
 time=31000;result=response();api.refresh();await api.load(key);assert.equal(api.display(exam).score,9);assert.equal(count,2);
});
