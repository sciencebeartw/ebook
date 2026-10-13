'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/ebook-push-sw.js','utf8');
const id='a'.repeat(64),rid='b'.repeat(64),scope='https://www.sciencebear.com.tw/ebook/';
function setup(windows=[]) {
    const events={},shown=[],badges=[],opened=[],stored=new Map();let receive;
    const indexedDB={open:()=>{
        const open={};queueMicrotask(()=>{open.result={close(){},transaction(){
            const tx={};tx.objectStore=()=>({get:key=>{const req={};queueMicrotask(()=>{req.result=stored.get(key);req.onsuccess();queueMicrotask(()=>tx.oncomplete());});return req;},put:(v,key)=>stored.set(key,v)});return tx;
        }};open.onsuccess();});return open;
    }};
    const context=vm.createContext({URL,Number,indexedDB,firebaseConfig:{},importScripts(){},
        self:{addEventListener:(n,fn)=>events[n]=fn,registration:{scope,showNotification:async(t,o)=>shown.push({t,o})},navigator:{setAppBadge:async n=>badges.push(n),clearAppBadge:async()=>badges.push(0)},skipWaiting(){}},
        clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url),claim:async()=>{}},
        firebase:{initializeApp(){},messaging:()=>({onBackgroundMessage:fn=>receive=fn})}});
    vm.runInContext(source,context);
    const data=(extra={})=>({kind:'ebook_push_test',notificationId:id,recipient:rid,subject:'science',count:'2',version:'1',...extra});
    const message=async payload=>{let work;events.message({source:{url:scope+'index.html'},data:payload,waitUntil:p=>work=p});await work;};
    const click=async data=>{let work;events.notificationclick({notification:{data,close(){}},waitUntil:p=>work=p});await work;};
    return{events,shown,badges,opened,data,message,click,receive:p=>receive(p)};
}
test('FCM資料由一個顯示點處理；不安裝fetch快取，無私人成績內容',async()=>{
    const h=setup();await h.receive({data:h.data()});
    assert.equal(h.shown.length,1);assert.equal(h.shown[0].o.tag,'ebook-'+id);assert.equal(h.shown[0].o.renotify,false);assert.equal(h.events.fetch,undefined);
    assert.equal(h.badges.at(-1),2);
    await h.receive({data:h.data({notificationId:'../../secret'})});assert.equal(h.shown.length,1);
});
test('已讀版本不被延迟推播覆蓋；暫停保持清除，明確開啟後恢復',async()=>{
    const h=setup();await h.message({kind:'ebook_push_badge',recipient:rid,count:0,version:5});
    await h.receive({data:h.data({count:'2',version:'2'})});assert.equal(h.badges.at(-1),0);
    await h.message({kind:'ebook_push_badge',recipient:rid,count:0,version:5,disabled:true});
    await h.receive({data:h.data({count:'3',version:'6'})});assert.equal(h.badges.at(-1),0);
    await h.message({kind:'ebook_push_badge',recipient:rid,count:3,version:6,disabled:false});assert.equal(h.badges.at(-1),3);
});
test('點擊只回正確科目，既有頁面不重載；不信任推播任意URL',async()=>{
    const messages=[];let focused=0;
    const h=setup([{url:scope+'index.html?subject=science',postMessage:p=>messages.push(p),focus:()=>focused++}]);
    await h.click({notificationId:id,subject:'science',url:'https://evil.example'});
    assert.equal(focused,1);assert.equal(messages[0].notificationId,id);assert.equal(h.opened.length,0);
    await h.click({notificationId:id,subject:'math',url:'https://evil.example'});
    assert.equal(new URL(h.opened[0]).origin,'https://www.sciencebear.com.tw');assert.equal(new URL(h.opened[0]).searchParams.get('subject'),'math');
    await h.click({notificationId:'bad',subject:'science'});assert.equal(h.opened.length,1);
});
test('非ebook頁面不得驅動前景通知或標記',async()=>{
    const h=setup();let accepted=false;
    h.events.message({source:{url:'https://evil.example/ebook/'},data:{kind:'ebook_push_foreground',payload:h.data()},waitUntil(){accepted=true;}});
    assert.equal(accepted,false);assert.equal(h.shown.length,0);
});
test('七類業務通知顯示標題但不暴露成績／留言；未知類型拒絕',async()=>{
    const h=setup();
    for(const type of ['post','bulletin','message','sticker','makeup','grade','homework']) {
        await h.receive({data:h.data({kind:'ebook_push_event',type,title:'最新學習通知'})});
        assert.equal(h.shown.at(-1).t,'最新學習通知');assert.equal(h.shown.at(-1).o.body,'請開啟山熊聯絡簿查看最新內容。');
    }
    assert.equal(h.shown.length,7);
    await h.receive({data:h.data({kind:'ebook_push_event',type:'unknown',title:'錯誤'})});assert.equal(h.shown.length,7);
});
