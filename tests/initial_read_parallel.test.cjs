const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('    async function executeFirebaseRead(');
const source = html.slice(start, html.indexOf('\n    }', start) + 6);
function fixture({former=false,wrongStudent=false,lifecycleError=false,fail=''}={}) {
  const reads=[], gates=[], keys=former?['current','former']:['current'];
  const read=path=>{
    reads.push(path);
    if(path.includes('/students/'))return Promise.resolve({val:()=>({name:wrongStudent?'其他學生':'測試學生'})});
    return new Promise((resolve,reject)=>gates.push(()=>fail&&path.includes(fail)?reject(new Error('讀取失敗')):resolve({val:()=>path.includes('/homeworkDone/')?{done:true}:{}})));
  };
  const context={console:{error(){}},BEAR_SUBJECT:'science',safeKey:x=>x,db:{ref:path=>({once:()=>read(path)})},
    loadStudentLifecycleIndexes:async()=>{
      if(lifecycleError)throw new Error('未驗證的調班歷程');
      return {classNameByKey:{},trackedClassKeys:keys,trackedGradeClassKeys:keys,studentKeysByClassKey:{current:['s'],former:['old-s']},transferIndex:{},transferChain:[],promotionContext:{},enrollmentIndex:{},enrollmentNodeMap:{}};
    },uniqueClassKeys:xs=>Array.from(new Set(xs)),
    loadGradeExamMapByKeys:async()=>{await read('science/grades/current/s/exams');return {};},
    loadExamIdByClassColKey:async()=>{await read('science/meta/examCatalog/current');return {};},
    loadClassNodeMapByKeys:async(base,ks)=>Object.fromEntries(await Promise.all(ks.map(async k=>[k,(await read(base+'/'+k)).val()]))),
    loadClassStudentNodeMapByKeys:async(base,ks,byClass)=>Object.fromEntries(await Promise.all(ks.map(async k=>[k,{[byClass[k][0]]:(await read(base+'/'+k+'/'+byClass[k][0])).val()}]))),
    window:{EbookPromotionApp:{getFormerBulletinScopes:()=>former?[{classKey:'former',className:'舊班'}]:[],getCurrentBulletinStartDate:()=>''}},
    mergeDailyPostClassNodeByKeys:()=>({}),collectGradeDateAnchorKeys:()=>[],collectDailyPostExamDateAnchorKeysById:()=>({}),
    buildGradeListFromClassExamMap:()=>[],filterItemsByStudentEnrollmentDate:x=>x,buildEbookBulletinList:()=>[],dedupeEbookBulletins:x=>x,
    buildFeedbackHistoryList:x=>x,mergeStudentChildNodeByKeys:()=>({formerFeedback:true}),mergeHomeworkDoneForStudentByKeys:()=>({formerDone:true})};
  vm.createContext(context);vm.runInContext(source,context);
  return {reads,gates,run:()=>context.executeFirebaseRead('測試學生','',true,'current','s')};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('驗證後七個原讀取同時開始，作業完成讀回才回傳，沒有整科目讀取',async()=>{
 const f=fixture();let completed=false;const pending=f.run().then(x=>{completed=true;return x;});await tick();
 assert.equal(f.gates.length,7);assert.equal(completed,false);
 assert.deepEqual(f.reads.slice(1).sort(),['science/grades/current/s/exams','science/meta/examCatalog/current','science/dailyPosts/current','science/bulletins/current','science/bulletins/全校','science/feedbacks/current/s','science/homeworkDone/current/s'].sort());
 f.gates.slice(0,-1).forEach(fn=>fn());await tick();assert.equal(completed,false);f.gates.at(-1)();
 const r=await pending;assert.equal(r.found,true);assert.equal(r.homeworkDone.done,true);
});
test('姓名不符與未驗證的調班歷程不啟動業務資料讀取',async()=>{
 for(const options of [{wrongStudent:true},{lifecycleError:true}]){
 const f=fixture(options);if(options.lifecycleError)await assert.rejects(f.run(),/未驗證/);else assert.equal((await f.run()).found,false);
 assert.deepEqual(f.reads,['science/students/current/s']);}
});
test('調班保留原班學生鍵與合併結果，沒有擴成整班留言或作業讀取',async()=>{
 const f=fixture({former:true});const p=f.run();await tick();f.gates.forEach(fn=>fn());const r=await p;
 assert.ok(f.reads.includes('science/feedbacks/former/old-s'));assert.ok(f.reads.includes('science/homeworkDone/former/old-s'));
 assert.equal(r.feedbackHistory.formerFeedback,true);assert.equal(r.homeworkDone.formerDone,true);
});
test('必要資料失敗不顯示半套結果；作業失敗保留原保護訊息',async()=>{
 for(const fail of ['/homeworkDone/','/feedbacks/','/grades/']){
 const f=fixture({fail});const check=assert.rejects(f.run(),fail==='/homeworkDone/'?/避免把已完成誤顯示為未完成/:/讀取失敗/);
 await tick();f.gates.forEach(fn=>fn());await check;}
});
