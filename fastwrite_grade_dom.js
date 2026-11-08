(function(root){'use strict';
 // 只更新成績區；留言、附件及編輯中的分數維持原 DOM 與原 expected value。
 root.replaceProductionGradeCards=function(container,html,selector,previousContexts,previousMakeupContexts){
  const fragment=document.createElement('template');fragment.innerHTML=html;
  function identity(card){const post=card.closest('.post-card-wrapper'),examId=card.dataset.storedExamId||card.dataset.examId||'';return JSON.stringify([card.dataset.sourceClassKey||post?.dataset.storedClassKey||post?.dataset.sourceClassKey||'',examId,examId?'':card.dataset.examColIndex||'']);}
  const fresh=new Map([...fragment.content.querySelectorAll(selector)].map(card=>[identity(card),card]));
  const cards=[...container.querySelectorAll(selector)];
  if(cards.length!==fresh.size||cards.some(card=>!fresh.has(identity(card))))return false;
  for(const card of cards){
   const next=fresh.get(identity(card));if(!next)continue;
   const restoreContexts=()=>{
    for(const field of card.querySelectorAll('[id^="god-score-edit-input-"]')){const key=field.id.slice('god-score-edit-input-'.length);if(Object.hasOwn(previousContexts||{},key))root.adminModeScoreEditContext[key]=previousContexts[key];}
    for(const status of card.querySelectorAll('[id^="god-makeup-status-"]')){const key=status.id.slice('god-makeup-status-'.length);if(Object.hasOwn(previousMakeupContexts||{},key))root.adminModeMakeupContext[key]=previousMakeupContexts[key];}
   };
   const syncAttributes=()=>{
    if(next.hasAttribute('onclick'))card.setAttribute('onclick',next.getAttribute('onclick'));else card.removeAttribute('onclick');
    if(next.hasAttribute('aria-busy'))card.setAttribute('aria-busy',next.getAttribute('aria-busy'));else card.removeAttribute('aria-busy');
    for(const attribute of [...card.attributes])if(attribute.name.startsWith('data-')&&!next.hasAttribute(attribute.name))card.removeAttribute(attribute.name);
    for(const attribute of [...next.attributes])if(attribute.name.startsWith('data-'))card.setAttribute(attribute.name,attribute.value);
   };
   if(card.dataset.gradeWritePending!==undefined){
    const committed=Number(card.dataset.gradeWriteRevision)||0;
    const waiting=next.hasAttribute('aria-busy')||(committed?Number(next.dataset.gradeRevision||0)<committed:card.dataset.gradeWritePending!==next.dataset.gradeScore&&card.dataset.gradeScore===next.dataset.gradeScore);
    if(waiting){restoreContexts();continue;}
   }
   if(card.innerHTML===next.innerHTML){restoreContexts();syncAttributes();continue;}
   const fields=[...card.querySelectorAll('textarea,input:not([type="hidden"])')],editing=(card.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select,[contenteditable]'))||fields.some(e=>e.type==='checkbox'?e.checked!==e.defaultChecked:e.value!==e.defaultValue)||!!card.querySelector('button:disabled');
   if(editing){let note=card.querySelector('.fastwrite-grade-update-note');if(!note){note=document.createElement('p');note.className='fastwrite-grade-update-note';note.setAttribute('role','status');card.append(note);}note.textContent='有新的成績更新；目前輸入已保留，送出時會核對是否衝突。';
    restoreContexts();continue;
   }
   if(card.classList.contains('active')){const hint=next.querySelector('.click-hint');if(hint)hint.textContent='▲';}
   card.innerHTML=next.innerHTML;
   syncAttributes();
  }
  return true;
 };
})(window);
