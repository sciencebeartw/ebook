'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../assessment_labels'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const cls='115小六資優自然週六上午班';
function extract(name){const i=html.indexOf('        function '+name+'(');assert.ok(i>=0);return html.slice(i,html.indexOf('\n        }',i)+10)}
const c={window:{AssessmentLabels:A},escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};vm.createContext(c);
for(const n of ['buildAssessmentTitleHtml','buildAssessmentLinkHtml'])vm.runInContext(extract(n),c);
test('contact-book cards and homework/holiday links share single and cross chapter policy',()=>{
 for(const prefix of ['課本作業','回家作業卷','假期練習卷','作業解答','假期練習卷答案']){
  assert.match(c.buildAssessmentLinkHtml(prefix+'｜理化第10章',cls),/有機化合物/);
  assert.doesNotMatch(c.buildAssessmentLinkHtml(prefix+'｜理化第3、4章 水與密度、溶液與溶解度',cls),/水與密度/);
 }
 assert.match(c.buildAssessmentTitleHtml('理化第11章',cls),/常見的力/);
 assert.doesNotMatch(c.buildAssessmentTitleHtml('理化第11章','115國三自然'),/常見的力/);
});
test('custom titles are escaped in cards and links',()=>{
 for(const render of [c.buildAssessmentTitleHtml,c.buildAssessmentLinkHtml]){
  const result=render('自訂｜<img src=x onerror=alert(1)>',cls);
  assert.doesNotMatch(result,/<img/);assert.match(result,/&lt;img/);
 }
});
test('both deployments use identical label policy',()=>{
 const dashboard=process.env.ASSESSMENT_DASHBOARD_DIR;
 if(dashboard) assert.equal(fs.readFileSync(dashboard+'/assessment_labels.js','utf8'),fs.readFileSync(require.resolve('../assessment_labels'),'utf8'));
});
