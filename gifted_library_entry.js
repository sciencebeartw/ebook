(function(root){'use strict';
 const API='https://asia-east1-sciencebear-quizbank.cloudfunctions.net/giftedLibraryStudentApi';
 let session=null,overlay=null,frame=null,generation=0,unsubscribe=null,opener=null,scrollY=0;
 const policy=root.GIFTED_LIBRARY_POLICY;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let boundaryTimer=null,frameTimer=null,frameStatus=null;
 const pilotRoot=()=>document.getElementById('giftedLibraryPilotEntry');
 function clearPilot(){const entry=pilotRoot();if(entry){entry.hidden=true;entry.replaceChildren();}}
 function close(clear=false){clearTimeout(frameTimer);frameStatus=null;generation++;unsubscribe?.();unsubscribe=null;frame?.remove();overlay?.remove();frame=overlay=null;document.documentElement.classList.remove('gl-open');document.body.style.removeProperty('--gl-scroll');if(opener){root.scrollTo(0,scrollY);if(opener.isConnected)opener.focus({preventScroll:true});opener=null;}if(clear){clearTimeout(boundaryTimer);session=null;clearPilot();refreshPostSlots();}}
 function ready(context){close(true);const user=context.auth?.currentUser;const teacherView=context.teacherView===true&&['god_session','student_preview'].includes(context.mode);if(!user||context.preview||(!teacherView&&(context.result?.isAdmin||['admin_view','god_session','student_preview'].includes(context.mode))))return;
  if(!policy.classIds.includes(context.result.className))return;
  session={auth:context.auth,uid:user.uid,className:context.result.className,name:context.result.studentName||'',readOnly:teacherView&&context.mode==='god_session',studentPreview:context.mode==='student_preview'};
  session.useCalendar=!teacherView || session.studentPreview;
  if(session.useCalendar)fetchCalendar(session);
  const target=new URLSearchParams(location.search).get('giftedLibrary');if(target==='mock'||/^grb-chapter-\d{2}$/.test(target||''))open(target);
 }
 function buttons(post,className,preview=false,studentName){
  if(!policy.classIds.includes(className))return '';
  const date=String(post?.date||'').replace(/\//g,'-').split(' ')[0].split('-').map((p,i)=>i?p.padStart(2,'0'):p).join('-');
  if(!preview && (studentName || session?.useCalendar)){
   return '<div class="gl-calendar-post" data-gl-class="'+esc(className)+'" data-gl-date="'+esc(date)+'"></div>';
  }
  const row=policy.reviews.find(r=>r.dates[className.includes('週六')?'sat':'sun']===date);
  const mockRelease=policy.mockOpensAtByClass?.[className] ?? policy.mockOpensAt;
  const items=(row && (preview || opening(date)<=Date.now())?link(row.chapterId,'複習題本',preview):'')+
   (mockPostIsOpen(date,mockRelease,preview?Infinity:Date.now())?link('mock','模擬試題',preview):'');
  return items?'<div class="gl-entry-buttons">'+items+'</div>':'';
 }
 function link(id,label,preview=false){
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('giftedLibrary',id);
  return preview?'<button type="button" disabled>'+label+'</button>':'<a href="'+esc(url.href)+'" data-gifted-library="'+esc(id)+'">'+label+'</a>';
 }
 // 同一登入共用一次課表查詢，切回前景時依時間更新。
 function serverTime(c){return c.serverNow+(performance.now()-c.received);}
 function opening(date){return Date.parse(date+'T00:00:00+08:00');}
 // 聯絡簿的日期只有年月日；開放日當篇還要等到該班的開放時刻。
 function mockPostIsOpen(postDate,release,now){
  const postDay=opening(postDate),start=Date.parse(release);
  return now>=start && now>=postDay && start<postDay+86400000;
 }
 function refreshPostSlots(){
  const slots=Array.from(document.querySelectorAll('.gl-calendar-post'));
  const c=session?.calendar,valid=c && session.auth.currentUser?.uid===session.uid;
  const now=valid?serverTime(c):0;
  const dates=[...new Set(slots.filter(s=>s.dataset.glClass===session?.className).map(s=>s.dataset.glDate).filter(d=>opening(d)<=now))].sort();
  const byDate=new Map();
  if(valid && dates.length){
   for(const row of c.reviews){
    if(opening(row.date)>now)continue;
    // 若改在兩堂課之間開放，放在開放當天可見的最近一篇聯絡簿。
    const date=dates.filter(d=>d<=row.date).pop() || dates[0];
    if(!byDate.has(date))byDate.set(date,[]);
    byDate.get(date).push(row);
   }
  }
  for(const slot of slots){
   if(!valid || slot.dataset.glClass!==session.className){slot.replaceChildren();continue;}
   const date=slot.dataset.glDate,rows=byDate.get(date)||[];
   const items=rows.map(row=>link(row.chapterId,rows.length===1 && row.date===date?'複習題本':'複習題本｜'+row.label));
   if(mockPostIsOpen(date,c.mockOpensAt,now)){
    items.push(link('mock','模擬試題'));
   }
   const html=items.length?'<div class="gl-entry-buttons">'+items.join('')+'</div>':'';
   if(slot.innerHTML!==html)slot.innerHTML=html;
  }
  if(valid) refreshTopEntry(c,now);
 }
 function refreshTopEntry(calendar,now){
  const entry=pilotRoot(),early=calendar.earlyAccess;
  if(!entry)return;
  let html='';
  if(early && now<early.expiresAt){
   const review=calendar.reviews.find(r=>r.chapterId===early.reviewId);
   html='<strong>測試學生專用</strong><div class="gl-entry-buttons">'+
    (review?link(review.chapterId,'複習題本｜'+review.label):'')+(early.mock?link('mock','模擬試題｜16 回'):'')+'</div>';
  }
  if(entry.innerHTML!==html)entry.innerHTML=html;
  entry.hidden=!html;
 }
 function drawCalendar(own){
  if(session!==own || own.auth.currentUser?.uid!==own.uid)return;
  refreshPostSlots();clearTimeout(boundaryTimer);
  const c=own.calendar,now=serverTime(c),early=c.earlyAccess;
  const next=Math.min(...[...c.reviews.map(r=>opening(r.date)),Date.parse(c.mockOpensAt),early?.expiresAt].filter(t=>t>now));
  if(Number.isFinite(next))boundaryTimer=setTimeout(()=>drawCalendar(own),Math.min(next-now+50,2147483647));
 }
 async function fetchCalendar(own){
  if(own.loading || session!==own)return;
  own.loading=true;
  const valid=()=>session===own && own.auth.currentUser?.uid===own.uid;
  try{
   const c=await request(own,{action:'entryCalendar'},valid);
   if(!valid()||c.classId!==own.className||!Array.isArray(c.reviews)||!Number.isFinite(c.serverNow))return;
   own.calendar={...c,received:performance.now()};
   drawCalendar(own);
  }catch(error){
   if(!valid())return;
   own.calendar=null;clearTimeout(boundaryTimer);refreshPostSlots();clearPilot();
   const entry=pilotRoot();
   if(entry && error.message!=='CLASS_NOT_AUTHORIZED'){
    entry.innerHTML='<span role="status">題本課表暫時無法載入。</span> <button type="button">重試載入課表</button>';
    entry.hidden=false;
    entry.querySelector('button').onclick=event=>{event.currentTarget.disabled=true;fetchCalendar(own);};
   }
  }finally{own.loading=false;}
 }
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && session?.useCalendar && (!session.calendar || performance.now()-session.calendar.received>60000))fetchCalendar(session);
 });
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
  frame=document.createElement('iframe');frame.title=target==='mock'?'模擬試題':'複習題本';const url=new URL('gifted-library/index.html',location.href);url.searchParams.set('target',target);url.searchParams.set('v','20261121-image-retry2');overlay.append(back,frame);document.body.append(overlay);
  if(saved.useCalendar)watchFrame(frame,url);
  frame.src=url.href;back.focus();unsubscribe=saved.auth.onAuthStateChanged(u=>{if(u?.uid!==saved.uid)close(true);});return true;
 }
 function watchFrame(element,url){
  const notice=document.createElement('div'),message=document.createElement('span'),retry=document.createElement('button');
  notice.className='gl-frame-notice';notice.hidden=true;notice.setAttribute('role','status');
  message.textContent='作答頁暫時無法載入。';retry.type='button';retry.textContent='重試';
  notice.append(message,retry);element.before(notice);frameStatus=notice;
  const failed=()=>{if(frame===element && frameStatus===notice)notice.hidden=false;};
  const arm=()=>{clearTimeout(frameTimer);notice.hidden=true;frameTimer=setTimeout(failed,12000);};
  let attempts=0;
  retry.onclick=()=>{arm();url.searchParams.set('retry',String(++attempts));element.src=url.href;};
  element.onerror=failed;arm();
 }
 function pageReady(caller){
  if(!frameStatus || frame?.contentWindow!==caller)return;
  clearTimeout(frameTimer);frame.onerror=null;frameStatus.remove();frameStatus=null;
 }
 function getTransport(caller){if(!frame||frame.contentWindow!==caller||!session)throw Error('LOGIN_REQUIRED');const own=session,epoch=generation;
  function valid(){if(epoch!==generation||session!==own||own.auth.currentUser?.uid!==own.uid)throw Error('LOGIN_REQUIRED');}
  return {sessionUid:own.uid,studentName:own.name,readOnly:own.readOnly,get retryInitialLoad(){return own.useCalendar;},
   async request(body){
    if(own.readOnly&&['draft','submit','reviewFill'].includes(body.action))throw Error('TEACHER_VIEW_READ_ONLY');
    return request(own,body,()=>epoch===generation&&session===own&&own.auth.currentUser?.uid===own.uid);
   },
   async confirmWrite(action){valid();if(!own.studentPreview)return true;const ok=await root.confirmStudentPreviewAction(action==='draft'?'儲存題本草稿':'提交題本答案並登記成績');valid();return ok;}
  };
 }
 document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const a=event.target.closest?.('a[data-gifted-library]');if(a&&open(a.dataset.giftedLibrary,a))event.preventDefault();});
 root.GiftedLibraryEbook={ready,close,buttons,getTransport,pageReady,refreshPostSlots};
})(window);
