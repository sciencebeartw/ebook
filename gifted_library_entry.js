(function(root){'use strict';
 const API='https://asia-east1-sciencebear-quizbank.cloudfunctions.net/giftedLibraryStudentApi';
 let session=null,overlay=null,frame=null,generation=0,unsubscribe=null,opener=null,scrollY=0;
 const policy=root.GIFTED_LIBRARY_POLICY;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pilotRoot=()=>document.getElementById('giftedLibraryPilotEntry');
 function clearPilot(){const entry=pilotRoot();if(entry){entry.hidden=true;entry.replaceChildren();}}
 function close(clear=false){generation++;unsubscribe?.();unsubscribe=null;frame?.remove();overlay?.remove();frame=overlay=null;document.documentElement.classList.remove('gl-open');document.body.style.removeProperty('--gl-scroll');if(opener){root.scrollTo(0,scrollY);if(opener.isConnected)opener.focus({preventScroll:true});opener=null;}if(clear){session=null;clearPilot();}}
 function ready(context){close(true);const user=context.auth?.currentUser;const teacherView=context.teacherView===true&&['god_session','student_preview'].includes(context.mode);if(!user||context.preview||(!teacherView&&(context.result?.isAdmin||['admin_view','god_session','student_preview'].includes(context.mode))))return;
  if(!policy.classIds.includes(context.result.className))return;
  session={auth:context.auth,uid:user.uid,className:context.result.className,name:context.result.studentName||'',readOnly:teacherView&&context.mode==='god_session',studentPreview:context.mode==='student_preview'};
  if(!teacherView&&session.className==='115小六資優自然週六上午班'&&session.name==='測試學生')showPilot(session);
  const target=new URLSearchParams(location.search).get('giftedLibrary');if(target==='mock'||/^grb-chapter-\d{2}$/.test(target||''))open(target);
 }
 function buttons(post,className,preview=false){
  if(!policy.classIds.includes(className))return '';
  const date=String(post?.date||'').replace(/\//g,'-').split(' ')[0].split('-').map((p,i)=>i?p.padStart(2,'0'):p).join('-');
  if(date<'2026-11-21'&&Date.now()<Date.parse(policy.mockOpensAt))return '';
  const row=policy.reviews.find(r=>r.dates[className.includes('週六')?'sat':'sun']===date);
  return '<div class="gl-entry-buttons">'+(row?link(row.chapterId,'複習題本',preview):'')+link('mock','模擬試題',preview)+'</div>';
 }
 function link(id,label,preview=false){
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('giftedLibrary',id);
  return preview?'<button type="button" disabled>'+label+'</button>':'<a href="'+esc(url.href)+'" data-gifted-library="'+esc(id)+'">'+label+'</a>';
 }
 async function showPilot(own){
  const current=()=>session===own&&own.auth.currentUser?.uid===own.uid;
  try{
   const grant=await request(own,{action:'pilotAccess'},current);
   if(!current()||grant.reviewId!=='grb-chapter-05'||grant.mock!==true)return;
   const entry=pilotRoot();if(!entry)return;
   entry.innerHTML='<strong>測試學生專用</strong><div class="gl-entry-buttons">'+link(grant.reviewId,'複習題本｜第五章 聲音')+link('mock','模擬試題｜16 回')+'</div>';
   entry.hidden=false;
  }catch{if(current())clearPilot();}
 }
 async function request(own,body,valid){
  if(!valid())throw Error('LOGIN_REQUIRED');
  const token=await own.auth.currentUser.getIdToken();
  if(!valid())throw Error('LOGIN_REQUIRED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal});
   const result=await response.json();
   if(!valid())throw Error('LOGIN_REQUIRED');
   if(!response.ok)throw Error(result.error||'RETRY_OR_CHECK_RECEIPT');
   return result;
  }finally{clearTimeout(timer);}
 }
 function open(target,trigger){const saved=session;if(!saved||saved.auth.currentUser?.uid!==saved.uid)return false;
  close();session=saved;opener=trigger||document.activeElement;scrollY=root.scrollY||0;document.body.style.setProperty('--gl-scroll',-scrollY+'px');document.documentElement.classList.add('gl-open');
  overlay=document.createElement('section');overlay.className='gl-overlay';overlay.setAttribute('aria-label',target==='mock'?'模擬試題':'複習題本');
  const back=document.createElement('button');back.type='button';back.textContent='返回聯絡簿';back.onclick=async()=>{if(frame?.contentWindow?.GiftedLibraryPage?.dirty()){if(!await root.swalConfirm('返回聯絡簿','尚未送出的答案已保留在此裝置，下次可繼續填寫。'))return;}close();};
  frame=document.createElement('iframe');frame.title=target==='mock'?'模擬試題':'複習題本';const url=new URL('gifted-library/index.html',location.href);url.searchParams.set('target',target);overlay.append(back,frame);document.body.append(overlay);frame.src=url.href;back.focus();unsubscribe=saved.auth.onAuthStateChanged(u=>{if(u?.uid!==saved.uid)close(true);});return true;
 }
 function getTransport(caller){if(!frame||frame.contentWindow!==caller||!session)throw Error('LOGIN_REQUIRED');const own=session,epoch=generation;
  function valid(){if(epoch!==generation||session!==own||own.auth.currentUser?.uid!==own.uid)throw Error('LOGIN_REQUIRED');}
  return {sessionUid:own.uid,studentName:own.name,readOnly:own.readOnly,
   async request(body){
    if(own.readOnly&&['draft','submit'].includes(body.action))throw Error('TEACHER_VIEW_READ_ONLY');
    return request(own,body,()=>epoch===generation&&session===own&&own.auth.currentUser?.uid===own.uid);
   },
   async confirmWrite(action){valid();if(!own.studentPreview)return true;const ok=await root.confirmStudentPreviewAction(action==='draft'?'儲存題本草稿':'提交題本答案並登記成績');valid();return ok;}
  };
 }
 document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const a=event.target.closest?.('a[data-gifted-library]');if(a&&open(a.dataset.giftedLibrary,a))event.preventDefault();});
 root.GiftedLibraryEbook={ready,close,buttons,getTransport};
})(window);
