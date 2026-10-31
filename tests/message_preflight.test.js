'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {create}=require('../fastwrite_message_bridge'),transport=require('../fastwrite_production_transport');
const hash=async x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function setup(){
 let sessionId='session_a',uid='teacher_a',revision=0,legacy=false,deny=false,hold=null;const calls=[],saved=new Map();
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const callable=async input=>{const p=input.data;calls.push({uid,op:p.operation,entity:p.entityId,command:p.command,messageSource:p.messageSource});
  if(p.operation==='read')return{data:legacy?{authority:'legacy',kind:'message',rollbackVerificationHash:'f'.repeat(64)}:{segment:'p000000000001',messages:[],revision}};
  if(p.operation==='receipt')return{data:null};
  if(p.operation==='commit'){if(deny)throw Object.assign(Error('permission-denied'),{code:'functions/permission-denied'});if(hold)await hold.promise;return{data:{businessStatus:'committed',eventId:'p000000000001_'+'a'.repeat(64),revision:++revision,committedAt:Date.now(),mirrorStatus:'pending'}};}
  throw Error('unexpected-operation');
 };
 const scopes=[{subject:'science',className:'測試班',classKey:'test_class',scopeId:'class_test',epoch:1,enabled:true}];
 const b=create({scopes,transport,storage,getUid:()=>uid,getSessionId:()=>sessionId,hash,callableFor:()=>callable});
 const p={subject:'science',className:'測試班',studentKey:'test_student',targetDate:'2026/10/25',content:'測試留言',requestId:'request_01'};
 return{b,p,calls,storage,setUid:x=>uid=x,setSession:x=>sessionId=x,setLegacy:x=>legacy=x,setDeny:x=>deny=x,setHold:x=>hold=x};
}
(async()=>{
 let s=setup();await s.b.warm('teacher',s.p);assert.deepEqual(s.calls[0].messageSource,{studentKey:s.p.studentKey,targetDate:s.p.targetDate});assert.deepEqual(s.calls.map(c=>c.op),['read'],'預備只能讀取，不能送出留言');
 const hold=deferred();s.setHold(hold);let done=false;const send=s.b.handle('teacher',s.p).promise.then(r=>{done=true;return r;});await new Promise(r=>setImmediate(r));assert.equal(done,false,'未取得 Firebase 提交收據不能顯示成功');hold.resolve();const result=await send;assert.equal(result.businessStatus,'committed');assert.equal(result.sheetStatus,'pending');assert.deepEqual(s.calls.map(c=>c.op),['read','commit'],'送出重用預讀，不能等待 Sheet');assert.equal(s.calls[1].messageSource,undefined);
 s=setup();await Promise.all([s.b.warm('teacher',s.p),s.b.warm('teacher',s.p)]);assert.equal(s.calls.length,1,'重複聚焦不能重複預讀');await s.b.handle('teacher',s.p).promise;await s.b.handle('teacher',{...s.p,requestId:'request_02'}).promise;assert.deepEqual(s.calls.map(c=>c.op),['read','commit','commit']);
 s=setup();await s.b.warm('teacher',s.p);s.setUid('teacher_b');await s.b.handle('teacher',s.p).promise;assert.equal(s.calls.filter(c=>c.op==='read').length,2,'切換帳號不能沿用前帳號預讀');
 s=setup();await s.b.warm('teacher',s.p);s.setDeny(true);await assert.rejects(s.b.handle('teacher',s.p).promise,/permission-denied/);assert.ok(s.storage.getItem('fastwrite-production-message_teacher_teacher_a-class_test-chat_'+(await hash(['science','test_class','test_student','2026/10/25'])).slice(0,40)));s.setDeny(false);await s.b.handle('teacher',s.p).promise;assert.deepEqual(s.calls.map(c=>c.op),['read','commit','receipt','commit'],'撤權或斷線不能另送 GAS；重試核對原 request');assert.equal(s.calls.at(-1).command.requestId,'request_01');
 s=setup();s.setLegacy(true);await s.b.warm('teacher',s.p);assert.equal((await s.b.handle('teacher',s.p).promise).authority,'legacy');assert.deepEqual(s.calls.map(c=>c.op),['read','read'],'回退證據不能快取成永久權威');
 s=setup();const t=await s.b.watchTarget('teacher',s.p);t.accept({segment:'p000000000001',revision:0,messages:{}});await s.b.handle('teacher',s.p).promise;assert.deepEqual(s.calls.map(c=>c.op),['commit'],'可見對話已核對，送出不重讀');s.b.clearRemote();await s.b.handle('teacher',{...s.p,requestId:'request_02'}).promise;assert.equal(s.calls.filter(c=>c.op==='read').length,1);
 s=setup();assert.equal(await s.b.warm('student',s.p),true);await s.b.handle('student',s.p).promise;assert.deepEqual(s.calls.map(c=>c.op),['read','commit'],'學生也只預讀一次；提交仍向伺服器驗證');
 s=setup();for(let i=0;i<5;i++)await s.b.warm('teacher',{...s.p,studentKey:'student_'+i});await s.b.warm('teacher',{...s.p,studentKey:'student_0'});assert.equal(s.calls.length,6,'預讀最多保存四個精確對話');
 s=setup();await s.b.warm('teacher',s.p);const oldNow=Date.now;try{Date.now=()=>oldNow()+121000;await s.b.handle('teacher',s.p).promise;}finally{Date.now=oldNow;}assert.equal(s.calls.filter(c=>c.op==='read').length,2,'逾時預讀必須重新核對');
 s=setup();await s.b.warm('teacher',s.p);await s.b.warm('god',s.p);await s.b.warm('student',s.p);assert.equal(s.calls.filter(c=>c.op==='read').length,3,'同 UID 不同角色不可共用預讀');
 s=setup();const studentTarget=await s.b.watchTarget('student',s.p);studentTarget.accept({segment:'p000000000001',revision:0,messages:{}});await s.b.handle('student',s.p).promise;assert.deepEqual(s.calls.map(c=>c.op),['commit'],'學生可見對話不重複預讀；仍必須提交');
 s=setup();await s.b.warm('god',s.p);s.setSession('session_b');await s.b.warm('god',s.p);assert.equal(s.calls.length,2,'同 UID 更換上帝視角 session 不可共用預讀');
 console.log('message preflight: 12 safety and completion scenarios passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
