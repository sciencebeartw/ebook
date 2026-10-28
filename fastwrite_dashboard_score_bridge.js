(function(root){"use strict";
 // 原登分中心的接線；只有明列且核准的班級走新協定。送出後不退回舊 writer。
 function create({scopes,callable,storage,getUid,transport=root.ProductionFastWriteTransport,hash,now=Date.now}){
  if(!Array.isArray(scopes)||scopes.length>64||typeof callable!=="function"||typeof getUid!=="function"||!transport?.create||typeof hash!=="function")throw Error("invalid-dashboard-bridge");
  const routes=new Map(),safeSource=x=>typeof x==="string"&&x.length>0&&x.length<=180&&!/[.#$[\]/\x00-\x1f\x7f]/.test(x)&&!["__proto__","constructor","prototype"].includes(x);
  for(const s of scopes){
   if(!["science","math"].includes(s.subject)||!["dashboard","bidirectional"].includes(s.gradeAuthority||s.scoreAuthority)||s.enabled!==true||!s.className||!safeSource(s.classKey)||!/^[-\w]{1,80}$/.test(s.scopeId)||!Number.isSafeInteger(s.epoch)||s.epoch<1||routes.has(s.subject+"|"+s.className)||[...routes.values()].some(r=>r.classKey===s.classKey||r.scopeId===s.scopeId))throw Error("invalid-dashboard-route");
   routes.set(s.subject+"|"+s.className,{...s});
  }
  const busy=new Map(),catalogs=new Map();
  const selected=(subject,cls)=>routes.get(subject+"|"+cls);
  const legacyView=v=>v?.kind==="grade"&&v.authority==="legacy"&&/^[a-f0-9]{64}$/.test(v.rollbackVerificationHash||"");
  const account=()=>{const uid=getUid();if(!/^[-\w]{1,80}$/.test(uid||""))throw Error("請先登入老師帳號");return uid;};
  const receiptKey=uid=>"fastwrite-dashboard-receipts-"+uid;
  function receipts(uid=account()){
   let r;try{r=JSON.parse(storage.getItem(receiptKey(uid))||"{}");}catch(_){throw Error("回填收據無法讀取，請先保留目前頁面");}
   if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).length>128)throw Error("回填收據需要核對");return r;
  }
  function saveReceipt(uid,route,entityId,result,command){
   if(!Number.isSafeInteger(result.revision)||result.revision<1||!/^[-\w]{1,80}$/.test(result.eventId||"")||(command.action==='set_makeup_color'?result.result?.color!==command.data.color:result.result?.score!==command.data.score))throw Error("成績收據對應不一致，請保留目前頁面");
   const rows=receipts(uid),id=route.scopeId+"|"+entityId+"|"+command.requestId;
   if(!rows[id]&&Object.keys(rows).length>=128)throw Error("待回填收據已達上限，請先查核同步狀態");
   rows[id]={scope:route.scopeId,entityId,epoch:route.epoch,requestId:command.requestId,eventId:result.eventId,revision:result.revision,
    score:result.result?.score,color:result.result?.color,action:command.action,sheetStatus:rows[id]?.sheetStatus||"pending",committedAt:result.committedAt};
   storage.setItem(receiptKey(uid),JSON.stringify(rows));
  }
  const COLORS=['#00ff00','#ffff00','#ff9900','#ff0000'];
  function validate(p,cls,action='writeScoreGas'){
   const color=action==='writeMakeupResultColorGas';
   if(p?.sourceSurface==='dashboard_feedback_center'&&p.feedbackId){
    if(p.className!==cls||!safeSource(p.sourceClassName)||!safeSource(p.studentKey)||p.writeStudentKey&&!safeSource(p.writeStudentKey)||p.sourceStudentKey&&!safeSource(p.sourceStudentKey)||!safeSource(p.feedbackId)||
      !safeSource(p.writeExamId)||!safeSource(p.sourceExamId)||![p.writeExamId,p.sourceExamId].includes(p.targetExamId)||
      !Number.isSafeInteger(Number(p.examColIndex))||Number(p.examColIndex)<5||p.allowTitleOnlyMatch||
      p.teacherDirectScoreWriteback===true||p.teacherDirectColorWriteback===true||p.teacherScoreCorrection===true||!color&&p.teacherColorCorrection===true||
      (color?!COLORS.includes(p.colorHex):typeof p.scoreValue!=='string'||!/^\d+(?:\.\d+)?假?$/.test(p.scoreValue)))throw Error('回報審核的學生或考卷對應不完整，請重新整理');
    return true;
   }
   if(!p||p.className!==cls||p.sourceClassName!==cls||!safeSource(p.studentKey)||!safeSource(p.writeExamId)||p.writeExamId!==p.targetExamId||p.sourceExamId!==p.writeExamId||
    p.feedbackId||p.allowTitleOnlyMatch||!Number.isSafeInteger(p.examColIndex)||p.examColIndex<5||
    (color? p.teacherDirectColorWriteback!==true||p.teacherColorCorrection!==COLORS.includes(p.expectedCurrentColor)||!/^#[a-f0-9]{6}$/.test(p.expectedCurrentColor||'')||!COLORS.includes(p.colorHex)||p.sourceSurface!=='dashboard_color_center':
     p.teacherDirectScoreWriteback!==true||p.teacherScoreCorrection!==true||typeof p.expectedCurrentScore!=='string'||typeof p.scoreValue!=='string'||!['dashboard_score_center','dashboard_score_center_batch'].includes(p.sourceSurface)))throw Error('這項操作尚未接入極速登分，未送往舊流程');
  }
  async function entity(route,studentKey,examId){const h=await hash([route.scopeId,studentKey,examId]);if(!/^[a-f0-9]{64}$/.test(h))throw Error("成績識別碼產生失敗");return"grade_"+h.slice(0,40);}
  function connection(route,entityId,uid){return transport.create({callable,storage,namespace:"dashboard_"+uid,scope:route.scopeId,entityId,epoch:route.epoch,
   onConfirmed:(r,c)=>saveReceipt(uid,route,entityId,r,c)});}
  async function one(route,p,uid,action='writeScoreGas'){
   const review=validate(p,route.className,action);const entityId=await entity(route,p.writeStudentKey||p.studentKey,p.writeExamId),key=uid+"|"+entityId;
   const color=action==='writeMakeupResultColorGas',commandAction=color?'set_makeup_color':'set_score';
   const data=review?{...(color?{color:p.colorHex}:{score:p.scoreValue}),review:{sourceClassName:p.sourceClassName,sourceStudentKey:p.sourceStudentKey||p.studentKey,sourceExamId:p.sourceExamId,feedbackId:p.feedbackId},...(p.teacherColorCorrection===true?{reviewCorrection:true}:{})}:
    color?{color:p.colorHex,expectedColor:p.expectedCurrentColor}:{score:p.scoreValue,expectedScore:p.expectedCurrentScore};
   const signature=JSON.stringify(data);
   if(busy.has(key)){const inFlight=busy.get(key);if(inFlight.signature!==signature)throw Error("同一學生仍有一筆儲存待確認");return inFlight.promise;}
   const promise=(async()=>{
    if(account()!==uid)throw Error("登入帳號已變更，請重新整理");
    const c=connection(route,entityId,uid),pending=c.pending();let result;
    if(pending){
     const pendingData=review?{...pending.data}:pending.data;
     if(review){delete pendingData.expectedScore;delete pendingData.expectedColor;}
     if(pending.action!==commandAction||JSON.stringify(pendingData)!==signature)throw Error("同一學生上一筆儲存尚未確認，未覆蓋原輸入");
     result=await c.send({recover:true});
    }else{
     // 尚未提交前就先確認追蹤容量；同時提交仍由 saveReceipt 再核對，失敗時命令不會被清掉。
     if(Object.keys(receipts(uid)).length>=128)throw Error("待回填收據已達上限，請先查核同步狀態");
     const requestId=review&&!p.teacherColorCorrection?'review_'+(await hash([p.feedbackId,commandAction,data])).slice(0,48):p.requestId||p.clientRequestId;
     // 現值與原請求收據互不相依；兩者完成後才準備命令，減少一次等待且保留防重送。
     const [view,receiptRead]=await Promise.all([c.read(),(review?c.receipt(requestId):Promise.resolve(null)).then(value=>({value}),error=>({error}))]);
     // 僅提交前、沒有未確認命令且伺服器已完成整班回退時，才允許原入口受理。
     if(legacyView(view))return{authority:"legacy",rollbackVerificationHash:view.rollbackVerificationHash,clientItemId:p.clientItemId||p.studentKey};
     if(view?.kind!=='grade'||(!review||p.teacherColorCorrection===true)&&(color?view.business?.color!==p.expectedCurrentColor:view.business?.score!==p.expectedCurrentScore))throw Error(color?'目前補考顏色已變更，請重新整理後再修改':'目前分數已變更，請重新整理後再修改');
     if(account()!==uid)throw Error("登入帳號已變更，請重新整理");
     if(receiptRead.error)throw receiptRead.error;const prior=receiptRead.value;
     const command={requestId,epoch:route.epoch,expectedRevision:view.revision,action:commandAction,
      data:review?{...data,...(color?{expectedColor:view.business.color}:{expectedScore:view.business.score})}:data};
     // 同一回報重新開頁仍先取原收據；不以新的 revision 重送已完成的審核。
     if(prior){saveReceipt(uid,route,entityId,prior,command);result=prior;}
     else{c.prepare(command);result=await c.send();}
    }
    if(account()!==uid)throw Error("登入帳號已變更；原帳號的儲存收據已保留，請重新整理");
    return{success:true,clientItemId:p.clientItemId||p.studentKey,examId:p.writeExamId,resolvedExamColIndex:p.examColIndex,
     scoreValue:result.result.score,...(color?{colorHex:result.result.color}:{}),storage:"firebase",businessStatus:"committed",sheetStatus:"pending",firebaseSynced:false,
     msg:"已儲存，試算表背景同步中",receipt:{eventId:result.eventId,revision:result.revision}};
   })();
   busy.set(key,{signature,promise});try{return await promise;}finally{if(busy.get(key)?.promise===promise)busy.delete(key);}
  }
  function handle(action,payload,subject){
   const route=selected(subject,payload?.className);
   if(!route||!["writeScoreGas","writeMakeupResultColorGas","batchWriteScoresGas"].includes(action))return null;
   const promise=(async()=>{
    const uid=account();
    if(action!=="batchWriteScoresGas")return one(route,payload,uid,action);
    if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>128||new Set(payload.items.map(p=>p.studentKey)).size!==payload.items.length)throw Error("批次名單不正確");
    // 全部先驗證格式；每輪至多三名，保留原登分中心的逐生成功／失敗結果。
    payload.items.forEach(p=>validate(p,route.className));let next=0;const results=new Array(payload.items.length);
    await Promise.all(Array.from({length:Math.min(3,results.length)},async()=>{
     while(next<results.length){const i=next++,p=payload.items[i];try{results[i]=await one(route,p,uid);}catch(e){results[i]={success:false,clientItemId:p.clientItemId||p.studentKey,msg:e.message};}}
    }));
    const legacy=results.filter(r=>r.authority==="legacy");
    if(legacy.length===results.length&&new Set(legacy.map(r=>r.rollbackVerificationHash)).size===1)return{authority:"legacy",rollbackVerificationHash:legacy[0].rollbackVerificationHash};
    // 批次含切換前未確認的原請求時，先完成原收據；只保留未送出的列讓使用者重試。
    for(let i=0;i<results.length;i++)if(results[i].authority==="legacy")results[i]={success:false,clientItemId:results[i].clientItemId,msg:"已切回原流程；前一筆儲存已查核，請再送出本列"};
    return{success:true,storage:"firebase",sheetStatus:"pending",results};
   })();return{promise};
  }
  async function checkReceipts(){
   const uid=account(),rows=receipts(uid),items=Object.entries(rows).filter(([,r])=>r.sheetStatus!=="verified").sort((a,b)=>(a[1].checkedAt||0)-(b[1].checkedAt||0)).slice(0,8),results=[];
   for(const [id,record]of items){
    if(account()!==uid)throw Error("登入帳號已變更，請重新整理");
    const route=[...routes.values()].find(s=>s.scopeId===record.scope&&s.epoch===record.epoch);if(!route)continue;
    const result=await connection(route,record.entityId,uid).mirror(record.requestId);
    if(account()!==uid)throw Error("登入帳號已變更，請重新整理");
    if(result?.eventId!==record.eventId||result.revision!==record.revision||!['pending','verified','needs-review'].includes(result.sheetStatus))throw Error("回填收據對應不一致");
    const fresh=receipts(uid);if(fresh[id]?.eventId!==record.eventId)continue;
    // 已核實收據可從瀏覽器移除；永久收據仍在伺服器，可依原 request ID 查詢。
    if(result.sheetStatus==="verified")delete fresh[id];else fresh[id]={...fresh[id],sheetStatus:result.sheetStatus,checkedAt:now()};
    storage.setItem(receiptKey(uid),JSON.stringify(fresh));results.push({...record,sheetStatus:result.sheetStatus});
   }return results;
  }
  async function read(path,legacyRead){
   const original=await legacyRead(),match=String(path).match(/^(science|math)\/(meta\/examCatalog|grades)\/([^/]+)(?:\/([^/]+)\/exams\/(col_\d+))?$/);
   if(!match)return original;const route=[...routes.values()].find(s=>s.subject===match[1]&&s.classKey===match[3]);if(!route)return original;
   if(match[2]==="meta/examCatalog"){catalogs.set(route.scopeId,original||{});return original;}
   if(!match[4]||!match[5])return original;
   const matches=Object.entries(catalogs.get(route.scopeId)||{}).filter(([,e])=>e?.colKey===match[5]);
   if(matches.length!==1)throw Error("極速成績欄位尚未核對，請重新選擇考卷");
   // 逐生索引比 catalog 先交接；同日期同名試卷仍須依伺服器標記辨識，不能套用另一卷投影。
   if(original?.fastWriteExamId&&original.fastWriteExamId!==matches[0][0])throw Error('新考卷欄位整理中，請稍後重新選擇考卷');
   const uid=account(),entityId=await entity(route,match[4],matches[0][0]),view=await connection(route,entityId,uid).read();
   if(legacyView(view))return legacyRead(); // 回退確認後再讀，不能沿用切換前取得的舊鏡像。
   if(view?.kind!=="grade"||typeof view.business?.score!=="string")throw Error("極速成績尚未完成對應");
   return{...original,score:view.business.score,fastWriteRevision:view.revision,fastWrite:true};
  }
  return{handle,read,receipts,checkReceipts};
 }
 root.DashboardScoreFastWrite={create};if(typeof module!=="undefined")module.exports={create};
})(typeof window!=="undefined"?window:globalThis);
