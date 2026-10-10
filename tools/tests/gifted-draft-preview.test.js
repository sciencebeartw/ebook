'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../../index.html'),'utf8');
const source=html.slice(html.indexOf('function renderGiftedHomeworkDraftPreview('),html.indexOf('function loadDashboardDraftPreviewPayload('));
test('homework preview is non-interactive, escaped, and absent from the real student page',()=>{
 const ctx={isDashboardDraftPreviewMode:true,SVG:{document:'<svg></svg>'},escapeHtml:s=>s.replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')};vm.createContext(ctx);vm.runInContext(source,ctx);
 const post={giftedHomeworkPreview:{label:'課本作業｜理化第11章 <img src=x onerror=evil()>',dual:true}};
 const result=ctx.renderGiftedHomeworkDraftPreview(post);assert.match(result,/aria-disabled="true"/);assert.match(result,/Google表單/);assert.match(result,/<svg>/);assert.doesNotMatch(result,/<a |href=|<img/);
 ctx.isDashboardDraftPreviewMode=false;assert.equal(ctx.renderGiftedHomeworkDraftPreview(post),'');
});
