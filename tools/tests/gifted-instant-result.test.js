'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../gifted/app.js'),'utf8');
function setup(response){
 const nodes=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,innerHTML:'',textContent:'',querySelectorAll:()=>[],scrollIntoView(){this.scrolled=true;}});return nodes.get(id);};
 const context={URLSearchParams,location:{search:'?plan=p&segment=s'},document:{getElementById:node,querySelectorAll:()=>[],visibilityState:'visible'},navigator:{onLine:true},
 structuredClone,localStorage:{},BearStudentMedia:{bind(){},reset(){},html:()=>''},GiftedCorrectionRequest:{mount(){}},GiftedResult:{...require('../../gifted/gifted-result.js'),mount(){}},
 GiftedGradeRefresh:{create:({read})=>({refresh:read,dispose(){}})},GiftedStudentTransport:{sessionUid:'test',studentName:'合成學生',request:async req=>{requests.push(req.action);if(req.action==='summary')return new Promise(()=>{});throw Error('temporary');}}};
 context.window=context;vm.createContext(context);
 vm.runInContext(source.slice(0,source.indexOf('if(transport){initStudent();'))+'globalThis.hooks={flush,readResult,renderSummary,renderResult,paintAnswerGrid,setup:(t,b)=>{task=t;box=b;answers=t.answers;}};})();',context);
 const task={planId:'p',segmentId:'s',scopeRevision:'r',classId:'test',revision:0,target:{questionCount:2},answers:{q1:'B',q2:'A'},questions:[{id:'q1',sourceIndex:1,prompt:'題目',choices:['A','B'],options:[],media:[]},{id:'q2',sourceIndex:2,prompt:'題目',choices:['A','B'],options:[],media:[]}]};
 const result={score:{earnedPoints:1,maxPoints:2,correctCount:1,wrongCount:1,blankCount:0},items:[{questionId:'q2',answer:['A'],correctAnswers:['A'],outcome:'correct'},{questionId:'q1',answer:['B'],correctAnswers:['A'],outcome:'wrong'}]};
 context.hooks.setup(task,{snapshot:()=>({}),flush:async()=>response||{status:'submitted',result:{status:'submitted',receiptId:'r',revision:1,result}}});
 return {hooks:context.hooks,node,requests,task,result};
}
test('submission paints score and wrong questions immediately while background summary stays unresolved',async()=>{
 const f=setup();await f.hooks.flush();
 assert.match(f.node('summary').innerHTML,/1 <small>\/ 2 分/);assert.match(f.node('result').innerHTML,/章內第 1 題 · 答錯/);
 assert.ok(f.node('result').innerHTML.indexOf('第 1 題')<f.node('result').innerHTML.indexOf('第 2 題'));
 assert.equal(f.node('resultSection').hidden,false);assert.equal(f.node('submitSection').hidden,true);assert.equal(f.node('summary').scrolled,true);
 assert.match(f.node('answerGrid').innerHTML,/class="needs-correction"[^>]*data-index="0"/);
 assert.match(f.node('answerGrid').innerHTML,/1 <s>B<\/s><\/span><span class="answer-correction">→ 正確 A/);
 assert.equal(f.node('answerGridHelp').hidden,false);assert.equal(f.task.answers.q1,'B');
 assert.deepEqual(f.requests,['summary']);assert.equal(f.task.submission.receiptId,'r');
});
test('pending background registration never replaces the authoritative immediate score',async()=>{
 const f=setup();await f.hooks.flush();f.hooks.renderSummary({student:{submittedQuestionCount:2,requiredQuestionCount:4,status:'partial'},grades:[{targetId:'s',status:'pending'}]});
 assert.match(f.node('summary').innerHTML,/1 <small>\/ 2 分/);assert.match(f.node('gradeRefreshStatus').textContent,/背景登記/);
});
test('unavailable result preserves accepted receipt and provides result retry instead of resubmission',async()=>{
 const f=setup({status:'submitted',result:{status:'submitted',receiptId:'r',revision:1,feedbackStatus:'unavailable'}});await f.hooks.flush();await new Promise(setImmediate);
 assert.match(f.node('receipt').textContent,/已成功送出/);assert.match(f.node('resultStatus').textContent,/不必重交/);assert.equal(f.node('reloadResult').hidden,false);
 assert.equal(f.node('submitSection').hidden,true);assert.equal(f.node('error').textContent,'');assert.deepEqual(f.requests,['result','summary']);
 assert.doesNotMatch(f.node('answerGrid').innerHTML,/needs-correction|正確/);assert.equal(f.node('answerGridHelp').hidden,true);
});
test('a saved draft advances the revision without blocking on media/task/summary reload',async()=>{
 const f=setup({status:'saved',result:{revision:1}});await f.hooks.flush();assert.equal(f.task.revision,1);assert.match(f.node('studentStatus').textContent,/草稿已保存/);assert.deepEqual(f.requests,[]);
 assert.doesNotMatch(f.node('answerGrid').innerHTML,/needs-correction|正確/);assert.equal(f.node('answerGridHelp').hidden,true);
});
test('answer grid uses released submission answers, distinguishes blank and pending, and never guesses a missing key',()=>{
 const f=setup();f.task.submission={receiptId:'r'};
 f.result.items=[{questionId:'q1',answer:[],correctAnswers:['A','B'],outcome:'blank'},{questionId:'q2',answer:['B'],outcome:'pending'}];
 f.hooks.renderResult(f.result);
 assert.match(f.node('answerGrid').innerHTML,/留白<\/s><\/span><span class="answer-correction">→ 正確 A、B/);
 assert.match(f.node('answerGrid').innerHTML,/class="awaiting-grading"[^>]*data-index="1"/);
 assert.match(f.node('answerGrid').innerHTML,/>2 B<\/span><span class="answer-pending">待批/);
 assert.deepEqual(f.task.answers,{q1:'B',q2:'A'});assert.deepEqual(f.requests,[]);
 for(const key of [undefined,[],['unknown']]){
  f.result.items[0].correctAnswers=key;f.hooks.renderResult(f.result);
  assert.doesNotMatch(f.node('answerGrid').innerHTML,/正確|@/);assert.match(f.node('answerGrid').innerHTML,/待訂正/);
 }
});
test('result grid stays hidden until submission exists and clears correction hints for an all-correct result',()=>{
 const f=setup();f.hooks.renderResult(f.result);
 assert.doesNotMatch(f.node('answerGrid').innerHTML,/needs-correction|正確/);assert.equal(f.node('answerGridHelp').hidden,true);
 f.task.submission={receiptId:'r'};f.result.items.forEach(item=>item.outcome='correct');f.hooks.renderResult(f.result);
 assert.doesNotMatch(f.node('answerGrid').innerHTML,/needs-correction|正確/);assert.equal(f.node('answerGridHelp').hidden,true);
 assert.equal((f.node('answerGrid').innerHTML.match(/class="answered"/g)||[]).length,2);
});
