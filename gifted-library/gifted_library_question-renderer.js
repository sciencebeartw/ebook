(function(global){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=v=>esc(v).replace(/\n/g,'<br>');
  function media(items,label,kind='question'){return (items||[]).map(a=>BearStudentMedia.html(a,'',label,kind)).join('');}
  function blocks(items){return (items||[]).map(b=>{
    if(b.kind==='text')return `<p class="typed-context-text">${text(b.text)}</p>`;
    if(b.kind==='media')return `<div class="typed-figures">${media(b.media,'題目附圖')}</div>`;
    if(b.kind==='table')return '<div class="typed-table-scroll" tabindex="0" role="region" aria-label="題目資料表"><table class="typed-table"><tbody>'+b.rows.map(row=>'<tr>'+row.map(c=>`<td colspan="${Math.max(1,Math.min(30,Number(c.colSpan)||1))}" rowspan="${Math.max(1,Math.min(30,Number(c.rowSpan)||1))}">${text(c.text)}${media(c.media,'表格附圖')}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
    return '';
  }).join('');}
  function isMock(q){return /^grb_mock_/.test(q.id||'')||/^grb-mock-/.test(q.chapterId||'');}
  function choiceLabel(q,o,i){return isMock(q)?'①②③④'[i]||String(i+1):String.fromCharCode(65+i)+'.';}
  function answerText(q,ids){return ids.map(id=>{const i=q.options.findIndex(o=>o.id===id),o=q.options[i];return o?(isMock(q)?choiceLabel(q,o,i)+' ':'')+o.text:id;}).join('、');}
  function question(q,name=q.id){
    const tf=q.options.length===2&&q.options[0].text.startsWith('○');
    return `<p class="typed-question-label">${esc(q.sourceTitle||q.label)}</p>`+(q.contextBlocks?.length?`<aside class="typed-context" aria-label="共用題文">${blocks(q.contextBlocks)}</aside>`:'')+
      `<p class="typed-prompt">${text(q.prompt)}</p>`+blocks(q.bodyBlocks)+
      (q.options.length?'<div class="typed-choices">'+q.options.map((o,i)=>`<label class="typed-choice"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="${esc(name)}" value="${esc(o.id)}"><span class="typed-choice-label">${tf?'':esc(choiceLabel(q,o,i))}</span><span class="typed-choice-content">${text(o.text)}${media(o.media,'選項 '+choiceLabel(q,o,i),'option')}</span></label>`).join('')+'</div>':'');
  }
  global.GiftedTypedQuestion={question,blocks,choiceLabel,answerText};
})(window);
