'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const source=process.env.STICKER_FRONTEND_SOURCE||path.resolve(__dirname,'..');
const {create}=require(path.join(source,'fastwrite_student_stickers.js')),transport=require(path.join(source,'fastwrite_production_transport.js'));
function fixture({committed=false,code='failed-precondition',unknown=false,vanishAtSend=false}={}){
 const saved=new Map(),calls=[],receipts={},old={requestId:'original_request',epoch:1,expectedRevision:0,action:'apply_stickers',data:{delta:5,reason:'上週申請',date:'2026-10-31'}};
 let reads=0;
 const storage={getItem:k=>{if(vanishAtSend&&++reads===4)saved.delete(k);return saved.get(k)||null;},setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const receipt={businessStatus:'committed',eventId:'a'.repeat(64),revision:1,result:{balance:4}};if(committed)receipts[old.requestId]=receipt;
 const callable=async q=>{const p=q.data;calls.push(p);
  if(unknown)throw Object.assign(Error('unavailable'),{code:'unavailable'});
  if(p.operation==='receipt')return{data:receipts[p.requestId]||null};
  if(p.operation==='read')return{data:{kind:'stickers',revision:1,business:{balance:4}}};
  if(p.command.data.date==='2026-10-31')throw Object.assign(Error('expired'),{code,details:{businessStatus:'rejected',reason:'sticker-latest-date-required',requestId:p.command.requestId}});
  receipts[p.command.requestId]=receipt;return{data:receipt};
 };
 const route={scopeId:'scope',className:'測試班',epoch:1,subject:'science',scoreAuthority:'dashboard',enabled:true},ctx={uid:'test',className:'測試班',studentName:'測試',studentKey:'測試',isAdmin:false};
 const t=transport.create({callable,storage,namespace:'student_stickers_test',scope:'scope',entityId:'stickers_'+'b'.repeat(40),epoch:1});t.prepare(old);
 const b=create({scopes:[route],callable,storage,getContext:()=>ctx,hash:async()=>'b'.repeat(64),transport});
 const p={className:'測試班',studentName:'測試',targetDate:'2026/11/07',type:'棒卡申請',clientRequestId:'new_request',content:JSON.stringify({count:10,reason:'本週申請',status:'待審核'})};
 return{saved,calls,t,old,send:patch=>b.handle('submitFeedback',{...p,...patch},'science').promise};
}
for(const code of ['failed-precondition','functions/failed-precondition'])test('跨週失敗由原收據查核及伺服器終態解除 '+code,async()=>{
 const f=fixture({code});const result=await f.send();assert.equal(result.businessStatus,'committed');assert.equal(f.t.pending(),null);
 assert.deepEqual(f.calls.map(x=>x.operation),['receipt','commit','read','commit']);assert.equal(f.calls[1].command.requestId,'original_request');assert.equal(f.calls[3].command.requestId,'new_request');assert.equal(f.calls[3].command.data.date,'2026-11-07');
});
test('舊請求其實成功時只確認原筆，提醒查看紀錄再決定新申請',async()=>{
 const f=fixture({committed:true});await assert.rejects(f.send(),/已確認儲存/);assert.deepEqual(f.calls.map(x=>x.operation),['receipt']);assert.equal(f.t.pending(),null);
});
test('斷線與未知結果保留完整原命令，不產生新請求',async()=>{
 const f=fixture({unknown:true});await assert.rejects(f.send(),/unavailable/);assert.deepEqual(f.t.pending(),f.old);assert.equal(f.calls.length,1);
});
test('同週改內容不偷偷重送原內容；仍保留原請求',async()=>{
 const f=fixture();await assert.rejects(f.send({targetDate:'2026/10/31'}),/原內容重試/);assert.equal(f.calls.length,0);assert.deepEqual(f.t.pending(),f.old);
});
test('另一分頁已移除未確認資料但未取得終態時不自動送出',async()=>{
 const f=fixture({vanishAtSend:true});await assert.rejects(f.send(),/結果尚未確認/);assert.equal(f.calls.length,0);assert.equal(f.t.pending(),null);
});
