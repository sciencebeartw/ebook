(function(root){'use strict';
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function answerText(q,value){
  if(q.type==='manual')return typeof value==='string'&&value.trim()?value:'留白';
  const ids=Array.isArray(value)?value:value?[value]:[];
  return ids.length?ids.map(id=>{const i=(q.choices||[]).indexOf(id);return i>=0?String.fromCharCode(65+i):'—';}).join('、'):'留白';
}
function mount(container,result,task,{viewQuestion}={}){
  if(!container||!Array.isArray(result?.items)||!Array.isArray(task?.questions))return false;
  const questions=new Map(task.questions.map(q=>[q.id,q]));
  const available=result.items.filter(item=>questions.has(item.questionId)&&typeof item.explanation==='string'&&item.explanation.trim());
  if(!available.length)return false;
  const section=element('section',undefined,'gifted-result-explanations');
  section.append(element('h3','每題訂正與解析'),element('p','點開題目查看原因，再用紅筆訂正在課本上。'));
  const outcomes={correct:'答對',wrong:'答錯',blank:'留白',pending:'待老師批改'};
  for(const item of available){
    const q=questions.get(item.questionId),details=element('details'),summary=element('summary');
    details.className=item.outcome==='correct'?'correct':'needs-correction';
    summary.append(element('span',q.paperLabel||q.sourceTitle||'第 '+q.sourceIndex+' 題'),element('b',outcomes[item.outcome]||'已收到'));
    const body=element('div',undefined,'gifted-result-body'),answers=element('dl');
    answers.append(element('dt','你的答案'),element('dd',answerText(q,item.answer)));
    if(item.correctAnswers?.length)answers.append(element('dt',item.answerRevisionNotice?'原判分答案':'正確答案'),element('dd',answerText(q,item.correctAnswers)));
    if(item.answerRevisionNotice){
      answers.append(element('dt','訂正答案'),element('dd',answerText(q,item.referenceCorrectAnswers)));
      body.append(element('p',item.answerRevisionNotice,'gifted-answer-revision-notice'));
    }
    body.append(answers,element('p',item.explanation,'gifted-result-explanation'));
    if(typeof viewQuestion==='function'){
      const button=element('button','查看原題');button.type='button';button.onclick=()=>viewQuestion(q.id);body.append(button);
    }
    details.append(summary,body);section.append(details);
  }
  root.GiftedProperNames?.decorate(section);
  container.append(section);return true;
}
const api={mount,answerText};if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftedResult=api;
})(typeof globalThis!=='undefined'?globalThis:this);
