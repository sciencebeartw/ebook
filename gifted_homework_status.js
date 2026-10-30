/* 原生作業以正式 Firebase 收據判斷已繳；Sheet 狀態不決定是否繳交。 */
(function(root){'use strict';
 function create({parseAssignment,readSummary,onChange=()=>{},now=Date.now}){
  const records=new Map();let bindings=new Map(),generation=0,identity='',active=false,inflight=0;
  const text=v=>String(v==null?'':v).normalize('NFKC').replace(/\s+/g,'');
  const date=v=>{const m=/(20\d\d)[/-](\d{1,2})[/-](\d{1,2})/.exec(String(v||''));return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
  const missing=v=>!String(v==null?'':v).trim()||/^(?:#N\/A|尚未繳交|未繳|未交|缺交|缺繳)$/.test(String(v).trim());
  const examKey=e=>JSON.stringify([e.examId||e.storedExamId||'',date(e.date),text(e.exam||e.examName)]);
  function activate(owner){if(identity!==owner){generation++;records.clear();bindings.clear();}identity=owner;active=!!owner;}
  function clear(){activate('');}
  function observe(posts,grades,className){
   const next=new Map();
   for(const post of posts||[]){
    if(post.isTransferFormerClass||String(post.storedClassName||post.className||className)!==className)continue;
    const day=date(post.date);if(!day)continue;
    const assignments=String(post.hw1||'').match(/https:\/\/[^\s<>"']+/g)||[];
    const parsed=assignments.map(parseAssignment).filter(Boolean);
    const unique=[...new Map(parsed.map(a=>[a.planId+'|'+a.segmentId,a])).values()];
    if(unique.length!==1)continue;
    const matching=(grades||[]).filter(e=>date(e.date)===day&&/作業/.test(String(e.date)+' '+String(e.exam||e.examName))&&
      String(e.storedClassName||e.className||className)===className);
    if(matching.length!==1)continue; // 同日多欄不能猜配對。
    const exam=matching[0],assignment=unique[0],key=assignment.planId+'|'+assignment.segmentId;
    let record=records.get(key);
    if(!record){record={key,assignment,className,day,title:text(exam.exam||exam.examName),state:'checking',attemptAt:null,revision:0};records.set(key,record);}
    if(record.className!==className||record.day!==day||record.title!==text(exam.exam||exam.examName))continue;
    next.set(examKey(exam),record);
   }
   bindings=next;
  }
  function get(exam){if(!active||!missing(exam.score))return null;return bindings.get(examKey(exam))||null;}
  async function load(key,{force=false}={}){
   const r=records.get(key);if(!active||!r||r.loading||inflight>=2)return false;
   if(!force&&r.attemptAt!==null&&(r.state==='loaded'||now()-r.attemptAt<30000))return false;
   const epoch=generation,revision=r.revision;r.loading=true;r.attemptAt=now();inflight++;
   try{
    const value=await readSummary(r.assignment);
    if(epoch!==generation||!active||revision!==r.revision)return false;
    const g=value?.grades?.find(g=>g.targetId===r.assignment.segmentId);
    if(value?.planId!==r.assignment.planId||value?.classId!==r.className||!g||date(g.lessonDate)!==r.day||text(g.title)!==r.title||
      !['submitted','not_submitted'].includes(g.submission?.status))throw Error('HOMEWORK_STATUS_MISMATCH');
    const s=g.submission;
    if(s.status==='submitted'&&(!Number.isSafeInteger(s.submittedAt)||s.submittedAt<=0||
      s.score!==null&&(!Number.isFinite(s.score)||s.score<0||s.score>s.maxScore)))throw Error('HOMEWORK_STATUS_MISMATCH');
    r.state='loaded';r.submission=s;r.sheetStatus=g.status;
   }catch(_){if(epoch===generation&&revision===r.revision){r.state='unavailable';}}finally{
    r.loading=false;inflight--;
    if(active)onChange();
    if(epoch===generation&&revision!==r.revision)load(r.key,{force:true});
   }
   return true;
  }
  function submitted(assignment,receipt){
   if(!active||receipt?.status!=='submitted'||!receipt.receiptId)return;
   const r=records.get(assignment.planId+'|'+assignment.segmentId);if(!r)return;
   r.revision++;r.submission={status:'submitted',submittedAt:receipt.submittedAt,score:null};r.state='checking';r.sheetStatus='pending';r.attemptAt=null;onChange();
   load(r.key,{force:true});
  }
  function display(exam){
   const r=get(exam);if(!r)return null;
   const s=r.submission,submitted=s?.status==='submitted';
   if(r.state==='loaded'&&!submitted)return null;
   return {key:r.key,score:submitted&&Number.isFinite(s.score)?s.score:null,
    label:submitted?(Number.isFinite(s.score)?String(s.score):'已繳交'):r.state==='unavailable'?'暫時無法確認':'確認繳交狀態中',
    note:submitted?(r.sheetStatus==='completed'?'已繳交':'已繳交・試算表同步中'):'',retry:r.state==='unavailable'};
  }
  function refresh(){
   if(!active)return;let changed=false;
   for(const r of records.values())if(!r.loading&&r.attemptAt!==null&&now()-r.attemptAt>=30000){r.state='checking';r.attemptAt=null;changed=true;}
   if(changed)onChange();
  }
  return {activate,clear,observe,get,load,submitted,display,refresh};
 }
 if(typeof module==='object'&&module.exports){module.exports={create};return;}
 const api=create({parseAssignment:href=>root.GiftedEbook?.assignmentFromHref(href),
  readSummary:a=>root.GiftedEbook.readSummary(a),onChange:()=>{root.refreshNativeHomeworkDisplays?.();queueMicrotask(scan);}});
 let observer;
 function scan(){
  observer?.disconnect();
  if(!('IntersectionObserver'in root)){
   document.querySelectorAll('[data-native-homework-key]').forEach(node=>{const b=node.getBoundingClientRect();if(b.bottom>=-100&&b.top<=root.innerHeight+100)api.load(node.dataset.nativeHomeworkKey);});return;
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
