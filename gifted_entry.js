/* 沿用聯絡簿登入。預設關閉；不儲存／轉送登入 token 至 URL、iframe 或 localStorage。 */
(function(root){'use strict';
 let frame,overlay,owner,lastOwner,auth,unsubscribe,studentSession,activeAssignment,studentName='',generation=0;
 const config=root.GIFTED_HOMEWORK_RELEASE,query=new URLSearchParams(location.search);
 function erase(uid){if(!uid)return;const prefix='gifted-answer-outbox-v1:'+encodeURIComponent(uid)+'|',correctionPrefix='gifted-correction-request:'+uid+':';try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith(prefix)||key?.startsWith(correctionPrefix))localStorage.removeItem(key);}}catch{}}
 function close(clear=false){generation++;if(clear){erase(owner||lastOwner);lastOwner=null;studentSession=null;}frame?.remove();overlay?.remove();frame=overlay=null;activeAssignment=null;unsubscribe?.();unsubscribe=null;owner=null;auth=null;document.body.classList.remove('gifted-entry-open');}
 function assignmentFromHref(href){
  try{
   const here=new URL(location.href),url=new URL(href,here),path=p=>p.replace(/\/index\.html$/,'/').replace(/\/$/,'');
   const ownPage=url.origin===here.origin&&path(url.pathname)===path(here.pathname);
   const publicPage=['https://www.sciencebear.com.tw','https://sciencebear.com.tw','https://sciencebeartw.github.io'].includes(url.origin)&&path(url.pathname)==='/ebook';
   const planId=url.searchParams.get('gifted'),segmentId=url.searchParams.get('segment')||'week-1';
   if((!ownPage&&!publicPage)||url.username||url.password||!/^hw_[a-f0-9]{64}$/.test(planId||'')||!/^week-[1-9]\d*$/.test(segmentId))return null;
   return {planId,segmentId};
  }catch{return null;}
 }
 function ready(context){
  if(config?.enabled!==true)return;
  const user=context.auth?.currentUser;
  const teacherView=context.teacherView===true&&['god_session','student_preview'].includes(context.mode);
  if(!user||context.preview||(!teacherView&&(context.result?.isAdmin||['admin_view','god_session','student_preview','dashboard_draft_preview'].includes(context.mode)))){close(true);return;}
  studentSession={auth:context.auth,uid:user.uid,readOnly:teacherView&&context.mode==='god_session',studentPreview:teacherView&&context.mode==='student_preview',studentName:String(context.result.studentName||'')};
  if(query.get('gifted')){const assignment=assignmentFromHref(location.href);if(assignment)openAssignment(assignment);}
 }
 function openAssignment(assignment){
  const session=studentSession,user=session?.auth.currentUser;
  if(!session||!user||user.uid!==session.uid)return false;
  const endpoint=new URL(config.studentApi);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('作業服務網址尚未核定');
  if(owner===user.uid&&frame&&activeAssignment?.planId===assignment.planId&&activeAssignment?.segmentId===assignment.segmentId)return true;
  close(!!lastOwner&&lastOwner!==user.uid);studentSession=session;owner=lastOwner=user.uid;auth=session.auth;studentName=session.studentName;activeAssignment=assignment;
  overlay=document.createElement('section');overlay.className='gifted-entry';overlay.setAttribute('aria-label','資優自然課本作業');
  const back=document.createElement('button');back.type='button';back.textContent='返回聯絡簿';
  back.onclick=async()=>{if(session.readOnly){close(false);return;}const ok=await root.swalConfirm('返回聯絡簿','尚未送出的答案會保留在此裝置，下次可繼續填寫。');if(ok)close(false);};
  frame=document.createElement('iframe');frame.title='資優自然課本作業';
  const url=new URL('gifted/index.html',location.href);url.searchParams.set('v','20261012-auto-retry');url.searchParams.set('plan',assignment.planId);url.searchParams.set('segment',assignment.segmentId);
  overlay.append(back,frame);document.body.append(overlay);document.body.classList.add('gifted-entry-open');frame.src=url.href;back.focus();
  unsubscribe=auth.onAuthStateChanged(next=>{if(next?.uid!==owner)close(true);});
  return true;
 }
 // 不記住裝置時，登入僅存在此頁；原生作業在同頁開啟，避免新分頁要求重登。
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download'))return;
  const assignment=assignmentFromHref(link.href);
  if(assignment&&openAssignment(assignment))event.preventDefault();
 });
 function getTransport(caller){
  if(!frame||frame.contentWindow!==caller||!owner||auth.currentUser?.uid!==owner)throw Error('LOGIN_REQUIRED');
  const uid=owner,epoch=generation,endpoint=config.studentApi;
  function valid(){if(epoch!==generation||owner!==uid||auth?.currentUser?.uid!==uid)throw Error('LOGIN_REQUIRED');}
  const preview=studentSession.studentPreview;
  return Object.freeze({sessionUid:uid,studentName,readOnly:studentSession.readOnly,studentPreview:preview,
   activity(){valid();root.markEbookGodSessionActivity?.();},
   async confirmWrite(action){valid();if(!preview)return true;const ok=await root.confirmStudentPreviewAction(action==='requestCorrection'?'送出正式答案更正申請':action==='draft'?'儲存作業草稿':'提交本週作業並登記正式成績');valid();return ok;},
   async request(body){
   if(studentSession?.readOnly&&!['task','receipt','result','summary'].includes(body.action))throw Error('TEACHER_VIEW_READ_ONLY');
   valid();const token=await auth.currentUser.getIdToken();valid();
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   const value=await response.json();valid();
   if(!response.ok)throw Error(value.error||'連線失敗');return value;
  }});
 }
 root.GiftedEbook={ready,close,getTransport};
})(window);
