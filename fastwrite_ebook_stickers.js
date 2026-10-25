(function(root){'use strict';
 let reader,manager,target,version=0,identity='',nativeBalance=0,committed,acceptedRevision=-1;
 function ready(){return typeof ebookFirebaseApp!=='undefined'&&typeof gData!=='undefined'&&gData&&typeof isAdminMode!=='undefined'&&typeof BEAR_SUBJECT!=='undefined'&&BEAR_SUBJECT==='/science'&&!isDashboardDraftPreviewMode;}
 function who(){return ready()?[ebookFirebaseApp.auth().currentUser?.uid||'',typeof ebookGodSessionId==='undefined'?'':ebookGodSessionId,gData.className||'',gData.foundUserKey||''].join('|'):'';}
 let submitter;
 root.handleProductionStudentSticker=function(action,payload){
  if(!ready()||isAdminMode||!Array.isArray(root.DASHBOARD_FASTWRITE_SCOPES)||!root.DASHBOARD_FASTWRITE_SCOPES.length)return null;
  if(!submitter)submitter=root.ProductionStudentStickerBridge.create({scopes:root.DASHBOARD_FASTWRITE_SCOPES,storage:root.localStorage,
   getContext:()=>({uid:ebookFirebaseApp.auth().currentUser?.uid,className:gData?.className,studentName:gData?.studentName,studentKey:gData?.foundUserKey,isAdmin:isAdminMode}),
   callable:ebookFunctions.httpsCallable('runEbookStudentAction',{timeout:30000}),hash:async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))).map(x=>x.toString(16).padStart(2,'0')).join('')});
  return submitter.handle(action,payload,BEAR_SUBJECT.replace(/^\//,''));
 };
 function getReader(){const scopes=root.DASHBOARD_FASTWRITE_SCOPES;if(!Array.isArray(scopes)||!scopes.length||!ready())return null;
  if(!reader)reader=root.ProductionStickerReader.create({scopes,storage:root.localStorage,getUid:()=>ebookFirebaseApp.auth().currentUser?.uid,getSessionId:()=>ebookGodSessionId,
   callableFor:mode=>ebookFunctions.httpsCallable(mode==='god'?'runEbookGodAdminAction':'runEbookStudentAction',{timeout:30000}),hash:async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))).map(x=>x.toString(16).padStart(2,'0')).join('')});return reader;}
 function note(text){const anchor=document.getElementById('headStickers');if(!anchor)return;let el=document.getElementById('fastWriteStickerReadStatus');if(!el){el=document.createElement('span');el.id='fastWriteStickerReadStatus';el.setAttribute('role','status');el.style.cssText='display:block;font-size:.85rem;overflow-wrap:anywhere';anchor.insertAdjacentElement('afterend',el);}el.textContent=text;}
 root.overlayProductionStickerBalance=function(raw,context){if(context===gData)nativeBalance=raw;if(!ready()||identity!==who()||context?.className!==gData.className||context?.foundUserKey!==gData.foundUserKey)return raw;if(committed?.identity===who())return committed.balance;return getReader()?.balance(raw,safeKey(gData.className),gData.foundUserKey)??raw;};
 root.confirmProductionStickerBalance=function(balance,revision){if(!ready()||!Number.isSafeInteger(balance)||!Number.isSafeInteger(revision)||revision<1)throw Error('invalid-confirmed-sticker-balance');if(identity===who()&&revision<acceptedRevision||committed?.identity===who()&&revision<committed.revision)return;committed={identity:who(),balance,revision};const count=document.getElementById('headStickerCount');if(count)count.textContent=balance;};
 root.overlayProductionStickerHistory=function(list,context){if(!ready()||identity!==who()||context?.className!==gData.className||context?.foundUserKey!==gData.foundUserKey)return list;return getReader()?.merge(list,safeKey(gData.className),gData.foundUserKey)||list;};
 root.stopProductionStickerWatch=function(){version++;manager?.clear();target?.clear();target=null;reader?.clear();identity='';committed=null;acceptedRevision=-1;};
 root.syncProductionStickerWatch=async function(){
  if(!ready()||document.hidden){root.stopProductionStickerWatch();return;}const b=getReader();if(!b||!b.accepts(safeKey(gData.className))||!gData.foundUserKey)return;
  const current=who();if(current===identity&&target)return;root.stopProductionStickerWatch();identity=current;const generation=version;
  try{
   const t=await b.target(isAdminMode?'god':'student',{classKey:safeKey(gData.className),studentKey:gData.foundUserKey});if(generation!==version||current!==who())return;target=t;
   manager=manager||root.ProductionFastWriteRealtime.create({database:db,getIdentity:who});note('正在確認棒卡資料…');
   manager.open(t.id,{prefix:t.prefix,transport:t.transport,onValue:view=>{if(generation!==version||current!==who())return;try{if(committed?.identity===current&&view?.revision<committed.revision)return;if(!t.accept(view))return;committed=null;acceptedRevision=view.revision;
     const count=document.getElementById('headStickerCount');if(count)count.textContent=b.balance(nativeBalance,safeKey(gData.className),gData.foundUserKey);note('');root.refreshProductionFeedbackView?.();
    }catch(_){manager.clear();t.clear();note('棒卡資料尚未確認，請重新登入後核對。');}},onState:(state,view)=>{
     if(generation!==version||current!==who())return;if(state==='blocked'||state==='legacy'){
      t.clear();if(state==='legacy'&&/^[a-f0-9]{64}$/.test(view?.rollbackVerificationHash||'')){document.getElementById('headStickerCount').textContent=nativeBalance;note('已切回原棒卡來源。');root.refreshProductionFeedbackView?.();}
      else note('棒卡即時連線已停止，請重新登入後核對。');
     }
    }});
  }catch(_){if(generation===version&&current===who())note('棒卡來源尚未確認，請重新登入後核對。');}
 };
 document.addEventListener('visibilitychange',()=>document.hidden?root.stopProductionStickerWatch():root.syncProductionStickerWatch());root.addEventListener('pagehide',()=>root.stopProductionStickerWatch());
})(window);
