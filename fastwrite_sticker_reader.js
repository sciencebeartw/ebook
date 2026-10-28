(function(root){'use strict';
 const safe=s=>typeof s==='string'&&s.length>0&&s.length<=180&&!/[.#$[\]/\x00-\x1f\x7f]/.test(s)&&!['__proto__','prototype','constructor'].includes(s),label=s=>typeof s==='string'&&s.length>0&&s.length<=100&&!/[\x00-\x1f\x7f]/.test(s),int=Number.isSafeInteger;
 function day(s){return typeof s==='string'&&/^(?:20\d{2}|2100)-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
 const date=s=>s.replace(/-/g,'/'),time=ms=>new Date(ms+28800000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' ');
 function create({scopes,callableFor,getUid,getSessionId=()=>'',storage,hash,transport=root.ProductionFastWriteTransport}){
  if(!Array.isArray(scopes)||scopes.length>64||[callableFor,getUid,getSessionId,hash].some(f=>typeof f!=='function')||!transport?.create)throw Error('invalid-sticker-reader');
  const routes=new Map(),cache=new Map();let identity='';
  for(const r of scopes){if(!(r.subject==='science'&&r.scoreAuthority==='dashboard'||r.subject==='math'&&r.gradeAuthority==='bidirectional')||r.enabled!==true||!safe(r.classKey)||!label(r.className)||!/^[-\w]{1,80}$/.test(r.scopeId)||!int(r.epoch)||r.epoch<1||routes.has(r.classKey)||[...routes.values()].some(s=>s.scopeId===r.scopeId))throw Error('invalid-sticker-route');routes.set(r.classKey,{...r});}
  function account(mode){const uid=getUid(),session=mode==='god'?getSessionId():'';if(!/^[-\w]{1,80}$/.test(uid||'')||mode==='god'&&!/^[a-f0-9]{48,64}$/i.test(session))throw Error('sticker-login-required');const next=[uid,mode,session].join('|');if(identity!==next){cache.clear();identity=next;}return{uid,session,key:next};}
  const token=(c,s)=>JSON.stringify([c,s]);
  function current(){const [uid,mode,session]=identity.split('|');if(!identity||getUid()!==uid||mode==='god'&&getSessionId()!==session){cache.clear();identity='';return false;}return true;}
  async function target(mode,{classKey,studentKey}){
   const route=routes.get(classKey);if(!['student','god','teacher'].includes(mode)||!route||!safe(studentKey))throw Error('sticker-source-invalid');
   const before=account(mode),h=await hash([route.scopeId,studentKey]);if(!/^[a-f0-9]{64}$/.test(h)||account(mode).key!==before.key)throw Error('sticker-login-changed');
   const entityId='stickers_'+h.slice(0,40),key=token(classKey,studentKey);
   function accept(view){
    if(account(mode).key!==before.key)throw Error('sticker-login-changed');const b=view?.business;
    if(view?.kind!=='stickers'||view.entityId!==entityId||!int(view.revision)||view.revision<0||!b||!int(b.balance)||new TextEncoder().encode(JSON.stringify(view)).length>256*1024)throw Error('invalid-sticker-projection');
    for(const field of ['applications','entries','checkins']){const rows=b[field]||{};if(typeof rows!=='object'||Array.isArray(rows)||Object.keys(rows).length>512)throw Error('invalid-sticker-projection');}
    for(const [id,a]of Object.entries(b.applications||{}))if(!a||typeof a!=='object'||!safe(id)||a.id!==id||!int(a.delta)||!a.delta||Math.abs(a.delta)>100||!day(a.date)||typeof a.reason!=='string'||a.reason.length>2000||!['pending','approved','rejected'].includes(a.status)||!int(a.submittedAt)||a.submittedAt<0||a.submittedAt>4102444800000||a.reviewReason!==undefined&&(typeof a.reviewReason!=='string'||a.reviewReason.length>2000)||a.sourceFeedbackKey!==undefined&&(!safe(a.sourceFeedbackKey)||!label(a.sourceClassName)||!safe(a.sourceStudentKey)))throw Error('invalid-sticker-projection');
    for(const [id,a]of Object.entries(b.entries||{}))if(!a||typeof a!=='object'||!safe(id)||a.id!==id||!int(a.delta)||!a.delta||Math.abs(a.delta)>100||!day(a.date)||typeof a.reason!=='string'||a.reason.length>2000||!int(a.at)||a.at<0||a.at>4102444800000||a.applicationId!==undefined&&!safe(a.applicationId))throw Error('invalid-sticker-projection');
    for(const [d,c]of Object.entries(b.checkins||{}))if(!c||typeof c!=='object'||!day(d)||typeof c.checked!=='boolean'||!int(c.checkedAt))throw Error('invalid-sticker-projection');
    const old=cache.get(key);if(old&&old.revision>view.revision)return false;const next={revision:view.revision,business:JSON.parse(JSON.stringify(b)),route,studentKey};if(JSON.stringify(old)===JSON.stringify(next))return false;
    if(cache.size>=4&&!cache.has(key))cache.delete(cache.keys().next().value);cache.set(key,next);return true;
   }
   return{id:route.scopeId+'|'+entityId,entityId,prefix:`ebook_fast_write_v1/business_entities/${route.scopeId}/${entityId}/`,
    transport:transport.create({callable:callableFor(mode),storage,namespace:'sticker_read_'+before.uid,scope:route.scopeId,entityId,epoch:route.epoch,sessionId:before.session||undefined}),accept,clear:()=>cache.delete(key)};
  }
  function balance(raw,classKey,studentKey){return current()?cache.get(token(classKey,studentKey))?.business.balance??raw:raw;}
  function merge(list,classKey,studentKey){const v=current()&&cache.get(token(classKey,studentKey));if(!v)return list;const rows=(list||[]).map(r=>({...r})),route=v.route;
   function add(a,entry){const fbKey=a.sourceFeedbackKey||'fw_s_'+a.id,cls=a.sourceClassName||route.className,skey=a.sourceStudentKey||studentKey;
    const matches=rows.map((r,i)=>[r,i]).filter(([r])=>r.fbKey===fbKey&&(r.storedClassName||r.sourceClassName||route.className)===cls&&(r.storedStudentKey||studentKey)===skey);
    if(matches.length>1)throw Error('sticker-history-ambiguous');const i=matches[0]?.[1],old=i===undefined?{}:rows[i],status=entry||a.status==='approved'?'通過':a.status==='pending'?'待審核':a.reviewReason?'退回：'+a.reviewReason:'退回';let content={};try{content=JSON.parse(old.content||'{}');}catch(_){throw Error('sticker-history-invalid');}if(!content||typeof content!=='object'||Array.isArray(content)||old.type&&old.type!=='棒卡申請')throw Error('sticker-history-invalid');
    const next={...old,fbKey,time:time(entry?a.at:a.submittedAt),targetDate:date(a.date),type:'棒卡申請',content:JSON.stringify({...content,reason:a.reason,count:a.delta,status}),actorRole:entry?'teacher':'student',sourceClassName:cls,sourceClassKey:cls.replace(/[.#$[\]]/g,'-'),storedClassName:cls,storedClassKey:cls.replace(/[.#$[\]]/g,'-'),storedStudentKey:skey,fastWriteSticker:true};
    if(i===undefined)rows.push(next);else rows[i]=next;
   }
   for(const a of Object.values(v.business.applications||{}))add(a,false);
   // 審核入帳的 entry 已由原申請顯示；不再合成一張獎勵卡。
   for(const a of Object.values(v.business.entries||{}))if(!a.applicationId)add(a,true);
   return rows;
  }
  return{target,balance,merge,clear:()=>{identity='';cache.clear();},accepts:c=>routes.has(c),size:()=>cache.size};
 }
 root.ProductionStickerReader={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
