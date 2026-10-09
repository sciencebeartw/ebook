/* 沿用聯絡簿登入。預設關閉；不儲存／轉送登入 token 至 URL、iframe 或 localStorage。 */
(function(root){'use strict';
 let frame,overlay,owner,lastOwner,auth,unsubscribe,studentName='',generation=0;
 const config=root.GIFTED_HOMEWORK_RELEASE,query=new URLSearchParams(location.search);
 function erase(uid){if(!uid)return;const prefix='gifted-answer-outbox-v1:'+encodeURIComponent(uid)+'|',correctionPrefix='gifted-correction-request:'+uid+':';try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith(prefix)||key?.startsWith(correctionPrefix))localStorage.removeItem(key);}}catch{}}
 function close(clear=false){generation++;if(clear){erase(owner||lastOwner);lastOwner=null;}frame?.remove();overlay?.remove();frame=overlay=null;unsubscribe?.();unsubscribe=null;owner=null;auth=null;document.body.classList.remove('gifted-entry-open');}
 function ready(context){
  if(config?.enabled!==true||!query.get('gifted'))return;
  const user=context.auth?.currentUser;
  if(!user||context.preview||context.result?.isAdmin||['admin_view','god_session','student_preview','dashboard_draft_preview'].includes(context.mode))return;
  const endpoint=new URL(config.studentApi);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('作業服務網址尚未核定');
  if(owner===user.uid&&frame)return;
  close(!!lastOwner&&lastOwner!==user.uid);owner=lastOwner=user.uid;auth=context.auth;studentName=String(context.result.studentName||'');
  overlay=document.createElement('section');overlay.className='gifted-entry';overlay.setAttribute('aria-label','資優自然課本作業');
  const back=document.createElement('button');back.type='button';back.textContent='返回聯絡簿';
  back.onclick=async()=>{const ok=await root.swalConfirm('返回聯絡簿','尚未送出的答案會保留在此裝置，下次可繼續填寫。');if(ok)close(false);};
  frame=document.createElement('iframe');frame.title='資優自然課本作業';
  const url=new URL('gifted/index.html',location.href);url.searchParams.set('v','20261010-auto-status');url.searchParams.set('plan',query.get('gifted'));url.searchParams.set('segment',query.get('segment')||'week-1');
  overlay.append(back,frame);document.body.append(overlay);document.body.classList.add('gifted-entry-open');frame.src=url.href;back.focus();
  unsubscribe=auth.onAuthStateChanged(next=>{if(next?.uid!==owner)close(true);});
 }
 function getTransport(caller){
  if(!frame||frame.contentWindow!==caller||!owner||auth.currentUser?.uid!==owner)throw Error('LOGIN_REQUIRED');
  const uid=owner,epoch=generation,endpoint=config.studentApi;
  function valid(){if(epoch!==generation||owner!==uid||auth?.currentUser?.uid!==uid)throw Error('LOGIN_REQUIRED');}
  return Object.freeze({sessionUid:uid,studentName,async request(body){
   valid();const token=await auth.currentUser.getIdToken();valid();
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   const value=await response.json();valid();
   if(!response.ok)throw Error(value.error||'連線失敗');return value;
  }});
 }
 root.GiftedEbook={ready,close,getTransport};
})(window);
