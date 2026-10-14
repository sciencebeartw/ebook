// Playwright CLI run-code --filename tools/ebook_push_navigation_browser_check.js
// 在本機 /ebook_push.css 同源空頁執行；只用合成狀態，不登入、不接 Firebase。
async (page) => {
    const base = await page.evaluate(()=>new URL('./',location.href).href);
    const html = await (await page.request.get(base+'index.html')).text();
    const navigationAdapters = html.slice(html.indexOf('        function getEbookPushNavigationContext()'),html.indexOf('        function switchTab(idx)',html.indexOf('        function getEbookPushNavigationContext()')));
    const launch = html.match(/<script id="ebook-push-launch">([\s\S]*?)<\/script>/)[1];
    const results=[], errors=[];page.on('pageerror', e=>errors.push(e.message));
    const check=(ok,msg)=>{if(!ok)throw new Error(msg);results.push(msg);};
    const mount=async()=>{
        await page.goto(base+'ebook_push.css');
        await page.setViewportSize({width:390,height:740});
        await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:sans-serif}.sticky-wrapper{position:sticky;top:0;height:50px;background:white;z-index:2}.gap{height:950px}.item{padding:12px;min-height:65px;border:1px solid green;margin:8px}.feedback-thread-replies[hidden]{display:none}.ep-dialog{max-width:350px;max-height:85vh}#emergencyModal{display:none;position:fixed;inset:50px 0 0;background:white;z-index:5}</style></head><body><button id="ebookPushEntry" hidden>通知</button><main id="main-screen"><nav class="sticky-wrapper">聯絡簿｜成績｜公告｜待完成</nav><div id="tab-content-0"><div class="gap"></div><article class="item" data-post-id="post1" data-post-date="2026/10/11" data-source-class-key="班級"><div class="post-header">聯絡簿內容</div><div class="gap"></div><section data-feedback-thread-id="parent1"><div class="item" data-feedback-key="parent1" data-feedback-role="student">家長留言</div><button class="feedback-thread-toggle" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');this.nextElementSibling.hidden=false">展開回覆</button><div class="feedback-thread-replies" hidden><div class="item" data-feedback-key="reply1" data-feedback-role="teacher">老師回覆</div></div></section><div class="item" data-feedback-key="sticker1">棒卡核准紀錄</div></article></div><div id="tab-content-1" style="display:none"><div class="gap"></div><div class="item score-card" data-pending-exam-anchor="1" data-exam-id="exam1" data-source-class-key="班級">成績 80 分、補考結果</div></div><div id="tab-content-2" style="display:none"><div class="gap"></div><article class="item" data-push-bulletin-id="bulletin1" data-source-class-key="班級">公告內容</article></div><div id="tab-content-3" style="display:none"><div class="pending-page-summary item">待完成項目</div></div><div class="gap"></div></main><div id="emergencyModal"><div class="item" id="emergencyContent">緊急公告內容</div></div></body></html>`);
        await page.evaluate(()=>{
            window.__calls=[];window.__badges=[];window.__version=1;window.__items=[];window.__delayStatus=0;window.__failRead=false;window.__failStatus=false;window.__openDelay=0;window.__unavailable=false;window.__readDelay=0;
            window.__settingsOpenings=0;
            const showModal=HTMLDialogElement.prototype.showModal;
            HTMLDialogElement.prototype.showModal=function(){if(this.classList.contains('ep-dialog'))__settingsOpenings++;return showModal.call(this);};
            localStorage.clear();sessionStorage.clear();
            window.__sw=new EventTarget();__sw.getRegistration=async()=>({active:{postMessage:data=>__badges.push(data.count)}});
            Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:__sw});
            Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async n=>__badges.push(n)});
            Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>__badges.push(0)});
            window.gData={className:'班級',bulletins:[{id:'popup1',className:'班級'}]};window.isStudentPreviewMode=false;window.isDashboardDraftPreviewMode=false;window.ebookGodSessionInfo=null;
            window.pendingTasksState={status:'ready'};window.popupAnnouncementQueue=[];window.activeEmergencyAnnouncement=null;window.pendingEntryReminderHandled=false;
            window.safeKey=v=>String(v).replace(/[.#$[\]]/g,'-');window.isBulletinEffective=()=>true;
            window.hideEmergencyModal=()=>{document.querySelector('#emergencyModal').style.display='none';activeEmergencyAnnouncement=null;};
            window.showNextPopupAnnouncement=()=>{activeEmergencyAnnouncement=popupAnnouncementQueue.shift();document.querySelector('#emergencyModal').style.display='block';return !!activeEmergencyAnnouncement;};
            window.toggleCard=n=>n.classList.add('active');
            window.switchTab=i=>{for(let j=0;j<4;j++)document.querySelector('#tab-content-'+j).style.display=i===j?'block':'none';window.scrollTo(0,0);};
            window.__snapshot=()=>({recipient:'b'.repeat(64),eligible:true,mode:'test_only',ready:true,enabled:true,registered:true,approved:true,businessEnabled:true,kinds:{},items:structuredClone(__items),count:__items.filter(i=>!i.readAt).length,version:__version});
            window.__api=async data=>{__calls.push(data.action+':'+(data.notificationId||''));if(data.action==='status'){const value=__snapshot();await new Promise(r=>setTimeout(r,__delayStatus));if(__failStatus)throw new Error('status離線');return value;}if(data.action==='open'){await new Promise(r=>setTimeout(r,__openDelay));if(__unavailable)throw new Error('内容已移除');const item=__items.find(i=>i.id===data.notificationId);return {type:item.type,target:item.target};}if(data.action==='read'){if(__failRead)throw new Error('已讀暫時離線');__items.find(i=>i.id===data.notificationId).readAt=Date.now();__version++;const result={count:__items.filter(i=>!i.readAt).length,version:__version};await new Promise(r=>setTimeout(r,data.notificationId.startsWith('1')?__readDelay:0));return result;}throw new Error('Unexpected API '+data.action);};
            window.__setItems=items=>{__items=items.map((t,i)=>({id:(i+1).toString(16).repeat(64),createdAt:Date.now(),status:'accepted',readAt:null,title:t.kind,type:t.kind,target:t}));};
        });
        await page.addScriptTag({content:await (await page.request.get(base+'ebook_push_navigation.js')).text()});
        await page.addScriptTag({content:launch});
        await page.addScriptTag({content:navigationAdapters});
        await page.addScriptTag({content:await (await page.request.get(base+'ebook_push_app.js')).text()});
        await page.evaluate(()=>{
            window.__ready=()=>EbookPush.ready({uid:'synthetic-user',subject:'science',session:{studentName:'系統測試生'},preview:false,call:__api,navigate:openEbookPushTarget,findTarget:t=>EbookPushNavigation.find(t,getEbookPushNavigationContext()),isReadable:EbookPushNavigation.readable});
            window.__click=id=>__sw.dispatchEvent(new MessageEvent('message',{data:{kind:'ebook_push_click',notificationId:id}}));
        });
    };
    const targets=[{kind:'post',id:'post1'},{kind:'bulletin',id:'bulletin1'},{kind:'message',id:'reply1',date:'2026/10/11'},{kind:'sticker',id:'sticker1',date:'2026/10/11'},{kind:'grade',id:'exam1'},{kind:'makeup',id:'exam1'},{kind:'homework'}].map(t=>({...t,classKey:'班級'}));
    for(const target of targets){
        await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();await EbookPush.open(__items[0].id);},target);
        const r=await page.evaluate(()=>({read:!!__items[0].readAt,badge:__badges.at(-1),open:document.querySelector('.ep-dialog').open,visible:!!EbookPushNavigation.find(__items[0].target,getEbookPushNavigationContext())}));
        check(r.read&&r.badge===0&&!r.open&&r.visible,'七類點入與已讀：'+target.kind);
        check(await page.evaluate(()=>__settingsOpenings===0),'整段導頁不曾顯示設定：'+target.kind);
    }
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__openDelay=600;__click(__items[0].id);},targets[2]);
    await page.waitForTimeout(200);
    check(await page.evaluate(()=>!document.querySelector('.ep-dialog').open&&__settingsOpenings===0&&!__items[0].readAt),'背景通知等待來源時不閃設定、不提前已讀');
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>__settingsOpenings===0&&__badges.at(-1)===0),'背景通知完成定位與已讀，全程不開設定');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();await EbookPush.open();},targets[2]);
    check(await page.evaluate(()=>document.querySelector('.ep-dialog').open&&__settingsOpenings===1),'主動按鈴鐺仍開啟設定');
    await page.evaluate(()=>{__openDelay=400;__click(__items[0].id);});
    check(await page.evaluate(()=>!document.querySelector('.ep-dialog').open&&__settingsOpenings===1),'設定已開啟時點通知立即關閉設定');
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>__settingsOpenings===1&&__badges.at(-1)===0),'從設定轉入內容不重開設定');
    await mount();await page.evaluate(async()=>{__setItems([{kind:'test'}]);await __ready();await EbookPush.open(__items[0].id);});
    check(await page.evaluate(()=>document.querySelector('.ep-dialog').open&&__settingsOpenings===1&&!!__items[0].readAt),'純連線測試仍顯示設定並記已讀');
    await mount();await page.evaluate(async()=>{__setItems([{kind:'bulletin',id:'popup1',classKey:'班級'}]);await __ready();await EbookPush.open(__items[0].id);});
    check(await page.evaluate(()=>!!__items[0].readAt&&activeEmergencyAnnouncement.id==='popup1'),'僅彈窗公告直接顯示');
    await mount();await page.evaluate(async targets=>{__setItems([targets[2],targets[1]]);await __ready();document.querySelector('.feedback-thread-toggle').click();const node=EbookPushNavigation.find(__items[0].target,getEbookPushNavigationContext());window.scrollTo(0,node.getBoundingClientRect().top+scrollY-70);},targets);
    await page.waitForFunction(()=>__items[0].readAt,null,{timeout:5000});
    check(await page.evaluate(()=>!__items[1].readAt&&__badges.at(-1)===1),'自行閱讀留言只減該則、保留其他未讀');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();const n=document.querySelector('[data-feedback-thread-id]');window.scrollTo(0,n.getBoundingClientRect().top+scrollY-65);},targets[2]);
    await page.waitForTimeout(1300);check(await page.evaluate(()=>!__items[0].readAt),'摺疊回覆不可誤標已讀');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__failRead=true;await EbookPush.open(__items[0].id);},targets[2]);
    check(await page.evaluate(()=>!__items[0].readAt&&__badges.at(-1)===1),'已讀斷線保留數字與待同步記錄');
    await page.evaluate(()=>{__failRead=false;window.dispatchEvent(new Event('online'));});await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>__badges.at(-1)===0),'恢復網路補記已讀');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__delayStatus=500;EbookPush.open();setTimeout(()=>__click(__items[0].id),50);},targets[2]);
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>__calls.filter(x=>x.startsWith('read:')).length===1),'設定查詢忙碌時點通知不遺失、不重複已讀');
    await mount();await page.evaluate(async target=>{__setItems([target]);sessionStorage.setItem('sciencebear.ebook.push.v1:science:click',__items[0].id);await __ready();},targets[1]);
    check(await page.evaluate(()=>!!__items[0].readAt&&!sessionStorage.getItem('sciencebear.ebook.push.v1:science:click')),'登入前點擊保留到準備完成');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__failStatus=true;await EbookPush.open(__items[0].id);},targets[2]);
    check(await page.evaluate(()=>!!__items[0].readAt&&__badges.at(-1)===0),'已讀成功不依賴第二次狀態查詢');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__delayStatus=600;window.dispatchEvent(new Event('online'));setTimeout(()=>EbookPush.open(__items[0].id),30);},targets[2]);
    await page.waitForFunction(()=>__items[0].readAt);await page.waitForTimeout(800);
    check(await page.evaluate(()=>__badges.at(-1)===0),'延遲舊status不復活數字');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__unavailable=true;await EbookPush.open(__items[0].id);},targets[2]);
    check(await page.evaluate(()=>!__items[0].readAt&&document.querySelector('.ep-error').textContent.includes('移除')),'來源移除保留未讀並顯示錯誤');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();const n=document.querySelector('[data-feedback-key="reply1"]');n.dataset.feedbackKey='wait';setTimeout(()=>n.dataset.feedbackKey='reply1',500);await EbookPush.open(__items[0].id);},targets[2]);
    check(await page.evaluate(()=>!!__items[0].readAt),'內容晚到時等待目標再已讀');
    await mount();await page.evaluate(async target=>{__setItems([{...target,id:'parent1'}]);await __ready();const n=document.querySelector('[data-feedback-key="parent1"]');window.scrollTo(0,n.getBoundingClientRect().top+scrollY-65);},targets[2]);
    await page.waitForTimeout(1200);check(await page.evaluate(()=>!__items[0].readAt),'舊回覆通知指向家長原文時不會提前已讀');
    await page.evaluate(async()=>{document.querySelector('.feedback-thread-replies').insertAdjacentHTML('afterbegin','<div class="gap"></div>');await EbookPush.open(__items[0].id);});
    check(await page.evaluate(()=>!!__items[0].readAt&&EbookPushNavigation.readable(document.querySelector('[data-feedback-key="reply1"]'))),'長討論串展開並捲到老師回覆');
    await mount();await page.evaluate(async target=>{__setItems([target]);history.replaceState(null,'','?pushNotice='+__items[0].id);await __ready();},targets[1]);
    check(await page.evaluate(()=>!!__items[0].readAt&&!new URL(location.href).searchParams.has('pushNotice')&&__settingsOpenings===0),'冷啟動URL完成導頁後才清除、全程不開設定');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();document.querySelector('[data-push-bulletin-id]').dataset.sourceClassKey='全校';await EbookPush.open(__items[0].id);},targets[1]);
    check(await page.evaluate(()=>!!__items[0].readAt),'全校公告亦能從本班通知開啟');
    await mount();await page.evaluate(async()=>{__setItems([{kind:'bulletin',id:'popup1',classKey:'班級'}]);await __ready();popupAnnouncementQueue=[gData.bulletins[0]];showNextPopupAnnouncement();});
    await page.waitForFunction(()=>__items[0].readAt);check(await page.evaluate(()=>__badges.at(-1)===0),'自行閱讀緊急公告彈窗會記已讀');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();switchTab(1);const n=document.querySelector('[data-pending-exam-anchor]');window.scrollTo(0,n.getBoundingClientRect().top+scrollY-65);},targets[4]);
    await page.waitForTimeout(1200);check(await page.evaluate(()=>!__items[0].readAt),'成績卡僅標題可見時不算讀取內容');
    await page.evaluate(()=>document.querySelector('[data-pending-exam-anchor]').classList.add('active'));
    await page.waitForFunction(()=>__items[0].readAt);check(await page.evaluate(()=>__badges.at(-1)===0),'自行展開成績卡會記已讀');
    await mount();await page.evaluate(async targets=>{__setItems([targets[2],targets[1]]);await __ready();__openDelay=200;EbookPush.open(__items[0].id);setTimeout(()=>__click(__items[1].id),40);},targets);
    await page.waitForFunction(()=>__items.every(i=>i.readAt));check(await page.evaluate(()=>__badges.at(-1)===0&&__calls.filter(x=>x.startsWith('read:')).length===2),'連點兩則通知皆完成且不重複讀取');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__openDelay=200;EbookPush.open(__items[0].id);setTimeout(()=>EbookPush.ready({uid:'another-user',subject:'science',session:{studentName:'一般家長'},preview:false,call:__api}),40);},targets[2]);
    await page.waitForTimeout(500);check(await page.evaluate(()=>!__items[0].readAt&&__calls.every(x=>!x.startsWith('read:'))),'切換身分取消舊通知導頁和已讀');
    for(const width of [320,768]){
        await mount();await page.setViewportSize({width,height:850});await page.evaluate(async target=>{__setItems([target]);await __ready();await EbookPush.open(__items[0].id);},targets[2]);
        check(await page.evaluate(()=>!!__items[0].readAt&&document.documentElement.scrollWidth<=innerWidth),'手機與iPad導頁無橫向溢出：'+width);
    }
    await mount();await page.evaluate(async target=>{__setItems([target,target]);await __ready();__readDelay=400;document.querySelector('.feedback-thread-toggle').click();const n=EbookPushNavigation.find(target,getEbookPushNavigationContext());window.scrollTo(0,n.getBoundingClientRect().top+scrollY-65);},targets[2]);
    await page.waitForFunction(()=>__items.every(i=>i.readAt));await page.waitForTimeout(900);
    check(await page.evaluate(()=>__badges.at(-1)===0&&__calls.filter(x=>x.startsWith('read:')).length===2),'同畫面兩則已讀回應亂序仍歸零且不重送');
    await mount();await page.evaluate(async target=>{__setItems([target]);await __ready();__delayStatus=1800;EbookPush.open();},targets[2]);
    check(await page.evaluate(()=>!document.querySelector('.ep-notice-open').disabled&&document.querySelector('.ep-feed-refresh').textContent==='更新中…'),'背景更新時通知文字不變灰、可立即點擊');
    await page.locator('.ep-notice-open').click();
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>__calls.filter(x=>x.startsWith('open:')).length===1),'清單背景更新尚未完成也能開始導頁');
    await mount();await page.evaluate(target=>{__setItems([target]);__delayStatus=500;__openDelay=500;__ready();setTimeout(()=>__click(__items[0].id),40);},targets[2]);
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>!EbookPushLaunch.current()&&document.querySelector('.ep-navigation-progress').hidden),'初始化期間收到推播不遺失，完成後清除進度提示');
    for (const width of [320,390,768]) {
        await mount();await page.addStyleTag({url:base+'ebook_push.css'});await page.setViewportSize({width,height:844});
        await page.evaluate(async target=>{__setItems([target]);await __ready();await EbookPush.open();__openDelay=1200;},targets[2]);
        await page.locator('.ep-notice-open').click();
        check(await page.evaluate(()=>{
            const p=document.querySelector('.ep-navigation-progress'),r=p.getBoundingClientRect(),s=p.querySelector('span');
            return !p.hidden&&!document.querySelector('.ep-dialog').open&&!__items[0].readAt&&Math.abs(r.x+r.width/2-innerWidth/2)<2&&Math.abs(r.y+r.height/2-innerHeight/2)<2&&r.left>=16&&r.right<=innerWidth-16&&s.getBoundingClientRect().width===40&&getComputedStyle(s).animationName==='ep-progress-spin';
        }),width+'：點通知列當下即顯示中央40px轉圈圈，API等待期間不提前已讀');
        if(width===390)await page.screenshot({path:'/private/tmp/ebook-push-progress-20261014/loading-'+page.context().browser().browserType().name()+'.png'});
        if(width===320){
            await page.emulateMedia({reducedMotion:'reduce'});
            check(await page.evaluate(()=>getComputedStyle(document.querySelector('.ep-navigation-progress>span')).animationName==='none'),'減少動態效果時保留文字提示、停止旋轉');
            await page.emulateMedia({reducedMotion:'no-preference'});
        }
        await page.waitForFunction(()=>__items[0].readAt);
        check(await page.evaluate(()=>document.querySelector('.ep-navigation-progress').hidden),width+'：抵達通知內容後轉圈圈消失');
    }
    await mount();await page.addStyleTag({url:base+'ebook_push.css'});
    await page.evaluate(async target=>{__setItems([target]);await __ready();popupAnnouncementQueue=[gData.bulletins[0]];showNextPopupAnnouncement();__openDelay=250;EbookPush.open(__items[0].id);},targets[2]);
    check(await page.evaluate(()=>document.querySelector('.ep-navigation-progress').classList.contains('is-waiting')&&getComputedStyle(document.querySelector('.ep-navigation-progress')).top!=='50%'),'API尚未回應時也尊重公告優先，不顯示中央載入卡');
    await page.waitForTimeout(600);
    check(await page.evaluate(()=>!!activeEmergencyAnnouncement&&!__items[0].readAt&&document.querySelector('.ep-navigation-progress').textContent.includes('提醒關閉後')),'公告優先顯示期間，通知在背景定位但不記已讀');
    await page.evaluate(()=>{hideEmergencyModal();document.body.insertAdjacentHTML('beforeend','<div class="swal2-container" style="position:fixed;inset:0;z-index:5000;background:white">待完成提醒</div>');});
    await page.waitForTimeout(400);
    check(await page.evaluate(()=>!__items[0].readAt),'待完成提醒接續顯示期間也不提前已讀');
    await page.screenshot({path:'/private/tmp/ebook-push-startup-20261014/waiting-'+page.context().browser().browserType().name()+'.png'});
    await page.evaluate(()=>{document.querySelector('.swal2-container').remove();switchTab(3);__dismissedAt=performance.now();});
    await page.waitForFunction(()=>__items[0].readAt);
    check(await page.evaluate(()=>performance.now()-__dismissedAt<800&&EbookPushNavigation.readable(document.querySelector('[data-feedback-key="reply1"]'))),'關閉提醒後800ms內露出通知內容並才記已讀');
    await mount();const scopes=await page.evaluate(targets=>targets.map(t=>EbookPushNavigation.find({...t,classKey:'別班'},getEbookPushNavigationContext())===null),targets);check(scopes.every(Boolean),'七類皆不跳往其他班同名資料');
    await page.screenshot({path:'/private/tmp/ebook-push-startup-20261014/flow-'+page.context().browser().browserType().name()+'.png'});
    check(errors.length===0,'無頁面JS例外');
    return {engine:page.context().browser().browserType().name(),passed:results.length,checks:results,errors};
}
