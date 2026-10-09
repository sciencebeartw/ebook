/* 只查本人的登分摘要：單一請求、有限次重試，背景或離線暫停。 */
(function(root){'use strict';
 const delays=[3000,5000,8000,13000,20000,30000];
 function create({read,render,onError=()=>{},onWaiting=()=>{},isVisible=()=>true,isOnline=()=>true,setTimer=setTimeout,clearTimer=clearTimeout,maxReads=12}){
  let timer=null,inflight=null,reads=0,disposed=false,waiting=true;
  function clear(){if(timer!==null)clearTimer(timer);timer=null;}
  function schedule(){
   clear();if(disposed||!waiting)return;
   if(reads>=maxReads){onWaiting('delayed');return;}
   if(!isVisible()||!isOnline()){onWaiting('paused');return;}
   timer=setTimer(()=>{timer=null;refresh();},delays[Math.min(Math.max(reads-1,0),delays.length-1)]);
  }
  function refresh({manual=false}={}){
   if(disposed)return Promise.resolve();
   if(inflight)return inflight;
   if(manual)reads=0;
   clear();
   if(!isVisible()||!isOnline()){onWaiting('paused');return Promise.resolve();}
   if(reads>=maxReads){onWaiting('delayed');return Promise.resolve();}
   reads++;
   inflight=Promise.resolve().then(read).then(value=>{
    if(disposed)return;
    waiting=render(value)===true;
   }).catch(error=>{if(!disposed)waiting=onError(error)===true;}).finally(()=>{
    inflight=null;schedule();
   });
   return inflight;
  }
  function resume(){clear();if(!disposed&&waiting&&reads<maxReads&&isVisible()&&isOnline())return refresh();}
  return {refresh,resume,pause:clear,dispose(){disposed=true;clear();},get reads(){return reads;}};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftedGradeRefresh=api;
})(typeof window==='undefined'?globalThis:window);
