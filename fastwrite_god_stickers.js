(function(root){'use strict';
 function create({scopes,getContext,callable,storage,hash,onBalance,bridge=root.DashboardStickerFastWrite}){
  if(!Array.isArray(scopes)||[getContext,callable,hash].some(f=>typeof f!=='function')||!bridge?.create)throw Error('invalid-god-sticker-bridge');
  const c=getContext(),validKey=s=>typeof s==='string'&&s.length>0&&s.length<=180&&!/[.#$[\]/\x00-\x1f]/.test(s);
  if(!c||!/^[\w-]{1,80}$/.test(c.uid||'')||!/^[a-f0-9]{48,64}$/i.test(c.sessionId||'')||!validKey(c.studentKey)||typeof c.className!=='string'||!c.className||typeof c.studentName!=='string'||!c.studentName)throw Error('請回行政中心重新開啟學生畫面');
  const identity=JSON.stringify(c);function current(){if(JSON.stringify(getContext())!==identity)throw Error('學生或老師連線已變更，請回原學生畫面查核');return c;}
  const prefix='god-sticker-'+JSON.stringify([c.className,c.studentKey])+'-';
  const isolatedStorage={getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v),removeItem:k=>storage.removeItem(prefix+k)};
  const core=bridge.create({scopes,storage:isolatedStorage,getUid:()=>current().uid,hash,
   callable:async q=>{current();const result=await callable({...q,sessionId:c.sessionId});current();return result;},
   getStudentKey:(cls,name,key)=>{current();if(cls!==c.className||name&&name!==c.studentName||key&&key!==c.studentKey)throw Error('棒卡入帳學生已變更，請重新載入');return c.studentKey;},
   onBalance:(route,key,balance,revision)=>{current();onBalance?.(route,key,balance,revision);}});
  function handle(action,p,subject){
   if(!['approveStickerGas','writeStickerAdjustmentGas'].includes(action)||!['science','math'].includes(subject))return null;
   if(!scopes.some(s=>s.enabled===true&&s.subject===subject&&(s.subject==='science'&&s.scoreAuthority==='dashboard'||s.subject==='math'&&s.gradeAuthority==='bidirectional')&&s.className===(p.balanceClassName||p.className)))return null;
   try{current();if(p.className!==c.className||p.studentName!==c.studentName)throw Error('棒卡學生對應已變更');
    return core.handle(action,{...p,studentKey:c.studentKey,...(action==='writeStickerAdjustmentGas'?{clientRequestId:p.requestId}:{})},subject);
   }catch(e){return{promise:Promise.reject(e)};}
  }
  return{handle,checkReceipts:core.checkReceipts,receipts:core.receipts,pendingIndex:core.pendingIndex,identity};
 }
 root.ProductionGodStickerBridge={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
