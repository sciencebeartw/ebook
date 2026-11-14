'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { setImmediate: nextTurn } = require('node:timers/promises');

test('學生視角顯示正式調查入口、六個複選項及停用的送出按鈕', async () => {
    const options = ['建功 114','建功 113','實驗 114','實驗 113','光武 114','光武 113'];
    const question = { id:'papers', title:'想請老師印哪些考卷？', type:'multiple', required:true,
        options:options.map((label,i)=>({id:'option_'+i,label})) };
    const form = { title:'11/21 段考考古題紙本申請', endsAt:0, description:'選擇需要的紙本', questions:[question] };
    const calls = [];
    const entry = { dataset:{survey:'paper_request'} };
    const host = { classList:{add(){}}, querySelectorAll:()=>[entry] };
    const nodes = new Map(['h2','.es-dialog-body','.es-dialog-footer','[data-submit]','form'].map(key=>[key,{}]));
    const dialog = { isConnected:true, querySelector:key=>nodes.get(key) };
    const document = { addEventListener(){}, getElementById:()=>host, querySelector:()=>null };
    const context = vm.createContext({window:{},document});
    for(const name of ['survey_contract','ebook_surveys_view','ebook_surveys_parent']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'),context);
    }
    context.window.EbookSurveyView.page = ()=>dialog;
    context.window.EbookSurveyAttachments = { bind(_, __, ___, config) {
        assert.equal(config.preview,true);
        assert.equal(config.readOnly,true);
    } };
    context.window.EbookSurveyParent.mount({
        preview:true, canRemind:()=>false, request:async ({action})=>{
            calls.push(action);
            return action === 'list'
                ? {surveys:[{id:'paper_request',title:form.title,answered:true}]}
                : {survey:{id:'paper_request',form},student:{name:'測試學生',className:'國二'},answered:true,canEdit:false};
        },
    });
    await nextTurn();
    assert.equal(host.hidden,false);
    assert.match(host.innerHTML,/紙本申請/);
    assert.match(host.innerHTML,/已填寫/);
    assert.match(host.innerHTML,/查看調查/);
    await entry.onclick();
    const html = nodes.get('.es-dialog-body').innerHTML;
    assert.match(html,/學生視角預覽/);
    assert.match(html,/這位學生已填寫/);
    assert.equal((html.match(/type="checkbox"/g)||[]).length,6);
    assert.ok(options.every(label=>html.includes(label)));
    assert.match(nodes.get('.es-dialog-footer').innerHTML,/data-submit disabled[^>]*>送出回答/);
    await nodes.get('[data-submit]').onclick();
    assert.deepEqual(calls,['list','get']);
});
