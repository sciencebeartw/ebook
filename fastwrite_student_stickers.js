(function(root){'use strict';
 function create({scopes,callable,storage,getContext,hash,transport=root.ProductionFastWriteTransport}){
  if(!Array.isArray(scopes)||scopes.length>64||[callable,getContext,hash].some(f=>typeof f!=='function')||!transport?.create)throw Error('invalid-student-sticker-bridge');
  const routes=new Map(),busy=new Map();
  for(const s of scopes.filter(route=>route.subject!=='math')){if(s.enabled!==true||s.subject!=='science'||s.scoreAuthority!=='dashboard'||!s.className||!/^[\w-]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.className))throw Error('invalid-student-sticker-route');routes.set(s.className,s);}
  function handle(action,p,subject){
   if(action!=='submitFeedback'||p?.type!=='棒卡申請'||subject!=='science')return null;
   const route=routes.get(p.className);if(!route)return null;
   return{promise:(async()=>{
    const ctx=getContext(),identity=JSON.stringify(ctx),current=()=>{if(JSON.stringify(getContext())!==identity)throw Error('學生或登入狀態已變更，請回原學生畫面查核');};
    if(!ctx||ctx.isAdmin===true||!/^[\w-]{1,80}$/.test(ctx.uid||'')||ctx.className!==p.className||ctx.studentName!==p.studentName||typeof ctx.studentKey!=='string'||!ctx.studentKey||/[.#$[\]/\x00-\x1f]/.test(ctx.studentKey)||p.sourceClassName&&p.sourceClassName!==ctx.className)throw Error('棒卡申請的班級學生對應已變更');
    let input;try{input=JSON.parse(p.content);}catch(_){throw Error('棒卡申請內容不正確');}
    const delta=Number(input?.count),match=String(p.targetDate||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/),date=match&&`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
    if(!input||Object.keys(input).some(k=>!['count','reason','status'].includes(k))||input.status!=='待審核'||!Number.isSafeInteger(delta)||!delta||Math.abs(delta)>100||delta>0&&delta<5||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>100||!date||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('棒卡申請內容不正確');
    const data={delta,reason:input.reason,date},entityId='stickers_'+(await hash([route.scopeId,ctx.studentKey])).slice(0,40);current();
    const id=ctx.uid+'|'+entityId,signature=JSON.stringify(data),prior=busy.get(id);
    if(prior){if(prior.signature!==signature)throw Error('上一筆棒卡申請尚未確認，請保留原內容');return prior.promise;}
    const promise=(async()=>{
     const c=transport.create({callable:async q=>{current();const r=await callable(q);current();return r;},storage,namespace:'student_stickers_'+ctx.uid,scope:route.scopeId,entityId,epoch:route.epoch,
      onConfirmed:r=>{current();if(!/^[a-f0-9]{64}$/.test(r.eventId||'')||!Number.isSafeInteger(r.revision)||r.revision<1||!Number.isSafeInteger(r.result?.balance))throw Error('棒卡申請收據尚未確認');}});
     const pending=c.pending();
     if(pending){if(pending.action!=='apply_stickers'||JSON.stringify(pending.data)!==signature)throw Error('上一筆棒卡申請結果待確認，請使用原內容重試');}
     else{
      const view=await c.read();current();
      if(view?.authority==='legacy'&&view.kind==='stickers'&&/^[a-f0-9]{64}$/.test(view.rollbackVerificationHash||''))return{authority:'legacy',rollbackVerificationHash:view.rollbackVerificationHash};
      if(view?.kind!=='stickers'||!Number.isSafeInteger(view.revision)||!Number.isSafeInteger(view.business?.balance))throw Error('棒卡來源尚未確認');
      c.prepare({requestId:p.clientRequestId,epoch:route.epoch,expectedRevision:view.revision,action:'apply_stickers',data});
     }
     const r=await c.send({recover:!!pending});current();
     return{success:true,storage:'firebase',businessStatus:'committed',reviewStatus:'pending',sheetStatus:'pending',fastWriteReceipt:{scope:route.scopeId,entityId,eventId:r.eventId,revision:r.revision},msg:'棒卡申請已儲存，請等待老師審核'};
    })();busy.set(id,{signature,promise});try{return await promise;}finally{if(busy.get(id)?.promise===promise)busy.delete(id);}
   })()};
  }
  return{handle};
 }
 root.ProductionStudentStickerBridge={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
