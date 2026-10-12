/* 只重送 outbox 中已確認要送出的原請求，不建立新答案或提交編號。 */
(function(root){'use strict';
 const delays=[2000,5000,10000,20000,30000];
 function isRetryable(error){
  return ['TypeError','NetworkError','TimeoutError','AbortError'].includes(error?.name)||
   ['RETRY_OR_CHECK_RECEIPT','TRY_LATER','REQUEST_IN_FLIGHT','CLIENT_BUSY','NETWORK_UNAVAILABLE'].includes(error?.message)||
   /^auth\/(network-request-failed|too-many-requests)$/.test(error?.code||'');
 }
 function create({send,isPending,isOnline=()=>true,isVisible=()=>true,canSend=()=>true,onWaiting=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,maxAttempts=8,slowDelay=120000}){
  let timer=null,inflight=null,attempts=0,disposed=false,blocked=false;
  function clear(){if(timer!==null)clearTimer(timer);timer=null;}
  function pending(){if(disposed)return false;try{return isPending()===true;}catch{return false;}}
  function ready(){
   if(!pending()||blocked)return false;
   if(!isOnline()){onWaiting('offline');return false;}
   if(!isVisible()){onWaiting('paused');return false;}
   return true;
  }
  function schedule(){
   clear();if(inflight||!ready())return;
   if(attempts>=maxAttempts){onWaiting('delayed');timer=setTimer(()=>{timer=null;attempt({slow:true});},slowDelay);return;}
   onWaiting('waiting');
   timer=setTimer(()=>{timer=null;attempt();},delays[Math.min(attempts,delays.length-1)]);
  }
  function failed(error){
   if(disposed)return;
   blocked=!isRetryable(error);clear();
   if(blocked){onWaiting('blocked');return;}
   schedule();
  }
  function attempt({slow=false}={}){
   if(inflight)return inflight;
   clear();if(!ready())return Promise.resolve();
   if(attempts>=maxAttempts&&!slow){schedule();return Promise.resolve();}
   if(!canSend()){schedule();return Promise.resolve();}
   attempts++;onWaiting('sending');
   inflight=Promise.resolve().then(send).catch(failed).finally(()=>{inflight=null;schedule();});
   return inflight;
  }
  function resume(){if(disposed||blocked)return;if(inflight)return inflight;attempts=0;return attempt();}
  return {failed,resume,pause:clear,
   settled(){blocked=false;attempts=0;clear();},
   reset(){blocked=false;attempts=0;clear();},
   dispose(){disposed=true;clear();},get attempts(){return attempts;}};
 }
 const api={create,isRetryable};if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftedAnswerRetry=api;
})(typeof window==='undefined'?globalThis:window);
