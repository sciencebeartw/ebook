'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create,isRetryable}=require('../../gifted/answer-retry');
const {create:createOutbox}=require('../../gifted/answer-outbox');
function fixture(extra={}){
 const timers=new Map(),states=[];let next=0,online=true,visible=true,pending=true,busy=false,calls=0;
 const retry=create({send:async()=>{calls++;pending=false;},isPending:()=>pending,isOnline:()=>online,isVisible:()=>visible,canSend:()=>!busy,
  setTimer:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),onWaiting:s=>states.push(s),...extra});
 return {retry,timers,states,get calls(){return calls;},setOnline:v=>online=v,setVisible:v=>visible=v,setPending:v=>pending=v,setBusy:v=>busy=v,
  async tick(){const [id,t]=timers.entries().next().value;timers.delete(id);await t.fn();await new Promise(setImmediate);}};
}
test('offline enqueue sends nothing and reconnect automatically sends once',async()=>{
 const f=fixture();f.setOnline(false);await f.retry.resume();assert.equal(f.calls,0);assert.equal(f.timers.size,0);assert.equal(f.states.at(-1),'offline');
 f.setOnline(true);await f.retry.resume();assert.equal(f.calls,1);assert.equal(f.timers.size,0);await f.retry.resume();assert.equal(f.calls,1);
});
test('repeated online/focus events share one request in flight',async()=>{
 let release,calls=0;const f=fixture({send:()=>{calls++;return new Promise(r=>release=()=>{f.setPending(false);r();});}});
 const a=f.retry.resume(),b=f.retry.resume();assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);assert.equal(f.retry.attempts,1);
 release();await a;assert.equal(f.timers.size,0);
});
test('failed requests back off, slow down after a bound, and resume immediately on reconnect',async()=>{
 const f=fixture({send:async()=>{throw new TypeError('Failed to fetch');},maxAttempts:3});
 await f.retry.resume();assert.equal([...f.timers.values()][0].ms,5000);await f.tick();assert.equal([...f.timers.values()][0].ms,10000);await f.tick();
 assert.equal(f.retry.attempts,3);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,120000);assert.equal(f.states.at(-1),'delayed');
 f.setOnline(false);await f.retry.resume();assert.equal(f.timers.size,0);f.setOnline(true);await f.retry.resume();assert.equal(f.retry.attempts,1);assert.equal(f.timers.size,1);
});
test('internet recovers with no browser online event: slow retry eventually submits and stops',async()=>{
 let calls=0;const f=fixture({send:async()=>{calls++;if(calls<4)throw new TypeError('Failed to fetch');f.setPending(false);},maxAttempts:2});
 await f.retry.resume();await f.tick();assert.equal([...f.timers.values()][0].ms,120000);
 await f.tick();assert.equal([...f.timers.values()][0].ms,120000);await f.tick();assert.equal(calls,4);assert.equal(f.timers.size,0);
});
test('hidden page and busy UI defer retries without spending attempts',async()=>{
 const f=fixture();f.setVisible(false);await f.retry.resume();assert.equal(f.calls,0);f.setVisible(true);f.setBusy(true);await f.retry.resume();
 assert.equal(f.retry.attempts,0);assert.equal(f.timers.size,1);f.setBusy(false);await f.tick();assert.equal(f.calls,1);
});
test('login, conflict, identity and invalid receipt errors never automatically retry',async()=>{
 for(const code of ['LOGIN_REQUIRED','DRAFT_CONFLICT','FORMAL_ALREADY_SUBMITTED','REQUEST_ID_REUSED','ROSTER_CHANGED','ASSIGNMENT_VERSION_CHANGED','SERVER_RECEIPT_INVALID','LOCAL_SAVE_FAILED']){
  let calls=0;const f=fixture({send:async()=>{calls++;throw Error(code);}});await f.retry.resume();await f.retry.resume();
  assert.equal(calls,1,code);assert.equal(f.timers.size,0,code);assert.equal(f.states.at(-1),'blocked');
 }
});
test('server and Firebase token network errors are retryable, permission failures are not',()=>{
 for(const e of [{name:'TimeoutError'}, {name:'AbortError'}, {message:'RETRY_OR_CHECK_RECEIPT'}, {message:'TRY_LATER'}, {code:'auth/network-request-failed'}])assert.equal(isRetryable(e),true);
 assert.equal(isRetryable({code:'auth/id-token-revoked'}),false);assert.equal(isRetryable(Error('ASSIGNMENT_NOT_OPEN')),false);
});
test('dispose during a failed request never restarts a timer or sends a late private operation',async()=>{
 let reject;const f=fixture({send:()=>new Promise((_,r)=>reject=r)});const promise=f.retry.resume();await Promise.resolve();f.retry.dispose();reject(new TypeError('Failed to fetch'));await promise;
 assert.equal(f.timers.size,0);await f.retry.resume();assert.equal(f.retry.attempts,1);
});
test('a cancelled or absent pending submit is never created by automatic retry',async()=>{
 const f=fixture();f.setPending(false);f.retry.failed(new TypeError('Failed to fetch'));await f.retry.resume();assert.equal(f.calls,0);assert.equal(f.timers.size,0);
});
test('lost reply reuses the exact outbox payload through reload and clears it only on receipt',async()=>{
 const values=new Map(),requests=[];let committed=null,writes=0,drop=true;
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const scope={sessionUid:'synthetic-student',planId:'synthetic-plan',segmentId:'week-1',scopeRevision:'r1',tabId:'synthetic-tab'};
 const transport=async payload=>{requests.push(structuredClone(payload));if(!committed){committed=structuredClone(payload);writes++;}else assert.deepEqual(payload,committed);
  if(drop){drop=false;throw new TypeError('Failed to fetch');}return {status:'submitted',revision:1,receiptId:'synthetic-receipt'};};
 const make=()=>createOutbox({storage,scope,transport,randomId:()=> 'synthetic_request_00001'});let box=make();const original=box.enqueue('submit',{q1:'A',q2:'B'},0);
 await assert.rejects(box.flush(),/Failed to fetch/);assert.deepEqual(box.snapshot().pending,original);box.close({erase:false});box=make();
 const f=fixture({send:()=>box.flush(),isPending:()=>!!box.snapshot().pending});await f.retry.resume();await f.retry.resume();
 assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(writes,1);assert.equal(box.snapshot().pending,null);assert.equal(box.snapshot().lastReceipt.receiptId,'synthetic-receipt');assert.equal(f.timers.size,0);
});
