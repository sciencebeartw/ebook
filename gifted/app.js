(function(){'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const query=new URLSearchParams(location.search),transport=window.GiftedStudentTransport;let actor,task,box,answers={},questionIndex=0,busy=false,tabId,releaseTab,conflictTask;
let mediaRefresh,mediaRetryAt=0;
// 延用 v17 的分頁鎖：重新整理保留同一草稿；複製分頁取得獨立編輯副本。
async function reserveTab(){
 if(tabId)return;
 if(!navigator.locks)throw Error('此瀏覽器無法安全保存作答，請改用新版 Safari 或 Chrome。');
 let id=sessionStorage.getItem('gifted-homework-tab')||crypto.randomUUID();
 const acquire=candidate=>new Promise((resolve,reject)=>navigator.locks.request('gifted-answer-tab:'+candidate,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}resolve(true);return new Promise(done=>{releaseTab=done;});}).catch(reject));
 if(!await acquire(id)){id=crypto.randomUUID();if(!await acquire(id))throw Error('無法保留作答分頁，請重新開啟。');}
 sessionStorage.setItem('gifted-homework-tab',id);tabId=id;
}
async function api(url,body,token){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error||'連線失敗');return value;}
const credential=()=> 'synthetic-token-'+(query.get('fixture')?query.get('fixture')+'-':'')+actor;
const student=(action,body={})=>transport?transport.request({action,planId:query.get('plan'),segmentId:query.get('segment'),...body}):api('/api/student',{action,planId:query.get('plan'),segmentId:query.get('segment'),...body},credential());
const learning=body=>transport?transport.request(body):api('/api/learning',body,credential());
const messages={LOGIN_REQUIRED:'登入已過期，請返回聯絡簿重新登入；尚未送出的答案已保留。',ASSIGNMENT_NOT_OPEN:'這份作業目前尚未開放或已截止。',ASSIGNMENT_UNAVAILABLE:'作業尚未準備完成，請稍後再試。',PUBLISHED_POST_NOT_READY:'聯絡簿正在同步，請稍後再試。',PUBLISHED_POST_LINK_MISMATCH:'本堂作業設定已變更，請從最新聯絡簿重新開啟。',HOMEWORK_POST_CONFLICT:'本堂作業發布時間或連結已變更，請由老師確認。',TRY_LATER:'操作較頻繁，請稍後重試。',CLASS_NOT_AUTHORIZED:'這份作業不屬於目前登入的班級。',RETRY_OR_CHECK_RECEIPT:'尚未確認伺服器結果，原答案已保留，請稍後重試。'};
function error(e){$('error').textContent=messages[e.message]||e.message;}
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
function controls(){let state;try{state=box?.snapshot();}catch{state={invalid:true};}const locked=busy||!task||!!task.submission||!!state?.pending||!!conflictTask||state?.invalid;
 document.querySelectorAll('#questionCard input[name=answer]').forEach(el=>el.disabled=!!locked);
 for(const id of ['save','submit','blanks'])$(id).disabled=!!locked;
 $('retry').hidden=!state?.pending||!!conflictTask;$('retry').disabled=busy;
 $('useServer').disabled=busy;$('keepLocal').disabled=busy||!!conflictTask?.submission;
 $('refreshSummary').disabled=busy||!task;document.querySelectorAll('[data-actor]').forEach(el=>el.disabled=busy);
}
async function run(button,fn){if(busy)return;busy=true;controls();$('error').textContent='';try{await fn();}catch(e){error(e);}finally{busy=false;controls();}}
function one(v){return Array.isArray(v)?v[0]||'':v||'';}
function valuesCount(){return Object.keys(answers).filter(k=>one(answers[k])).length;}
function paint(){BearStudentMedia.bind($('questionCard'));BearStudentMedia.reset();const q=task.questions[questionIndex];$('count').textContent='已填 '+valuesCount()+' / '+task.questions.length+' 題';$('question').value=q.id;
 $('questionCard').innerHTML=(q.groupContext?'<p>'+esc(q.groupContext)+'</p>':'')+'<p><strong>章內第 '+q.sourceIndex+' 題</strong></p><p>'+esc(q.prompt)+'</p>'+q.media.map(m=>BearStudentMedia.html(m,'','第 '+q.sourceIndex+' 題圖表')).join('')+q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o.id)}" ${one(answers[q.id])===o.id?'checked':''} ${task.submission?'disabled':''}><span>${esc(o.text)}${(o.media||[]).map(m=>BearStudentMedia.html(m,'','選項圖表')).join('')}</span></label>`).join('');
 $('questionCard').querySelectorAll('input[name=answer]').forEach(el=>el.onchange=()=>{try{answers[q.id]=el.value;box.saveLocalDraft(answers,task.revision);$('studentStatus').textContent='已暫存本機；送出後才正式登記。';paint();}catch(e){error(e);}});
 $('answerGrid').innerHTML=task.questions.map((q,i)=>`<button class="${one(answers[q.id])?'answered':''}" data-index="${i}" aria-current="${i===questionIndex}">${q.sourceIndex} ${one(answers[q.id])?String.fromCharCode(65+q.choices.indexOf(one(answers[q.id]))):'—'}</button>`).join('');$('answerGrid').querySelectorAll('button').forEach(el=>el.onclick=()=>{questionIndex=Number(el.dataset.index);paint();});
 $('previous').disabled=questionIndex===0;$('next').disabled=questionIndex===task.questions.length-1;controls();
}
async function summary(){const v=await student('summary'),s=v.student,g=v.grades.find(g=>g.targetId===task.segmentId),done=g?.status==='completed';
 $('summary').innerHTML=`<div class="score-cards"><div class="score-card ${done?'':'pending'}"><strong>本次作業成績</strong><b>${done?g.receipt.score+' / '+task.target.questionCount:'尚未登分'}</b><p>${done?'已自動登記，不必另行回報。':({waiting_answers:'答案已收件，請補齊前段後累計全章。',waiting_column:'答案已收件，等待老師建立作業欄。',waiting_grading:'答案已收件，等待老師批改。',pending:'答案已保存，成績登記中，請稍後更新狀態。',sync_pending:'成績已登記，雲端同步中。',blocked:'答案已保留，請由老師確認成績。'}[g?.status]||(task.submission?'答案已保存，成績登記中，請稍後更新狀態。':'完成後按下方提交。'))}</p></div><div class="score-card"><strong>本章完成進度</strong><b>${s.submittedQuestionCount} / ${s.requiredQuestionCount}</b><p>${s.status==='complete'?'全章已交齊 · '+s.finalScore+' 分':'尚未交齊不計全章分數'}</p></div></div>`;
}
function showConflict(server){conflictTask=server;$('conflict').hidden=false;const local=box.snapshot().draft?.answers||{};const label=(q,v)=>{const n=q.choices.indexOf(one(v));return n<0?'未答':String.fromCharCode(65+n);};const differences=task.questions.filter(q=>one(local[q.id])!==one(server.answers[q.id]));$('comparison').innerHTML=differences.length?differences.map(q=>'<p>第 '+q.sourceIndex+' 題：本機 '+label(q,local[q.id])+'／已保存 '+label(q,server.answers[q.id])+'</p>').join(''):'<p>選項相同，保存版本不同；請選擇要保留的版本。</p>';$('studentStatus').textContent='另一個視窗或裝置已更新答案；請先比較版本。';controls();}
async function load(){box?.close({erase:false});task=await student('task');conflictTask=null;$('conflict').hidden=true;$('workspace').hidden=false;$('login').hidden=true;$('studentName').textContent=task.classId+' · '+(transport?transport.studentName:'測試學生 '+actor.toUpperCase());$('studentTitle').textContent=task.chapterLabel+'｜'+task.label;$('assignmentInfo').textContent='本次 '+task.questions.length+' 題 · '+(task.target.includesPreviousAnswers?'會沿用上週答案，合併計算全章。':'作業欄只登記本次範圍。');
 box=GiftedAnswerOutbox.create({storage:localStorage,scope:{sessionUid:transport?transport.sessionUid:'v21-test-'+(query.get('fixture')||'default')+'-'+actor,planId:task.planId,segmentId:task.segmentId,scopeRevision:task.scopeRevision,tabId},transport:learning});const local=box.snapshot();answers=structuredClone(!task.submission&&local.draft?local.draft.answers:task.answers);
 if(local.pending)$('studentStatus').textContent='上次送出尚未確認；請重試原本的送出，不必重填。';
 else if(local.draft&&!task.submission&&local.draft.expectedRevision!==task.revision)showConflict(task);
 else $('studentStatus').textContent=local.draft&&!task.submission?'已恢復本機答案。':'可以開始作答。';
 $('question').innerHTML=task.questions.map(q=>`<option value="${q.id}">第 ${q.sourceIndex} 題</option>`).join('');paint();await summary();
 if(task.submission){const result=await learning({action:'result',planId:task.planId,segmentId:task.segmentId});$('receipt').textContent='本段 '+task.questions.length+' 題已收到。首次正式答案已保存；重複送出不會新增另一筆成績。';$('result').innerHTML=result.items.map(item=>{const q=task.questions.find(q=>q.id===item.questionId);return `<span class="result ${item.outcome==='correct'?'':'wrong'}">第${q.sourceIndex}題 ${item.outcome==='correct'?'答對':item.outcome==='blank'?'留白':'答錯'}</span>`;}).join('');$('studentStatus').textContent='本段已提交，首次作答不再覆蓋。';}
}
async function flush(){try{const result=await box.flush();if(['saved','submitted'].includes(result.status)){await load();if(result.status==='saved')$('studentStatus').textContent='草稿已保存至資料庫。';}}catch(e){if(['DRAFT_CONFLICT','FORMAL_ALREADY_SUBMITTED'].includes(e.message)){showConflict(await student('task'));return;}$('studentStatus').textContent='尚未確認送出結果；原答案與送出編號已保留，請按重試。';paint();throw e;}}
function initStudent(){$('student').hidden=false;if(!query.get('plan')){$('login').innerHTML='<p>請從電子聯絡簿的本週作業連結進入。</p>';return;}
 const mediaStatus=document.createElement('div');mediaStatus.id='mediaStatus';mediaStatus.hidden=true;mediaStatus.innerHTML='<p id="mediaMessage" role="status"></p><button type="button" id="reloadMedia">重新載入圖表</button>';$('questionCard').before(mediaStatus);
 $('reloadMedia').onclick=()=>refreshMedia();
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('.student-media,.student-media-dialog'))refreshMedia();},true);
 document.addEventListener('load',e=>{if(e.target.tagName!=='IMG'||!e.target.closest('.student-media,.student-media-dialog'))return;const images=[...document.querySelectorAll('#questionCard img,.student-media-dialog[open] img')];if(images.length&&images.every(i=>i.complete&&i.naturalWidth>0))$('mediaStatus').hidden=true;},true);
 document.querySelectorAll('[data-actor]').forEach(el=>el.onclick=()=>run(el,async()=>{await reserveTab();actor=el.dataset.actor;await load();}));
 $('question').onchange=e=>{questionIndex=task.questions.findIndex(q=>q.id===e.target.value);paint();};$('previous').onclick=()=>{questionIndex--;paint();};$('next').onclick=()=>{questionIndex++;paint();};
 for(const action of ['save','submit'])$(action).onclick=e=>run(e.target,async()=>{if(action==='submit'&&valuesCount()<task.questions.length&&!$('blanks').checked)throw Error('還有未答題，請填完或勾選確認留白。');box.enqueue(action==='save'?'draft':'submit',answers,task.revision,$('blanks').checked);await flush();});$('retry').onclick=e=>run(e.target,flush);
 $('refreshSummary').onclick=e=>run(e.target,summary);
 for(const [id,choice]of [['useServer','server'],['keepLocal','local']])$(id).onclick=e=>run(e.target,async()=>{const next=box.resolveConflict(conflictTask,choice);task=conflictTask;conflictTask=null;$('conflict').hidden=true;answers=next.draft.answers;paint();if(task.submission)await load();else $('studentStatus').textContent=choice==='server'?'已使用資料庫保存的答案。':'已保留本機答案，請再按儲存或提交。';});
 window.addEventListener('beforeunload',e=>{try{const s=box?.snapshot();if(s?.pending||s?.draft&&!task?.submission&&task.questions.some(q=>one(s.draft.answers[q.id])!==one(task.answers[q.id]))){e.preventDefault();e.returnValue='';}}catch{e.preventDefault();e.returnValue='';}});
}
if(transport){initStudent();run(null,async()=>{await reserveTab();await load();});}
else if(document.body.dataset.giftedProduction==='true'){ $('student').hidden=false;$('login').textContent='請從電子聯絡簿的作業連結登入。'; }
else if(query.get('view')==='student')initStudent();else location.replace('/dashboard');
})();
