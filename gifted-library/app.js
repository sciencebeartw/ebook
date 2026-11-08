(function(){'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const target=new URLSearchParams(location.search).get('target'),mock=target==='mock';
 let transport,content=null,busy=false,changed=false,epoch=0,pending=null;
 const messages={ASSIGNMENT_NOT_OPEN:'這份教材尚未到開放日期。',LOGIN_REQUIRED:'登入已失效，請返回聯絡簿重新登入。',DRAFT_CONFLICT:'另一個裝置已更新答案，請重新載入最新紀錄。',FORMAL_ALREADY_SUBMITTED:'這份題本已送出，請重新載入查看結果。',ASSIGNMENT_VERSION_CHANGED:'教材版本已更新，請重新載入。',BLANKS_REQUIRE_CONFIRMATION:'尚有未填題目，請完成作答或勾選空白確認。',TEACHER_VIEW_READ_ONLY:'目前是老師唯讀檢視。',TRY_LATER:'操作較頻繁，請稍後再試。'};
 const message=e=>messages[e.message]||'連線暫時未完成，答案已保留，請重試。';
 const key=()=> 'gifted-library-draft-v1:'+transport.sessionUid+':'+content.chapterId;
 function collect(){return Object.fromEntries(content.questions.map(q=>{const el=$('questions').querySelector('[data-id="'+CSS.escape(q.id)+'"]');return [q.id,q.type==='manual'?el.querySelector('textarea').value:q.type==='multiple'?[...el.querySelectorAll('input:checked')].map(x=>x.value):el.querySelector('input:checked')?.value||null];}));}
 function stash(){if(!content||content.status==='submitted'||transport.readOnly)return;try{if(!changed&&!pending){localStorage.removeItem(key());return;}localStorage.setItem(key(),JSON.stringify({revision:content.revision,draftRevision:content.draftRevision,answers:collect(),pending}));}catch{}}
 function setAnswers(answers){for(const q of content.questions){const el=$('questions').querySelector('[data-id="'+CSS.escape(q.id)+'"]');if(q.type==='manual')el.querySelector('textarea').value=answers[q.id]||'';else{const chosen=Array.isArray(answers[q.id])?answers[q.id]:[answers[q.id]];el.querySelectorAll('input').forEach(i=>i.checked=chosen.includes(i.value));}}}
 function controls(){ $('save').disabled=$('submit').disabled=busy||transport.readOnly;$('reload').disabled=busy;$('rounds').disabled=busy;$('questions').querySelectorAll('input,textarea').forEach(el=>el.disabled=busy||transport.readOnly||content?.status==='submitted');}
 function showResult(result){$('actions').hidden=true;$('result').textContent='已完成作答。自動判分：'+result.earnedPoints+'／'+result.autoMaxPoints+(result.pending?'；另有 '+result.pending+' 題請自行對照解答。':'。')+'\n請核對答案，並在題本上訂正。';
  for(const item of result.results){const q=content.questions.find(q=>q.id===item.questionId),el=$('questions').querySelector('[data-id="'+CSS.escape(item.questionId)+'"] .question-result');if(!q||!el)continue;el.hidden=false;el.dataset.outcome=item.outcome;const answer=item.acceptedAnswers?.length?item.expected:GiftedTypedQuestion.answerText(q,item.correctAnswers||[]);el.textContent=(q.type==='manual'?'請自行核對':({correct:'答對',wrong:'答錯',blank:'未作答',pending:'請自行核對'}[item.outcome]))+'\n參考答案：'+(answer||item.expected||'請參考題本解答');}
 }
 async function list(){const mine=++epoch;content=null;pending=null;changed=false;$('title').textContent='模擬試題';$('paper').hidden=true;$('list').hidden=true;$('rounds').hidden=true;$('status').textContent='正在讀取回次…';
  try{const r=await transport.request({action:'list'});if(mine!==epoch)return;const rows=r.entries.filter(e=>e.kind==='mock');$('status').textContent=rows.length?'自行選擇要練習的回次；已完成的回次可以查看答案。':'模擬試題將於 11/21 開放。';$('list').hidden=false;$('list').innerHTML=rows.map(e=>'<button type="button" data-chapter="'+esc(e.id)+'"><strong>'+esc(e.label)+'</strong><small>'+ (e.progress?'已完成 · '+e.progress.score+'／'+e.progress.maxScore:'尚未作答 · '+e.questionCount+' 題')+'</small></button>').join('');$('list').querySelectorAll('button').forEach(b=>b.onclick=()=>load(b.dataset.chapter));}catch(e){if(mine===epoch)$('status').textContent=message(e);}
 }
 async function load(chapterId){const mine=++epoch;busy=true;if(content)stash();pending=null;$('status').textContent='正在載入題目…';controls();
  try{const next=await transport.request({action:'task',chapterId});if(mine!==epoch)return;content=next;changed=false;BearStudentMedia.reset();$('title').textContent=mock?'模擬試題':'複習題本';$('list').hidden=true;$('paper').hidden=false;$('rounds').hidden=!mock;$('summary').textContent=next.label+' · '+next.questionCount+' 題';$('result').textContent='';$('blanks').checked=false;$('actions').hidden=next.status==='submitted';
   $('questions').innerHTML=next.questions.map(q=>'<article class="student-question" data-id="'+esc(q.id)+'">'+GiftedTypedQuestion.question(q)+(q.type==='manual'?'<textarea maxlength="2000" aria-label="本題答案" placeholder="填寫答案，送出後自行核對解答"></textarea>':'')+'<div class="question-result" hidden></div></article>').join('');
   let answers=next.answers||{},notice='先作答，送出後即可核對答案。';
   try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved&&saved.revision===next.revision&&saved.draftRevision===next.draftRevision&&next.status!=='submitted'){answers=saved.answers;pending=saved.pending||null;changed=true;notice=pending?'上次送出結果尚待確認，請按原按鈕重試。':'已恢復此裝置尚未送出的答案。';}}catch{}
   setAnswers(answers);$('status').textContent=notice;
   if(next.status==='submitted'){showResult(next.result);try{localStorage.removeItem(key());}catch{}$('status').textContent='已收到作答紀錄。';}
  }catch(e){if(mine===epoch)$('status').textContent=message(e);}finally{if(mine===epoch){busy=false;controls();}}
 }
 async function write(action){if(busy||!content||transport.readOnly||content.status==='submitted')return;
  busy=true;controls();
  try{
   if(!pending){if(!await transport.confirmWrite(action))return;pending={action,chapterId:content.chapterId,revision:content.revision,expectedRevision:content.draftRevision,requestId:crypto.randomUUID(),answers:collect(),confirmBlanks:$('blanks').checked};stash();}
   if(pending.action!==action){$('status').textContent='上次'+(pending.action==='submit'?'送出':'儲存')+'結果待確認，請先重試原按鈕。';return;}
   $('status').textContent=action==='submit'?'正在送出並核對…':'正在儲存…';
   const r=await transport.request(pending);pending=null;content={...content,...r};changed=false;if(r.status==='submitted'){showResult(r.result);try{localStorage.removeItem(key());}catch{}$('status').textContent='已收到你的作答。';}else{stash();$('status').textContent='草稿已儲存，下次登入可繼續。';}
  }catch(e){$('status').textContent=message(e);if(['BLANKS_REQUIRE_CONFIRMATION','INVALID_ANSWERS','INVALID_CHOICE'].includes(e.message))pending=null;stash();}
  finally{busy=false;controls();}
 }
 $('questions').addEventListener('input',()=>{changed=true;stash();});$('save').onclick=()=>write('draft');$('submit').onclick=()=>write('submit');$('reload').onclick=()=>content&&load(content.chapterId);$('rounds').onclick=()=>{stash();list();};BearStudentMedia.bind($('questions'));
 window.GiftedLibraryPage={dirty:()=>changed};
 try{if(parent===window)throw Error('LOGIN_REQUIRED');transport=parent.GiftedLibraryEbook.getTransport(window);$('name').textContent=transport.studentName;mock?list():/^grb-chapter-\d{2}$/.test(target||'')?load(target):($('status').textContent='請從聯絡簿的教材按鈕進入。');}catch(e){$('status').textContent=message(e);}
})();
