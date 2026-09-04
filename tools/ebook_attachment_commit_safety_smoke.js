const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
const code=section('        function cleanupStudentUploadBatch(', '        function formatUploadSize(')+section('        function discardUploadedFeedbackDraft(', '        function registerStudentFeedbackComposer(')+section('        function removeStudentFeedbackAttachment(', '        async function sendStudentFeedbackWithAttachments(')+section('        async function sendStudentFeedbackWithAttachments(', '        function isGiftedScienceClassName(');
async function scenario(mode){
 const deleted=[];const saved=[];
 const elements={'input-thread':{value:'補畫'},'feedback-send-thread':{disabled:false},'feedback-attachment-status-thread':{}};
 const ctx={
  console:{warn(){}},Promise,
  makeDomSafeId:s=>s,
  studentFeedbackComposerContexts:{thread:{targetDate:'2026/08/22',replyToFeedbackKey:'parent'}},
  studentFeedbackAttachmentDrafts:{thread:{files:[{name:'image.jpg',size:2545159}]}},
  document:{getElementById:k=>elements[k]||null},
  isFeedbackAttachmentUploading:false,
  confirmStudentPreviewAction:async()=>true,
  uploadFeedbackAttachmentFiles:async()=>[{name:'image.jpg',path:'TEST-ONLY/image.jpg',url:'https://example.invalid/image.jpg'}],
  buildFeedbackContentWithAttachments:()=> '補畫 [附件]https://example.invalid/image.jpg',
  ebookStorage:{ref:path=>({delete:async()=>deleted.push(path)})},
  renderStudentFeedbackAttachmentDraft(){},swalAlert(){},getUploadErrorText:e=>e.message,
  sendFeedback:(id,date,type,content,ok,fail)=>{saved.push(content);if(mode==='success')ok();else fail(new Error('network response lost after server commit'));}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 await ctx.sendStudentFeedbackWithAttachments('thread');
 ctx.uploadBatchPaths=['TEST-ONLY/image.jpg'];ctx.uploadBatchUrls=['https://example.invalid/image.jpg'];
 await ctx.cleanupStudentUploadBatch();
 assert.equal(deleted.length,0,'lost homework response must not delete committed upload');
 const retained=(ctx.studentFeedbackAttachmentDrafts.thread.uploaded||[]).length;
 // User removes the file chip left in the composer after the reply failed to arrive.
 ctx.removeStudentFeedbackAttachment('thread',0);
 await Promise.resolve();
 assert.equal(saved.length,1);
 assert.equal(deleted.length,0,'removing a stale draft must never delete a committed attachment');
 return {scenario:mode,serverFeedbackSaved:saved.length,retainedUploadedDrafts:retained,deleteCallsAfterRemove:deleted.length,remoteDeletionAllowed:false};
}
(async()=>console.log(JSON.stringify(await Promise.all([scenario('success'),scenario('response_lost_after_commit')]),null,2)))();
