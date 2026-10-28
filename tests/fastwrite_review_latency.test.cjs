const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {create}=require('../fastwrite_dashboard_score_bridge');
const transport=require('../fastwrite_production_transport');
const hash=async p=>crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
function setup(subject='science'){
 const memory=new Map(),calls=[],read=deferred(),receipt=deferred();let uid='teacher';
 const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const b=create({scopes:[{scopeId:'class_test',className:'班級',classKey:'班級',epoch:1,subject,gradeAuthority:'bidirectional',enabled:true}],storage,hash,getUid:()=>uid,transport,callable:async p=>{
  calls.push(p);const d=p.data;
  if(d.operation==='read')return{data:await read.promise};
  if(d.operation==='receipt')return{data:await receipt.promise};
  assert.equal(d.operation,'commit');assert.equal(d.command.expectedRevision,7);
  return{data:{businessStatus:'committed',revision:8,eventId:'event_8',result:d.command.action==='set_makeup_color'?{color:d.command.data.color}:{score:d.command.data.score},committedAt:123}};
 }});
 const payload={className:'班級',sourceClassName:'班級',studentKey:'student',feedbackId:'feedback',writeExamId:'exam',sourceExamId:'exam',targetExamId:'exam',examColIndex:5,sourceSurface:'dashboard_feedback_center',scoreValue:'68',colorHex:'#ff0000'};
 return{b,payload,calls,read,receipt,memory,setUid:v=>{uid=v}};
}
test('science and math score/color review start current view and original receipt together, commit only after both',async()=>{
 for(const subject of ['science','math'])for(const action of ['writeScoreGas','writeMakeupResultColorGas']){
  const c=setup(subject),p=c.b.handle(action,c.payload,subject).promise;await tick();
  assert.deepEqual(c.calls.map(p=>p.data.operation),['read','receipt']);
  c.read.resolve({kind:'grade',revision:7,business:{score:'',color:'#ffffff'}});await tick();assert.equal(c.calls.length,2);assert.equal(c.memory.size,0);
  c.receipt.resolve(null);const result=await p;assert.equal(result.businessStatus,'committed');assert.equal(result.sheetStatus,'pending');assert.equal(c.calls.length,3);
  assert.equal([...c.memory.keys()].filter(k=>k.startsWith('fastwrite-production-')).length,0);
 }
});
test('known original receipt completes review without another commit',async()=>{
 const c=setup(),p=c.b.handle('writeScoreGas',c.payload,'science').promise;await tick();
 c.receipt.resolve({businessStatus:'committed',revision:8,eventId:'event_8',result:{score:'68'},committedAt:123});
 c.read.resolve({kind:'grade',revision:8,business:{score:'68',color:'#ffffff'}});
 assert.equal((await p).businessStatus,'committed');assert.deepEqual(c.calls.map(p=>p.data.operation),['read','receipt']);
});
test('read failure and account drift do not prepare or send any command',async()=>{
 for(const drift of [false,true]){
  const c=setup(),p=c.b.handle('writeScoreGas',c.payload,'science').promise;const rejected=assert.rejects(p);await tick();
  c.receipt.resolve(null);if(drift){c.setUid('other');c.read.resolve({kind:'grade',revision:7,business:{score:'',color:'#ffffff'}})}else c.read.reject(Error('network'));
  await rejected;assert.equal(c.calls.length,2);assert.equal(c.memory.size,0);
 }
});
test('direct score editing keeps its exact current-value guard and skips receipt lookup',async()=>{
 const c=setup(),payload={...c.payload,sourceSurface:'dashboard_score_center',feedbackId:undefined,teacherDirectScoreWriteback:true,teacherScoreCorrection:true,expectedCurrentScore:'50',clientRequestId:'direct_request'};
 const p=c.b.handle('writeScoreGas',payload,'science').promise;const rejected=assert.rejects(p,/目前分數已變更/);await tick();
 c.read.resolve({kind:'grade',revision:7,business:{score:'60',color:'#ffffff'}});await rejected;
 assert.deepEqual(c.calls.map(p=>p.data.operation),['read']);assert.equal(c.memory.size,0);
});
test('verified rollback still permits legacy behavior when parallel receipt lookup rejects',async()=>{
 const c=setup(),p=c.b.handle('writeScoreGas',c.payload,'science').promise;await tick();
 c.receipt.reject(Error('receipt-on-legacy'));c.read.resolve({kind:'grade',authority:'legacy',rollbackVerificationHash:'a'.repeat(64)});
 assert.equal((await p).authority,'legacy');assert.equal(c.memory.size,0);assert.equal(c.calls.length,2);
});
test('receipt lookup failure prevents a new review commit',async()=>{
 const c=setup(),p=c.b.handle('writeScoreGas',c.payload,'science').promise;const rejected=assert.rejects(p,/receipt-network/);await tick();
 c.receipt.reject(Error('receipt-network'));c.read.resolve({kind:'grade',revision:7,business:{score:'',color:'#ffffff'}});
 await rejected;assert.equal(c.memory.size,0);assert.equal(c.calls.length,2);
});
