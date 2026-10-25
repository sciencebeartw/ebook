(function(root){'use strict';
 // 原原生資優欄位由 BearGifted_GradeMetadataMap_ 提供分母；題本與回家卷有自己的 assessmentKind。
 // 僅選擇顯示來源，不賦予任何寫入權限。
 function nativeAuthority(raw){
  return !!raw&&!raw.assessmentKind&&Number.isFinite(raw.homeworkMaxScore)&&raw.homeworkMaxScore>0&&raw.homeworkMaxScore<=250&&
   (/^hw_[a-f0-9]{64}$/.test(raw.giftedPlanId||'')&&/^week-\d+$/.test(raw.giftedSegmentId||'')||/作業/.test(String(raw.date||'')));
 }
 function create({scopes,callableFor,getUid,getSessionId=()=>'',storage,hash,transport=root.ProductionFastWriteTransport}){
  if(!Array.isArray(scopes)||scopes.length>64||[callableFor,getUid,getSessionId,hash].some(f=>typeof f!=='function')||!transport?.create)throw Error('invalid-grade-reader');
  const routes=new Map(),cache=new Map(),safe=x=>typeof x==='string'&&x.length>0&&x.length<=180&&!/[.#$[\]/\x00-\x1f\x7f]/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
  for(const s of scopes){if(!['science','math'].includes(s.subject)||!['dashboard','bidirectional'].includes(s.gradeAuthority||s.scoreAuthority)||s.enabled!==true||!safe(s.classKey)||!s.className||!/^[-\w]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.classKey)||[...routes.values()].some(r=>r.scopeId===s.scopeId))throw Error('invalid-grade-route');routes.set(s.classKey,{...s});}
  let identity='';function account(mode){const uid=getUid(),session=mode==='god'?getSessionId():'';if(!/^[-\w]{1,80}$/.test(uid||'')||mode==='god'&&!/^[a-f0-9]{48,64}$/i.test(session))throw Error('grade-login-required');const next=uid+'|'+session+'|'+mode;if(identity!==next){cache.clear();identity=next;}return{uid,session,identity};}
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
  function overlay(raw,classKey,studentKey,examId){if(nativeAuthority(raw))return raw;const v=cache.get(token(classKey,studentKey,examId));if(!v)return raw;
   const pending=String(raw.score??'')!==v.score;return{...raw,score:v.score,cellColor:v.color,fastWriteRevision:v.revision,
    ...(pending?{average:'更新中',dist:[],labels:[],myBucket:-1,total:0,fastWriteStatisticsPending:true}:{})};}
  return{target,overlay,clear:()=>{cache.clear();identity='';},accepts:classKey=>routes.has(classKey),size:()=>cache.size};
 }
 root.ProductionGradeReader={create,nativeAuthority};if(typeof module!=='undefined')module.exports={create,nativeAuthority};
})(typeof window!=='undefined'?window:globalThis);
