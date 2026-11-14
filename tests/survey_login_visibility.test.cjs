'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function source(start,end){const i=html.indexOf(start);assert.ok(i>=0);const j=html.indexOf(end,i+start.length);assert.ok(j>i);return html.slice(i,j);}
const api=source('    function createApiMethods(', '\n    const proxyRunner =');
const resume=source('        async function restoreRememberedStudentLogin()', '\n        function doLogin(');
const mount=source('            if (window.EBOOK_SURVEYS_ENABLED && window.EbookSurveyParent', '\n            renderDailyPosts(');
function fixture(overrides={}){
 const requests=[],mounted=[],errors=[];
 const session={success:true,firebaseCustomToken:'synthetic-token',firebaseAuthUid:'qa',subjectKey:'science',className:'QA班',studentKey:'qa',studentName:'測試學生',...overrides};
 const c={console:{warn(){}},ebookAuthSessionInfo:null,gData:null,ebookRememberedRestoreInProgress:false,ebookGodSessionId:'',isDashboardDraftPreviewMode:false,isAdminMode:false,isStudentPreviewMode:false,
  BEAR_SUBJECT:'science/',firebase:{auth:{Auth:{Persistence:{LOCAL:'local',NONE:'none'}}}},
  ebookFunctions:{httpsCallable:name=>async data=>{requests.push({name,data});return {data:name==='runEbookSurveyStudentAction'?{surveys:[{id:'qa-survey'}]}:session};}},
  ebookAuth:{setPersistence:async()=>{},signInWithCustomToken:async()=>{},signOut:async()=>{}},
  executeFirebaseRead:async()=>({found:true}),loadEbookLoginPendingPolicy:async()=>({status:'ready'}),waitForInitialEbookAuthUser:async()=>({uid:'qa'}),showEbookParentLoginLoader(){},resetEbookSessionBootstrapLoader(){},shouldRevokeRememberedLoginForError:()=>false,
  document:{getElementById:()=>({style:{},innerText:''})},window:{EBOOK_SURVEYS_ENABLED:true,EbookSurveyParent:{mount:d=>mounted.push(d)}}};
 vm.createContext(c);c.enterStudentView=()=>vm.runInContext(mount,c);vm.runInContext(api+'\n'+resume,c);
 return {c,session,requests,mounted,errors,login:()=>c.createApiMethods(c.enterStudentView,e=>errors.push(e)).getStudentData('測試學生','synthetic-only',false)};
}
for(const mode of ['manual','remembered'])test(mode+' 登入正式回傳沒有 role 時仍顯示調查入口，沿用同一學生 session',async()=>{
 const f=fixture();if(mode==='manual')await f.login();else assert.equal(await f.c.restoreRememberedStudentLogin(),true);
 assert.equal(f.errors.length,0);assert.equal(f.mounted.length,1);assert.equal(f.c.ebookAuthSessionInfo.role,'student');assert.equal(f.mounted[0].identity,'science|QA班|qa');
 assert.equal((await f.mounted[0].request({action:'list'})).surveys[0].id,'qa-survey');assert.equal(f.requests.filter(r=>r.name==='runEbookSurveyStudentAction').length,1);
 assert.equal(f.session.role,undefined,'不改寫原始登入回傳資料');
});
test('登入缺少必要身分不掛載調查',async()=>{const f=fixture({studentKey:''});await f.login();assert.equal(f.errors.length,1);assert.equal(f.mounted.length,0);});
test('明確非學生角色不被前端預設值蓋成學生',async()=>{for(const role of ['teacher','student_preview']){const f=fixture({role});await f.login();assert.equal(f.c.ebookAuthSessionInfo.role,role);assert.equal(f.mounted.length,0);}});
test('上帝模式與編輯草稿預覽不掛載家長調查',async()=>{for(const flag of ['isAdminMode','isDashboardDraftPreviewMode']){const f=fixture();f.c[flag]=true;await f.login();assert.equal(f.mounted.length,0);}});

test('後台學生視角沿用同一調查 API，明確標記為預覽',async()=>{
 const f=fixture();f.c.isStudentPreviewMode=true;
 f.c.ebookAuthSessionInfo={subjectKey:'science',className:'QA班',studentKey:'qa'};
 f.c.enterStudentView();
 assert.equal(f.mounted.length,1);
 assert.equal(f.mounted[0].preview,true);
 assert.equal(f.mounted[0].identity,'science|QA班|qa');
 assert.equal((await f.mounted[0].request({action:'list'})).surveys[0].id,'qa-survey');
 assert.deepEqual(f.requests.map(request=>request.name),['runEbookSurveyStudentAction']);
});
