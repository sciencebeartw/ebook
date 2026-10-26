'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const drafts=require('../student_tool_drafts');

function form(identity='student-one') {
    const doc={hidden:false,activeElement:null};
    const details={open:false,contains:el=>fields.includes(el)};
    function field(id,type='text',tagName='INPUT') {
        return {id,type,tagName,value:'',style:{display:'none'},selectionStart:null,selectionEnd:null,
            closest:()=>details,focus(){doc.activeElement=this;},
            setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
    }
    const reason=field('reason');
    const count=field('count','select-one','SELECT');
    count.options=[{value:'-5'},{value:'__custom__'}];count.value='-5';
    const file=field('attachment','file');
    const fields=[reason,count,file];
    details.querySelector=()=>reason;
    details.querySelectorAll=()=>fields;
    const host={dataset:{studentToolDraftIdentity:identity},ownerDocument:doc,
        querySelectorAll:selector=>selector.includes('details.compact-student-tool')?[details]:fields};
    return {host,doc,details,reason,count,file};
}

test('live redraw retains open form, typed reason, custom option and cursor',()=>{
    const before=form();before.details.open=true;before.reason.value='改進事項尚未送出';
    before.reason.style.display='block';before.reason.selectionStart=2;before.reason.selectionEnd=4;
    before.doc.activeElement=before.reason;before.count.value='__custom__';
    const state=drafts.capture(before.host,'student-one');
    const after=form();drafts.restore(after.host,state,'student-one');
    assert.equal(after.details.open,true);assert.equal(after.reason.value,'改進事項尚未送出');
    assert.equal(after.reason.style.display,'block');assert.equal(after.count.value,'__custom__');
    assert.equal(after.doc.activeElement,after.reason);assert.equal(after.reason.selectionStart,2);
    assert.equal(after.reason.selectionEnd,4);
});

test('switching student cannot carry another family draft or file input',()=>{
    const before=form();before.reason.value='private draft';before.file.value='private attachment';
    const state=drafts.capture(before.host,'student-one');
    assert.equal(state.tools[0].fields.some(field=>field.id==='attachment'),false);
    assert.equal(drafts.capture(before.host,'student-two'),null);
    const after=form('student-two');drafts.restore(after.host,state,'student-two');
    assert.equal(after.reason.value,'');assert.equal(after.file.value,'');
    assert.equal(after.host.dataset.studentToolDraftIdentity,'student-two');
});

test('successful submit clears remain cleared and removed options are not resurrected',()=>{
    const before=form();before.reason.value='';before.count.value='__custom__';
    const state=drafts.capture(before.host,'student-one');
    const after=form();after.count.options=[{value:'-5'}];
    drafts.restore(after.host,state,'student-one');
    assert.equal(after.reason.value,'');assert.equal(after.count.value,'-5');
    assert.equal(after.details.open,false);
});

test('background redraw retains values without stealing focus',()=>{
    const before=form();before.reason.value='保留內容';before.doc.activeElement=before.reason;
    const state=drafts.capture(before.host,'student-one');
    const after=form();after.doc.hidden=true;drafts.restore(after.host,state,'student-one');
    assert.equal(after.reason.value,'保留內容');assert.equal(after.doc.activeElement,null);
});

test('full contact-book redraw captures before replacing DOM and restores after attachments',()=>{
    const main=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const capture=main.indexOf('var toolDraftState = window.StudentToolDrafts.capture');
    const replace=main.indexOf('container.innerHTML = html;',capture);
    const attachments=main.indexOf('renderStudentHomeworkDraft(dateKey)',replace);
    const restore=main.indexOf('window.StudentToolDrafts.restore(container, toolDraftState, toolDraftIdentity)',replace);
    assert.ok(capture>0&&replace>capture&&restore>replace);
    assert.ok(attachments<0||attachments<restore);
    assert.match(main,/gData\?\.foundUserKey \|\| "", !!isAdminMode/);
});
