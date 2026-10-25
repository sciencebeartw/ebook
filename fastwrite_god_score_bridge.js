(function(root){'use strict';
 function create({scopes,getIdentity,hash,callable,storage,studentKeyFor,scoreBridge=root.DashboardScoreFastWrite,newRequestId=()=>root.crypto.randomUUID()}){
  if(!Array.isArray(scopes)||[getIdentity,hash,callable,studentKeyFor,newRequestId].some(f=>typeof f!=='function')||!scoreBridge?.create)throw Error('invalid-god-score-bridge');
  let current;
  async function get(){const before=getIdentity();if(!before||!/^[-\w]{1,80}$/.test(before.uid||'')||!/^[a-f0-9]{48,64}$/i.test(before.sessionId||''))throw Error('請重新開啟老師視角');
   const identity=before.uid+'|'+before.sessionId;if(current?.identity===identity)return current.bridge;
   const token='god_'+(await hash([before.uid,before.sessionId])).slice(0,40);if(getIdentity()?.uid!==before.uid||getIdentity()?.sessionId!==before.sessionId)throw Error('老師視角已切換，請重新整理');
   const bridge=scoreBridge.create({scopes,storage,hash,getUid:()=>{const live=getIdentity();if(live?.uid!==before.uid||live?.sessionId!==before.sessionId)throw Error('老師視角已切換，原儲存收據已保留');return token;},callable:input=>callable({...input,sessionId:before.sessionId})});current={identity,bridge};return bridge;
  }
  function handle(action,p){const cls=p?.gradeClassName||p?.sourceClassName||p?.className,route=scopes.find(s=>s.className===cls&&s.subject==='science'&&s.enabled===true);
   const color=action==='writeMakeupResultColorGas';
   const review=!!p.feedbackId&&['ebook_god_review','ebook_god_color_correction'].includes(p.sourceSurface);
   const direct=action==='writeScoreGas'&&p.sourceSurface==='ebook_god_review'&&p.teacherDirectScoreWriteback===true&&!p.feedbackId&&typeof p.expectedCurrentScore==='string';
   if(!route||(!color&&(action!=='writeScoreGas'||p.sourceSurface!=='ebook_god_score_correction'&&!direct&&!review)))return null;
   if(color&&!['ebook_god_color_correction','ebook_god_review'].includes(p.sourceSurface))return null;
   return{promise:(async()=>{
    if(direct&&(!['','假'].includes(p.expectedCurrentScore)||!/^\d+(?:\.\d+)?假$/.test(p.scoreValue||'')))throw Error('目前欄位已不是待補登的缺考，請重新整理後確認');
    const studentKey=studentKeyFor(route,p);if(!studentKey||!review&&p.storedStudentKey&&studentKey!==p.storedStudentKey)throw Error('無法確認原班學生對應，請重新開啟畫面');
    const b=await get(),request={...p,...(direct?{teacherScoreCorrection:true}:{}),className:cls,sourceClassName:review?p.sourceClassName:cls,studentKey,
     ...(review?{writeStudentKey:studentKey,sourceStudentKey:p.storedStudentKey||p.studentKey}:{}),
     requestId:(color?'godcolor_':'godscore_')+newRequestId(),sourceSurface:review?'dashboard_feedback_center':color?'dashboard_color_center':'dashboard_score_center'};
    const r=await b.handle(action,request,'science').promise;return r.authority==='legacy'?r:{result:r};
   })()};
  }
  return{handle,checkReceipts:async()=>{const b=await get();await b.checkReceipts();return Object.keys(b.receipts()).length;}};
 }
 root.ProductionGodScoreBridge={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
