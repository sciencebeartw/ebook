#!/usr/bin/env node
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function block(start,end){const a=html.indexOf('function '+start+'('),b=html.indexOf('function '+end+'(',a+1);assert(a>=0&&b>a);return html.slice(a,b);}
const id='exam_12345678-1234-1234-1234-123456789012',col='pending_'+id;
function setup(){
 let overlays=0;
 const ctx={window:{overlayProductionGrade:g=>{overlays++;return {...g,score:g.score==='stale'?'':g.score};}},EbookLifecycleApp:{buildTransferChain:()=>[]},GiftedAssignmentVisibility:{visible:()=>true},normalizeEbookExamLookupText:v=>String(v).replace(/\s+/g,''),shouldIncludeTransferGrade:()=>true,getTransferGradePresentation:()=>({className:'班',sourceClassName:'班'}),getTransferDateKey:()=>1,getTransferFallbackYear:()=>2026,isHomeworkColumnTitle:()=>false,isMathAdvancedGuidanceExam:()=>false,getMathAdvancedGuidanceStandard:()=>null};
 vm.createContext(ctx);vm.runInContext(block('isFastWriteInitialGrade','collectGradeDateAnchorKeys')+block('buildGradeListFromExams','buildGradeListFromClassExamMap'),ctx);
 ctx.resolveTransferGradeDisplayIdentity=o=>({date:o.grade.date,examId:ctx.getVerifiedStoredGradeExamId(o.grade,o.colKey,'班',o.examIdByColKey,o.examCatalogEntriesByClassKey),sourceColKey:o.colKey});
 return{ctx,rows:e=>ctx.buildGradeListFromExams(e,{classKey:'班',className:'班',examCatalogEntriesByClassKey:{班:{[id]:{colKey:'col_5',date:'2026/10/29小考',title:'新卷'}}}}),get overlays(){return overlays;}};
}
function grade(score='50'){return{date:'2026/10/29小考',examName:'新卷',score,fastWriteExamId:id,fastWriteInitial:{schema:1,scope:'class_fixture',requestId:'req_fixture',examId:id,requestHash:'a'.repeat(64),scoreHash:'b'.repeat(64)}};}
test('parent sees first grades before Sheet catalog exists and without canonical blank overlay',()=>{const s=setup(),g=grade();const rows=s.ctx.buildGradeListFromExams({[col]:g},{classKey:'班',className:'班'});assert.equal(rows.length,1);assert.equal(rows[0].score,'50');assert.equal(rows[0].examId,id);assert.equal(s.overlays,0);});
test('initial zero and leave retain values while physical blank column cannot hide or duplicate same exam',()=>{for(const value of ['0','假']){const s=setup(),rows=s.rows({[col]:grade(value),col_5:{...grade(''),fastWriteInitial:null}});assert.equal(rows.length,1);assert.equal(rows[0].score,value);assert.equal(rows[0].scoreNum,value==='0'?0:null);}});
test('atomic settlement shows actual manual/newer score and keeps unrelated exam',()=>{const s=setup(),rows=s.rows({col_5:{...grade('99'),fastWriteInitial:null},col_6:{date:'2026/10/20小考',examName:'舊卷',score:'77',note:'原備註'}});assert.equal(rows.length,2);assert.equal(rows.find(g=>g.examId===id).score,'99');assert.equal(rows.find(g=>g.exam==='舊卷').score,'77');});
test('malformed pending marker is excluded rather than misidentified by stale column catalog',()=>{const s=setup();assert.equal(s.rows({[col]:{...grade(),fastWriteInitial:{...grade().fastWriteInitial,examId:'other'}}}).length,0);assert.equal(s.ctx.getVerifiedStoredGradeExamId({date:'不同日期',examName:'舊卷'},'col_5','班',{col_5:id},{班:{[id]:{date:'2026/10/29小考',title:'新卷',colKey:'col_5'}}}),'');});
