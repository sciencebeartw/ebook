'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const P=require('../class_session_plan');
test('unsubmitted holiday score survives focus/context refresh, and resets on student switch',async()=>{
 const dom={},events={},windowEvents={},id='holiday_retention',post={id:'post',date:'2026/09/19',className:'class',displayOptions:{holidayPractice:{assignmentId:id,title:'test',questionUrl:'https://demo.test/q',dueAt:Date.now()+100000}}};
 const c={console,Date,URL,Promise,setTimeout:()=>{},gData:{className:'class',foundUserKey:'one',grades:[]},isAdminMode:false,isDashboardDraftPreviewMode:false,isStudentPreviewMode:false,ClassSessionPlan:P,document:{addEventListener:(n,f)=>events[n]=f,getElementById:id=>dom[id],activeElement:null},addEventListener:(n,f)=>windowEvents[n]=f,doPostAction:(a,d,ok)=>ok({success:true,assignments:{[id]:post.displayOptions.holidayPractice},progress:{[id]:{unlockedAt:1}}})};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../holiday_practice_app.js'),'utf8'),c);
 dom['holiday-card-'+id]={innerHTML:c.HolidayPracticeApp.render(post)};await new Promise(r=>setImmediate(r));
 events.input({target:{id:'holiday-score-'+id,value:'80'}});windowEvents.focus();await new Promise(r=>setImmediate(r));assert.match(dom['holiday-card-'+id].innerHTML,/value="80"/);
 c.gData.foundUserKey='two';const next=c.HolidayPracticeApp.render(post);assert.ok(!next.includes('value="80"'));
});
