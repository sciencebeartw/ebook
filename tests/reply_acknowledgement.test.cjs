'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const W=path.join(__dirname,'..');
function row(){return {actorRole:'teacher',source:'ebook_god_teacher',replyToFeedbackKey:'root',clientRequestId:'request',storedStudentKey:'student',storedClassKey:'class',fbKey:'reply',targetDate:'2026/11/22',content:'original',contentProjection:'current',safeC:'class',stuKey:'student',cls:'class'};}
function ui(){return {fromVisible:(text,version)=>({verified:Promise.resolve({version}),text}),preview:(text,p)=>({verified:p.then(r=>r.revision||r),text}),edit:async(dialog,initial,submit)=>{const v=(await initial.verified).version;const result=await submit({operation:'edit',version:v,text:'edited'});return result.revision;}};}
test('god private acknowledgement survives public catchup, expires, and isolates sessions',async()=>{
 let now=1000,version=0,session='a';const calls=[],item=row(),menu={dataset:{feedbackId:'reply',feedbackClass:'class',feedbackStudent:'student'},setAttribute(){},removeAttribute(){}};const button={dataset:{feedbackOperation:'edit'},closest:()=>menu};
 const context={window:{FeedbackRevisionUI:ui(),refreshProductionFeedbackView(){}},canUseAdminModeReply:()=>true,isStudentPreviewMode:false,isDashboardDraftPreviewMode:false,gData:{className:'class',feedbackHistory:[item]},safeKey:x=>x,productionMessageDate:x=>x,escapeHtmlAttr:x=>x,Swal:{},swalAlert:async()=>{},createClientRequestId:()=>Math.random().toString(),ebookGodSessionInfo:{},Date:{now:()=>now},getGodSessionCallable:()=>async({data})=>{calls.push(data.operation);if(data.operation==='read')return {data:{result:{version}}};assert.equal(data.version,version);return {data:{result:{revision:{version:++version,content:'edited',operation:'edit'}}}};}};
 Object.defineProperty(context,'ebookGodSessionId',{get:()=>session});vm.runInNewContext(fs.readFileSync(path.join(W,'ebook_teacher_feedback_actions.js'),'utf8'),context);const actions=context.window.EbookTeacherFeedbackActions;
 await actions.open(button);assert.deepEqual(calls,['read','edit']);item.content='edited';actions.overlay(item);await actions.open(button);assert.deepEqual(calls,['read','edit','edit']);
 now+=120001;actions.overlay(item);await actions.open(button);assert.equal(calls.at(-2),'read');
 item.content='edited';actions.overlay(item);item.content='other device';actions.overlay(item);await actions.open(button);assert.equal(calls.at(-2),'read');
 session='b';actions.overlay(item);await actions.open(button);assert.equal(calls.at(-2),'read');
});
