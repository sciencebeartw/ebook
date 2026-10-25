(function(root){"use strict";
 // 同一候選的 callable transport。結果不明保留原命令，從 receipt 恢復，不改送 GAS。
 function create({callable,storage,namespace,scope,entityId,epoch,sessionId,onConfirmed,kind="business"}){
  if(typeof callable!=="function"||!storage||!/^[-\w]{1,100}$/.test(namespace)||!/^[-\w]{1,80}$/.test(scope)||!/^[-\w]{1,80}$/.test(entityId)||!Number.isSafeInteger(epoch)||epoch<1)throw Error("invalid-production-transport");
  const key="fastwrite-production-"+namespace+"-"+scope+"-"+entityId;
  function pending(){try{return JSON.parse(storage.getItem(key)||"null");}catch(_){throw Error("saved-command-unreadable");}}
  async function request(operation,extra={}){const response=await callable({action:"fastWriteV1",data:{operation,scope,entityId,epoch,...extra},...(sessionId?{sessionId}:{})});return response.data;}
  function prepare(command){if(pending())throw Error("previous-command-unconfirmed");
   if(!["business","message"].includes(kind)||!command||command.epoch!==epoch||!/^[-\w]{1,80}$/.test(command.requestId||"")||(kind!=="message"||command.expectedRevision!==undefined)&&!Number.isSafeInteger(command.expectedRevision))throw Error("invalid-command");
   storage.setItem(key,JSON.stringify(command));return pending();}
  async function send({recover=false}={}){const saved=pending();if(!saved)return null;
   const receipt=recover?await request("receipt",{requestId:saved.requestId}):null;
   let result;
   try{result=receipt||await request("commit",{command:saved});}
   catch(error){
    const d=error?.details;
    if(error?.code==='functions/failed-precondition'&&d?.businessStatus==='rejected'&&
      d.requestId===saved.requestId&&['feedback-review-already-scored','feedback-review-already-colored'].includes(d.reason)&&
      JSON.stringify(pending())===JSON.stringify(saved)){
     storage.removeItem(key);error.fastWriteRejected=true;
    }
    throw error;
   }
   if(result?.businessStatus!=="committed"||!result.eventId)throw Error("business-not-confirmed");
   if(JSON.stringify(pending())!==JSON.stringify(saved))throw Error("saved-command-changed");
   // 先持久保存回填追蹤，再移除未確認命令。儲存失敗時原命令仍可查收據恢復。
   if(onConfirmed)await onConfirmed(result,saved);
   if(JSON.stringify(pending())!==JSON.stringify(saved))throw Error("saved-command-changed");storage.removeItem(key);return result;}
  return{prepare,pending,send,read:()=>request("read"),watch:()=>request("watch"),renew:()=>request("renew"),legacyReference:messageId=>request("legacyReference",{messageId}),receipt:requestId=>request("receipt",{requestId}),mirror:requestId=>request("mirror",{requestId}),history:page=>request("history",{page}),checkinMonth:month=>request("checkinMonth",{month})};
 }
 root.ProductionFastWriteTransport={create};if(typeof module!=="undefined")module.exports={create};
})(typeof window!=="undefined"?window:globalThis);
