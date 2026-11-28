(function(){
  'use strict';
  const prefix='slots-v1:';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validShape=shape=>shape&&['blanks','checks','mixed'].includes(shape.mode)&&Array.isArray(shape.labels)&&shape.labels.length>0&&(shape.mode!=='mixed'||shape.kinds?.length===shape.labels.length);
  const isCheck=(shape,i)=>shape.mode==='checks'||shape.kinds?.[i]==='check';
  function fields(q){
    if(!validShape(q.answerInputs))return '<textarea maxlength="2000" aria-label="本題答案" placeholder="填寫答案，送出後自行核對解答"></textarea>';
    const shape=q.answerInputs,{mode,labels}=shape;
    const legend=mode==='checks'?'勾選符合的項目':mode==='mixed'?'依照紙本逐格填答與勾選':'依照紙本格位填答';
    return '<fieldset class="answer-inputs'+(mode==='checks'?' check-options':'')+'"><legend>'+legend+'</legend>'+
      labels.map((label,i)=>isCheck(shape,i)
        ? '<label class="answer-option"><input type="checkbox" data-slot="'+i+'"><span>'+escape(label)+'</span></label>'
        : '<label><span>'+escape(label)+'</span><input type="text" maxlength="'+Math.min(100,Math.floor(1700/labels.length))+'" data-slot="'+i+'" autocomplete="off" spellcheck="false"></label>').join('')+
      (shape.paperHint?'<p class="paper-answer-hint">'+escape(shape.paperHint)+'</p>':'')+
      '<label class="earlier-answer" hidden><span>原本填寫的答案</span><textarea maxlength="2000" aria-label="原本填寫的答案"></textarea></label></fieldset>';
  }
  function controls(element){return Array.from(element.querySelectorAll('[data-slot]'));}
  function encode(values){
    if(!values.some(value=>typeof value==='boolean'?value:Boolean(value.trim()))) return '';
    return prefix+JSON.stringify(values);
  }
  function decode(shape,count,answer){
    if(typeof answer!=='string'||!answer.startsWith(prefix))return null;
    try{
      const values=JSON.parse(answer.slice(prefix.length));
      if(Array.isArray(values)&&values.length===count&&values.every((value,i)=>typeof value===(isCheck(shape,i)?'boolean':'string')))return values;
    }catch{}
    return null;
  }
  function read(q,element){
    if(!validShape(q.answerInputs))return element.querySelector('textarea').value;
    const fields=controls(element);
    const values=fields.map((field,i)=>isCheck(q.answerInputs,i)?field.checked:field.value);
    return encode(values)||element.querySelector('.earlier-answer textarea').value;
  }
  function submittedValues(q,answer){
    const shape=q.answerInputs;
    if(!validShape(shape))return null;
    const count=shape.labels.length;
    if(answer==null||answer==='')return shape.labels.map((_,i)=>isCheck(shape,i)?false:'');
    const values=decode(shape,count,answer);
    if(values)return values;
    if(typeof answer!=='string'||answer.startsWith(prefix)||shape.mode!=='blanks')return null;
    const parts=count===1?[answer]:answer.split(/[；;\r\n]+/).map(value=>value.trim());
    return parts.length===count?parts:null;
  }
  function restore(q,element,answer){
    if(!validShape(q.answerInputs)){element.querySelector('textarea').value=answer||'';return;}
    const fields=controls(element);
    const previous=element.querySelector('.earlier-answer');
    previous.hidden=true;
    previous.querySelector('textarea').value='';
    const values=submittedValues(q,answer);
    if(!values&&answer){previous.hidden=false;previous.querySelector('textarea').value=answer;}
    fields.forEach((field,i)=>{if(isCheck(q.answerInputs,i))field.checked=values?.[i]===true;else field.value=values?.[i]||'';});
  }
  function reference(q,result){
    if(!validShape(q.answerInputs)||!Array.isArray(result.referencePositions))return '';
    const {mode,labels}=q.answerInputs;
    const positions=result.referencePositions;
    if(mode==='checks')return positions.length?'應勾選 '+positions.map(i=>labels[i]).join('、'):'各項均不勾選';
    const lines=[];
    let checked=[];
    const flushChecks=()=>{
      if(checked.length)lines.push('應勾選 '+checked.join('、'));
      checked=[];
    };
    positions.forEach((value,i)=>{
      if(value===true)checked.push(labels[i]);
      if(typeof value==='string'){
        flushChecks();
        lines.push(labels[i]+'　'+value);
      }
    });
    flushChecks();
    if(result.paperReference)lines.push(result.paperReference);
    return '\n'+lines.join('\n');
  }
  window.GiftedLibraryAnswerInputs={fields,read,restore,reference,submittedValues};
})();
