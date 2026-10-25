(function(root){'use strict';
 function create({scopes,callable,storage,getUid,getStudentKey,onBalance,hash,transport=root.ProductionFastWriteTransport}){
  if(!Array.isArray(scopes)||scopes.length>64||[callable,getUid,getStudentKey,hash].some(f=>typeof f!=='function')||!transport?.create)throw Error('invalid-sticker-bridge');
  const routes=new Map(),busy=new Map();
  for(const s of scopes.filter(route=>route.subject!=='math')){if(s.enabled!==true||s.subject!=='science'||s.scoreAuthority!=='dashboard'||!s.className||!/^[\w-]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.className))throw Error('invalid-sticker-route');routes.set(s.className,s);}
  const uid=()=>{const v=getUid();if(!/^[\w-]{1,80}$/.test(v||''))throw Error('請先登入老師帳號');return v;};
  const receiptKey=u=>'fastwrite-sticker-receipts-'+u;
  const pendingKey=u=>'fastwrite-sticker-pending-'+u;
  function pendingIndex(u=uid()){let rows;try{rows=JSON.parse(storage.getItem(pendingKey(u))||'{}');}catch(_){throw Error('未確認棒卡操作無法讀取，請保留目前頁面');}if(!rows||typeof rows!=='object'||Array.isArray(rows)||Object.keys(rows).length>128)throw Error('未確認棒卡操作需要核對');return rows;}
  function forgetPending(u,entityId){const rows=pendingIndex(u);delete rows[entityId];storage.setItem(pendingKey(u),JSON.stringify(rows));}
  function receipts(u=uid()){let r;try{r=JSON.parse(storage.getItem(receiptKey(u))||'{}');}catch(_){throw Error('棒卡收據無法讀取，請保留目前頁面');}if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length>128)throw Error('棒卡收據需要核對');return r;}
  function remember(u,route,entityId,result,c){if(!Number.isSafeInteger(result.result?.balance)||!Number.isSafeInteger(result.revision)||result.revision<1)throw Error('棒卡儲存收據不一致');
   const all=receipts(u),k=route.scopeId+'|'+entityId+'|'+c.requestId;if(!all[k]&&Object.keys(all).length>=128)throw Error('待回填收據已達上限，請先查核');
   all[k]={scope:route.scopeId,entityId,epoch:route.epoch,requestId:c.requestId,eventId:result.eventId,revision:result.revision,sheetStatus:'pending'};storage.setItem(receiptKey(u),JSON.stringify(all));forgetPending(u,entityId);
  }
  function connection(route,entityId,u){return transport.create({callable,storage,namespace:'stickers_'+u,scope:route.scopeId,entityId,epoch:route.epoch,onConfirmed:(r,c)=>remember(u,route,entityId,r,c)});}
  const legacy=v=>v?.kind==='stickers'&&v.authority==='legacy'&&/^[a-f0-9]{64}$/.test(v.rollbackVerificationHash||'');
  function day(v){const m=String(v||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);if(!m)throw Error('請重新選擇聯絡簿日期');const d=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');if(!Number.isFinite(Date.parse(d))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('聯絡簿日期不正確');return d;}
  function app(view,row){const fb=row.feedbackKey||row.fbKey,matches=Object.values(view.business?.applications||{}).filter(a=>(a.sourceFeedbackKey||'fw_s_'+a.id)===fb&&(!a.sourceClassName||a.sourceClassName===(row.sourceClassName||row.cls||row.className))&&(!a.sourceStudentKey||!row.storedStudentKey||a.sourceStudentKey===row.storedStudentKey));
   if(!fb||matches.length!==1||matches[0].status!=='pending'||matches[0].delta!==Number(row.count??row.countNum))throw Error('申請狀態或棒數已變更，請重新載入');return matches[0].id;}
  async function one(route,p,action,u){
   const studentKey=getStudentKey(route.className,p.studentName,p.studentKey);if(typeof studentKey!=='string'||!studentKey||/[.#$[\]/\x00-\x1f]/.test(studentKey))throw Error('學生對應尚未確認，請重新載入原班級');
   const intent={...p};if(action!=='writeStickerAdjustmentGas')delete intent.clientRequestId;
   const entityId='stickers_'+(await hash([route.scopeId,studentKey])).slice(0,40),busyKey=u+'|'+entityId,signature=JSON.stringify({action,p:intent});
   if(busy.has(busyKey)){const old=busy.get(busyKey);if(old.signature!==signature)throw Error('這位學生上一筆操作仍在確認中');return old.promise;}
   const promise=(async()=>{
    if(uid()!==u)throw Error('登入帳號已變更');const c=connection(route,entityId,u),saved=c.pending();let result;
    const requestSignature=await hash([action,intent]);
    const intentKey='fastwrite-sticker-intent-'+u+'-'+entityId;
    if(saved){if(storage.getItem(intentKey)!==requestSignature)throw Error('上一筆棒卡儲存尚未確認，原輸入已保留');result=await c.send({recover:true});}
    else{
     if(Object.keys(receipts(u)).length>=128)throw Error('待回填收據已達上限，請先查核');const view=await c.read();
     if(legacy(view))return{authority:'legacy',rollbackVerificationHash:view.rollbackVerificationHash};
     if(view?.kind!=='stickers'||!Number.isSafeInteger(view.business?.balance)||!Number.isSafeInteger(view.revision))throw Error('棒卡資料尚未完成對應');
     let commandAction,data,requestId=action==='writeStickerAdjustmentGas'?p.clientRequestId:null;
     if(action==='writeStickerAdjustmentGas'){
      if(!Number.isSafeInteger(Number(p.count))||!Number(p.count)||Math.abs(Number(p.count))>100||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>2000)throw Error('棒卡調整內容不正確');
      commandAction='adjust_stickers';data={delta:Number(p.count),reason:p.reason,date:day(p.targetDate),expectedBalance:view.business.balance};
     }else if(action==='fastWriteStickerCheckin'){
      if(typeof p.checked!=='boolean')throw Error('核對狀態不正確');commandAction='review_stickers_and_checkin';data={applicationIds:[],date:day(p.date),checked:p.checked,expectedBalance:view.business.balance};
     }else{
      const rows=p.rows||[p],ids=rows.map(r=>app(view,r));if(!ids.length||ids.length>32||new Set(ids).size!==ids.length)throw Error('待審申請超過單次上限或重複');
      commandAction='review_stickers_bulk';const decision=action==='approveAllStickersGas'||p.actionStr==='通過'?'approve':String(p.actionStr||'').startsWith('退回')?'reject':null;
      if(!decision)throw Error('審核狀態不正確');data={applicationIds:ids,decision,expectedBalance:view.business.balance,...(decision==='reject'?{reason:p.actionStr.replace(/^退回[：:]?/,'')}:{} )};
     }
     if(!requestId)requestId='st_'+(await hash([requestSignature,view.revision])).slice(0,48);
     if(!/^[\w-]{1,80}$/.test(requestId))throw Error('棒卡操作識別碼不正確');if(uid()!==u)throw Error('登入帳號已變更');
     const pendingRows=pendingIndex(u);if(!pendingRows[entityId]&&Object.keys(pendingRows).length>=128)throw Error('未確認操作已達上限，請先查核');
     pendingRows[entityId]={scope:route.scopeId,entityId,epoch:route.epoch,studentKey};storage.setItem(pendingKey(u),JSON.stringify(pendingRows));
     storage.setItem(intentKey,requestSignature);c.prepare({requestId,epoch:route.epoch,expectedRevision:view.revision,action:commandAction,data});result=await c.send();
    }
    storage.removeItem(intentKey);if(uid()!==u)throw Error('登入帳號已變更；原帳號收據已保留');if(onBalance)onBalance(route,studentKey,result.result.balance,result.revision);
    return{success:true,storage:'firebase',businessStatus:'committed',sheetStatus:'pending',firebaseSynced:true,balance:result.result.balance,feedbackKey:'fw_s_'+result.eventId,
     receipt:{eventId:result.eventId,revision:result.revision},msg:'已儲存，試算表背景同步中'};
   })();busy.set(busyKey,{signature,promise});try{return await promise;}finally{if(busy.get(busyKey)?.promise===promise)busy.delete(busyKey);}
  }
  function handle(action,p,subject){
   if(!['approveStickerGas','approveAllStickersGas','writeStickerAdjustmentGas','fastWriteStickerCheckin'].includes(action)||subject!=='science')return null;
   const route=routes.get(p?.balanceClassName||p?.className);if(!route){if(routes.has(p?.className))return{promise:Promise.reject(Error('棒卡入帳班級尚未完成對應'))};return null;}
   const promise=(async()=>{
    const u=uid();if(action!=='approveAllStickersGas')return one(route,p,action,u);
    let rows=p.pendingList;try{if(typeof rows==='string')rows=JSON.parse(rows);}catch(_){throw Error('待審名單不正確');}
    if(!Array.isArray(rows)||!rows.length||rows.length>128)throw Error('單次審核最多 128 筆申請');
    const groups=new Map();for(const row of rows){const name=row.stuName||row.studentName;if(!name)throw Error('待審學生不明');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(row);}
    if([...groups.values()].some(a=>a.length>32))throw Error('單一學生每次最多審核 32 筆');
    const entries=[...groups],results=new Array(entries.length);let next=0;
    await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(next<entries.length){const i=next++,[name,list]=entries[i];try{results[i]={rows:list,result:await one(route,{className:p.className,balanceClassName:route.className,studentName:name,rows:list},action,u)};}catch(e){results[i]={rows:list,error:e.message};}}}));
    const old=results.filter(r=>r.result?.authority==='legacy');if(old.length===results.length&&new Set(old.map(r=>r.result.rollbackVerificationHash)).size===1)return old[0].result;
    const confirmed=results.filter(r=>r.result?.businessStatus==='committed').flatMap(r=>r.rows),failed=results.filter(r=>r.result?.businessStatus!=='committed');
    return{success:failed.length===0,storage:'firebase',businessStatus:failed.length?'partial':'committed',sheetStatus:'pending',firebaseSynced:true,count:confirmed.length,confirmedRecords:confirmed,failed:failed.map(r=>({records:r.rows,message:r.error||'已回退，請核對後再送出'})),msg:failed.length?'部分儲存尚未確認，請保留未完成的申請':'已儲存，試算表背景同步中'};
   })();return{promise};
  }
  async function recoverPending(){const u=uid(),results=[];for(const [id,p]of Object.entries(pendingIndex(u)).slice(0,8)){
   if(uid()!==u)throw Error('登入帳號已變更');const route=[...routes.values()].find(s=>s.scopeId===p.scope&&s.epoch===p.epoch);
   if(!route||id!==p.entityId||id!=='stickers_'+(await hash([p.scope,p.studentKey])).slice(0,40))throw Error('未確認操作對應已變更');
   if(busy.has(u+'|'+id))continue;const c=connection(route,id,u);if(!c.pending()){forgetPending(u,id);continue;}
   const promise=c.send({recover:true});busy.set(u+'|'+id,{signature:'recover',promise});let result;try{result=await promise;}finally{if(busy.get(u+'|'+id)?.promise===promise)busy.delete(u+'|'+id);}
   storage.removeItem('fastwrite-sticker-intent-'+u+'-'+id);if(uid()!==u)throw Error('登入帳號已變更；原帳號收據已保留');if(onBalance)onBalance(route,p.studentKey,result.result.balance,result.revision);results.push(result);
  }return results;}
  async function checkReceipts(){await recoverPending();const u=uid(),all=receipts(u),results=[];for(const [key,r]of Object.entries(all).slice(0,8)){
   const route=[...routes.values()].find(s=>s.scopeId===r.scope&&s.epoch===r.epoch);if(!route)continue;if(uid()!==u)throw Error('登入帳號已變更');
   const state=await connection(route,r.entityId,u).mirror(r.requestId);if(state?.eventId!==r.eventId||state.revision!==r.revision||!['pending','verified','needs-review'].includes(state.sheetStatus))throw Error('棒卡回填收據不一致');
   const fresh=receipts(u);if(uid()!==u)throw Error('登入帳號已變更');if(state.sheetStatus==='verified')delete fresh[key];else fresh[key]={...r,sheetStatus:state.sheetStatus};storage.setItem(receiptKey(u),JSON.stringify(fresh));results.push(state);
  }return results;}
  return{handle,receipts,checkReceipts,pendingIndex,recoverPending};
 }
 root.DashboardStickerFastWrite={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
