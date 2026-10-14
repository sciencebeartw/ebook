// Playwright CLI run-code --filename tools/ebook_push_settings_browser_check.js
// 本機同源空頁；合成裝置／API 狀態，絕不連正式資料庫或要求系統授權。
async (page) => {
    await page.unrouteAll();
    await page.goto("about:blank");
    const base='https://www.sciencebear.com.tw/ebook/', local='http://127.0.0.1:8796/ebook/';
    await page.route(base+'**',async route=>{
        const name=route.request().url().split('?')[0].split('/').pop();
        if(name==='ebook_push_messaging.mjs')return route.fulfill({contentType:'text/javascript',body:'export async function connect(){return "synthetic-browser-token";} export function disconnect(){}'});
        const response=await page.request.get(local+name);return route.fulfill({response});
    });
    await page.route(base+'ebook_push.css', route => route.request().resourceType()==='document' ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8">'}) : route.continue());
    const html = await (await page.request.get(local+'index.html')).text();
    const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(v=>v[0]).join('\n');
    let header = html.split('<div id="main-screen">')[1].split('<section id="ebookResourcePage"')[0];
    header = header.replace('id="headClass"></div>','id="headClass">小六資優自然週六上午班</div>').replace('id="headName"></div>','id="headName">系統測試生</div>');
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
            window.__state={eligible:true,mode:'test_only',ready:true,registered:true,approved:true,enabled:true,approvedDeviceCount:2,deviceCode:'TESTONLY',businessEnabled:true,preferences:{},kinds:{post:'聯絡簿',bulletin:'公告',message:'老師留言／回覆',sticker:'棒卡審核',makeup:'補考結果',grade:'課後成績',homework:'作業催繳'},items:[],count:0,version:1,recipient:'a'.repeat(64),...options.state};
            window.__options={subject:'science',uid:'preview-only',session:{studentName:'系統測試生',rememberDevice:true},call:async d=>{__calls.push(d);if(d.action==='preferences'){await new Promise(r=>setTimeout(r,60));if(__fail)throw new Error('網路暫時無法連線');Object.assign(__state.preferences,d.preferences);}else if(d.action==='pause'){__state.enabled=false;}else if(d.action!=='status')throw new Error('不允許的展示操作：'+d.action);return structuredClone(__state);}};
        },options);
        await page.addScriptTag({url:base+'ebook_push_app.js'});
        await page.evaluate(async()=>{await EbookPush.ready(__options);await EbookPush.open();document.querySelector('.ep-settings').open=true;await document.fonts.ready;});
    };

    async function setupEnrollment(options={}) {
        await mount({state:{registered:false,enabled:false,approved:false},...options});
        await page.evaluate(()=>{
            __permissionRequests=0;
            Notification.requestPermission=async()=>{__permissionRequests++;return 'granted';};
            navigator.serviceWorker.register=async()=>({active:{postMessage(){}},pushManager:{getSubscription:async()=>null}});
            navigator.serviceWorker.ready=Promise.resolve();
            const old=__options.call;
            __options.call=async d=>{
                if(d.action==='register'){__calls.push(d);Object.assign(__state,{registered:true,enabled:true,approved:true,deviceId:'b'.repeat(64),deviceCode:'TESTONLY',approvedDeviceCount:3});return structuredClone(__state);}
                if(d.action==='test'){__calls.push(d);return {notificationId:'c'.repeat(64)};}
                return old(d);
            };
        });
    }
    const android='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
    for(const options of [{ua:android,installed:false},{}]) {
        await setupEnrollment(options);
        await page.locator('[data-ep="enable"]').click();
        await page.waitForFunction(()=>document.querySelector('.ep-state-title').textContent==='通知已開啟');
        check(await page.evaluate(()=>__permissionRequests===1&&__calls.filter(c=>c.action==='register').length===1),'允許後直接註冊 '+(options.ua?'Android':'iPhone'));
        await page.locator('.ep-pilot summary').click();
        check(await page.locator('[data-ep="test"]').isEnabled()&&!(await page.locator('.ep-test-device').textContent()).includes('TESTONLY'),'無審核碼且立即可測試 '+(options.ua?'Android':'iPhone'));
        await page.locator('[data-ep="test"]').click();
        await page.waitForFunction(()=>document.querySelector('.ep-error').textContent.includes('測試已排定'));
        check(await page.evaluate(()=>__calls.filter(c=>c.action==='test').length===1),'直接建立測試請求 '+(options.ua?'Android':'iPhone'));
    }
    await setupEnrollment({ua:android,installed:false});
    await page.evaluate(()=>{Notification.requestPermission=async()=>{__permissionRequests++;return 'denied';};});
    await page.locator('[data-ep="enable"]').click();
    await page.waitForFunction(()=>document.querySelector('.ep-error').textContent.includes('尚未允許'));
    check(await page.evaluate(()=>!__calls.some(c=>c.action==='register'||c.action==='test')),'拒絕授權不註冊或傳送');
    await setupEnrollment({state:{registered:true,enabled:true,approved:false}});
    await page.locator('[data-ep="enable"]').click();
    await page.waitForFunction(()=>document.querySelector('.ep-state-title').textContent==='通知已開啟');
    check(await page.evaluate(()=>__calls.filter(c=>c.action==='register').length===1),'舊待審裝置重新開啟直接完成');
    check(errors.length===0,'無 JavaScript 錯誤');
    return {passed:checks.length,checks};
}
