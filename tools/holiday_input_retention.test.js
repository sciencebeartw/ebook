'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const P=require('../class_session_plan');
test('unsubmitted holiday score survives focus/context refresh, and resets on student switch',async()=>{
 const dom={},events={},windowEvents={},id='holiday_retention',post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:{assignmentId:id,title:'test',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000}}};
 let progress={};
 const c={console,Date,URL,Promise,setTimeout:()=>{},gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:id=>dom[id],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(a,d,ok)=>ok({success:true,assignments:{[id]:post.displayOptions.holidayPractice},progress:progress})};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 const first=c.HolidayPracticeApp.render(post);assert.match(first,/class="btn-link"/);
 const main=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(main.includes('我已完成本次作業'));assert.ok(!main.includes('我已完成一般作業'));
 dom['holiday-card-'+id]={innerHTML:first};await new Promise(r=>setImmediate(r));
 assert.match(dom['holiday-card-'+id].innerHTML,/我已完成，顯示答案/);assert.match(dom['holiday-card-'+id].innerHTML,/holiday-unlock-btn/);
 progress={[id]:{unlockedAt:1}};windowEvents.focus();await new Promise(r=>setImmediate(r));
 events.input({target:{id:'holiday-score-'+id,value:'80'}});windowEvents.focus();await new Promise(r=>setImmediate(r));assert.match(dom['holiday-card-'+id].innerHTML,/value="80"/);
 c.gData.foundUserKey='two';const next=c.HolidayPracticeApp.render(post);assert.ok(!next.includes('value="80"'));
});
