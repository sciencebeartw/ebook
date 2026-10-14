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
            const sw=new EventTarget();sw.getRegistration=async()=>null;
            Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});
            Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>{}});
            window.__calls=[];window.__fail=false;
            window.__state={eligible:true,mode:'all',ready:true,registered:true,approved:true,enabled:true,approvedDeviceCount:2,deviceCode:'TESTONLY',businessEnabled:true,preferences:{},kinds:{post:'聯絡簿',bulletin:'公告',message:'老師留言／回覆',sticker:'棒卡審核',makeup:'補考結果',grade:'課後成績',homework:'作業催繳'},items:[],count:0,version:1,recipient:'a'.repeat(64),...options.state};
            window.__options={subject:'science',uid:'preview-only',session:{studentName:'測試學生',rememberDevice:true},call:async d=>{__calls.push(d);if(d.action==='preferences'){await new Promise(r=>setTimeout(r,60));if(__fail)throw new Error('網路暫時無法連線');Object.assign(__state.preferences,d.preferences);}else if(d.action==='pause'){__state.enabled=false;}else if(d.action!=='status')throw new Error('不允許的展示操作：'+d.action);return structuredClone(__state);}};
        },options);
        await page.addScriptTag({url:base+'ebook_push_app.js'});
        await page.evaluate(async()=>{await EbookPush.ready(__options);await EbookPush.open();document.querySelector('.ep-settings').open=true;await document.fonts.ready;});
    };
    for(const width of [320,360,390,430,768,1024]){
        await mount({width});
        check(await page.evaluate(()=>{const d=document.querySelector('.ep-dialog');return d.scrollWidth<=d.clientWidth&&document.documentElement.scrollWidth<=innerWidth;}),'無橫向溢出 '+width);
        check(await page.locator('.ep-preference-row').count()===7&&await page.locator('[role="switch"]').count()===5&&await page.locator('.ep-fixed').count()===2,'兩類必接收與五類開關 '+width);
        check(await page.locator('.ep-pilot').evaluate(e=>!e.open)&&await page.locator('.ep-guide').evaluate(e=>!e.open),'工具和教學預設收合 '+width);
    }
    await mount();
    check(await page.locator('.ep-state-title').textContent()==='通知已開啟','iPhone 已授權狀態');
    check((await page.locator('.ep-preferences').textContent()).includes('包含緊急公告'),'公告清楚說明緊急通知');
    check((await page.locator('.ep-preference-row > span:first-child').allTextContents()).slice(0,2).join('|')==='公告包含緊急公告|作業催繳','前兩項固定為公告與作業催繳');
    await page.locator('[data-ep-preference="grade"]').uncheck();
    await page.waitForFunction(()=>document.querySelector('.ep-save').textContent==='已儲存');
    check(await page.evaluate(()=>__state.preferences.grade===false&&__calls.filter(x=>x.action==='preferences').length===1),'單一類型單次儲存');
    await page.locator('[data-ep-preference="message"]').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>__state.preferences.message===false);
    check(await page.locator('[data-ep-preference="message"]').isChecked()===false,'鍵盤可切換類型');
    check(await page.locator('[data-ep-preference="message"]').evaluate(e=>document.activeElement===e),'儲存後保留鍵盤焦點');
    await page.evaluate(()=>__fail=true);
    await page.locator('[data-ep-preference="sticker"]').uncheck();
    await page.waitForFunction(()=>document.querySelector('.ep-save').textContent==='未儲存');
    check(await page.locator('[data-ep-preference="sticker"]').isChecked()&&(await page.locator('.ep-error').textContent()).includes('網路'),'儲存失敗保留原設定並顯示錯誤');
    await mount({state:{preferences:{bulletin:false,homework:false}}});
    check(await page.locator('.ep-fixed').count()===2&&await page.locator('[data-ep-preference="homework"]').count()===0&&await page.locator('[data-ep-preference="bulletin"]').count()===0,'舊關閉值不使必接收項目變成可選');
    await mount({state:{enabled:false}});
    check(await page.locator('[data-ep="enable"]').isVisible()&&await page.locator('.ep-state-title').textContent()==='通知已暫停','暫停可重新開啟');
    await mount();await page.locator('[data-ep="pause"]').click();
    await page.waitForFunction(()=>document.querySelector('.ep-state-title').textContent==='通知已暫停');
    check(await page.evaluate(()=>__calls.filter(x=>x.action==='pause').length===1),'裝置暫停沿用單次原 API');
    await mount({installed:false});
    check(await page.locator('.ep-state-title').textContent()==='先加入主畫面'&&await page.locator('[data-ep="enable"]').isHidden()&&await page.locator('[data-ep="help"]').isVisible(),'iPhone 一般分頁先提示加入主畫面');
    const android='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
    await mount({ua:android,installed:false,state:{registered:false,enabled:false}});
    check(await page.locator('[data-ep="enable"]').isEnabled(),'Android Chrome 不強制加入主畫面');
    await page.locator('.ep-guide summary').click();
    check(await page.locator('[data-id="android"]').getAttribute('aria-pressed')==='true'&&(await page.locator('.ep-guide-content').textContent()).includes('Chrome'),'Android 自動顯示 Chrome 教學');
    await page.locator('[data-id="ios"]').click();
    check((await page.locator('.ep-guide-content').textContent()).includes('Safari'),'可切換另一種裝置教學');
    await mount({ua:android,permission:'denied'});
    check(await page.locator('.ep-state-title').textContent()==='通知已被手機關閉','Android 封鎖權限不誤報開啟');
    await page.locator('[data-ep="help"]').click();
    check(await page.locator('.ep-guide').evaluate(e=>e.open)&&(await page.locator('.ep-guide-content').textContent()).includes('頁面資訊 → 權限 → 通知'),'封鎖狀態導向 Android 恢復步驟');
    await mount({ua:android+' Line/14.0'});
    check(await page.locator('.ep-state-title').textContent()==='請用瀏覽器開啟'&&await page.locator('[data-ep="enable"]').isHidden(),'LINE 內開引導外部瀏覽器');
    await mount({ua:android,unsupported:true});
    check((await page.locator('.ep-state-detail').textContent()).includes('Chrome'),'Android 不支援時不誤導去 iPhone 主畫面');
    await mount({state:{approved:false}});
    check(!(await page.locator('.ep-test-device').textContent()).includes('TESTONLY')&&await page.locator('[data-ep="enable"]').isEnabled()&&await page.locator('.ep-state-title').textContent()==='請重新開啟通知','舊待審裝置可重新開啟且不顯示核對碼');
    await mount();
    await page.evaluate(()=>EbookPush.ready({...__options,session:{studentName:'一般家長'}}));
    check(await page.locator('#ebookPushEntry').isVisible(),'一般家長依伺服器開放範圍顯示通知入口');
    await page.evaluate(async()=>{
        window.__beforePreview=__calls.length;window.__deviceEffects=[];
        window.__savedBinding=JSON.stringify({uid:'another-student',subject:'math',deviceId:'b'.repeat(64)});
        localStorage.setItem('sciencebear.ebook.push.v1:device',__savedBinding);
        navigator.serviceWorker.getRegistration=async()=>{__deviceEffects.push('registration');return null;};
        navigator.clearAppBadge=async()=>{__deviceEffects.push('badge');};
        Notification.requestPermission=async()=>{__deviceEffects.push('permission');return 'granted';};
        await EbookPush.ready({...__options,preview:true,session:{},uid:undefined});
    });
    check(await page.locator('#ebookPushEntry').isVisible(),'行政預覽沒有學生登入憑證也顯示通知入口');
    check(await page.locator('#ebookPushEntry').getAttribute('aria-label')==='通知（學生視角預覽）','入口標示學生視角預覽');
    await page.locator('#ebookPushEntry').click();
    check(await page.locator('.ep-preview-dialog').isVisible()&&(await page.locator('.ep-preview-note').textContent()).includes('目前是管理員預覽'),'點鈴鐺顯示清楚的管理員預覽說明');
    check(await page.locator('.ep-preview-dialog [data-ep], .ep-preview-dialog input, .ep-preview-dialog .ep-log').count()===0,'預覽不提供註冊、測試發送、偏好修改或假通知清單');
    check(await page.locator('.ep-preview-dialog [data-preview-guide="ios"]').getAttribute('aria-pressed')==='true','預覽依裝置顯示 iPhone 教學');
    await page.locator('[data-preview-guide="android"]').click();
    check((await page.locator('.ep-preview-dialog .ep-guide-content').textContent()).includes('Chrome'),'預覽可切換 Android 教學');
    await page.locator('[data-preview-guide="ios"]').click();
    for(const size of [{width:320,height:568},{width:390,height:844},{width:820,height:1180},{width:568,height:320}]){
        await page.setViewportSize(size);
        check(await page.evaluate(()=>{const d=document.querySelector('.ep-preview-dialog'),b=d.querySelector('.ep-body');b.scrollTop=b.scrollHeight;const close=d.querySelector('.ep-close').getBoundingClientRect();return d.scrollWidth<=d.clientWidth&&b.scrollWidth<=b.clientWidth&&b.scrollTop+b.clientHeight>=b.scrollHeight-2&&close.top>=0&&close.bottom<=innerHeight;}),'預覽無橫向溢出、教學底部可達、關閉可見 '+size.width+'x'+size.height);
    }
    await page.evaluate(()=>EbookPush.open('a'.repeat(64)));
    check(await page.evaluate(()=>__calls.length===__beforePreview&&__deviceEffects.length===0&&localStorage.getItem('sciencebear.ebook.push.v1:device')===__savedBinding),'預覽與通知點擊不讀寫 API、不動裝置權限與原綁定');
    await page.evaluate(()=>EbookPush.beforeLogout());
    check(await page.locator('.ep-preview-dialog').isHidden()&&await page.locator('#ebookPushEntry').isHidden(),'離開預覽收起入口與視窗');
    check(await page.evaluate(()=>__calls.length===__beforePreview&&__deviceEffects.length===0&&localStorage.getItem('sciencebear.ebook.push.v1:device')===__savedBinding),'預覽登出保留原裝置綁定');
    await page.evaluate(async()=>{localStorage.removeItem('sciencebear.ebook.push.v1:device');await EbookPush.ready(__options);await EbookPush.open();});
    check(await page.locator('.ep-dialog:not(.ep-preview-dialog)').isVisible()&&await page.locator('.ep-preview-dialog').isHidden(),'切回學生登入恢復正常通知中心');
    await mount();await page.emulateMedia({reducedMotion:'reduce'});
    check(await page.locator('.ep-switch-track').first().evaluate(e=>getComputedStyle(e).transitionDuration)==='0s','減少動態效果');
    await page.emulateMedia({reducedMotion:'no-preference'});
    check(errors.length===0,'無 JavaScript 錯誤');
    return {passed:checks.length,checks};
}
