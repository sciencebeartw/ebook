'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const P=require('../class_session_plan');
test('unsubmitted holiday score survives focus/context refresh, and resets on student switch',async()=>{
 const dom={},events={},windowEvents={},id='holiday_retention',post={id:'post',date:'2026/09/19',className:'class',displayOptions:{links:{holidayLabel:'中秋複習卷'},holidayPractice:{assignmentId:id,title:'test',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000}}};
 let progress={};
 const c={console,Date,URL,Promise,setTimeout:()=>{},gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:id=>dom[id],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(a,d,ok)=>ok({success:true,assignments:{[id]:post.displayOptions.holidayPractice},progress:progress})};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);assert.match(first,/class="btn-link post-button-orange"/);
 assert.match(first,/中秋複習卷｜test/);assert.doesNotMatch(first,/假期練習卷｜test/);
 post.displayOptions.links.holidayLabel='';assert.match(c.HolidayPracticeApp.render(post),/假期練習卷｜test/);post.displayOptions.links.holidayLabel='中秋複習卷';
 const main=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(main.includes('我已完成本次所有作業'));assert.ok(!main.includes('我已完成一般作業'));
 dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 assert.match(dom['holiday-card-'+id].innerHTML,/我已完成，顯示答案/);assert.match(dom['holiday-card-'+id].innerHTML,/holiday-unlock-btn/);
 progress={[id]:{unlockedAt:1}};windowEvents.focus();await new Promise(r=>setImmediate(r));
 assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/holiday-score-report/);
 assert.match(c.HolidayPracticeApp.reportFormForExam({sourceAssignmentId:id}),/holiday-score-report/);
 events.input({target:{id:'holiday-score-'+id,value:'80'}});windowEvents.focus();await new Promise(r=>setImmediate(r));assert.match(c.HolidayPracticeApp.reportFormForExam({sourceAssignmentId:id}),/value="80"/);
 c.gData.foundUserKey='two';c.HolidayPracticeApp.render(post);assert.doesNotMatch(c.HolidayPracticeApp.reportFormForExam({sourceAssignmentId:id}),/value="80"/);
});

test('ebook shared holiday policy recognizes advanced science only',()=>{
 for(const name of ['115國一自然超前班','115國二自然超前班'])assert.equal(P.supportsHolidayPractice('science',name),true);
 for(const name of ['115國一生物','115國二理化','115國一數學超前班'])assert.equal(P.supportsHolidayPractice('science',name),false);
});

test('dashboard draft preview shows the distinct holiday answer button without exposing the answer',()=>{
 const dom={},events={},windowEvents={},id='holiday_preview_button';
 const post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:{assignmentId:id,title:'理化複習',questionUrl:'https://demo.test/q',answerUrl:'https://private.test/answer',dueAt:Date.now()+100000}}};
 const c={console,Date,URL,Promise,setTimeout:()=>{},gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:true,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:key=>dom[key],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction(){throw Error('preview must not call the student action API')}};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const rendered=c.HolidayPracticeApp.render(post);
 assert.match(rendered,/holiday-preview-btn/);assert.match(rendered,/我已完成，顯示答案/);assert.match(rendered,/disabled aria-disabled="true"/);
 assert.doesNotMatch(rendered,/private\.test/);assert.doesNotMatch(rendered,/data-holiday-action="unlock"/);
});

test('pending holiday card centers its deadline and omits the redundant pending label',async()=>{
 const dom={},id='holiday_centered_deadline';
 const post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:{assignmentId:id,title:'理化複習',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000}}};
 const c={console,Date,URL,Promise,setTimeout:()=>{},gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener(){},getElementById:key=>dom[key],activeElement:null},addEventListener(){},doPostAction:(action,data,ok)=>ok({success:true,assignments:{[id]:post.displayOptions.holidayPractice},progress:{}})};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 const rendered=dom['holiday-card-'+id].innerHTML;
 assert.match(rendered,/holiday-deadline-box/);assert.match(rendered,/holiday-deadline-hint/);assert.match(rendered,/holiday-unlock-hint/);
 assert.match(rendered,/完成作答後按一下，答案會立即開啟。/);assert.doesNotMatch(rendered,/>待作答</);
});

test('named student preview loads the real holiday control and asks before unlocking',async()=>{
 const dom={},events={},windowEvents={},id='holiday_named_preview';
 const assignment={assignmentId:id,title:'理化複習',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000,revision:1};
 const post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:assignment}};
 let progress={},confirmCount=0,unlockCount=0;
 const c={console,Date,URL,Promise,setTimeout:()=>{},safeKey:value=>value,gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:true,ClassSessionPlan:P,confirmStudentPreviewAction:async label=>{confirmCount++;assert.equal(label,'開啟假期卷答案');return true},document:{addEventListener:(n,f)=>events[n]=f,getElementById:key=>dom[key],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(action,data,ok)=>{if(action==='getHolidayPracticeContext')ok({success:true,assignments:{[id]:assignment},progress});else{unlockCount++;progress={[id]:{unlockedAt:1}};ok({success:true,progress:progress[id],answerUrl:'https://private.test/answer'});}}};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 assert.match(dom['holiday-card-'+id].innerHTML,/data-holiday-action="unlock"/);assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/holiday-preview-btn/);
 events.click({target:{closest:()=>({dataset:{assignment:id,holidayAction:'unlock'}})}});await new Promise(r=>setImmediate(r));
 assert.equal(confirmCount,1);assert.equal(unlockCount,1);assert.match(dom['holiday-card-'+id].innerHTML,/private\.test\/answer/);assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/再次開啟答案卷/);
});

test('holiday practice has an independent homework field when regular homework is empty',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(main,/var hasRegularHomeworkTwo = homeworkItems\.some/);
 assert.match(main,/if \(holidayHtml && !hasRegularHomeworkTwo\)[\s\S]{0,500}label: homeworkItems\.length \? "今日作業二" : "今日作業"/);
 assert.doesNotMatch(main,/homeworkItems\.push\(\{ key: "hw2", label: "今日作業二", val: "" \}\)/);
});

test('unlocked holiday practice renders an answer-style button instead of the old reopen wording',async()=>{
 const dom={},events={},windowEvents={},id='holiday_answer_button';
 const assignment={assignmentId:id,title:'理化複習',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000,revision:1};
 const post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:assignment}};
 const progress={[id]:{unlockedAt:1}};
 const c={console,Date,URL,Promise,setTimeout:()=>{},safeKey:value=>value,gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:key=>dom[key],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(action,data,ok)=>ok({success:true,assignments:{[id]:assignment},progress})};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 assert.match(dom['holiday-card-'+id].innerHTML,/holiday-answer-btn/);
 assert.match(dom['holiday-card-'+id].innerHTML,/假期練習卷答案｜理化複習/);
 assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/再次開啟答案卷/);
 assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/holiday-score-report/);
 const reportForm=c.HolidayPracticeApp.reportFormForExam({sourceAssignmentId:id});
 assert.match(reportForm,/score-report-section holiday-score-report/);
 assert.match(reportForm,/回報假期練習卷分數/);
 assert.match(reportForm,/max="200"/);
 assert.equal(P.validScore(150),150);
 assert.equal(P.validScore(201),null);
});

test('unlock click immediately shows progress and swaps to the answer link without a reload',async()=>{
 const dom={},events={},windowEvents={},id='holiday_fast_feedback';let unlockCallback;
 const assignment={assignmentId:id,title:'理化複習',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000,revision:1};
 const post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:assignment}};
 const c={console,Date,URL,Promise,setTimeout:()=>{},safeKey:value=>value,gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:key=>dom[key],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(action,data,ok)=>{if(action==='getHolidayPracticeContext')ok({success:true,assignments:{[id]:assignment},progress:{}});else unlockCallback=ok;}};c.window=c;vm.createContext(c);
 const icons=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const SVG = \{[\s\S]*?\n        \};/)[0];vm.runInContext(icons,c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 events.click({target:{closest:()=>({dataset:{assignment:id,holidayAction:'unlock'}})}});
 assert.match(dom['holiday-card-'+id].innerHTML,/正在開啟答案…/);
 unlockCallback({success:true,progress:{unlockedAt:1},answerUrl:'https://private.test/answer'});
 await new Promise(r=>setImmediate(r));
 assert.match(dom['holiday-card-'+id].innerHTML,/private\.test\/answer/);
 assert.doesNotMatch(dom['holiday-card-'+id].innerHTML,/正在開啟答案|再次開啟答案卷/);
});
