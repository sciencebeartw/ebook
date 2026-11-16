(function(){
  'use strict';
  const prefix='slots-v1:';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validShape=shape=>shape&&(shape.mode==='blanks'||shape.mode==='checks')&&Array.isArray(shape.labels)&&shape.labels.length>0;
  function fields(q){
    if(!validShape(q.answerInputs))return '<textarea maxlength="2000" aria-label="本題答案" placeholder="填寫答案，送出後自行核對解答"></textarea>';
    const {mode,labels}=q.answerInputs;
    const legend=mode==='checks'?'勾選符合的項目':'依照紙本格位填答';
    return '<fieldset class="answer-inputs'+(mode==='checks'?' check-options':'')+'"><legend>'+legend+'</legend>'+
      labels.map((label,i)=>mode==='checks'
        ? '<label><input type="checkbox" data-slot="'+i+'"><span>'+escape(label)+'</span></label>'
        : '<label><span>'+escape(label)+'</span><input type="text" maxlength="'+Math.min(100,Math.floor(1700/labels.length))+'" data-slot="'+i+'" autocomplete="off" spellcheck="false"></label>').join('')+
      '<label class="earlier-answer" hidden><span>原本填寫的答案</span><textarea maxlength="2000" aria-label="原本填寫的答案"></textarea></label></fieldset>';
  }
  function controls(element){return Array.from(element.querySelectorAll('[data-slot]'));}
  function encode(mode,values){
    if(mode==='checks'?!values.some(Boolean):!values.some(x=>x.trim())) return '';
    return prefix+JSON.stringify(values);
  }
  function decode(mode,count,answer){
    if(typeof answer!=='string'||!answer.startsWith(prefix))return null;
    try{
      const values=JSON.parse(answer.slice(prefix.length));
      const expectedType=mode==='checks'?'boolean':'string';
      if(Array.isArray(values)&&values.length===count&&values.every(value=>typeof value===expectedType))return values;
    }catch{}
    return null;
  }
  function read(q,element){
    if(!validShape(q.answerInputs))return element.querySelector('textarea').value;
    const {mode}=q.answerInputs, fields=controls(element);
    const values=fields.map(field=>mode==='checks'?field.checked:field.value);
    return encode(mode,values)||element.querySelector('.earlier-answer textarea').value;
  }
  function restore(q,element,answer){
    if(!validShape(q.answerInputs)){element.querySelector('textarea').value=answer||'';return;}
    const {mode,labels}=q.answerInputs,fields=controls(element);
    const previous=element.querySelector('.earlier-answer');
    previous.hidden=true;
    previous.querySelector('textarea').value='';
    let values=decode(mode,fields.length,answer);
    if(!values&&answer&&mode==='blanks'){
      // Legacy free text can be restored when its delimiters match the original number of blanks.
      const parts=labels.length===1?[answer]:answer.split(/[；;\r\n]+/).map(value=>value.trim());
      if(parts.length===fields.length)values=parts;
    }
    if(!values&&answer){previous.hidden=false;previous.querySelector('textarea').value=answer;}
    fields.forEach((field,i)=>{if(mode==='checks')field.checked=values?.[i]===true;else field.value=values?.[i]||'';});
  }
  function reference(q,result){
    if(!validShape(q.answerInputs)||!Array.isArray(result.referencePositions))return '';
    const {mode,labels}=q.answerInputs;
    if(mode==='checks')return '應勾選 '+result.referencePositions.map(i=>labels[i]).join('、');
    return '\n'+result.referencePositions.map((a,i)=>labels[i]+'　'+a).join('\n');
  }
  window.GiftedLibraryAnswerInputs={fields,read,restore,reference};
})();
