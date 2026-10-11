'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {visible}=require('../gifted_assignment_visibility');
const cls='115小六資優自然週日晚上班',g={giftedPostId:'post1',giftedPlanId:'hw_a',giftedSegmentId:'week-1'};
const post={id:'post1',className:cls,reserveTime:'2026/10/11 18:00',hw1:'[課本作業｜概念一、二]https://www.sciencebear.com.tw/ebook/?gifted=hw_a&segment=week-1'};
const now=Date.parse('2026-10-11T18:00:00+08:00');
test('legacy grades keep original visibility; exact published native post gates all new columns',()=>{assert(visible({},[],cls,now));assert(!visible(g,[],cls,now));assert(!visible(g,[post],cls,now-1));assert(visible(g,[post],cls,now));assert(!visible(g,[{...post,className:'other'}],cls,now));assert(!visible(g,[{...post,hw1:'removed'}],cls,now));assert(!visible(g,[post,post],cls,now));});
test('cancel, malformed schedule and postpone hide the same column without changing identity or grade',()=>{for(const p of [{...post,displayOptions:{session:{status:'cancelled'}}},{...post,reserveTime:'invalid'},{...post,reserveTime:'2026/10/12 18:00'}])assert(!visible(g,[p],cls,now));assert(visible({...g,score:0},[post],cls,now));});
test('already provisioned holiday and home papers also wait for their exact public post',()=>{const a={sourcePostId:'post1',assessmentKind:'homework_self_marked'};assert(!visible(a,[],cls,now));assert(!visible(a,[post],cls,now-1));assert(visible(a,[post],cls,now));});
test('real grade builder includes publication gate and listener rebuilds when posts change',()=>{const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');assert(html.includes('GiftedAssignmentVisibility.visible(rawData, options.dailyPosts || {}, classKey)'));assert(html.includes('rebuildGradesFromScopedSources();\n                        remapDailyPostGrades();'));for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(script[1].trim())new vm.Script(script[1]);});
test('actual grade list function hides unpublished columns, restores them on public post and preserves legacy grade',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),start=html.indexOf('    function buildGradeListFromExams('),end=html.indexOf('    function buildGradeListFromClassExamMap(',start);
 const ctx={GiftedAssignmentVisibility:{visible},EbookLifecycleApp:{buildTransferChain:()=>[]},shouldIncludeTransferGrade:()=>true,getTransferGradePresentation:()=>({className:cls,sourceClassKey:cls}),resolveTransferGradeDisplayIdentity:({grade})=>({date:grade.date}),isHomeworkColumnTitle:()=>true,isMathAdvancedGuidanceExam:()=>false,getMathAdvancedGuidanceStandard:()=>null,getTransferDateKey:()=>1,getTransferFallbackYear:()=>2026,currentClassName:cls};
 vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 const exams={col_5:{...g,date:'2026/10/11作業',examName:'理化第11章',homeworkMaxScore:19,score:''},col_6:{date:'2026/10/4作業',examName:'原作業',score:'12'}};
 assert.equal(ctx.buildGradeListFromExams(exams,{classKey:cls,dailyPosts:{}}).length,1);
 const published={...post,reserveTime:''};assert.equal(ctx.buildGradeListFromExams(exams,{classKey:cls,dailyPosts:{post1:published}}).length,2);
 assert.equal(ctx.buildGradeListFromExams(exams,{classKey:cls,dailyPosts:{post1:{...published,hw1:''}}}).length,1);
});
