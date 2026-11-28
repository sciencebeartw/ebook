(function(){
  'use strict';
  const inputs=window.GiftedLibraryAnswerInputs;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  function choiceText(q,values,separator='、'){
    const ids=Array.isArray(values)?values:values?[values]:[];
    const labels=ids.map(id=>{
      const index=q.options.findIndex(o=>o.id===id);
      if(index<0)return null;
      if(q.section==='tf'||(q.options.length===2&&q.options[0].text.startsWith('○')))return q.options[index].text.charAt(0);
      return GiftedTypedQuestion.choiceLabel(q,q.options[index],index).replace(/\.$/,'');
    });
    return labels.includes(null)?'':labels.join(separator);
  }
  function answerLine(state,original,reference){
    const line=el('span',undefined,'cell-answer');
    line.dataset.state=state;
    if(state==='wrong'||state==='blank'){
      line.append(el('s',original||'留白'),el('b','→ 正確 '+(reference||'答案未提供')));
    }else if(state==='pending'){
      line.append(el('span','原答 '+(original||'留白')),el('b','參考 '+(reference||'請參考題本解答')),el('small','待核對'));
    }else{
      line.textContent=original||'未提供';
    }
    return line;
  }
  function checkedLine(labels,values,expected,unanswered){
    const selected=labels.filter((_,i)=>values[i]);
    const key=labels.filter((_,i)=>expected[i]);
    const extra=labels.filter((_,i)=>values[i]&&!expected[i]);
    const missing=labels.filter((_,i)=>!values[i]&&expected[i]);
    const state=unanswered?'blank':extra.length||missing.length?'wrong':'correct';
    const line=answerLine(state,unanswered?'留白':selected.join('、')||'均未勾選',key.join('、')||'均不勾選');
    if(state==='wrong'){
      const notes=[];
      if(missing.length)notes.push('漏勾 '+missing.join('、'));
      if(extra.length)notes.push('多勾 '+extra.join('、'));
      line.append(el('small',notes.join('　')));
    }
    return line;
  }
  function manualCells(q,item,raw){
    const shape=q.answerInputs,refs=item.referencePositions;
    const values=inputs.submittedValues(q,raw);
    const lines=[];
    const slots=new Map();
    const blank=raw==null||raw==='';
    const row=(label,line)=>{
      const wrap=el('span',undefined,'manual-row');
      if(label)wrap.append(el('span',label,'slot-label'));
      wrap.append(line);
      lines.push(wrap);
    };
    const fallback=()=>{
      const original=typeof raw==='string'&&raw.startsWith('slots-v1:')
        ? values?.map((v,i)=>v===true?shape.labels[i]:typeof v==='string'?v:'').filter(Boolean).join('、')||'原答格式無法逐格辨識' : raw;
      row('',answerLine(blank?'blank':'pending',original,inputs.reference(q,item)||item.expected));
    };
    if(!values||!Array.isArray(refs))fallback();
    else if(shape.mode==='checks'){
      if(!refs.every(i=>Number.isInteger(i)&&i>=0&&i<values.length))fallback();
      else row('',checkedLine(shape.labels,values,values.map((_,i)=>refs.includes(i)),blank));
    }else if(refs.length!==values.length)fallback();
    else{
      for(let i=0;i<values.length;){
        if(shape.kinds?.[i]==='check'){
          let end=i+1;
          while(shape.kinds[end]==='check')end++;
          row('',checkedLine(shape.labels.slice(i,end),values.slice(i,end),refs.slice(i,end),blank));
          i=end;
        }else{
          const original=values[i],reference=refs[i];
          const state=window.GiftedLibraryFillState(original,typeof reference==='string'?reference:'',q.id,shape.labels[i]);
          const line=answerLine(state,original,reference);
          row(shape.labels[i],line);
          slots.set(i,{line,original,reference});
          i++;
        }
      }
      if(item.paperReference)row('紙本作答',el('span',item.paperReference));
    }
    return {lines,slots};
  }
  function render(container,questions,result,answers,viewQuestion){
    const byId=new Map(result.results.map(item=>[item.questionId,item]));
    const fragment=document.createDocumentFragment(),fillSlots=new Map();
    let group,grid;
    for(const [i,q] of questions.entries()){
      const title=q.sourceTitle?.split('｜').pop().trim()||q.label||'第 '+(i+1)+' 題';
      const match=/^(.+?)\s+第\s*(.+?)\s*題(.*)$/u.exec(title);
      const section=match?match[1]:'作答題目';
      if(section!==group){
        group=section;grid=el('div',undefined,'answer-cells');
        fragment.append(el('h3',section),grid);
      }
      const button=el('button',undefined,'answer-cell');
      button.type='button';button.onclick=()=>viewQuestion(q.id);
      const number=match?match[2]+match[3]:title;
      button.append(el('span',number,'cell-number'));
      const item=byId.get(q.id);
      if(!item){button.append('尚無判定');grid.append(button);continue;}
      const raw=item.answer!==undefined?item.answer:answers?.[q.id];
      if(q.type==='manual'){
        button.classList.add('manual-cell');
        const {lines,slots}=manualCells(q,item,raw);
        button.append(...lines);
        fillSlots.set(q.id,slots);
      }else{
        const ref=item.acceptedAnswers?.length?choiceText(q,item.acceptedAnswers,' 或 '):choiceText(q,item.correctAnswers);
        const original=choiceText(q,raw);
        const line=answerLine(item.outcome,original||(item.outcome==='blank'?'留白':'原答未提供'),ref||item.expected);
        button.dataset.state=item.outcome;
        button.append(line);
        button.setAttribute('aria-label',[title,({correct:'答對',wrong:'答錯',blank:'未作答',pending:'待核對'})[item.outcome],line.textContent].filter(Boolean).join('，'));
      }
      grid.append(button);
    }
    container.replaceChildren(fragment);
    return (id,slot,verdict)=>{
      const info=fillSlots.get(id)?.get(slot);
      if(!info)return;
      const state={different:'wrong',equivalent:'correct',uncertain:'pending'}[verdict];
      if(!state)return;
      const updated=answerLine(state,info.original,info.reference);
      info.line.replaceWith(updated);info.line=updated;
    };
  }
  window.GiftedLibraryResultGrid={render};
})();
