// Playwright CLI run-code --filename tools/ebook_push_settings_browser_check.js
// 本機同源空頁；合成裝置／API 狀態，絕不連正式資料庫或要求系統授權。
async (page) => {
    const base = await page.evaluate(() => new URL('./',location.href).href);
    await page.route(base+'ebook_push.css', route => route.request().resourceType()==='document' ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8">'}) : route.continue());
    const html = await (await page.request.get(base+'index.html')).text();
    const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(v=>v[0]).join('\n');
    let header = html.split('<div id="main-screen">')[1].split('<section id="ebookResourcePage"')[0];
    header = header.replace('id="headClass"></div>','id="headClass">小六資優自然週六上午班</div>').replace('id="headName"></div>','id="headName">測試學生</div>');
    const errors=[], checks=[];
    page.on('pageerror',e=>errors.push(e.message));
    const check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
    const mount=async(options={})=>{
        await page.goto(base+'ebook_push.css');
        await page.setViewportSize({width:options.width||390,height:options.height||844});
        await page.setContent(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link rel="stylesheet" href="${base}ebook_push.css"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet"></head><body><div class="app-container"><div id="main-screen" style="display:block">${header}</div></div></body></html>`);
        await page.evaluate(options=>{
            localStorage.clear();sessionStorage.clear();
            Object.defineProperty(navigator,'userAgent',{configurable:true,value:options.ua||'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
            Object.defineProperty(navigator,'standalone',{configurable:true,value:options.installed!==false});
            Object.defineProperty(window,'Notification',{configurable:true,value:{permission:options.permission||'granted',requestPermission:async()=>{throw new Error('不得要求真正系統權限');}}});
            Object.defineProperty(window,'PushManager',{configurable:true,value:function(){}});
            if(options.unsupported)delete window.PushManager;
            const sw=new EventTarget();sw.getRegistration=async()=>{if(options.blockedSW)throw new Error('SecurityError');return null;};
            Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});
            Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>{}});
            window.__calls=[];window.__fail=false;
            window.__state={eligible:true,mode:'all',ready:true,registered:true,approved:true,enabled:true,approvedDeviceCount:2,deviceCode:'TESTONLY',businessEnabled:true,preferences:{},kinds:{post:'聯絡簿',bulletin:'公告',message:'老師留言／回覆',sticker:'棒卡審核',makeup:'補考結果',grade:'課後成績',homework:'作業催繳'},items:[],count:0,version:1,recipient:'a'.repeat(64),...options.state};
            window.__navigations=[]; window.__options={navigate:async t=>{__navigations.push(t);return true;},subject:'science',uid:'preview-only',session:{studentName:'測試學生',rememberDevice:true},call:async d=>{__calls.push(d);if(d.action==='preferences'){await new Promise(r=>setTimeout(r,60));if(__fail)throw new Error('網路暫時無法連線');Object.assign(__state.preferences,d.preferences);}else if(d.action==='pause'){__state.enabled=false;}else if(d.action==='open'){const i=__state.items.find(i=>i.id===d.notificationId);return {type:i.type,target:i.target};}else if(d.action==='read'){__state.items.find(i=>i.id===d.notificationId).readAt=Date.now();__state.count=__state.items.filter(i=>!i.readAt).length;__state.version++;return {count:__state.count,version:__state.version};}else if(d.action!=='status')throw new Error('不允許的展示操作：'+d.action);return structuredClone(__state);}};
        },options);
        await page.addScriptTag({url:base+'ebook_push_app.js'});
        await page.evaluate(async()=>{await EbookPush.ready(__options);await EbookPush.open();await document.fonts.ready;});
    };

    const data=()=>({registered:false,enabled:false,approved:false,count:3,items:[
        {id:'1'.repeat(64),type:'post',title:'本週聯絡簿已發布',createdAt:Date.now()-60000,status:'available',readAt:1,target:{kind:'post',id:'p1'}},
        {id:'2'.repeat(64),type:'message',title:'老師有新的留言／回覆',createdAt:Date.now()-120000,status:'available',readAt:null,target:{kind:'message',id:'m1'}},
        {id:'3'.repeat(64),type:'bulletin',title:'山熊有一則新公告',createdAt:Date.now()-180000,status:'available',readAt:null,target:{kind:'bulletin',id:'b1'}},
        {id:'4'.repeat(64),type:'homework',title:'請查看最新待完成項目',createdAt:Date.now()-240000,status:'available',readAt:null,target:{kind:'homework'}}]});
    for(const width of [320,390,430,768,1024]) {
        await mount({width,state:data(),permission:'denied'});
        check(await page.locator('.ep-entry-dot').isVisible()&&await page.locator('.ep-entry-dot').textContent()==='3','拒絕手機權限仍有紅色未讀數 '+width);
        check(await page.locator('.ep-settings').evaluate(e=>!e.open),'設定預設收合 '+width);
        check(await page.locator('.ep-notice-row').count()===3,'預設只看未讀 '+width);
        check(await page.evaluate(()=>__calls.every(c=>c.action==='status')),'開通知中心不代讀／要求手機權限 '+width);
        check(await page.evaluate(()=>{const d=document.querySelector('.ep-dialog'),s=document.querySelector('.ep-settings').getBoundingClientRect();return d.scrollWidth<=d.clientWidth&&s.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;}),'設定底部可見且無溢出 '+width);
        if(width===390||width===768)await page.screenshot({path:'/private/tmp/ebook-inbox-20261014/center-'+width+'-'+page.context().browser().browserType().name()+'.png'});
    }
    await page.locator('.ep-filters [data-id="all"]').click();
    check(await page.locator('.ep-notice-row').count()===4&&(await page.locator('.ep-notice-row').last().textContent()).includes('本週聯絡簿'),'全部頁未讀排前、已讀留在後');
    await page.locator('.ep-filters [data-id="unread"]').click();
    await page.locator('.ep-mark').first().focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('.ep-filter-count').textContent==='2');
    check(await page.locator('.ep-entry-dot').textContent()==='2'&&await page.locator('.ep-notice-row').count()===2,'手動已讀立即減數與移除未讀列');
    check(await page.evaluate(()=>document.activeElement.matches('.ep-mark')),'手動已讀後保留下一筆鍵盤操作焦點');
    await page.locator('.ep-notice-open').first().click();
    await page.waitForFunction(()=>!document.querySelector('.ep-dialog').open);
    check(await page.evaluate(()=>__navigations.length===1&&__navigations[0].kind==='bulletin'&&__state.count===1),'整列點擊直接定位公告並已讀');
    await page.evaluate(()=>EbookPush.open());
    await page.locator('.ep-notice-open').click();
    await page.waitForFunction(()=>!document.querySelector('.ep-dialog').open);
    check(await page.evaluate(()=>__navigations.at(-1).kind==='homework'&&__state.count===0),'待完成沿用 homework 導頁');
    check(await page.locator('.ep-entry-dot').isHidden(),'讀完後紅點消失');
    await page.evaluate(()=>EbookPush.open());
    check((await page.locator('.ep-empty').textContent()).includes('通知都看完了'),'未讀清空有明確空狀態');
    await page.locator('.ep-empty [data-ep="filter"]').click();
    check(await page.locator('.ep-notice-row').count()===4,'已讀仍能從全部查看');
    await page.locator('.ep-settings>summary').click();
    check(await page.locator('.ep-device').isVisible(),'底部可展開設定');
    await page.locator('[data-ep="close"]').click();await page.evaluate(()=>EbookPush.open());
    check(await page.locator('.ep-settings').evaluate(e=>!e.open)&&await page.locator('.ep-filters [data-id="unread"]').getAttribute('aria-pressed')==='true','再次打開回到未讀、設定收合');
    await mount({width:390,height:844,state:{...data(),items:Array.from({length:40},(_,n)=>({...data().items[1],id:(n+1).toString(16).padStart(64,'0'),title:'老師的新留言：'+('請記得完成本週作業，'.repeat(5)),createdAt:Date.now()-n*60000})),count:40}});
    check(await page.locator('.ep-inbox').evaluate(e=>e.scrollHeight>e.clientHeight),'40則長文字獨立捲動');
    await page.locator('.ep-inbox').evaluate(e=>e.scrollTop=e.scrollHeight);
    check(await page.locator('.ep-settings>summary').isVisible(),'長列表捲到底仍能展開設定');
    await page.locator('.ep-settings>summary').click();
    check(await page.evaluate(()=>document.querySelector('.ep-settings').getBoundingClientRect().bottom<=innerHeight),'設定展開仍在視窗內');
    await mount({width:844,height:390,state:data()});
    await page.locator('.ep-settings>summary').click();
    check(await page.evaluate(()=>document.querySelector('.ep-dialog').scrollHeight<=document.querySelector('.ep-dialog').clientHeight+1),'手機橫向無外層裁切');
    await mount({width:390,unsupported:true,state:data(),permission:'default'});
    check(await page.locator('.ep-notice-row').count()===3&&await page.locator('.ep-entry-dot').isVisible(),'不支援手機推播仍可看站內通知');
    await mount({width:390,unsupported:true,blockedSW:true,state:data(),permission:'denied'});
    check(await page.locator('.ep-notice-row').count()===3&&await page.locator('.ep-entry-dot').textContent()==='3','SW被瀏覽器限制仍可查看站內未讀');
    await page.locator('[data-ep="close"]').click();
    await page.screenshot({path:'/private/tmp/ebook-inbox-20261014/bell-'+page.context().browser().browserType().name()+'.png'});
    check(errors.length===0,'無 JavaScript 錯誤');
    return {passed:checks.length,checks};
}
