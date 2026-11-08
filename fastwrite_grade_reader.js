(function(root){'use strict';
 // 原原生資優欄位由 BearGifted_GradeMetadataMap_ 提供分母；題本與回家卷有自己的 assessmentKind。
 // 僅選擇顯示來源，不賦予任何寫入權限。
 function nativeAuthority(raw){
  return !!raw&&!raw.assessmentKind&&Number.isFinite(raw.homeworkMaxScore)&&raw.homeworkMaxScore>0&&raw.homeworkMaxScore<=250&&
   (/^hw_[a-f0-9]{64}$/.test(raw.giftedPlanId||'')&&/^week-\d+$/.test(raw.giftedSegmentId||'')||/作業/.test(String(raw.date||'')));
 }
 function create({scopes,callableFor,getUid,getSessionId=()=>'',storage,hash,transport=root.ProductionFastWriteTransport,now=Date.now}){
  if(!Array.isArray(scopes)||scopes.length>64||[callableFor,getUid,getSessionId,hash].some(f=>typeof f!=='function')||!transport?.create)throw Error('invalid-grade-reader');
  const routes=new Map(),cache=new Map(),complete=new Map(),safe=x=>typeof x==='string'&&x.length>0&&x.length<=180&&!/[.#$[\]/\x00-\x1f\x7f]/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
  for(const s of scopes){if(!['science','math'].includes(s.subject)||!['dashboard','bidirectional'].includes(s.gradeAuthority||s.scoreAuthority)||s.enabled!==true||!safe(s.classKey)||!s.className||!/^[-\w]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.classKey)||[...routes.values()].some(r=>r.scopeId===s.scopeId))throw Error('invalid-grade-route');routes.set(s.classKey,{...s});}
  let identity='',waitingDeadline=0;function account(mode){const uid=getUid(),session=mode==='god'?getSessionId():'';if(!/^[-\w]{1,80}$/.test(uid||'')||mode==='god'&&!/^[a-f0-9]{48,64}$/i.test(session))throw Error('grade-login-required');const next=uid+'|'+session+'|'+mode;if(identity!==next){cache.clear();complete.clear();waitingDeadline=0;identity=next;}return{uid,session,identity};}
  const token=(c,s,e)=>JSON.stringify([c,s,e]);
  async function target(mode,{classKey,studentKey,examId}){
   const route=routes.get(classKey);if(!['student','god','teacher'].includes(mode)||!route||!safe(studentKey)||!safe(examId))throw Error('grade-source-invalid');
   const before=account(mode),key=token(classKey,studentKey,examId),h=await hash([route.scopeId,studentKey,examId]);if(!/^[a-f0-9]{64}$/.test(h)||account(mode).identity!==before.identity)throw Error('grade-login-changed');
   const entityId='grade_'+h.slice(0,40),id=route.scopeId+'|'+entityId;
   return{id,key,transport:transport.create({callable:callableFor(mode),storage,namespace:'grade_read_'+before.uid,scope:route.scopeId,entityId,epoch:route.epoch,sessionId:before.session||undefined}),prefix:`ebook_fast_write_v1/business_entities/${route.scopeId}/${entityId}/`,
    accept:view=>{if(account(mode).identity!==before.identity)throw Error('grade-login-changed');if(view?.kind!=='grade'||view.entityId!==entityId||!Number.isSafeInteger(view.revision)||view.revision<0||typeof view.business?.score!=='string'||view.business.score.length>80||typeof view.business.color!=='string'||!/^#[a-f0-9]{6}$/i.test(view.business.color))throw Error('invalid-grade-projection');
     const old=cache.get(key);if(old&&old.revision>view.revision)return false;const next={revision:view.revision,score:view.business.score,color:view.business.color};if(JSON.stringify(old)===JSON.stringify(next))return false;
     if(cache.size>=64&&!cache.has(key))cache.delete(cache.keys().next().value);cache.delete(key);cache.set(key,next);return true;},clear:()=>cache.delete(key)};
  }
  // 分數與統計只能由同一份完整原生快照發布；即時 business 通知不搶先覆蓋分數。
  function copy(raw){const next={...raw};for(const key of ['dist','labels'])if(Array.isArray(raw[key]))next[key]=raw[key].slice();return next;}
  const fields=['score','cellColor','average','dist','labels','myBucket','total','distMin','distMax','fastWriteRevision','fastWriteStatisticsVersion'];
  function saved(raw,classKey,studentKey,examId){
   const x=raw.fastWriteLastComplete,g=x?.grade;
   if(x?.schema!==1||x.classKey!==classKey||x.studentKey!==studentKey||x.examId!==examId||x.examId!==raw.fastWriteExamId||x.bindingHash!==raw.fastWriteBindingHash||x.date!==raw.date||x.examName!==raw.examName||!g||typeof g!=='object')return null;
   if(!['string','number'].includes(typeof g.score)||String(g.score).length>80||!['string','number'].includes(typeof g.average)||!String(g.average).trim()||String(g.average).trim()==='更新中'||String(g.average).length>80)return null;
   if(['dist','labels'].some(k=>g[k]!==undefined&&(!Array.isArray(g[k])||g[k].length>128))||g.dist?.some(n=>!Number.isFinite(n))||g.labels?.some(v=>typeof v!=='string'||v.length>80))return null;
   if(['fastWriteRevision','fastWriteStatisticsVersion'].some(k=>g[k]!==undefined&&(!Number.isSafeInteger(g[k])||g[k]<0))||JSON.stringify(x).length>4096)return null;
   const grade={};for(const k of fields)if(g[k]!==undefined)grade[k]=g[k];
   return{...raw,...copy(grade),fastWriteRevision:g.fastWriteRevision||0,fastWriteStatisticsVersion:g.fastWriteStatisticsVersion||0,fastWriteStatisticsPending:false,gradeDisplayPending:false};
  }
  function remember(key,raw){if(complete.size>=64&&!complete.has(key))complete.delete(complete.keys().next().value);complete.delete(key);complete.set(key,copy(raw));}
  function overlay(raw,classKey,studentKey,examId,mode='student'){
   raw=raw||{};account(mode);if(nativeAuthority(raw))return raw;
   const key=token(classKey,studentKey,examId);let old=complete.get(key);
   if(old&&raw.fastWriteBindingHash&&old.fastWriteBindingHash&&raw.fastWriteBindingHash!==old.fastWriteBindingHash){complete.delete(key);old=null;}
   const pending=raw.fastWriteStatisticsPending===true||String(raw.average||'').trim()==='更新中';
   if(pending){
    const previous=saved(raw,classKey,studentKey,examId);
    if(previous&&(!old||(previous.fastWriteRevision||0)>=(old.fastWriteRevision||0)&&(previous.fastWriteStatisticsVersion||0)>=(old.fastWriteStatisticsVersion||0))){old=previous;remember(key,previous);}
    if(old)return copy(old);
    // 只有完全沒有完整舊資料時才等一次，最多八秒；沒有重複讀取或輪詢。
    if(!waitingDeadline)waitingDeadline=now()+8000;
    if(now()>=waitingDeadline)return{...raw,average:'暫無資料',dist:[],labels:[],myBucket:-1,total:0,gradeDisplayDelayed:true};
    return{...raw,score:'',average:'',dist:[],labels:[],myBucket:-1,total:0,gradeDisplayPending:true};
   }
   const older=old&&((raw.fastWriteRevision||0)<(old.fastWriteRevision||0)||(raw.fastWriteStatisticsVersion||0)<(old.fastWriteStatisticsVersion||0));
   if(older)return copy(old);
   const next=copy(raw);if(studentKey&&examId)remember(key,next);return copy(next);
  }
  return{target,overlay,waitingUntil:()=>waitingDeadline>now()?waitingDeadline:0,clearLive:()=>cache.clear(),clear:()=>{cache.clear();complete.clear();waitingDeadline=0;identity='';},accepts:classKey=>routes.has(classKey),size:()=>cache.size};
 }
 root.ProductionGradeReader={create,nativeAuthority};if(typeof module!=='undefined')module.exports={create,nativeAuthority};
})(typeof window!=='undefined'?window:globalThis);
