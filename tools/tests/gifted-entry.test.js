'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../gifted_entry.js'),'utf8');
const plan='hw_'+'a'.repeat(64);
function setup(enabled=true,deepLink=true,overrides={}){const values=new Map(),elements=[],listeners=[],events={};const storage={get length(){return values.size;},key:i=>[...values.keys()][i],removeItem:k=>values.delete(k)};
const document={addEventListener:(name,fn)=>events[name]=fn,body:{append:e=>elements.push(e),classList:{add(){},remove(){}}},createElement:tag=>({tag,contentWindow:{},setAttribute(){},focus(){},children:[],append(...items){this.children.push(...items);},remove(){const i=elements.indexOf(this);if(i>=0)elements.splice(i,1);}})};
let resolveFetch;const context={URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{href:'https://school.example/ebook/'+(deepLink?'?gifted='+plan+'&segment=week-1':''),search:deepLink?'?gifted='+plan+'&segment=week-1':''},localStorage:storage,document,GIFTED_HOMEWORK_RELEASE:{enabled,studentApi:'https://api.example/student'},fetch:()=>new Promise(r=>{resolveFetch=r;})};Object.assign(context,overrides);context.window=context;
vm.createContext(context);vm.runInContext(code,context);
const auth={currentUser:{uid:'student-a',getIdToken:async()=> 'opaque'},onAuthStateChanged(fn){listeners.push(fn);return()=>{};}};
const ready=extra=>context.GiftedEbook.ready({auth,result:{studentName:'合成學生'},mode:'remembered_session',...extra});
const click=(href,extra={})=>{let prevented=false;events.click({button:0,target:{closest:()=>({href,hasAttribute:()=>false})},preventDefault(){prevented=true;},...extra});return prevented;};
return {context,ui:context.GiftedEbook,ready,auth,values,elements,listeners,click,resolveFetch:()=>resolveFetch({ok:true,json:async()=>({privateResult:'owner-only'})})};}
test('closed config and teacher preview never create a student frame',()=>{for(const extra of [{preview:true},{mode:'god_session'},{mode:'student_preview'},{result:{isAdmin:true} }]){const f=setup();f.ready(extra);assert.equal(f.elements.length,0);}const f=setup(false);f.ready();assert.equal(f.elements.length,0);});
test('return then logout erases only current owner drafts; a different login cannot reuse the bridge',()=>{const f=setup();f.ready();f.values.set('gifted-answer-outbox-v1:student-a|p','old');f.values.set('gifted-correction-request:student-a:p','private');f.values.set('unrelated','retain');assert.throws(()=>f.ui.getTransport({}),/LOGIN_REQUIRED/);f.ui.close(false);assert.equal(f.values.size,3);f.ui.close(true);assert.deepEqual([...f.values.keys()],['unrelated']);f.ready();f.auth.currentUser={uid:'student-b',getIdToken:async()=> 'new'};assert.throws(()=>f.ui.getTransport({}),/LOGIN_REQUIRED/);});
test('logout invalidates a request in flight and removes the frame before any stale response is returned',async()=>{const f=setup();f.ready();const frame=f.elements[0].children[1],transport=f.ui.getTransport(frame.contentWindow);const pending=transport.request({action:'task'});await new Promise(setImmediate);f.ui.close(true);f.resolveFetch();await assert.rejects(pending,/LOGIN_REQUIRED/);assert.equal(f.elements.length,0);assert.throws(()=>f.ui.getTransport(frame.contentWindow),/LOGIN_REQUIRED/);});
test('plain contact book opens a native homework link with its in-memory login and can reopen after return',()=>{
 const f=setup(true,false);f.ready({mode:'manual-login'});assert.equal(f.elements.length,0);
 const href='https://www.sciencebear.com.tw/ebook/?gifted='+plan+'&segment=week-1';
 assert.equal(f.click(href),true);const frame=f.elements[0].children[1];
 assert.equal(new URL(frame.src).origin,'https://school.example');assert.equal(new URL(frame.src).searchParams.get('plan'),plan);
 assert.equal(f.ui.getTransport(frame.contentWindow).sessionUid,'student-a');assert.equal(f.values.size,0);
 assert.equal(f.click(href),true);assert.equal(f.elements[0].children[1],frame);
 f.ui.close(false);assert.equal(f.click(href),true);assert.notEqual(f.elements[0].children[1],frame);
 f.ui.close(true);assert.equal(f.click(href),false);assert.equal(f.elements.length,0);
});
test('only trusted native homework links intercept an ordinary click',()=>{
 const f=setup(true,false);f.ready();const native='https://www.sciencebear.com.tw/ebook/?gifted='+plan;
 for(const href of ['https://example.com/ebook/?gifted='+plan,'https://www.sciencebear.com.tw/other/?gifted='+plan,'https://www.sciencebear.com.tw/ebook/?gifted=invalid',native+'&segment=week-0','https://someone@www.sciencebear.com.tw/ebook/?gifted='+plan,'https://docs.google.com/forms/d/example'])assert.equal(f.click(href),false,href);
 for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}])assert.equal(f.click(native,extra),false);
 assert.equal(f.elements.length,0);assert.equal(f.click(native),true);
});
test('preview, disabled feature, changed identity and logged-out sessions cannot open a link',()=>{
 const href='https://www.sciencebear.com.tw/ebook/?gifted='+plan;
 for(const extra of [{preview:true},{mode:'admin_view'},{mode:'god_session'},{mode:'student_preview'},{mode:'dashboard_draft_preview'},{result:{isAdmin:true}}]){const f=setup(true,false);f.ready(extra);assert.equal(f.click(href),false);}
 const disabled=setup(false,false);disabled.ready();assert.equal(disabled.click(href),false);
 const f=setup(true,false);f.ready();f.auth.currentUser={uid:'student-b'};assert.equal(f.click(href),false);f.auth.currentUser=null;assert.equal(f.click(href),false);
});
test('switching a segment retires the old frame and its in-flight transport',async()=>{
 const f=setup(true,false);f.ready();const href='https://www.sciencebear.com.tw/ebook/?gifted='+plan;
 f.click(href+'&segment=week-1');const old=f.elements[0].children[1],transport=f.ui.getTransport(old.contentWindow),pending=transport.request({action:'task'});await new Promise(setImmediate);
 assert.equal(f.click(href+'&segment=week-2'),true);const frame=f.elements[0].children[1];assert.notEqual(frame,old);assert.equal(new URL(frame.src).searchParams.get('segment'),'week-2');
 f.resolveFetch();await assert.rejects(pending,/LOGIN_REQUIRED/);assert.throws(()=>f.ui.getTransport(old.contentWindow),/LOGIN_REQUIRED/);
});

test('verified Dashboard teacher view opens the first homework in place, read-only and without token storage',async()=>{
 for(const mode of ['god_session']){
  const f=setup(true,false);f.ready({mode,teacherView:true,result:{isAdmin:true,studentName:'測試生'}});
  assert.equal(f.click('https://www.sciencebear.com.tw/ebook/?gifted='+plan),true);
  const frame=f.elements[0].children[1],transport=f.ui.getTransport(frame.contentWindow);
  assert.equal(transport.readOnly,true);assert.equal(f.values.size,0);
  for(const action of ['draft','submit','requestCorrection'])await assert.rejects(transport.request({action}),/TEACHER_VIEW_READ_ONLY/);
  const pending=transport.request({action:'task'});await new Promise(setImmediate);f.resolveFetch();assert.equal((await pending).privateResult,'owner-only');
  await f.elements[0].children[0].onclick();assert.equal(f.elements.length,0);
 }
 const f=setup();f.ready({teacherView:true,mode:'god_session',preview:true});assert.equal(f.elements.length,0);
});

test('Dashboard student preview prompts before formal actions, preserves cancellation and forwards activity',async()=>{
 const f=setup(true,false);f.ready({mode:'student_preview',teacherView:true,result:{studentName:'測試生'}});
 assert.equal(f.click('https://www.sciencebear.com.tw/ebook/?gifted='+plan),true);
 const frame=f.elements[0].children[1],transport=f.ui.getTransport(frame.contentWindow);
 assert.equal(transport.readOnly,false);assert.equal(transport.studentPreview,true);
 const prompts=[];let accepted=false,activity=0;
 f.context.confirmStudentPreviewAction=async label=>{prompts.push(label);return accepted;};f.context.markEbookGodSessionActivity=()=>activity++;
 assert.equal(await transport.confirmWrite('submit'),false);assert.match(prompts[0],/正式成績/);
 accepted=true;assert.equal(await transport.confirmWrite('submit'),true);assert.equal(await transport.confirmWrite('requestCorrection'),true);
 transport.activity();assert.equal(activity,1);
 const pending=transport.request({action:'submit'});await new Promise(setImmediate);f.resolveFetch();await pending;
 f.ui.close(true);await assert.rejects(transport.confirmWrite('submit'),/LOGIN_REQUIRED/);assert.throws(()=>transport.activity(),/LOGIN_REQUIRED/);
});

test('iPad without AbortSignal.timeout reads homework and releases its timeout',async()=>{
 const timers=new Map();let signal;
 const f=setup(true,true,{AbortSignal:{},setTimeout:(fn,ms)=>{assert.equal(ms,30000);timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),fetch:async(url,input)=>{signal=input.signal;return {ok:true,json:async()=>({loaded:true})};}});
 f.ready();const transport=f.ui.getTransport(f.elements[0].children[1].contentWindow);
 assert.equal((await transport.request({action:'task'})).loaded,true);
 assert.equal(signal.aborted,false);assert.equal(timers.size,0);
});
test('homework request still aborts on timeout and cleans up after network failure',async()=>{
 let expire,cleared=0;
 const f=setup(true,true,{AbortSignal:{},setTimeout:fn=>{expire=fn;return 1;},clearTimeout:()=>cleared++,fetch:(url,input)=>new Promise((resolve,reject)=>input.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});
 f.ready();const pending=f.ui.getTransport(f.elements[0].children[1].contentWindow).request({action:'task'});
 await new Promise(setImmediate);expire();await assert.rejects(pending,{name:'AbortError'});assert.equal(cleared,1);
 f.context.fetch=async()=>{throw new TypeError('offline');};
 await assert.rejects(f.ui.getTransport(f.elements[0].children[1].contentWindow).request({action:'task'}),/offline/);assert.equal(cleared,2);
});

test('standalone homework transport also supports browsers without AbortSignal.timeout',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../gifted/app.js'),'utf8');
 const apiSource=source.slice(source.indexOf('async function api('),source.indexOf('const credential='));
 let expire,cleared=0;
 const ctx={AbortSignal:{},AbortController,setTimeout:fn=>{expire=fn;return 1;},clearTimeout:()=>cleared++,fetch:async()=>({ok:true,json:async()=>({loaded:true})})};
 vm.createContext(ctx);vm.runInContext(apiSource,ctx);
 assert.equal((await ctx.api('/api/student',{action:'task'},'synthetic-token')).loaded,true);assert.equal(cleared,1);
 ctx.fetch=(url,input)=>new Promise((resolve,reject)=>input.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
 const pending=ctx.api('/api/student',{action:'task'},'synthetic-token');expire();await assert.rejects(pending,{name:'AbortError'});assert.equal(cleared,2);
});

test('summary read is authenticated, scoped, and does not need to open homework',async()=>{
 const f=setup(true,false),seen=[];f.context.fetch=async(url,input)=>{seen.push({url,input});return {ok:true,json:async()=>({planId:plan})};};f.ready();
 assert.equal((await f.ui.readSummary({planId:plan,segmentId:'week-1'})).planId,plan);assert.equal(f.elements.length,0);
 assert.deepEqual(JSON.parse(seen[0].input.body),{action:'summary',planId:plan,segmentId:'week-1'});assert.equal(seen[0].input.headers.Authorization,'Bearer opaque');
 assert.equal(f.values.size,0);
});
test('summary read rejects an old identity after logout or a different login',async()=>{
 for(const switchUser of [false,true]){const f=setup(true,false);f.ready();const pending=f.ui.readSummary({planId:plan,segmentId:'week-1'});await new Promise(setImmediate);
 if(switchUser){f.auth.currentUser={uid:'student-b',getIdToken:async()=> 'new'};f.ready();}else f.ui.close(true);
 f.resolveFetch();await assert.rejects(pending,/LOGIN_REQUIRED/);}
});
