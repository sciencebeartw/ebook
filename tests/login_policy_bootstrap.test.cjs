'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('    function loadEbookLoginPendingPolicy('), html.indexOf('    function ebookAdminFeatureRetired('));
const normalize = html.slice(html.indexOf('    function normalizeEbookPendingPolicyPayload('), html.indexOf('    async function loadEbookPendingTaskPolicy('));
function fixture() {
 let calls = 0;
 const c = {window:{}, loadEbookPendingTaskPolicy:async()=>{calls++;return {status:'ready',legacy:true};}};
 vm.runInNewContext(normalize + source, c);
 return { c, calls:()=>calls };
}
test('同次身分驗證的規則直接使用，沒有第二支 Callable 或快取', async()=>{
 const f=fixture(); const policy=await f.c.loadEbookLoginPendingPolicy({pendingPolicy:{success:true,status:'ready',items:[],showPending:true,loadedAt:42}});
 assert.equal(policy.status,'ready');assert.equal(policy.loadedAt,42);assert.equal(f.calls(),0);
});
test('規則無法確認或格式不完整時維持封閉，不顯示錯誤待完成或逾期提醒',async()=>{
 for(const value of [null,{}, {status:'ready',items:[]}, {success:false,status:'unavailable',reason:'policy-call-failed'}]){
  const f=fixture(),p=await f.c.loadEbookLoginPendingPolicy({pendingPolicy:value});
  assert.equal(p.status,'unavailable');assert.equal(p.showPending,false);assert.equal(p.loginReminder,false);assert.equal(p.reminderDue,false);assert.equal(f.calls(),0);
 }
});
test('舊版後端缺少新欄位仍呼叫原有規則入口，保留滾動發布與回退相容',async()=>{
 const f=fixture(); assert.equal((await f.c.loadEbookLoginPendingPolicy({})).legacy,true);assert.equal(f.calls(),1);
});
test('三個登入入口要求同次規則，手動刷新仍使用原有規則重讀',()=>{
 for(const fn of ['getStudentData: async function(', 'async function restoreRememberedStudentLogin()', 'async function enterEbookGodSession(']){
  const i=html.indexOf(fn);assert.ok(html.slice(i,i+2800).includes('loadEbookLoginPendingPolicy(session)'));
 }
 const i=html.indexOf('refreshStudentData:');assert.ok(html.slice(i,i+2000).includes('loadEbookPendingTaskPolicy()'));
 assert.ok(html.includes('includePendingPolicy: needsFirebaseToken'));
 assert.ok(html.includes('if (!needsFirebaseToken && ebookGodSessionInfo && ebookGodSessionInfo.pendingPolicy === undefined && previousPendingPolicy)'));

});
