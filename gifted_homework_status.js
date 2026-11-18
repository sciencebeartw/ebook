/* 原生作業以正式 Firebase 收據判斷已繳；Sheet 狀態不決定是否繳交。 */
(function(root){'use strict';
 function create({parseAssignment,readSummary,onChange=()=>{},now=Date.now}){
  const records=new Map();let bindings=new Map(),postBindings=new Map(),generation=0,identity='',active=false,inflight=0;
  const text=v=>String(v==null?'':v).normalize('NFKC').replace(/\s+/g,'');
  const date=v=>{const m=/(20\d\d)[/-](\d{1,2})[/-](\d{1,2})/.exec(String(v||''));return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
  const missing=v=>!String(v==null?'':v).trim()||/^(?:#N\/A|尚未繳交|未繳|未交|缺交|缺繳|缺考)$/.test(String(v).trim());
  const examKey=e=>JSON.stringify([e.examId||e.storedExamId||'',date(e.date),text(e.exam||e.examName),e.colIndex??null]);
  function activate(owner){if(identity!==owner){generation++;records.clear();bindings.clear();postBindings.clear();}identity=owner;active=!!owner;}
  function clear(){activate('');}
  const assignmentKey=a=>a.planId+'|'+a.segmentId;
  const postId=p=>String(p.id||p.dailyPostId||'');
  const postKey=(post,slot)=>JSON.stringify([postId(post),date(post.date),slot]);

  function observe(posts,grades,className,dueByClass){
   const next=new Map(), nextPosts=new Map(), candidates=[];
   for(const post of posts||[]){
    if(post.isTransferFormerClass||String(post.storedClassName||post.className||className)!==className)continue;
    const day=date(post.date);if(!day)continue;
    const slots=['hw1','hw2'].flatMap(slot=>(String(post[slot]||'').match(/https:\/\/[^\s<>"']+/g)||[])
      .map(parseAssignment).filter(Boolean).map(assignment=>({slot,assignment})));
    const byAssignment=new Map();
    for(const entry of slots){
     const key=assignmentKey(entry.assignment);
     if(!byAssignment.has(key))byAssignment.set(key,[]);
     byAssignment.get(key).push(entry);
    }
    for(const [key,entries] of byAssignment)candidates.push({post,day,slots:entries,key});
   }
   for(const {post,day,slots,key} of candidates){
    const {assignment}=slots[0];
    const matching=(grades||[]).filter(e=>!e.isTransferFormerClass&&date(e.date)===day&&
      /作業/.test(String(e.date)+' '+String(e.exam||e.examName))&&
      String(e.storedClassName||e.className||className)===className);
    const exact=matching.filter(e=>e.giftedPlanId===assignment.planId&&e.giftedSegmentId===assignment.segmentId&&
      (!e.giftedPostId||e.giftedPostId===postId(post)||e.giftedPostId===post.dailyPostId));
    const legacy=matching.length===1&&candidates.filter(entry=>entry.day===day).length===1&&
      !matching[0].giftedPlanId&&!matching[0].giftedSegmentId&&!matching[0].giftedPostId;
    const exam=exact.length===1?exact[0]:legacy?matching[0]:null;
    const title=text(exam?.exam||exam?.examName);
    let record=records.get(key);
    if(!record){
     record={key,assignment,className,day,title,state:'checking',attemptAt:null,revision:0};
     records.set(key,record);
    }
    if(record.className!==className||record.day!==day||record.title&&title&&record.title!==title)continue;
    if(title&&!record.title){
     record.title=title;
     if(record.state==='loaded'&&record.summaryTitle!==title){
      record.state='checking';record.attemptAt=null;
     }
    }
    const source=post.storedClassKey||post.sourceClassKey||className;
    record.dueAt=dueByClass?.[source]?.[postId(post)]?.dueAt || root.ClassSessionPlan?.options?.(post)?.homeworkDue?.dueAt || exam?.dueAt;
    record.materialized=exact.length===1&&/^\d+(?:\.\d+)?$/.test(String(exact[0].score??'').trim());
    for(const {slot} of slots)nextPosts.set(postKey(post,slot),record);
    if(exam)next.set(examKey(exam),record);
   }
   bindings=next;
   postBindings=nextPosts;
  }
  function get(exam){if(!active||!missing(exam.score))return null;return bindings.get(examKey(exam))||null;}

  function receiptState(record, unverifiedLegacy=false){
   if(!record||!active)return null;
   if(record.submission?.status==='submitted'&&!unverifiedLegacy)return {status:'submitted'};
   if(record.materialized)return {status:'submitted'};
   if(record.state==='loaded'&&!unverifiedLegacy)return {status:'not_submitted'};
   const unavailable=record.state==='unavailable';
   return {status:'unconfirmed',key:record.key,label:unavailable?'暫時無法確認繳交狀態':'確認繳交狀態中',retry:unavailable};
  }

  const needsLegacyTitleCheck=(record,exam)=>record?.submission?.status==='submitted'&&!exam.giftedPlanId&&
   record.summaryTitle!==text(exam.exam||exam.examName);
  function pendingForExam(exam){
   const record=get(exam);
   return receiptState(record,needsLegacyTitleCheck(record,exam));
  }

  function postAssignmentKey(post,slot){return postBindings.get(postKey(post,slot))?.key||'';}

  function postDisplay(key){
   const record=records.get(key),result=receiptState(record);
   if(!result)return null;
   if(result.status==='submitted')return {label:'已繳交'};
   if(result.status==='not_submitted')return {label:root.AssessmentLabels?.scienceScoreStatus?.({exam:'課本作業'},record.className,{unsubmitted:true,dueAt:record.dueAt},now()) || '尚未繳交',key};
   return result;
  }

  async function load(key,{force=false}={}){
   const r=records.get(key);if(!active||!r||r.loading||inflight>=2)return false;
   if(!force&&r.attemptAt!==null&&(r.state==='loaded'||now()-r.attemptAt<30000))return false;
   const epoch=generation,revision=r.revision;r.loading=true;r.attemptAt=now();inflight++;
   try{
    const value=await readSummary(r.assignment);
    if(epoch!==generation||!active||revision!==r.revision)return false;
    const g=value?.grades?.find(g=>g.targetId===r.assignment.segmentId);
    if(value?.planId!==r.assignment.planId||value?.classId!==r.className||!g||date(g.lessonDate)!==r.day||(r.title&&text(g.title)!==r.title)||
      !['submitted','not_submitted'].includes(g.submission?.status))throw Error('HOMEWORK_STATUS_MISMATCH');
    const s=g.submission;
    if(s.status==='submitted'&&(!Number.isSafeInteger(s.submittedAt)||s.submittedAt<=0||
      s.score!==null&&(!Number.isFinite(s.score)||s.score<0||s.score>s.maxScore)))throw Error('HOMEWORK_STATUS_MISMATCH');
    if(r.submission?.status!=='submitted'||s.status==='submitted'&&s.submittedAt>=r.submission.submittedAt){
     r.submission=s;
     r.sheetStatus=g.status;
    }
    r.summaryTitle=text(g.title);r.state='loaded';
   }catch(_){if(epoch===generation&&revision===r.revision){r.state='unavailable';}}finally{
    r.loading=false;inflight--;
    if(active)onChange();
    if(epoch===generation&&revision!==r.revision)load(r.key,{force:true});
   }
   return true;
  }
  function submitted(assignment,receipt){
   if(!active||receipt?.status!=='submitted'||!receipt.receiptId||!Number.isSafeInteger(receipt.submittedAt)||receipt.submittedAt<=0)return;
   const r=records.get(assignmentKey(assignment));
   if(!r||r.submission?.status==='submitted'&&r.submission.submittedAt>=receipt.submittedAt)return;
   r.revision++;r.submission={status:'submitted',submittedAt:receipt.submittedAt,score:null};r.state='checking';r.sheetStatus='pending';r.attemptAt=null;onChange();
   load(r.key,{force:true});
  }
  function display(exam){
   const r=get(exam);if(!r)return null;
   const s=r.submission,submitted=s?.status==='submitted'&&!needsLegacyTitleCheck(r,exam);
   if(r.state==='loaded'&&!submitted){
    const status=receiptState(r,needsLegacyTitleCheck(r,exam));
    if(status.status==='unconfirmed')return {key:r.key,score:null,label:'無法確認繳交狀態',note:'',retry:true};
    const label=root.AssessmentLabels?.scienceScoreStatus?.(exam,r.className,{unsubmitted:true,dueAt:r.dueAt},now());
    return label?{key:r.key,score:null,label,note:''}:null;
   }
   return {key:r.key,score:submitted&&Number.isFinite(s.score)?s.score:null,
    label:submitted?(Number.isFinite(s.score)?String(s.score):'已繳交'):r.state==='unavailable'?'暫時無法確認':'確認繳交狀態中',
    note:submitted?(r.sheetStatus==='completed'?'已繳交':'已繳交・試算表同步中'):'',retry:r.state==='unavailable'};
  }
  function refresh(){
   if(!active)return;let changed=false;
   for(const r of records.values())if(!r.loading&&r.attemptAt!==null&&now()-r.attemptAt>=30000){r.state='checking';r.attemptAt=null;changed=true;}
   if(changed)onChange();
  }
  return {activate,clear,observe,get,load,submitted,display,refresh,pendingForExam,postAssignmentKey,postDisplay};
 }
 if(typeof module==='object'&&module.exports){module.exports={create};return;}
 const api=create({parseAssignment:href=>root.GiftedEbook?.assignmentFromHref(href),
  readSummary:a=>root.GiftedEbook.readSummary(a),onChange:()=>{root.refreshNativeHomeworkDisplays?.();queueMicrotask(scan);}});
 let observer;
 function scan(){
  observer?.disconnect();
  if(!('IntersectionObserver'in root)){
   document.querySelectorAll('[data-native-homework-key]').forEach(node=>{if(!node.getClientRects().length)return;const b=node.getBoundingClientRect();if(b.bottom>=-100&&b.top<=root.innerHeight+100)api.load(node.dataset.nativeHomeworkKey);});return;
  }
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)api.load(e.target.dataset.nativeHomeworkKey);},{rootMargin:'100px'});
  document.querySelectorAll('[data-native-homework-key]').forEach(node=>observer.observe(node));
 }
 document.addEventListener('click',event=>{const button=event.target.closest?.('[data-native-homework-retry]');if(button)api.load(button.dataset.nativeHomeworkRetry,{force:true});});
 root.addEventListener('focus',()=>{if(!document.hidden)api.refresh();});
 root.addEventListener('online',()=>{if(!document.hidden)api.refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)api.refresh();});
 root.GiftedHomeworkStatus={...api,scan};
})(typeof window==='object'?window:globalThis);
