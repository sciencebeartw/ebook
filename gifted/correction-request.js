/* 更正是獨立申請，不能修改首次提交或直接登分。 */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(host,{task,scopeKey,send,reload}){
 host.hidden=!task.submission;if(!task.submission)return;
 const latest=task.correctionRequest,waiting=latest?.status==='pending',key='gifted-correction-request:'+scopeKey+':'+task.planId+':'+task.segmentId;
 let pending=null;try{pending=JSON.parse(localStorage.getItem(key)||'null');if(pending&&latest?.requestId===pending.requestId){localStorage.removeItem(key);pending=null;}}catch{}
 host.innerHTML=`<h2>首次答案填錯了？</h2><p>請核對紙本後提出更正。<strong>老師核准前，成績維持目前已登記的版本。</strong></p>${latest?`<p class="correction-state">${waiting?'更正申請已送出，等待老師核准':latest.status==='approved'?'老師已核准更正':'老師未核准這次更正'}${latest.reviewNote?' · '+esc(latest.reviewNote):''}</p>`:''}<button type="button" data-cr="open" ${waiting?'disabled':''}>${waiting?'等待老師處理':'申請更正答案'}</button><div data-cr="form" hidden><p>只修改誤填的題目，其餘保留目前答案。點題目可以查看題文。</p><div class="correction-answers">${task.questions.map(q=>`<details><summary>第 ${esc(q.sourceIndex)} 題</summary><p>${esc(q.groupContext||'')}</p><p>${esc(q.prompt)}</p>${(q.media||[]).map(m=>root.BearStudentMedia.html(m,'','題目圖表')).join('')}${q.options.map(o=>`<label class="option"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="correction-${esc(q.id)}" data-cr-q="${esc(q.id)}" value="${esc(o.id)}" ${(task.answers[q.id]||[]).includes(o.id)?'checked':''}><span>${esc(o.text)}${(o.media||[]).map(m=>root.BearStudentMedia.html(m,'','選項圖表')).join('')}</span></label>`).join('')}${q.type==='single'?`<label class="option"><input type="radio" name="correction-${esc(q.id)}" data-cr-q="${esc(q.id)}" value="" ${!(task.answers[q.id]||[]).length?'checked':''}>留白</label>`:''}</details>`).join('')}</div><label>更正原因<textarea data-cr="reason" maxlength="1000" placeholder="例如：紙本第 3 題圈 B，上傳時誤選 A。"></textarea></label><p data-cr="preview"></p><button type="button" data-cr="submit" class="primary">送出更正申請</button></div><p data-cr="status" role="status"></p>`;
 const el=k=>host.querySelector(`[data-cr="${k}"]`);root.BearStudentMedia.bind(host);
 function show(){el('form').hidden=false;el('open').hidden=true;}
 function lock(v){host.querySelectorAll('input,textarea,button').forEach(e=>e.disabled=v);}
 el('open').onclick=show;
 if(pending){show();el('reason').value=pending.reason;host.querySelectorAll('[data-cr-q]').forEach(e=>e.checked=(pending.answers[e.dataset.crQ]||[]).includes(e.value)||!e.value&&!pending.answers[e.dataset.crQ]?.length);el('status').textContent='上次申請結果尚未確認，請重試原申請。';host.querySelectorAll('input,textarea').forEach(e=>e.disabled=true);el('submit').textContent='重試原申請';}
 el('submit').onclick=async()=>{
  if(!pending){const answers=Object.fromEntries(task.questions.map(q=>[q.id,[...host.querySelectorAll('[data-cr-q]')].filter(e=>e.dataset.crQ===q.id&&e.checked&&e.value).map(e=>e.value).sort()]));
   const changed=task.questions.filter(q=>JSON.stringify(answers[q.id])!==JSON.stringify(task.answers[q.id]));const reason=el('reason').value.trim();
   if(!changed.length||!reason){el('status').textContent=!changed.length?'請先修改誤填的答案。':'請填寫更正原因。';return;}
   pending={action:'requestCorrection',planId:task.planId,segmentId:task.segmentId,scopeRevision:task.scopeRevision,expectedRevision:task.correction?.revision||0,requestId:'cr_'+crypto.randomUUID().replaceAll('-',''),answers,reason};
   try{localStorage.setItem(key,JSON.stringify(pending));}catch{pending=null;el('status').textContent='無法保存重試資料，請確認瀏覽器儲存空間後再試。';return;}
  }
  lock(true);el('status').textContent='正在送出更正申請，原成績維持不變…';let accepted=false;
  try{const result=await send(pending);if(result.requestId!==pending.requestId)throw Error('RETRY_OR_CHECK_RECEIPT');localStorage.removeItem(key);pending=null;accepted=true;el('status').textContent='更正申請已送出！等待老師核准，原成績維持不變。';await reload();}
  catch(e){const messages={CORRECTION_ALREADY_PENDING:'已有一筆更正等待老師處理，請稍後再查看。',CORRECTION_CONFLICT:'老師已更新答案，請重新開啟作業後再確認。',CORRECTION_NO_CHANGE:'答案與目前紀錄相同，不需要更正。',CORRECTION_LIMIT:'申請次數已達上限，請直接聯絡老師。'};
   if(messages[e.message]){localStorage.removeItem(key);pending=null;el('status').textContent=messages[e.message];}else el('status').textContent=accepted?'申請已收到，請稍後重新開啟查看。':'連線結果尚未確認，請重試原申請，不必重新填寫。';
  }finally{if(host.isConnected&&!accepted){lock(false);if(pending){host.querySelectorAll('input,textarea').forEach(e=>e.disabled=true);el('submit').textContent='重試原申請';}}}
 };
}
root.GiftedCorrectionRequest={mount};
})(window);
