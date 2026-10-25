(function(root){'use strict';
 // 只更新成績區；留言、附件及編輯中的分數維持原 DOM 與原 expected value。
 root.replaceProductionGradeCards=function(container,html,selector,previousContexts,previousMakeupContexts){
  const fragment=document.createElement('template');fragment.innerHTML=html;
  function identity(card){const post=card.closest('.post-card-wrapper'),examId=card.dataset.storedExamId||card.dataset.examId||'';return JSON.stringify([card.dataset.sourceClassKey||post?.dataset.storedClassKey||post?.dataset.sourceClassKey||'',examId,examId?'':card.dataset.examColIndex||'']);}
  const fresh=new Map([...fragment.content.querySelectorAll(selector)].map(card=>[identity(card),card]));
  for(const card of container.querySelectorAll(selector)){
   const next=fresh.get(identity(card));if(!next)continue;
   const fields=[...card.querySelectorAll('textarea,input:not([type="hidden"])')],editing=card.contains(document.activeElement)||fields.some(e=>e.type==='checkbox'?e.checked!==e.defaultChecked:e.value!==e.defaultValue)||!!card.querySelector('button:disabled');
   if(editing){let note=card.querySelector('.fastwrite-grade-update-note');if(!note){note=document.createElement('p');note.className='fastwrite-grade-update-note';note.setAttribute('role','status');card.append(note);}note.textContent='有新的成績更新；目前輸入已保留，送出時會核對是否衝突。';
    for(const field of fields){const key=field.id?.replace(/^god-score-edit-input-/,'');if(key!==field.id&&Object.hasOwn(previousContexts||{},key))root.adminModeScoreEditContext[key]=previousContexts[key];}
    for(const status of card.querySelectorAll('[id^="god-makeup-status-"]')){const key=status.id.slice('god-makeup-status-'.length);if(Object.hasOwn(previousMakeupContexts||{},key))root.adminModeMakeupContext[key]=previousMakeupContexts[key];}continue;
   }
   card.innerHTML=next.innerHTML;
   for(const attribute of [...card.attributes])if(attribute.name.startsWith('data-')&&!next.hasAttribute(attribute.name))card.removeAttribute(attribute.name);
   for(const attribute of [...next.attributes])if(attribute.name.startsWith('data-'))card.setAttribute(attribute.name,attribute.value);
  }
 };
})(window);
