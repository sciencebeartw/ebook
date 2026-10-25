(function(root){'use strict';
 let manager,observer,visible=new Set(),targets=new Map(),version=0,identity='',receiptsIdentity='',nativeFeedback={},renderQueued=false;
 function ready(){return typeof getProductionMessageBridge==='function'&&typeof ebookFirebaseApp!=='undefined'&&typeof gData!=='undefined'&&!!gData;}
 function currentIdentity(){if(!ready())return '';return [ebookFirebaseApp.auth().currentUser?.uid||'',typeof ebookGodSessionId==='undefined'?'':ebookGodSessionId,gData.className||'',gData.foundUserKey||''].join('|');}
 function status(message){const host=document.getElementById('tab-content-0');if(!host)return;let el=document.getElementById('fastWriteMessageReadStatus');if(!el){el=document.createElement('p');el.id='fastWriteMessageReadStatus';el.setAttribute('role','status');host.prepend(el);}el.textContent=message;}
 function historyControls(t){
  const state=t.historyState(),card=t.card;if(!state||!card?.isConnected)return;
  let panel=card.querySelector('.fastwrite-history-controls');if(!panel){panel=document.createElement('div');panel.className='fastwrite-history-controls';card.querySelector('[id^="history-"]')?.insertAdjacentElement('afterend',panel);}
  panel.replaceChildren();if(state.head==='p000000000001')return;
  const label=document.createElement('span');label.setAttribute('role','status');label.textContent=t.loadingHistory?'正在讀取較早留言…':state.selected===state.head?'目前顯示最新留言。':'最新留言與較早留言第 '+Number(state.selected.slice(1))+' 頁。';panel.append(label);
  for(const [text,segment]of [['更早留言',state.previous],['較新留言',state.next]]){if(!segment)continue;const button=document.createElement('button');button.type='button';button.textContent=text;button.style.minHeight='44px';button.disabled=!!t.loadingHistory;button.addEventListener('click',()=>loadHistory(t,segment));panel.append(button);}
 }
 function latestHistory(t,head){
  if(Number(head.slice(1))<=1||t.recentHead===head)return;
  if(t.loadingHistory){t.pendingHead=head;return;}
  t.recentHead=head;loadHistory(t,'p'+String(Number(head.slice(1))-1).padStart(12,'0'));
 }
 async function loadHistory(t,segment){
  if(t.loadingHistory)return;t.loadingHistory=true;historyControls(t);
  try{await t.history(segment);if(targets.get(t.id)===t)refreshHistory();}
  catch(_){if(targets.get(t.id)===t)status('較早留言尚未讀取完成，請稍後重試。');}
  finally{t.loadingHistory=false;if(targets.get(t.id)===t){historyControls(t);if(t.pendingHead){const head=t.pendingHead;delete t.pendingHead;latestHistory(t,head);}}}
 }
 function refreshHistory(){
  if(renderQueued)return;renderQueued=true;Promise.resolve().then(()=>{renderQueued=false;if(!ready()||document.hidden)return;
   try{gData.feedbackHistory=buildFeedbackHistoryList(nativeFeedback,gData);renderDailyPosts(gData.dailyPost,gData.feedbackHistory,true);}catch(_){status('留言更新暫時中斷，請重新整理後確認。');}
  });
 }
 root.refreshProductionFeedbackView=refreshHistory;
 root.rememberProductionMessageNativeFeedback=function(node){nativeFeedback=node||{};};
 root.stopProductionMessageWatches=function(){version++;observer?.disconnect();observer=null;visible.clear();manager?.clear();for(const t of targets.values())t.clear();targets.clear();};
 async function reconcile(){
  if(!ready()){root.stopProductionMessageWatches();return;}
  const generation=++version,b=getProductionMessageBridge();if(!b||document.hidden){root.stopProductionMessageWatches();return;}
  const current=currentIdentity();if(identity!==current){manager?.clear();b.clearRemote();targets.clear();identity=current;}
  if(receiptsIdentity!==current){receiptsIdentity=current;
   // 每個登入畫面最多背景查八張既有收據，不等待 Sheet，也不阻擋送出。
   b.checkReceipts().then(rows=>{if(rows.length&&identity===current&&currentIdentity()===current)refreshHistory();}).catch(()=>{});
  }
  if(!manager)manager=root.ProductionFastWriteRealtime.create({database:db,getIdentity:currentIdentity});
  const selected=[...visible].filter(n=>n.isConnected).slice(0,4),wanted=[];
  for(const card of selected){
   const classKey=card.dataset.sourceClassKey||card.dataset.storedClassKey||safeKey(gData.className),date=card.dataset.postDate,post=(gData.dailyPost||[]).find(p=>(p.sourceClassKey||p.storedClassKey||safeKey(gData.className))===classKey&&p.date===date);if(!post)continue;
   const className=post.sourceClassName||post.storedClassName||post.className||gData.className;
   if(!b.accepts(BEAR_SUBJECT.replace(/^\//,''),className))continue;
   try{
    const ids=getStudentKeysForClass(gData.studentKeysByClassKey,classKey,className===gData.className?gData.foundUserKey:'');if(ids.length!==1)throw Error('message-student-ambiguous');
    const t=await b.watchTarget(isAdminMode?'god':'student',{subject:BEAR_SUBJECT.replace(/^\//,''),className,studentKey:ids[0],targetDate:productionMessageDate(date)});
    if(generation!==version||identity!==currentIdentity())return;wanted.push(t.id);if(!targets.has(t.id))targets.set(t.id,t);targets.get(t.id).card=card;
   }catch(_){status('部分留言來源尚未確認，請重新整理後確認。');}
  }
  if(generation!==version)return;manager.keepOnly(wanted);for(const[id,t]of targets)if(!wanted.includes(id)){t.clear();targets.delete(id);}
  for(const id of wanted){const t=targets.get(id);historyControls(t);manager.open(id,{prefix:t.prefix,transport:t.transport,onValue:view=>{try{
   t.accept(view);refreshHistory();historyControls(t);
   // 首次進入與換段各讀一次前段；後續舊頁由使用者操作，避免下載完整歷史。
   latestHistory(t,view.segment);
  }catch(_){manager.keepOnly(wanted.filter(x=>x!==id));t.clear();targets.delete(id);status('留言對應已改變，請重新登入後確認。');}},onState:(state)=>{if(state==='connected')status('');if(state==='blocked'||state==='legacy'){t.clear();targets.delete(id);refreshHistory();status(state==='legacy'?'已切回原留言來源。':'即時留言連線已停止，請重新登入或重新整理後確認。');}}});}
 }
 root.syncProductionVisibleMessageWatches=function(){
  observer?.disconnect();visible.clear();if(!ready()||document.hidden||!getProductionMessageBridge()||isDashboardDraftPreviewMode){root.stopProductionMessageWatches();return;}
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);reconcile();},{rootMargin:'80px 0px'});
  document.querySelectorAll('#tab-content-0 .post-card-wrapper').forEach(n=>observer.observe(n));
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)root.stopProductionMessageWatches();else root.syncProductionVisibleMessageWatches();});
 root.addEventListener('pagehide',()=>root.stopProductionMessageWatches());
})(window);
