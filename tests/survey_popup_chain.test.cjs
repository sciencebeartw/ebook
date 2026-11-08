'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('        function maybeShowPendingEntryReminder()');
const pending=html.slice(start,html.indexOf('        // ★★★ 即時監聽生命週期管理',start));
const parent=fs.readFileSync(path.join(__dirname,'../ebook_surveys_parent.js'),'utf8');
async function fixture({answered=false,snoozed=false,lateList=false}={}){
    let container=false,options,resolveAlert,resolveList,modalCount=0,requestCount=0;
    const listeners={},storage=new Map(),tabs=[];
    const c={console,Date,Event,
        pendingEntryNoticeReady:true,pendingEntryReminderHandled:false,
        pendingTasksState:{policy:{},items:[{}]},activeEmergencyAnnouncement:null,
        isAdminMode:false,isDashboardDraftPreviewMode:false,gData:{pendingPolicy:{}},
        pendingReminderShownSessionIdentity:'',getPendingReminderDeliveryIdentity:()=> 'qa',
        wasPendingReminderShownInBrowserSession:()=>false,markPendingReminderShownInBrowserSession(){},
        switchTab:n=>tabs.push(n),
        localStorage:{getItem:k=>snoozed?'1':storage.get(k),setItem:(k,v)=>storage.set(k,v)},
        document:{getElementById:()=>null,querySelector:()=>null,
            addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:e=>listeners[e.type]?.()},
        swalAlert:(_title,_text,_icon,_label,opts)=>{
            container=true;options=opts;return new Promise(resolve=>resolveAlert=resolve);
        },
        window:{EBOOK_SURVEYS_ENABLED:true,EbookPendingTasks:{getEntryReminderItems:()=>[{}]},
            EbookSurveyContract:{esc:String},EbookSurveyView:{modal(){
                modalCount++;return {querySelector:()=>({}),close(){}};
            }}}
    };
    vm.createContext(c);vm.runInContext(parent+'\n'+pending,c);
    const list={surveys:[{id:'qa',title:'調查',answered,closed:false,remind:true}]};
    const config={identity:'qa',canRemind:()=>!container,request:async()=>{
        requestCount++;return lateList?new Promise(resolve=>resolveList=()=>resolve(list)):list;
    }};
    c.window.EbookSurveyParent.mount(config);c.maybeShowPendingEntryReminder();
    await Promise.resolve();
    return {c,tabs,config,get modals(){return modalCount;},get requests(){return requestCount;},
        click:async confirmed=>{resolveAlert({isConfirmed:confirmed});await Promise.resolve();},
        finishClose(){container=false;options.didClose?.();},
        finishList:async()=>{resolveList();await Promise.resolve();await Promise.resolve();}};
}
for(const confirmed of [true,false])test('前一彈窗'+(confirmed?'確認':'略過')+'後，等動畫完成才接續調查且不重讀清單',async()=>{
    const f=await fixture();assert.equal(f.modals,0);
    await f.click(confirmed);assert.equal(f.modals,0,'動畫期間不能跳出調查');
    f.finishClose();assert.equal(f.modals,1,'完全關閉後不能漏掉調查');
    f.c.document.dispatchEvent(new Event('ebook:popup-idle'));assert.equal(f.modals,1);
    assert.equal(f.requests,1);assert.deepEqual(f.tabs,confirmed?[3]:[]);
});
test('清單較晚載入仍可顯示調查',async()=>{
    const f=await fixture({lateList:true});await f.click(true);f.finishClose();
    assert.equal(f.modals,0);await f.finishList();assert.equal(f.modals,1);assert.equal(f.requests,1);
});
for(const reason of ['answered','snoozed'])test(reason+' 不因關閉其他彈窗而強制再提醒',async()=>{
    const f=await fixture({[reason]:true});await f.click(true);f.finishClose();assert.equal(f.modals,0);
});
test('同頁僅提醒一次；重新登入掛載後可再次提醒未填調查',async()=>{
    const f=await fixture();await f.click(true);f.finishClose();assert.equal(f.modals,1);
    f.c.window.EbookSurveyParent.maybeRemind();assert.equal(f.modals,1);
    f.c.window.EbookSurveyParent.mount(f.config);await new Promise(setImmediate);assert.equal(f.modals,2);
});
test('等關閉期間登出，不再彈出上一位學生的調查',async()=>{
    const f=await fixture();await f.click(true);f.c.window.EbookSurveyParent.reset();
    f.finishClose();assert.equal(f.modals,0);
});
