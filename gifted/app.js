(function(){'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const questionLabel=q=>q.paperLabel||'章內第 '+q.sourceIndex+' 題';
const query=new URLSearchParams(location.search),transport=window.GiftedStudentTransport;let actor,task,box,answers={},questionIndex=0,busy=false,tabId,releaseTab,conflictTask;
let mediaRefresh,mediaRetryAt=0,gradeRefresh,answerRetry,submissionResult=null,latestSummary=null,resultRead=null;
// 延用 v17 的分頁鎖：重新整理保留同一草稿；複製分頁取得獨立編輯副本。
async function reserveTab(){
 if(tabId)return;
 if(!navigator.locks)throw Error('此瀏覽器無法安全保存作答，請改用新版 Safari 或 Chrome。');
 let id=sessionStorage.getItem('gifted-homework-tab')||crypto.randomUUID();
 const acquire=candidate=>new Promise((resolve,reject)=>navigator.locks.request('gifted-answer-tab:'+candidate,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}resolve(true);return new Promise(done=>{releaseTab=done;});}).catch(reject));
 if(!await acquire(id)){id=crypto.randomUUID();if(!await acquire(id))throw Error('無法保留作答分頁，請重新開啟。');}
 sessionStorage.setItem('gifted-homework-tab',id);tabId=id;
}
async function api(url,body,token){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal});const value=await response.json();if(!response.ok)throw Error(value.error||'連線失敗');return value;}
 finally{clearTimeout(timeout);}
}
const credential=()=> 'synthetic-token-'+(query.get('fixture')?query.get('fixture')+'-':'')+actor;
const student=(action,body={})=>transport?transport.request({action,planId:query.get('plan'),segmentId:query.get('segment'),...body}):api('/api/student',{action,planId:query.get('plan'),segmentId:query.get('segment'),...body},credential());
const learning=body=>transport?transport.request(body):api('/api/learning',body,credential());
const isReadOnly=()=>transport?.readOnly===true||task?.readOnly===true;
const confirmWrite=action=>transport?.confirmWrite?transport.confirmWrite(action):Promise.resolve(true);
const messages={TEACHER_VIEW_READ_ONLY:'老師查看模式只能檢視，不能替學生送出或更正答案。',IDENTITY_MAPPING_REQUIRED:'這個帳號的線上作業尚未開通，請聯絡老師協助；電子聯絡簿仍可正常使用。',PILOT_STUDENT_REQUIRED:'這個帳號的線上作業尚未開通，請聯絡老師協助。',ENROLLMENT_INACTIVE:'這個帳號的作業使用資格需要老師確認，請聯絡老師協助。',ROSTER_CHANGED:'學生資料已更新，請返回聯絡簿重新登入；若仍無法作答，請聯絡老師。',LOGIN_REQUIRED:'登入已過期，請返回聯絡簿重新登入；尚未送出的答案已保留。',ASSIGNMENT_NOT_OPEN:'這份作業目前尚未開放或已截止。',ASSIGNMENT_UNAVAILABLE:'作業尚未準備完成，請稍後再試。',PUBLISHED_POST_NOT_READY:'聯絡簿正在同步，請稍後再試。',PUBLISHED_POST_LINK_MISMATCH:'本堂作業設定已變更，請從最新聯絡簿重新開啟。',HOMEWORK_POST_CONFLICT:'本堂作業發布時間或連結已變更，請由老師確認。',TRY_LATER:'操作較頻繁，請稍後重試。',CLASS_NOT_AUTHORIZED:'這份作業不屬於目前登入的班級。',RETRY_OR_CHECK_RECEIPT:'尚未確認伺服器結果，原答案已保留，請稍後重試。'};
function error(e){$('error').textContent=messages[e.message]||e.message;if(!task)$('login').textContent='作業暫時無法載入，請返回聯絡簿後重新開啟。';}
async function refreshMedia(){
 if(!task||mediaRefresh)return;
 $('mediaStatus').hidden=false;
 if(Date.now()<mediaRetryAt){$('mediaMessage').textContent='圖表尚未載入，請稍候一分鐘再試；已填答案仍保留。';return;}
 const original=task;mediaRetryAt=Date.now()+60000;$('reloadMedia').disabled=true;$('mediaMessage').textContent='正在重新載入圖表，已填答案仍保留。';
 mediaRefresh=(async()=>{try{
   const fresh=await student('task');if(task!==original)return;
   task=GiftedMediaRefresh.refreshUrls(task,fresh);paint();
   $('mediaMessage').textContent='圖片連結已更新；若仍未顯示，請稍後再試。';
 }catch(e){$('mediaMessage').textContent=messages[e.message]||'圖表暫時無法載入，請稍後再試；已填答案仍保留。';}
 finally{$('reloadMedia').disabled=false;mediaRefresh=null;}})();
 return mediaRefresh;
}
function controls(){let state;try{state=box?.snapshot();}catch{state={invalid:true};}const locked=isReadOnly()||busy||!task||!!task.submission||!!state?.pending||!!conflictTask||state?.invalid;
 document.querySelectorAll('#questionCard input[name=answer]').forEach(el=>el.disabled=!!locked);
 for(const id of ['save','submit','blanks'])$(id).disabled=!!locked;
 $('retry').hidden=!state?.pending||!!conflictTask;$('retry').disabled=busy;
 $('useServer').disabled=busy;$('keepLocal').disabled=busy||!!conflictTask?.submission;
 $('refreshSummary').disabled=busy||!task;document.querySelectorAll('[data-actor]').forEach(el=>el.disabled=busy);
}
async function run(button,fn){if(busy)return;busy=true;controls();$('error').textContent='';try{await fn();}catch(e){error(e);}finally{busy=false;controls();}}
function one(v){return Array.isArray(v)?v[0]||'':v||'';}
function valuesCount(){return Object.keys(answers).filter(k=>one(answers[k])).length;}
function paintAnswerGrid(){
 const results=new Map((task.submission?submissionResult?.items||[]:[]).map(item=>[item.questionId,item]));
 let needsCorrection=false;
 $('answerGrid').innerHTML=task.questions.map((q,i)=>{
  const item=results.get(q.id),wrong=['wrong','blank'].includes(item?.outcome),pending=item?.outcome==='pending';
  const value=item?item.answer:answers[q.id],original=q.type==='manual'?(one(value)?'已填':'留白'):GiftedResult.answerText(q,value);
  const hasKey=wrong&&q.type!=='manual'&&Array.isArray(item.correctAnswers)&&item.correctAnswers.length>0&&item.correctAnswers.every(id=>q.choices.includes(id));
  const correct=hasKey?GiftedResult.answerText(q,item.referenceCorrectAnswers||item.correctAnswers):'';
  const state=wrong?'needs-correction':pending?'awaiting-grading':item?.outcome==='correct'||one(value)?'answered':'';
  const status=wrong?(correct?'，正確答案 '+correct:'，待訂正'):pending?'，待老師批改':item?.outcome==='correct'?'，答對':'';
  needsCorrection=needsCorrection||wrong;
  return `<button type="button" class="${state}" data-index="${i}" aria-current="${i===questionIndex}" aria-label="${esc(questionLabel(q)+'，原答 '+original+status)}"><span>${esc(q.paperLabel||q.sourceIndex)} ${hasKey?'<s>'+esc(original)+'</s>':esc(original)}</span>${hasKey?'<span class="answer-correction">→ 正確 '+esc(correct)+'</span>':wrong?'<span class="answer-correction">待訂正</span>':pending?'<span class="answer-pending">待批</span>':''}</button>`;
 }).join('');
 $('answerGrid').querySelectorAll('button').forEach(el=>el.onclick=()=>{questionIndex=Number(el.dataset.index);paint();});
 $('answerGridHelp').hidden=!needsCorrection;
}
function paint(){BearStudentMedia.bind($('questionCard'));BearStudentMedia.reset();const q=task.questions[questionIndex];$('count').textContent='已填 '+valuesCount()+' / '+task.questions.length+' 題';$('question').value=q.id;
 $('questionCard').innerHTML=(q.groupContext?'<p>'+esc(q.groupContext)+'</p>':'')+'<p><strong>'+esc(questionLabel(q))+'</strong></p><p>'+esc(q.prompt)+'</p>'+BearStudentMedia.blocks(q.bodyBlocks)+q.media.map(m=>BearStudentMedia.html(m,'',questionLabel(q)+'圖表')).join('')+q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o.id)}" ${one(answers[q.id])===o.id?'checked':''} ${task.submission?'disabled':''}><span>${esc(o.text)}${(o.media||[]).map(m=>BearStudentMedia.html(m,'','選項圖表')).join('')}</span></label>`).join('');
 window.GiftedProperNames?.decorate($('questionCard'),q.prompt);
 $('questionCard').querySelectorAll('input[name=answer]').forEach(el=>el.onchange=()=>{if(isReadOnly())return;try{answers[q.id]=el.value;box.saveLocalDraft(answers,task.revision);$('studentStatus').textContent='已暫存本機；送出後才正式登記。';paint();}catch(e){error(e);}});
 paintAnswerGrid();
 $('previous').disabled=questionIndex===0;$('next').disabled=questionIndex===task.questions.length-1;controls();
}
function renderSummary(v){
 if(v)latestSummary=v;
 const s=latestSummary?.student,g=latestSummary?.grades.find(g=>g.targetId===task.segmentId),done=g?.status==='completed',submitted=!!task.submission,score=submissionResult?.score;
 const labels={waiting_answers:'補齊前段答案後，會自動登記全章成績。',waiting_column:'老師建立作業欄後，會自動登記。',waiting_grading:'等待老師批改。',pending:'成績正在背景登記，不必重新提交。',sync_pending:'成績已登記，正在同步顯示。',blocked:'成績登記需要老師確認，請勿重複提交。'};
 const value=score?score.earnedPoints===null?'待老師批改':esc(score.earnedPoints)+' <small>/ '+esc(score.maxPoints)+' 分</small>':done?esc(g.receipt.score)+' <small>/ '+task.target.questionCount+' 分</small>':submitted?'已成功送出':'尚未提交';
 $('summary').innerHTML=`<div class="score-cards"><div class="score-card ${score||done?'':submitted?'processing':'pending'}"><strong>${score?'本次作答成績':'本次作業成績'}</strong><b>${value}</b><p>${score&&score.earnedPoints!==null?'答對 '+score.correctCount+' 題 · 答錯 '+score.wrongCount+' 題'+(score.blankCount?' · 留白 '+score.blankCount+' 題':''):submitted?'答案已保存，不必重新提交。':'先完成紙本，再填寫本次答案。'}</p></div><div class="score-card"><strong>本章完成進度</strong><b>${s?s.submittedQuestionCount+' <small>/ '+s.requiredQuestionCount+' 題</small>':'確認中'}</b><p>${s?.status==='complete'?'全章已交齊 · '+s.finalScore+' 分':'分段完成後，自動合計全章'}</p></div></div>`;
 $('gradeRefreshStatus').textContent=done?'成績已自動登記，不必另外回報。':submitted?labels[g?.status]||labels.pending:'';
 $('refreshSummary').hidden=done||!submitted;
 return submitted&&(!g||['not_submitted','pending','sync_pending'].includes(g.status));
}
function startSummary(){
 gradeRefresh?.dispose();renderSummary();
 gradeRefresh=GiftedGradeRefresh.create({read:()=>student('summary'),render:renderSummary,
  isVisible:()=>document.visibilityState!=='hidden',isOnline:()=>navigator.onLine!==false,
  onError:()=>{$('gradeRefreshStatus').textContent=task.submission?'答案已收到，暫時無法確認背景登記進度；不必重新提交。':'目前無法查詢登記狀態，已填答案仍保留。';return !!task.submission;},
  onWaiting:reason=>{if(task.submission)$('gradeRefreshStatus').textContent=reason==='delayed'?'背景登記時間較長；不必重交，稍後會繼續確認。':'回到頁面或恢復網路後，會繼續確認背景登記。';}
 });
 return gradeRefresh.refresh();
}
function viewQuestion(id){const i=task.questions.findIndex(q=>q.id===id);if(i>=0){questionIndex=i;paint();$('questionCard').scrollIntoView({behavior:'smooth',block:'start'});}}
function showReceipt(){
 $('resultSection').hidden=false;$('submitSection').hidden=true;
 $('receipt').textContent=isReadOnly()?'學生已提交本段作業，可查看分數與逐題結果。':'已成功送出 '+task.questions.length+' 題！請用紅筆逐題訂正在課本上；未訂正仍視同作業未完成。';
 $('studentStatus').textContent=isReadOnly()?'老師查看 · 顯示學生已保存的答案與成績。':'本段已提交，首次作答已保存；誤填時可在下方申請更正，待老師核准。';
}
function renderResult(result){
 submissionResult=result;showReceipt();renderSummary();paintAnswerGrid();$('reloadResult').hidden=true;$('resultStatus').textContent='';
 const outcomes={correct:'答對',wrong:'答錯',blank:'留白',pending:'待老師批改'};
 const items=[...result.items].sort((a,b)=>(a.outcome==='correct')-(b.outcome==='correct'));
 const wrong=items.filter(i=>['wrong','blank'].includes(i.outcome)).length;
 $('resultTitle').textContent=wrong?'需要訂正 '+wrong+' 題':'每題作答結果';
 $('result').innerHTML=items.map(item=>{const q=task.questions.find(q=>q.id===item.questionId);return `<button type="button" data-question-id="${esc(q.id)}" class="result ${['wrong','blank'].includes(item.outcome)?'wrong':''}">${esc(questionLabel(q))} · ${outcomes[item.outcome]}</button>`;}).join('');
 $('result').querySelectorAll('[data-question-id]').forEach(el=>el.onclick=()=>viewQuestion(el.dataset.questionId));
 if(window.GiftedResult)GiftedResult.mount($('result'),result,task,{viewQuestion});
 if(result.correction)$('studentStatus').textContent='老師已更正 · '+new Date(result.correction.correctedAt).toLocaleString('zh-TW')+' · '+result.correction.reason;
}
function readResult(){
 if(resultRead?.task===task)return resultRead.promise;
 const original=task;showReceipt();$('reloadResult').hidden=true;$('resultStatus').textContent='正在讀取本次分數與錯題…';
 const entry={task:original};resultRead=entry;
 entry.promise=learning({action:'result',planId:task.planId,segmentId:task.segmentId}).then(result=>{if(task===original)renderResult(result);}).catch(e=>{
  if(task!==original)return;
  $('resultStatus').textContent=e.message==='ANSWERS_NOT_RELEASED'?'本次結果將於老師開放後顯示；答案已保存。':'答案已成功保存，逐題結果暫時無法載入；請重新載入結果，不必重交。';
  $('reloadResult').hidden=e.message==='ANSWERS_NOT_RELEASED';
 }).finally(()=>{if(resultRead===entry)resultRead=null;});
 return entry.promise;
}
function showConflict(server){conflictTask=server;$('conflict').hidden=false;const local=box.snapshot().draft?.answers||{};const label=(q,v)=>{const n=q.choices.indexOf(one(v));return n<0?'未答':String.fromCharCode(65+n);};const differences=task.questions.filter(q=>one(local[q.id])!==one(server.answers[q.id]));$('comparison').innerHTML=differences.length?differences.map(q=>'<p>'+esc(questionLabel(q))+'：本機 '+label(q,local[q.id])+'／已保存 '+label(q,server.answers[q.id])+'</p>').join(''):'<p>選項相同，保存版本不同；請選擇要保留的版本。</p>';$('studentStatus').textContent='另一個視窗或裝置已更新答案；請先比較版本。';controls();}
async function load(){answerRetry?.dispose();gradeRefresh?.dispose();box?.close({erase:false});task=await student('task');submissionResult=null;latestSummary=null;$('result').innerHTML='';$('receipt').textContent='';$('resultStatus').textContent='';$('resultSection').hidden=!task.submission;$('submitSection').hidden=isReadOnly()||!!task.submission;conflictTask=null;$('conflict').hidden=true;$('workspace').hidden=false;$('login').hidden=true;$('studentName').textContent=task.classId+' · '+(transport?transport.studentName:'測試學生 '+actor.toUpperCase());$('studentTitle').innerHTML=esc(task.chapterLabel)+'<span class="scope-label">'+esc(task.label)+'</span>';$('assignmentInfo').textContent='本次 '+task.questions.length+' 題 · '+(task.target.includesPreviousAnswers?'會沿用上週答案，合併計算全章。':'作業欄只登記本次範圍。');
 box=null;
 if(!isReadOnly()){await reserveTab();box=GiftedAnswerOutbox.create({storage:localStorage,scope:{sessionUid:transport?transport.sessionUid:'v21-test-'+(query.get('fixture')||'default')+'-'+actor,planId:task.planId,segmentId:task.segmentId,scopeRevision:task.scopeRevision,tabId},transport:learning});}
 // 收件回覆曾遺失，但重新整理已取得正式收據時，清掉待重送狀態；不重寫伺服器首答。
 if(task.submission&&box?.snapshot().pending)box.resolveConflict(task,'server');
 const local=box?.snapshot()||{};answers=structuredClone(!task.submission&&local.draft?local.draft.answers:task.answers);
 if(local.pending)$('studentStatus').textContent='上次送出尚未確認；連線恢復後會自動重試，不必重填。';
 else if(local.draft&&!task.submission&&local.draft.expectedRevision!==task.revision)showConflict(task);
 else $('studentStatus').textContent=isReadOnly()?'老師查看 · '+(task.submission?'學生已提交。':'學生尚未提交。'):local.draft&&!task.submission?'已恢復本機答案。':'可以開始作答。';
 $('question').innerHTML=task.questions.map(q=>`<option value="${q.id}">${esc(questionLabel(q))}</option>`).join('');paint();startSummary();
 $('correctionRequest').hidden=true;$('correctionRequest').innerHTML='';
 document.querySelector('.lead').textContent=isReadOnly()?'老師查看模式：可檢視學生作業、答案與成績。':'提交後會自動登記作業成績，不必另外傳訊息回報。';
 document.querySelector('.homework-reminder').hidden=isReadOnly();
 if(!isReadOnly())GiftedCorrectionRequest.mount($('correctionRequest'),{task,scopeKey:transport?transport.sessionUid:actor,send:learning,reload:load,beforeSubmit:()=>confirmWrite('requestCorrection')});
 startAnswerRetry();
 if(task.submission)await readResult();
}
function startAnswerRetry(){
 answerRetry?.dispose();answerRetry=null;if(isReadOnly()||!box)return;
 const originalBox=box,originalTask=task;
 answerRetry=GiftedAnswerRetry.create({
  isPending:()=>box===originalBox&&task?.planId===originalTask.planId&&task?.segmentId===originalTask.segmentId&&!task.submission&&!conflictTask&&!!box.snapshot().pending,
  isOnline:()=>navigator.onLine!==false,isVisible:()=>document.visibilityState!=='hidden',canSend:()=>!busy,
  send:async()=>{busy=true;controls();$('error').textContent='';try{await flush();}catch(e){error(e);throw e;}finally{busy=false;controls();}},
  onWaiting:state=>{const labels={offline:'目前沒有網路；答案已保留，連線恢復後會自動送出。',paused:'答案已保留，回到此頁後會自動確認送出。',waiting:'送出結果尚未確認；答案已保留，正在等待自動重試。',sending:'正在自動確認送出，請稍候。',delayed:'連線仍不穩定；答案已保留，會持續自動重試。'};
   if(labels[state]){$('studentStatus').textContent=labels[state];$('error').textContent='';}}
 });
 if(box.snapshot().pending)answerRetry.resume();
}
async function flush(){
 if(isReadOnly())throw Error('TEACHER_VIEW_READ_ONLY');
 const originalBox=box,originalTask=task;
 if(navigator.onLine===false){answerRetry?.resume();paint();return;}
 let response;
 try{response=await originalBox.flush();}catch(e){
  if(box!==originalBox||task!==originalTask)return;
  answerRetry?.failed(e);
  if(['DRAFT_CONFLICT','FORMAL_ALREADY_SUBMITTED'].includes(e.message)){showConflict(await student('task'));return;}
  if(!GiftedAnswerRetry.isRetryable(e)){$('studentStatus').textContent='送出需要確認；原答案已保留。';paint();throw e;}
  paint();return;
 }
 if(box!==originalBox||task!==originalTask)return;
 if(['submitted','saved'].includes(response.status))answerRetry?.settled();
 if(response.status==='submitted'){
  task.submission=response.result;task.revision=response.result.revision;
  // 交卷後不重載 task，仍須讓更正表單取得本次正式送出的完整答案。
  task.answers=Object.fromEntries(task.questions.map(q=>{const value=answers[q.id];return [q.id,q.type==='manual'?value||'':Array.isArray(value)?[...value].sort():value?[value]:[]];}));
  showReceipt();paint();
  GiftedCorrectionRequest.mount($('correctionRequest'),{task,scopeKey:transport?transport.sessionUid:actor,send:learning,reload:load,beforeSubmit:()=>confirmWrite('requestCorrection')});
  if(response.result.result)renderResult(response.result.result);else readResult();
  startSummary();$('summary').scrollIntoView({behavior:'instant',block:'start'});
 }else if(response.status==='saved'){
  task.revision=response.result.revision;task.answers=structuredClone(answers);$('studentStatus').textContent='草稿已保存至資料庫。';paint();
 }
}

async function saveOrSubmit(action){if(isReadOnly())throw Error('TEACHER_VIEW_READ_ONLY');if(action==='submit'&&valuesCount()<task.questions.length&&!$('blanks').checked)throw Error('還有未答題，請填完或勾選確認留白。');if(!await confirmWrite(action==='save'?'draft':'submit'))return;box.enqueue(action==='save'?'draft':'submit',answers,task.revision,$('blanks').checked);await flush();}

function initStudent(){for(const event of ['click','keydown','touchstart','scroll'])document.addEventListener(event,()=>{try{transport?.activity?.();}catch{}},{passive:true,capture:true});$('student').hidden=false;if(!query.get('plan')){$('login').innerHTML='<p>請從電子聯絡簿的本週作業連結進入。</p>';return;}
 const mediaStatus=document.createElement('div');mediaStatus.id='mediaStatus';mediaStatus.hidden=true;mediaStatus.innerHTML='<p id="mediaMessage" role="status"></p><button type="button" id="reloadMedia">重新載入圖表</button>';$('questionCard').before(mediaStatus);
 $('reloadMedia').onclick=()=>refreshMedia();
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('.student-media,.student-media-dialog'))refreshMedia();},true);
 document.addEventListener('load',e=>{if(e.target.tagName!=='IMG'||!e.target.closest('.student-media,.student-media-dialog'))return;const images=[...document.querySelectorAll('#questionCard img,.student-media-dialog[open] img')];if(images.length&&images.every(i=>i.complete&&i.naturalWidth>0))$('mediaStatus').hidden=true;},true);
 document.querySelectorAll('[data-actor]').forEach(el=>el.onclick=()=>run(el,async()=>{await reserveTab();actor=el.dataset.actor;await load();}));
 $('question').onchange=e=>{questionIndex=task.questions.findIndex(q=>q.id===e.target.value);paint();};$('previous').onclick=()=>{questionIndex--;paint();};$('next').onclick=()=>{questionIndex++;paint();};
 for(const action of ['save','submit'])$(action).onclick=e=>run(e.target,()=>saveOrSubmit(action));$('retry').onclick=e=>run(e.target,async()=>{answerRetry?.reset();await flush();});
 $('reloadResult').onclick=e=>run(e.target,readResult);
 $('refreshSummary').onclick=e=>run(e.target,()=>gradeRefresh?.refresh({manual:true}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){gradeRefresh?.pause();answerRetry?.pause();}else{gradeRefresh?.resume();answerRetry?.resume();}});
 window.addEventListener('offline',()=>{gradeRefresh?.pause();answerRetry?.pause();answerRetry?.resume();});window.addEventListener('online',()=>{gradeRefresh?.resume();answerRetry?.resume();});
 window.addEventListener('focus',()=>answerRetry?.resume());
 window.addEventListener('pagehide',e=>{if(e.persisted){gradeRefresh?.pause();answerRetry?.pause();}else{gradeRefresh?.dispose();answerRetry?.dispose();}});
window.addEventListener('pageshow',e=>{if(e.persisted){gradeRefresh?.resume();answerRetry?.resume();}});
 for(const [id,choice]of [['useServer','server'],['keepLocal','local']])$(id).onclick=e=>run(e.target,async()=>{const next=box.resolveConflict(conflictTask,choice);task=conflictTask;conflictTask=null;$('conflict').hidden=true;answers=next.draft.answers;paint();if(task.submission)await load();else $('studentStatus').textContent=choice==='server'?'已使用資料庫保存的答案。':'已保留本機答案，請再按儲存或提交。';});
 window.addEventListener('beforeunload',e=>{try{const s=box?.snapshot();if(s?.pending||s?.draft&&!task?.submission&&task.questions.some(q=>one(s.draft.answers[q.id])!==one(task.answers[q.id]))){e.preventDefault();e.returnValue='';}}catch{e.preventDefault();e.returnValue='';}});
}
if(transport){initStudent();run(null,load);}
else if(document.body.dataset.giftedProduction==='true'){ $('student').hidden=false;$('login').textContent='請從電子聯絡簿的作業連結登入。'; }
else if(query.get('view')==='student')initStudent();else location.replace('/dashboard');
})();
