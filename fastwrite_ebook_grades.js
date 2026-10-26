(function(root){'use strict';
 let bridge,manager,observer,generation=0,identity='',visible=new Set(),targets=new Map(),blocked=new Set(),queued=false;
 function ready(){return typeof ebookFirebaseApp!=='undefined'&&typeof gData!=='undefined'&&gData&&typeof isAdminMode!=='undefined';}
 function who(){return ready()?[ebookFirebaseApp.auth().currentUser?.uid||'',typeof ebookGodSessionId==='undefined'?'':ebookGodSessionId,gData.className||'',gData.foundUserKey||''].join('|'):'';}
 function reader(){if(!ready()||!Array.isArray(root.DASHBOARD_FASTWRITE_SCOPES)||!root.DASHBOARD_FASTWRITE_SCOPES.length)return null;
  if(!bridge)bridge=root.ProductionGradeReader.create({scopes:root.DASHBOARD_FASTWRITE_SCOPES,getUid:()=>ebookFirebaseApp.auth().currentUser?.uid,getSessionId:()=>ebookGodSessionId,storage:root.localStorage,
   callableFor:mode=>ebookFunctions.httpsCallable(mode==='god'?'runEbookGodAdminAction':'runEbookStudentAction',{timeout:30000}),hash:async parts=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(parts))))).map(n=>n.toString(16).padStart(2,'0')).join('')});return bridge;}
 function redraw(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;if(ready()&&!document.hidden&&typeof root.rebuildProductionGradeView==='function')root.rebuildProductionGradeView();});}
 function note(card,text){if(!card?.isConnected)return;let el=card.querySelector('.fastwrite-grade-read-status');if(!el){el=document.createElement('p');el.className='fastwrite-grade-read-status';el.setAttribute('role','status');card.append(el);}el.textContent=text;}
 root.overlayProductionGrade=function(raw,classKey,studentKey,examId){if(identity!==who())return raw;return reader()?.overlay(raw,classKey,studentKey,examId)||raw;};
 root.stopProductionGradeWatches=function(){generation++;observer?.disconnect();observer=null;visible.clear();manager?.clear();targets.clear();blocked.clear();bridge?.clear();identity='';};
 async function reconcile(){
  if(!ready()||document.hidden){root.stopProductionGradeWatches();return;}const b=reader();if(!b)return;
  const current=who();if(identity!==current){manager?.clear();targets.clear();blocked.clear();b.clear();identity=current;}
  const version=++generation;manager=manager||root.ProductionFastWriteRealtime.create({database:db,getIdentity:who});const wanted=new Map();
  for(const card of [...visible].filter(n=>n.isConnected)){
   if(wanted.size>=4)break;const post=card.closest('.post-card-wrapper'),classKey=card.dataset.sourceClassKey||post?.dataset.storedClassKey||post?.dataset.sourceClassKey,examId=card.dataset.storedExamId||card.dataset.examId;
   if(!classKey||!examId||!b.accepts(classKey))continue;
   const matches=(gData.grades||[]).filter(g=>(g.storedClassKey||g.sourceClassKey)===classKey&&(g.storedExamId||g.examId)===examId);if(matches.length!==1||!matches[0].sourceStudentKey){note(card,'成績來源尚未核對，請重新整理後確認。');continue;}
   if(root.ProductionGradeReader.nativeAuthority(matches[0]))continue;
   try{const t=await b.target(isAdminMode?'god':'student',{classKey,studentKey:matches[0].sourceStudentKey,examId});if(version!==generation||current!==who())return;if(blocked.has(t.id))continue;if(!wanted.has(t.id))wanted.set(t.id,{...t,cards:[]});wanted.get(t.id).cards.push(card);}catch(_){note(card,'即時成績尚未確認，請重新登入後確認。');}
  }
  if(version!==generation)return;manager.keepOnly([...wanted.keys()]);targets=wanted;
  for(const [id,t]of wanted)manager.open(id,{prefix:t.prefix,transport:t.transport,onValue:view=>{try{if(t.accept(view))redraw();}catch(_){blocked.add(id);manager.keepOnly([...targets.keys()].filter(x=>x!==id));t.clear();for(const c of targets.get(id)?.cards||[])note(c,'成績來源已改變，請重新登入後確認。');redraw();}},onState:state=>{if(state==='blocked'||state==='legacy'){blocked.add(id);t.clear();for(const c of targets.get(id)?.cards||[])note(c,state==='legacy'?'已切回原成績來源。':'即時成績已停止，請重新登入後確認。');redraw();}}});
 }
 root.syncProductionVisibleGradeWatches=function(){observer?.disconnect();visible.clear();if(!ready()||document.hidden||!reader()||isDashboardDraftPreviewMode){root.stopProductionGradeWatches();return;}
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);reconcile();},{rootMargin:'80px 0px'});
  document.querySelectorAll('#tab-content-0 .grade-section[data-pending-exam-anchor],#tab-content-1 .score-card[data-pending-exam-anchor]').forEach(n=>observer.observe(n));
 };
 root.addEventListener('online',()=>{root.stopProductionGradeWatches();if(!document.hidden)root.syncProductionVisibleGradeWatches();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)root.stopProductionGradeWatches();else root.syncProductionVisibleGradeWatches();});root.addEventListener('pagehide',()=>root.stopProductionGradeWatches());
})(window);
