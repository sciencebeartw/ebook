(function(root){"use strict";
 function create({scopes,callableFor,storage,getUid,hash,getSessionId=()=>"",transport=root.ProductionFastWriteTransport,onSaved=()=>{}}){
  if(!Array.isArray(scopes)||scopes.length>64||[callableFor,getUid,hash].some(f=>typeof f!=="function")||!storage||!transport?.create)throw Error("message-bridge-config-invalid");
  const routes=new Map(),busy=new Map(),remote=new Map(),prepared=new Map(),safe=x=>typeof x==="string"&&x.length>0&&x.length<=180&&!/[.#$[\]/\x00-\x1f\x7f]/.test(x)&&!["__proto__","constructor","prototype"].includes(x);
  for(const s of scopes.filter(route=>route.subject!=='math')){if(s.subject!=="science"||s.enabled!==true||!safe(s.className)||!safe(s.classKey)||!/^[-\w]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.className)||[...routes.values()].some(r=>r.classKey===s.classKey||r.scopeId===s.scopeId))throw Error("message-route-invalid");routes.set(s.className,{...s});}
  const account=()=>{const uid=getUid();if(!/^[-\w]{1,80}$/.test(uid||""))throw Error("請先登入再送出留言");return uid;};
  const receiptKey=uid=>"fastwrite-message-receipts-"+uid;
  // 重用目前登入者與角色的可見／輸入中對話；提交仍由伺服器逐次核對權限、切換與交易。
  const preparedKey=(mode,uid,route,entityId)=>[mode,uid,mode==='god'?getSessionId():'',route.scopeId,route.epoch,entityId].join('|');
  function remember(k,promise){const row={at:Date.now(),promise};prepared.delete(k);prepared.set(k,row);while(prepared.size>4)prepared.delete(prepared.keys().next().value);return row;}
  function readReady(mode,uid,route,entityId,c){
   if(!['student','teacher','god'].includes(mode))return c.read();
   const k=preparedKey(mode,uid,route,entityId),old=prepared.get(k);
   if(old&&Date.now()-old.at<120000)return old.promise;
   const row=remember(k,Promise.resolve().then(()=>c.read()).then(view=>{
    if(account()!==uid)throw Error('登入帳號已變更，請重新整理');
    if(view?.authority==='legacy'||!/^p\d{12}$/.test(view?.segment||'')||!Array.isArray(view.messages))if(prepared.get(k)===row)prepared.delete(k);
    return view;
   }).catch(error=>{if(prepared.get(k)===row)prepared.delete(k);throw error;}));return row.promise;
  }
  async function warm(mode,p){
   if(!['student','teacher','god'].includes(mode))return false;
   const route=p?.subject==='science'&&routes.get(p.className);if(!route)return false;
   const uid=account(),target=await watchTarget(mode,p);if(!target||account()!==uid)return false;
   const entityId=target.id.split('|').pop();await readReady(mode,uid,route,entityId,target.transport);return true;
  }
  function receipts(uid=account()){let rows;try{rows=JSON.parse(storage.getItem(receiptKey(uid))||"{}");}catch(_){throw Error("留言收據無法讀取，請保留目前頁面");}if(!rows||typeof rows!=="object"||Array.isArray(rows)||Object.keys(rows).length>128)throw Error("留言收據需要查核");return rows;}
  function save(uid,id,row){const rows=receipts(uid);if(!rows[id]&&Object.keys(rows).length>=128)throw Error("待回填留言已達上限，請先查核同步狀態");rows[id]=row;storage.setItem(receiptKey(uid),JSON.stringify(rows));}
  function connection(route,entityId,mode,uid,payload){return transport.create({kind:"message",callable:callableFor(mode),storage,namespace:"message_"+mode+"_"+uid,scope:route.scopeId,entityId,epoch:route.epoch,sessionId:mode==="god"?getSessionId():undefined,
   onConfirmed:(result,command)=>{
    if(!/^p\d{12}_[a-f0-9]{64}$/.test(result.eventId||"")||!Number.isSafeInteger(result.revision)||result.revision<1||result.revision>32||!Number.isSafeInteger(result.committedAt))throw Error("留言收據對應不一致");
    const id=route.scopeId+"|"+entityId+"|"+command.requestId;
    save(uid,id,{scope:route.scopeId,entityId,epoch:route.epoch,mode,requestId:command.requestId,eventId:result.eventId,revision:result.revision,committedAt:result.committedAt,className:route.className,classKey:route.classKey,studentKey:payload.studentKey,targetDate:payload.targetDate,text:command.text,replyTo:command.replyTo||"",mirrorStatus:result.mirrorStatus||"pending"});
   }});}
  function handle(mode,p){
   if(!["student","teacher","god"].includes(mode))throw Error("message-mode-invalid");
   const route=p?.subject==="science"&&routes.get(p.className);if(!route)return null;
   return{promise:(async()=>{
    if(!safe(p.studentKey)||!/^\d{4}\/\d{2}\/\d{2}$/.test(p.targetDate||"")||typeof p.content!=="string"||!p.content.trim()||p.content.length>5000||!/^[-\w]{1,80}$/.test(p.requestId||"")||p.replyTo&&!/^[-\w]{1,80}$/.test(p.replyTo))throw Error("留言來源或內容不完整，未送出");
    const uid=account(),h=await hash([route.subject,route.classKey,p.studentKey,p.targetDate]);if(!/^[a-f0-9]{64}$/.test(h))throw Error("留言識別碼產生失敗");
    const entityId="chat_"+h.slice(0,40),key=uid+"|"+mode+"|"+entityId,signature=JSON.stringify([p.content,p.replyTo||"",p.requestId]);
    if(busy.has(key)){const pending=busy.get(key);if(pending.signature!==signature)throw Error("這個對話還有一筆送出待確認");return pending.promise;}
    const promise=(async()=>{
     const c=connection(route,entityId,mode,uid,p),pending=c.pending();
     if(pending&&(pending.text!==p.content||(pending.replyTo||"")!==(p.replyTo||"")||pending.requestId!==p.requestId))throw Error("上一則留言仍待確認，請先用原內容重試");
     if(!pending){
      if(Object.keys(receipts(uid)).length>=128)throw Error("待回填留言已達上限，請先查核同步狀態");
      const view=await readReady(mode,uid,route,entityId,c);
      if(view?.authority==="legacy"&&view.kind==="message"&&/^[a-f0-9]{64}$/.test(view.rollbackVerificationHash||"")){
       let replyToFeedbackKey=p.replyTo||"";
       if(/^p\d{12}_/.test(replyToFeedbackKey)){
        const reference=await c.legacyReference(replyToFeedbackKey);
        if(reference?.authority!=="legacy"||reference.rollbackVerificationHash!==view.rollbackVerificationHash||reference.messageId!==replyToFeedbackKey||!safe(reference.feedbackKey)||/^p\d{12}_/.test(reference.feedbackKey))throw Error("原留言對應尚未確認，輸入已保留，請稍後重試");
        replyToFeedbackKey=reference.feedbackKey;
       }
       return{authority:"legacy",rollbackVerificationHash:view.rollbackVerificationHash,replyToFeedbackKey};
      }
      if(!/^p\d{12}$/.test(view?.segment||"")||!Array.isArray(view.messages))throw Error("留言來源尚未完成對應");
      if(account()!==uid)throw Error("登入帳號已變更，請重新整理");
      c.prepare({requestId:p.requestId,text:p.content,replyTo:p.replyTo||"",epoch:route.epoch});
     }
     let receipt;try{receipt=await c.send({recover:!!pending});}catch(error){prepared.delete(preparedKey(mode,uid,route,entityId));throw error;}if(account()!==uid)throw Error("登入帳號已變更；原留言收據已保留");
     const result={success:true,storage:"firebase",businessStatus:"committed",sheetStatus:receipt.mirrorStatus||"pending",fastWriteReceipt:{scope:route.scopeId,entityId,eventId:receipt.eventId,requestId:p.requestId,revision:receipt.revision},time:new Date(receipt.committedAt).toLocaleString("sv-SE",{timeZone:"Asia/Taipei"}).replaceAll("-","/"),msg:"留言已儲存，背景同步中"};
     try{onSaved(result,p,mode);}catch(_){}return result;
    })();busy.set(key,{signature,promise});try{return await promise;}finally{if(busy.get(key)?.promise===promise)busy.delete(key);}
   })()};
  }
  async function checkReceipts(){const uid=account(),rows=receipts(uid),items=Object.entries(rows).sort((a,b)=>(a[1].checkedAt||0)-(b[1].checkedAt||0)).slice(0,8),results=[];
   for(const[id,row]of items){if(account()!==uid)throw Error("登入帳號已變更");const route=routes.get(row.className);if(!route||route.scopeId!==row.scope||route.epoch!==row.epoch)continue;
    const receipt=await connection(route,row.entityId,row.mode,uid,row).receipt(row.requestId);
    if(receipt?.eventId!==row.eventId||receipt.revision!==row.revision||!["pending","running","retry","verified","needs-review"].includes(receipt.mirrorStatus))throw Error("留言收據對應不一致");
    const fresh=receipts(uid);if(fresh[id]?.eventId!==row.eventId)continue;if(receipt.mirrorStatus==="verified")delete fresh[id];else fresh[id]={...fresh[id],mirrorStatus:receipt.mirrorStatus,checkedAt:Date.now()};storage.setItem(receiptKey(uid),JSON.stringify(fresh));results.push({...row,mirrorStatus:receipt.mirrorStatus});
   }return results;
  }
  function merge(classKey,studentKey,legacy){const uid=account(),out={...(legacy||{})},existing=new Map(Object.entries(out).filter(([,r])=>r.clientRequestId).map(([id,r])=>[r.clientRequestId,r.originalFeedbackKey||id]));
   const withdrawn=Object.assign({},...([...remote.values()].filter(r=>r.loginUid===uid&&r.classKey===classKey&&r.studentKey===studentKey).map(r=>r.withdrawn||{})));
   for(const [id,row]of Object.entries(out))if(withdrawn[id]||withdrawn[String(row.clientRequestId||'').replace(/^fw_/, '')]||Object.values(withdrawn).includes(row.originalFeedbackKey||id))delete out[id];
   for(const row of [...remote.values()].filter(r=>r.loginUid===uid).flatMap(r=>r.rows).concat(Object.values(receipts(uid)))){if(withdrawn[row.eventId]||row.classKey!==classKey||row.studentKey!==studentKey||existing.has("fw_"+row.eventId)||out[row.eventId])continue;
    const teacher=row.mode!=="student";out[row.eventId]={time:new Date(row.committedAt).toLocaleString("sv-SE",{timeZone:"Asia/Taipei"}).replaceAll("-","/"),targetDate:row.targetDate,content:row.text,actorRole:teacher?"teacher":"student",type:teacher?(row.replyTo?"老師回覆":"老師留言"):"學生留言",source:teacher?"ebook_god_teacher":"ebook_student",replyToFeedbackKey:existing.get("fw_"+row.replyTo)||row.replyTo,clientRequestId:"fw_"+row.eventId,sourceStudentKey:row.studentKey,sourceClassKey:row.classKey,sourceClassName:row.className,fastWritePending:row.mirrorStatus!=="verified"};
   }return out;
  }
  async function watchTarget(mode,p){
   const route=p?.subject==='science'&&routes.get(p.className);if(!route)return null;
   if(!['student','teacher','god'].includes(mode)||!safe(p.studentKey)||!/^\d{4}\/\d{2}\/\d{2}$/.test(p.targetDate||''))throw Error('invalid-message-watch');
   const uid=account(),h=await hash([route.subject,route.classKey,p.studentKey,p.targetDate]);if(!/^[a-f0-9]{64}$/.test(h)||account()!==uid)throw Error('message-watch-identity-changed');
   const entityId='chat_'+h.slice(0,40),id=uid+'|'+route.scopeId+'|'+entityId,c=connection(route,entityId,mode,uid,p);
   const segmentAt=n=>'p'+String(n).padStart(12,'0'),index=s=>/^p\d{12}$/.test(s||'')&&Number(s.slice(1))>0?Number(s.slice(1)):0;
   let closed=false,loading=null;
   function put(view,isHistory){
     if(account()!==uid)throw Error('message-watch-identity-changed');
     if(closed)return;
     if(!index(view?.segment)||!Number.isSafeInteger(view.revision)||view.revision<0||view.revision>32||view.messages&&(typeof view.messages!=='object'||Array.isArray(view.messages)||Object.keys(view.messages).length>96)||JSON.stringify(view).length>512*1024)throw Error('invalid-message-projection');
     const withdrawn=view.withdrawn||{};if(Object.keys(withdrawn).length>256||Object.entries(withdrawn).some(([k,v])=>!safe(k)||!safe(v)))throw Error('invalid-message-projection');
     const rows=Object.entries(view.messages||{}).map(([eventId,row])=>{
      if(!safe(eventId)||!row||row.id!==eventId||typeof row.text!=='string'||row.text.length>5000||!['student','parent','teacher'].includes(row.role)||!Number.isSafeInteger(row.committedAt)||row.replyTo&&!safe(row.replyTo))throw Error('invalid-message-projection');
      return{eventId,mode:row.role==='teacher'?'teacher':'student',classKey:route.classKey,className:route.className,studentKey:p.studentKey,targetDate:p.targetDate,text:row.text,committedAt:row.committedAt,replyTo:row.replyTo||'',mirrorStatus:'pending'};
     });
     if(!remote.has(id)&&remote.size>=4)throw Error('message-visible-limit');
     const old=remote.get(id)||{head:view.segment,selected:view.segment,pages:{}};
     if(!isHistory&&index(view.segment)<index(old.head))return;
     if(view.revision<(old.revisions?.[view.segment]??-1))return;
     if(isHistory&&index(view.segment)>=index(old.head))throw Error('invalid-message-history');
     const head=isHistory?old.head:view.segment,selected=isHistory?view.segment:old.selected===old.head?head:old.selected;
     const pages={...old.pages,[view.segment]:rows},revisions={...old.revisions,[view.segment]:view.revision},keep=new Set([head,segmentAt(Math.max(1,index(head)-1)),selected]);
     for(const s of Object.keys(pages))if(!keep.has(s)){delete pages[s];delete revisions[s];}
     // 撤回也移除持久收據；離開可見範圍或重開頁面後不能由本機重新投影。
     if(Object.keys(withdrawn).length){const local=receipts(uid);let changed=false;
      for(const [key,row]of Object.entries(local))if(row.scope===route.scopeId&&row.entityId===entityId&&row.classKey===route.classKey&&row.studentKey===p.studentKey&&withdrawn[row.eventId]){delete local[key];changed=true;}
      if(changed)storage.setItem(receiptKey(uid),JSON.stringify(local));
     }
     remote.set(id,{loginUid:uid,classKey:route.classKey,studentKey:p.studentKey,head,selected,pages,revisions,withdrawn:{...old.withdrawn,...withdrawn},rows:Object.values(pages).flat()});
     if(!isHistory)remember(preparedKey(mode,uid,route,entityId),Promise.resolve({segment:view.segment,messages:[]}));
   }
   const target={id,prefix:'ebook_fast_write_v1/segments/'+route.scopeId+'/'+entityId+'/',transport:c,
    accept(view){put(view,false);},
    historyState(){const r=remote.get(id);return r?{head:r.head,selected:r.selected,previous:index(r.selected)>1?segmentAt(index(r.selected)-1):null,next:index(r.selected)<index(r.head)-1?segmentAt(index(r.selected)+1):null}:null;},
    async history(segment){
     const state=remote.get(id);if(closed||!state||!index(segment)||index(segment)>=index(state.head))throw Error('invalid-message-history');
     if(loading)throw Error('message-history-busy');
     loading=(async()=>{const result=await c.history(segment);if(closed)return;
      if(account()!==uid||result?.segment!==segment||!index(result.head)||index(result.head)<index(segment)||!Array.isArray(result.messages)||result.messages.length>32||!Array.isArray(result.references)||result.references.length>64)throw Error('invalid-message-history');
      const messages={};for(const row of [...result.references,...result.messages]){if(!row||!safe(row.id))throw Error('invalid-message-history');messages[row.id]=row;}
      put({segment,revision:result.revision??result.messages.length,messages,withdrawn:result.withdrawn||{}},true);return target.historyState();
     })();try{return await loading;}finally{loading=null;}
    },clear(){closed=true;remote.delete(id);prepared.delete(preparedKey(mode,uid,route,entityId));}};
   return target;
  }
  function clearRemote(){remote.clear();prepared.clear();}
  async function dates(p){
   const route=p?.subject==='science'&&routes.get(p.className);if(!route||!safe(p.studentKey))throw Error('invalid-message-watch');const uid=account();
   const result=await callableFor('teacher')({action:'fastWriteMessageViewV1',data:{scope:route.scopeId,epoch:route.epoch,studentKey:p.studentKey,...(p.before?{before:p.before}:{})}}),r=result?.data;
   if(account()!==uid||!r||r.scope!==route.scopeId||r.epoch!==route.epoch||r.className!==route.className||r.classKey!==route.classKey||r.studentKey!==p.studentKey||!Array.isArray(r.dates)||r.dates.length>4||new Set(r.dates).size!==r.dates.length||r.dates.some(d=>!/^\d{4}\/\d{2}\/\d{2}$/.test(d)))throw Error('invalid-message-dates');return r;
  }
  async function nativeReference(p,messageId){
   if(!/^p\d{12}_[a-f0-9]{64}$/.test(messageId||''))throw Error('invalid-message-reference');const uid=account(),t=await watchTarget('teacher',p),r=await t.transport.legacyReference(messageId);
   if(account()!==uid||r?.messageId!==messageId||!safe(r.feedbackKey)||/^p\d{12}_/.test(r.feedbackKey)||!(r.authority==='firebase'&&r.verified===true||r.authority==='legacy'&&/^[a-f0-9]{64}$/.test(r.rollbackVerificationHash||'')))throw Error('留言仍在同步，請稍後再查核已看狀態');return r.feedbackKey;
  }
  return{handle,warm,receipts,checkReceipts,merge,watchTarget,clearRemote,dates,nativeReference,accepts:(subject,className)=>subject==="science"&&routes.has(className)};
 }
 root.MessageFastWriteBridge={create};if(typeof module!=="undefined")module.exports={create};
})(typeof window!=="undefined"?window:globalThis);
