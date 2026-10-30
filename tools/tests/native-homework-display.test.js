'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('../../gifted_homework_status');
const html=fs.readFileSync(require('node:path').resolve(__dirname,'../../index.html'),'utf8');
function extract(name){const begin=html.indexOf('        function '+name+'('),end=html.indexOf('\n        function ',begin+20);assert(begin>=0&&end>begin);return html.slice(begin,end);}
function fixture(read){
 const a={planId:'hw_test',segmentId:'week-1'},exam={date:'2026/10/25作業',exam:'機械｜概念一',score:'',scoreNum:null};
 const api=create({parseAssignment:()=>a,readSummary:read});api.activate('test');api.observe([{date:'2026/10/25',hw1:'https://school.example/ebook/?gifted=hw_test'}],[exam],'測試班');
 const ctx=vm.createContext({window:{GiftedHomeworkStatus:api},ClassSessionPlan:{isSelfMarked:()=>false},
 isHomePracticeScoreTitle:()=>false,isHomeworkColumnTitle:()=>true,isHomeworkMissingScore:()=>true,getMathAdvancedGuidanceStandard:()=>null,isMathAdvancedGuidanceExam:()=>false,isCurrentStudentEnrollmentExemptExam:()=>false,
 escapeHtml:String,escapeHtmlAttr:String,getFeedbackOverrideNum:()=>null});vm.runInContext(extract('getDisplayLogic'),ctx);
 return {api,exam,show:()=>ctx.getDisplayLogic(exam,[])};
}
const reply=score=>({planId:'hw_test',classId:'測試班',grades:[{targetId:'week-1',lessonDate:'2026-10-25',title:'機械｜概念一',status:'pending',submission:{status:'submitted',submittedAt:1000,score,maxScore:11}}]});
test('real contact-book renderer uses the committed Firebase score even when Sheet is blank',async()=>{for(const score of [0,9]){const f=fixture(async()=>reply(score));assert.equal(f.show().mainScore,'確認繳交狀態中');await f.api.load('hw_test|week-1');const d=f.show();assert.equal(d.effectiveNum,score);assert.equal(d.mainScore,String(score));assert.match(d.statusHtml,/已繳交・試算表同步中/);assert.equal(d.needsReport,false);}});
test('renderer preserves manual grade and shows an actionable unknown on lookup failure',async()=>{const f=fixture(async()=>{throw Error('offline')});await f.api.load('hw_test|week-1');assert.equal(f.show().mainScore,'暫時無法確認');assert.match(f.show().statusHtml,/重新確認繳交狀態/);f.exam.score='8';f.exam.scoreNum=8;assert.equal(f.show().mainScore,8);});
