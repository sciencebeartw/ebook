'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),start=html.indexOf('function getDisplayLogic('),end=html.indexOf('function refreshNativeHomeworkDisplays()',start);
const ctx={isHomePracticeScoreTitle:()=>false,isHomeworkColumnTitle:()=>true,isHomeworkMissingScore:()=>false,getMathAdvancedGuidanceStandard:()=>null,isMathAdvancedGuidanceExam:()=>false,isCurrentStudentEnrollmentExemptExam:()=>false,ClassSessionPlan:{isSelfMarked:()=>false},window:{},getFeedbackOverrideNum:()=>null,SVG:{frown:''}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
test('Firebase score remains usable while Sheet is pending; makeup color remains visible',()=>{const r=ctx.getDisplayLogic({score:'6',scoreNum:6,nativeScopeSheetStatus:'pending',cellColor:'#ff0000',myBucket:2},[]);assert.equal(r.mainScore,6);assert.equal(r.effectiveNum,6);assert.match(r.statusHtml,/試算表待同步/);assert.match(r.statusHtml,/觀念必須加強/);assert.equal(r.needsReport,false);});
test('normal grades and missing homework are not marked as saved pending scores',()=>{for(const e of [{score:'6',scoreNum:6},{score:'',scoreNum:null,nativeScopeSheetStatus:'pending'}])assert.doesNotMatch(ctx.getDisplayLogic(e,[]).statusHtml,/試算表待同步/);});
