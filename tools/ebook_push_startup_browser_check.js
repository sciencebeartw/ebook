// Playwright CLI：實際入口的慢速腳本與啟動畫面銜接；不登入、不接資料庫。
async (browserPage) => {
    // 此測試會停止解析器並替換 Storage / SW；使用獨立 context，避免污染後續入口檢查。
    const context = await browserPage.context().browser().newContext();
    const page = await context.newPage();
    try {
    const base = 'http://127.0.0.1:8796/';
    const html = await (await page.request.get(base+'index.html')).text();
    const checks=[], check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
    const engine=page.context().browser().browserType().name();
    let release;
    const gate=new Promise(resolve=>release=resolve);
    await page.setViewportSize({width:390,height:844});
    await page.route('**/*',async route=>{
        const url=route.request().url();
        // 不回傳空的 SDK，避免 WebKit 在後續入口檢查重用模擬回應。
        if(!url.startsWith(base))return route.abort();
        if(url.includes('/assessment_labels.js')){await gate;return route.abort().catch(()=>{});}
        return route.continue();
    });
    await page.goto(base+'index.html?pushNotice='+'a'.repeat(64),{waitUntil:'commit'});
    await page.waitForFunction(()=>!!document.querySelector('#splash-status')&&!!window.EbookPushLaunch);
    check(await page.locator('#splash-status').isVisible(),'主要程式尚未載入也有清楚啟動畫面');
    check(await page.evaluate(()=>!window.EbookPush&&EbookPushLaunch.current()==='a'.repeat(64)),'Firebase與通知模組載入前已保留URL目的地');
    check(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor==='rgb(243, 250, 246)'),'頁面最初背景與啟動畫面一致');
    // 固定在尚未載入主要程式的畫面；避免截圖工具等待整份文件完成。
    await page.evaluate(()=>window.stop());
    release();
    await page.unrouteAll({behavior:'ignoreErrors'});
    // WebKit 的截圖會等待已停止文件的字型，該狀態以可見性斷言驗證；Chrome另留實際畫面。
    if(engine!=='webkit') await page.screenshot({path:'/private/tmp/ebook-push-startup-20261014/startup-'+engine+'.png',timeout:5000});
    await page.goto('about:blank');
    await page.goto(base+'ebook_push.css');
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="splash-screen" style="position:fixed;inset:0;background:#f3faf6">正在開啟</div><div id="appContainer" style="display:none">登入聯絡簿</div>');
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
    const detection=scripts.find(s=>s.includes('window.showApp = function'));
    await page.addScriptTag({content:detection});
    await page.evaluate(()=>showApp());
    check(await page.evaluate(()=>document.getElementById('appContainer').style.display==='block'&&document.getElementById('splash-screen').style.display!=='none'),'啟動畫面淡出前內容已顯示，沒有空白銜接');
    await page.waitForTimeout(650);
    check(await page.locator('#appContainer').isVisible()&&!await page.locator('#splash-screen').isVisible(),'淡出結束後登入畫面保持可見');
    const launch=scripts.find(s=>s.includes('window.EbookPushLaunch ='));
    await page.evaluate(()=>{
        localStorage.clear();sessionStorage.clear();
        window.__sw=new EventTarget();Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:__sw});
        Storage.prototype.setItem=function(){throw new Error('Storage blocked');};
        Storage.prototype.getItem=function(){throw new Error('Storage blocked');};
        Storage.prototype.removeItem=function(){throw new Error('Storage blocked');};
    });
    await page.addScriptTag({content:launch});
    check(await page.evaluate(async()=>{
        const ch=new MessageChannel();const received=new Promise(resolve=>ch.port1.onmessage=e=>{ch.port1.close();resolve(e.data.received);});
        __sw.dispatchEvent(new MessageEvent('message',{data:{kind:'ebook_push_click',notificationId:'b'.repeat(64),subject:'science'},ports:[ch.port2]}));
        return await received&&EbookPushLaunch.current()==='b'.repeat(64);
    }),'儲存被限制時仍可接住並確認推播，不依賴sessionStorage');
    check(await page.evaluate(()=>{
        __sw.dispatchEvent(new MessageEvent('message',{data:{kind:'ebook_push_click',notificationId:'c'.repeat(64),subject:'math'}}));
        __sw.dispatchEvent(new MessageEvent('message',{data:{kind:'ebook_push_click',notificationId:'invalid'}}));
        return EbookPushLaunch.current()==='b'.repeat(64);
    }),'拒絕不同科目與無效通知識別');
    check(await page.evaluate(()=>{EbookPushLaunch.clear('a'.repeat(64));return EbookPushLaunch.current()==='b'.repeat(64);}),'較早的完成回應不會清掉下一則通知');
    await page.goto(base+'ebook_push.css');
    return {engine,passed:checks.length,checks};
    } finally { await context.close(); }
}
