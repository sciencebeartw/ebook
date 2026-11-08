#!/usr/bin/env node
'use strict';
// 從正式 renderer 與修改分數函式建立離線測試頁，不連線或改寫學生資料。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'..'),out=process.argv[2];
if(!out)throw Error('請指定系統暫存輸出目錄');
fs.mkdirSync(out,{recursive:true});const source=fs.readFileSync(path.join(repo,'index.html'),'utf8');
let scripts=0;for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=/.test(match[1])||!match[2].trim())continue;new vm.Script(match[2]);scripts++;}
function extract(name){const start=source.indexOf('function '+name+'(');if(start<0)throw Error(name);const rest=source.slice(start);for(const end of rest.matchAll(/\n        }(?:\r?\n)/g)){const code=(name==='writeGodScoreCorrection'?'async ':'')+rest.slice(0,end.index+10);try{new vm.Script(code);return code;}catch(_){}}throw Error('無法擷取 '+name);}

const functions=['getDisplayLogic','getGodEditableScore','getGodEditableScoreInfo','getGodScoreHumanLabel','buildGodScoreEditBox','buildAssessmentTitleHtml','buildDailyPostExamCard','renderOldGradeCards','writeGodScoreCorrection'];
const css=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
for(const file of ['fastwrite_grade_reader.js','fastwrite_grade_dom.js','fastwrite_ebook_grades.js','ebook_score_distribution.js'])fs.copyFileSync(path.join(repo,file),path.join(out,file));
const setup=`
var isAdminMode=true,isDashboardDraftPreviewMode=false,ebookGodSessionId='a'.repeat(64),BEAR_SUBJECT='science',EBOOK_SCORE_MAX=200;
var gData={className:'測試班級',foundUserKey:'student',studentKey:'student',studentName:'測試學生',feedbackHistory:[]};
var ebookFirebaseApp={auth:()=>({currentUser:{uid:'fixture_uid'}})};
var ebookFunctions={httpsCallable:()=>()=>{throw Error('禁止遠端呼叫');}};
window.DASHBOARD_FASTWRITE_SCOPES=[{subject:'science',gradeAuthority:'dashboard',enabled:true,classKey:'測試班級',className:'測試班級',scopeId:'fixture',epoch:1}];
window.ProductionFastWriteTransport={create:()=>({})};
window.adminModeScoreEditContext={};window.adminModeMakeupContext={};
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
var escapeHtmlAttr=escapeHtml,escapeAdminHtml=escapeHtml,escapeInlineJs=escapeHtml;
var safeKey=s=>s.replace(/[.#$[\\]]/g,'-'),makeDomSafeId=s=>s.replace(/[^a-zA-Z0-9_-]/g,'_');
var ClassSessionPlan={isSelfMarked:()=>false};var SVG={target:'',edit:''};
var canUseAdminModeReview=()=>true,isHomeworkColumnTitle=()=>false,isHomeworkMissingScore=()=>false,isHomePracticeScoreTitle=()=>false,isMathAdvancedGuidanceExam=()=>false,isCurrentStudentEnrollmentExemptExam=()=>false;
var getMathAdvancedGuidanceStandard=()=>null,getFeedbackOverrideNum=()=>null,shouldShowGodMakeupReview=()=>false;
var getGradeScoreUnitText=()=> '分',getDailyPostExamTimePrefix=()=> '今日',getDailyPostExamLabel=()=> '小考';
window.AssessmentLabels={describe:v=>({heading:v,detail:''})};
var swalAlert=()=>{throw Error('非預期錯誤提示');},swalConfirm=async()=>true,createStableEbookRequestId=()=> 'fixture_request';
var sendResult=async()=>({result:{storage:'firebase',receipt:{revision:6}}}),runGodAdminAction=(action,payload)=>{window.lastPayload=payload;return sendResult();},renderProductionGodScoreReceipt=()=>{};
`;
const checks=`
window.syncProductionVisibleGradeWatches=()=>{};
var base={score:'94假',average:'95.80',dist:[0,0,0,1,24],labels:['0–20','20–40','40–60','60–80','80–100'],myBucket:4,total:25,fastWriteRevision:4,fastWriteStatisticsVersion:47,fastWriteStatisticsPending:false,sourceStudentKey:'student'};
var nativeRaw=base;
function grade(){var x=window.overlayProductionGrade(nativeRaw,'測試班級','student','exam1');return {...x,className:'測試班級',storedClassKey:'測試班級',sourceClassKey:'測試班級',storedClassName:'測試班級',exam:'熱的傳播',examId:'exam1',storedExamId:'exam1',date:'2026/11/07',colIndex:5,scoreNum:/\\d/.test(x.score)?parseFloat(x.score):null,unit:'分'};}
var post={date:'2026/11/07',storedClassName:'測試班級'};
function draw(full=false){var e=grade(),html=buildDailyPostExamCard(post,e,[],[]),c=document.querySelector('#daily');if(full)c.innerHTML=html;else window.replaceProductionGradeCards(c,'<div class="post-card-wrapper" data-stored-class-key="測試班級">'+html+'</div>','.grade-section',window.adminModeScoreEditContext,window.adminModeMakeupContext);renderOldGradeCards([e],!full);}
window.rebuildProductionGradeView=()=>draw();
function assert(value,msg){if(!value)throw Error(msg);}
function main(){return document.querySelector('#daily .main-score')?.innerText.trim();}
function avg(){return document.querySelector('#daily .score-sub')?.innerText.trim();}
function tick(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
window.runGradeSuite=async()=>{var results=[];window.stopProductionGradeWatches();nativeRaw={...base,average:'更新中',fastWriteStatisticsPending:true};draw(true);assert(!document.querySelector('.main-score,.score-val,.avg-score,.score-sub,.v2-bar-chart-container'),'首次等待不可先顯示數字');assert(document.querySelectorAll('[aria-busy=true]').length===2,'兩個入口整卡等待');results.push('first-pending');
 nativeRaw=base;draw();assert(main().includes('94')&&avg().includes('95.80'),'完整數字一起出現');assert(!document.querySelector('[aria-busy=true]'),'等待狀態已移除');assert(document.querySelector('.score-card').hasAttribute('onclick'),'首次載入完成後仍可展開歷史卡片');results.push('first-complete');
 var card=document.querySelector('#daily .grade-section'),scoreNode=card.querySelector('.main-score'),comment=document.querySelector('#comment');comment.value='保留留言';var height=card.getBoundingClientRect().height;
 window.scrollTo(0,180);var scroll=window.scrollY;
 nativeRaw={...base,score:'97',average:'更新中',dist:[],fastWriteRevision:5,fastWriteStatisticsPending:true};draw();await tick();assert(main().includes('94')&&avg().includes('95.80'),'延遲時保留原完整資料');assert(card===document.querySelector('#daily .grade-section')&&scoreNode===card.querySelector('.main-score'),'等待時節點不換');assert(comment===document.querySelector('#comment')&&comment.value==='保留留言','留言保留');assert(Math.abs(window.scrollY-scroll)<2&&card.getBoundingClientRect().height===height,'等待時高度與捲動穩定');results.push('pending-stability');
 nativeRaw={...base,score:'97',average:'96.20',fastWriteRevision:5,fastWriteStatisticsVersion:48};draw();assert(main().includes('97')&&avg().includes('96.20'),'完成時一次換分數與平均');results.push('atomic-update');
 // 新的編輯值及原 expected value 必須一起保留，離開輸入欄後才釋出完整更新。
 var input=card.querySelector('input[type=number]'),key=input.id.slice('god-score-edit-input-'.length);input.value='99';input.focus();nativeRaw={...nativeRaw,average:'96.30',fastWriteStatisticsVersion:49};draw();assert(input===card.querySelector('input[type=number]')&&input.value==='99','不覆蓋未送出輸入');assert(window.adminModeScoreEditContext[key].currentScore==='97','保留原衝突比較值');results.push('dirty-input');input.value=input.defaultValue;input.blur();await tick();assert(avg().includes('96.30'),'失焦後補上已到齊資料');
 // 真正的修改分數函式：先收到儲存回覆，稍後才收到完整統計。
 input=card.querySelector('input[type=number]');key=input.id.slice('god-score-edit-input-'.length);input.value='98';var btn=card.querySelector('.god-score-edit-row button');btn.focus();await writeGodScoreCorrection(btn,key);await tick();assert(main().includes('97')&&avg().includes('96.30'),'儲存回覆不拆開顯示');assert(window.lastPayload.expectedCurrentScore==='97'&&window.lastPayload.scoreValue==='98','寫入防衝突合約保留');assert(card.querySelector('input[type=number]').value==='98','儲存後保留新輸入');nativeRaw={...nativeRaw,score:'98',average:'96.40',fastWriteRevision:6,fastWriteStatisticsVersion:50};draw();assert(main().includes('98')&&avg().includes('96.40'),'統計到齊後一起發布');assert(!card.hasAttribute('data-grade-write-pending'),'清除本機等待狀態');results.push('ack-before-stats');
 // 順序相反：完整統計比 callable 回覆先到，不可卡在 disabled 或回蓋更新中。
 var release;sendResult=()=>new Promise(r=>release=r);input=card.querySelector('input[type=number]');key=input.id.slice('god-score-edit-input-'.length);input.value='99';btn=card.querySelector('.god-score-edit-row button');btn.focus();var writing=writeGodScoreCorrection(btn,key);await Promise.resolve();await Promise.resolve();nativeRaw={...nativeRaw,score:'99',average:'96.50',fastWriteRevision:7,fastWriteStatisticsVersion:51};draw();assert(main().includes('98'),'送出途中保留整卡');release({result:{storage:'firebase',receipt:{revision:7}}});await writing;await tick();assert(main().includes('99')&&avg().includes('96.50'),'回覆到達後立即釋出已到齊資料');assert(!card.querySelector('button:disabled'),'沒有卡住按鈕');results.push('stats-before-ack');
 // 等待自己寫入時若又被別人修改，更新的完整 revision 應放行。
 sendResult=async()=>({result:{storage:'firebase',receipt:{revision:8}}});input=card.querySelector('input[type=number]');key=input.id.slice('god-score-edit-input-'.length);input.value='100';btn=card.querySelector('.god-score-edit-row button');btn.focus();await writeGodScoreCorrection(btn,key);await tick();nativeRaw={...nativeRaw,score:'96',average:'96.60',fastWriteRevision:9,fastWriteStatisticsVersion:53};draw();assert(main().includes('96')&&avg().includes('96.60'),'後續他人完整修正不可被自己的舊等待鎖住');results.push('concurrent-correction');
 assert(!document.body.innerText.includes('更新中'),'沒有拆開的更新中文字');assert(document.documentElement.scrollWidth<=window.innerWidth+1,'沒有水平溢出');results.push('no-overflow');
 isAdminMode=false;canUseAdminModeReview=()=>false;window.stopProductionGradeWatches();nativeRaw={...base,average:'更新中',fastWriteStatisticsPending:true};draw(true);assert(!document.querySelector('.main-score,.score-val'),'家長初次等待也不拆開顯示');nativeRaw=base;draw();assert(main().includes('94')&&avg().includes('95.80')&&!document.querySelector('.god-score-edit-box'),'家長完整資料同次顯示且不出現老師控制項');results.push('parent-view');return results;
};
window.runResilienceSuite=async()=>{var results=[];isAdminMode=true;canUseAdminModeReview=()=>true;
 const previous={schema:1,classKey:'測試班級',studentKey:'student',examId:'exam1',bindingHash:'bind1',date:'2026/11/07',examName:'熱的傳播',grade:{...base}};
 const pending={...base,score:'97',average:'更新中',fastWriteStatisticsPending:true,fastWriteRevision:5,fastWriteExamId:'exam1',fastWriteBindingHash:'bind1',date:'2026/11/07',examName:'熱的傳播',fastWriteLastComplete:previous};
 for(let i=0;i<2;i++){gData.foundUserKey='cold-'+i;nativeRaw=pending;draw(true);assert(main().includes('94')&&avg().includes('95.80')&&!document.querySelector('[aria-busy=true]'),'冷啟動與重新進入立即顯示伺服器完整舊成績');}results.push('server-cold-entry-and-reentry');
 gData.foundUserKey='no-history';nativeRaw={...pending};delete nativeRaw.fastWriteLastComplete;draw(true);assert(!document.querySelector('.main-score,.score-val'),'八秒前保持整卡等待');
 await new Promise(resolve=>setTimeout(resolve,8250));await tick();assert(main().includes('97')&&avg().includes('暫無資料'),'沒有舊資料時八秒後仍可讀已確認分數');assert(!document.querySelector('[aria-busy=true],.v2-bar-chart-container'),'逾時不持續等待也不畫不完整圖');results.push('bounded-wait-without-history');
 nativeRaw={...pending,score:'98',average:'96.20',fastWriteStatisticsPending:false,fastWriteRevision:6,fastWriteStatisticsVersion:48};delete nativeRaw.fastWriteLastComplete;draw();assert(main().includes('98')&&avg().includes('96.20')&&document.querySelector('.v2-bar-chart-container'),'恢復後分數平均與圖整組顯示');results.push('recovery-after-timeout');
 assert(document.documentElement.scrollWidth<=innerWidth+1,'沒有水平溢出');return results;
};
window.drawGrade=draw;
`;
fs.writeFileSync(path.join(out,'fixture.html'),'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\nbody{display:block!important;margin:0;padding:12px}#fixture{max-width:900px;margin:auto}#tab-content-1{display:block}textarea{width:90%;min-height:80px}</style></head><body><div id="fixture"><div style="height:190px"></div><div class="post-card-wrapper" data-stored-class-key="測試班級"><div id="daily"></div><textarea id="comment" aria-label="留言"></textarea></div><div id="tab-content-1"></div><div style="height:700px"></div></div><script src="ebook_score_distribution.js"></script><script>'+setup+'</script><script src="fastwrite_grade_reader.js"></script><script src="fastwrite_grade_dom.js"></script><script src="fastwrite_ebook_grades.js"></script><script>'+functions.map(extract).join('\n')+'\n'+checks+'</script></body></html>');
console.log(JSON.stringify({inlineScriptsParsed:scripts,fixture:path.join(out,'fixture.html')}));
