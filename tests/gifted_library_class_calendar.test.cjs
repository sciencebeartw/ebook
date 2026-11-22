const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../gifted_library_entry.js'),'utf8');
function fixture(className,date,reviewDate,options={}){
 const welcome={hidden:true,replaceChildren(){this.innerHTML='';}};
 const slot=(glClass,glDate)=>({dataset:{glClass,glDate},innerHTML:'',replaceChildren(){this.innerHTML='';}});
 const slots=['2026-11-07','2026-11-14','2026-11-21','2026-11-22','2026-11-28'].map(day=>slot(className,day));
 if(options.onlyOld)slots.splice(2);
 const transferred=slot(className.includes('週六')?'115小六資優自然週日晚上班':'115小六資優自然週六上午班','2026-11-21');slots.push(transferred);
 const opened=[];
 const element=()=>({setAttribute(){},append(){},before(){},focus(){},remove(){}});
 const document={createElement:element,getElementById:()=>welcome,querySelectorAll:()=>slots,addEventListener(){},documentElement:{classList:{remove(){},add(){}}},body:{append(section){opened.push(section);},style:{removeProperty(){},setProperty(){}}}};
 const auth={currentUser:{uid:'demo',getIdToken:async()=>'fixture'},onAuthStateChanged:()=>()=>{}},location=new URL('https://example.invalid/ebook/'+(options.query||''));
 const config={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../gifted_library_policy.js'),'utf8'),config);
 const policy=config.window.GIFTED_LIBRARY_POLICY;
 const root={GIFTED_LIBRARY_POLICY:policy},calls=[];
 vm.runInNewContext(code,{window:root,document,Date,URL,URLSearchParams,location,performance:{now:()=>0},AbortController,clearTimeout(){},setTimeout(){},fetch:async(url,requestOptions)=>{
  calls.push(JSON.parse(requestOptions.body).action);
  return {ok:true,json:async()=>({classId:className,serverNow:Date.parse(date+'T'+(options.time||'20:00:00')+'+08:00'),mockOpensAt:policy.mockOpensAtByClass[className],earlyAccess:null,reviews:options.reviews||[{chapterId:'grb-chapter-05',date:reviewDate,label:'聲音'}]})};
 }});
 const api=root.GiftedLibraryEbook;
 for(const s of slots){
  const glDate=s.dataset.glDate,glClass=s.dataset.glClass;
  const time=options.postTime||({'週六上午':'09:00','週日下午':'14:00','週日晚上':'18:00'})[glClass.slice(-5,-1)];
  const html=api.buttons({date:glDate,reserveTime:glDate.replaceAll('-','/')+' '+time},glClass,false,'一般學生');
  s.dataset.glPublishAt=html.match(/data-gl-publish-at="([^"]+)"/)[1];
 }
 api.ready({auth,teacherView:options.view===true,mode:options.view?'student_preview':'',result:{className,studentName:'一般學生'}});
 return {api,calls,slots,transferred,welcome,opened,visible:()=>slots.filter(s=>s.innerHTML).map(s=>s.dataset.glDate)};
}
for(const [day,classDate] of [['週六上午','2026-11-21'],['週日下午','2026-11-22']]){
 test(day+'的一般學生依伺服器日期開放，只使用自己班的聯絡簿',async()=>{
  const cls='115小六資優自然'+day+'班';
  const before=fixture(cls,'2026-11-19',classDate);await new Promise(setImmediate);assert.deepEqual(before.visible(),[]);
  const f=fixture(cls,classDate,classDate);await new Promise(setImmediate);
  assert.deepEqual(f.calls,['entryCalendar']);assert.equal(f.welcome.hidden,true);
  assert.equal(f.transferred.innerHTML,'');assert.equal(f.slots[0].innerHTML,'');assert.equal(f.slots[1].innerHTML,'');
  assert.match(f.slots.find(s=>s.dataset.glDate===classDate).innerHTML,/複習題本/);
  assert.match(f.slots.find(s=>s.dataset.glDate===classDate).innerHTML,/模擬試題/);
  assert.equal(f.slots[4].innerHTML,'');
  const moved=fixture(cls,classDate,'2026-11-28');await new Promise(setImmediate);assert.ok(moved.slots.every(s=>!s.innerHTML.includes('複習題本')));
 });
}

for(const [day,release] of [['週日下午','14:00:00'],['週日晚上','18:00:00']]){
 for(const view of [false,true]){
  test(day+'模擬試題跟隨當班發布時刻與當期貼文 / '+(view?'學生視角':'本人'),async()=>{
   const cls='115小六資優自然'+day+'班',date='2026-11-22';
   const before=(Number(release.slice(0,2))-1)+':59:59';
   for(const [time,expected] of [['00:00:00',false],[before,false],[release,true],['19:00:00',true]]){
    const f=fixture(cls,date,date,{time,view});await new Promise(setImmediate);
    assert.equal(f.slots.find(s=>s.dataset.glDate===date).innerHTML.includes('模擬試題'),expected,time);
    assert.ok(f.slots.every(s=>s.dataset.glDate===date || !s.innerHTML.includes('模擬試題')));
    assert.equal(f.welcome.hidden,true);
   }
   const f=fixture(cls,date,date,{time:release,view,onlyOld:true});await new Promise(setImmediate);
   assert.ok(f.slots.every(s=>!s.innerHTML.includes('模擬試題')));
   assert.equal(f.welcome.hidden,true);
   assert.match(f.api.buttons({date},cls,true),/disabled>模擬試題/);
   assert.doesNotMatch(f.api.buttons({date:'2026-11-15'},cls,true),/模擬試題/);
  });
 }
}

for(const [day,date,time,before] of [
 ['週六上午','2026-11-21','09:00:00','08:59:59'],
 ['週日下午','2026-11-22','14:00:00','13:59:59'],
 ['週日晚上','2026-11-22','18:00:00','17:59:59']
]){
 const cls='115小六資優自然'+day+'班';
 for(const view of [false,true]){
  test(day+' '+(view?'學生視角':'學生本人')+'：兩個入口只在當週貼文發布後顯示',async()=>{
   for(const [at,visible] of [['00:00:00',false],[before,false],[time,true]]){
    const f=fixture(cls,date,date,{time:at,view});await new Promise(setImmediate);
    const post=f.slots.find(s=>s.dataset.glDate===date);
    assert.equal(post.innerHTML.includes('grb-chapter-05'),visible,at);
    assert.equal(post.innerHTML.includes('模擬試題'),visible,at);
    assert.equal(f.transferred.innerHTML,'');
   }
   const absent=fixture(cls,date,date,{time,view,onlyOld:true,query:'?giftedLibrary=grb-chapter-05'});await new Promise(setImmediate);
   assert.deepEqual(absent.visible(),[]);assert.match(absent.welcome.innerHTML,/本週指派/);assert.doesNotMatch(absent.welcome.innerHTML,/data-gifted-library/);
   const delayed=fixture(cls,date,date,{time,view,postTime:'21:30'});await new Promise(setImmediate);
   assert.equal(delayed.slots.find(s=>s.dataset.glDate===date).innerHTML,'');
  });
 }
}
test('本週沒有指派就沒有題本按鈕，上週保留自身章節，下一週使用新章節',async()=>{
 const cls='115小六資優自然週六上午班',date='2026-11-28';
 const reviews=[{date:'2026-11-21',chapterId:'grb-chapter-05',label:'聲音'},{date,chapterId:'grb-chapter-06',label:'光'}];
 const week=fixture(cls,date,date,{reviews});await new Promise(setImmediate);
 const links=(f,day)=>f.slots.find(s=>s.dataset.glDate===day).innerHTML;
 assert.match(links(week,'2026-11-21'),/chapter-05/);assert.doesNotMatch(links(week,'2026-11-21'),/chapter-06/);
 assert.match(links(week,date),/chapter-06/);assert.doesNotMatch(links(week,date),/chapter-05/);
 const absent=fixture(cls,date,date,{reviews});absent.slots.splice(4,1);await new Promise(setImmediate);
 assert.match(links(absent,'2026-11-21'),/chapter-05/);assert.ok(absent.slots.every(s=>!s.innerHTML.includes('chapter-06')));
 const skipped=fixture(cls,date,date,{reviews:reviews.slice(0,1)});await new Promise(setImmediate);
 assert.doesNotMatch(links(skipped,date),/複習題本/);assert.match(links(skipped,date),/模擬試題/);
});
test('儲存的題本連結等同班當週貼文出現，只開啟一次',async()=>{
 const cls='115小六資優自然週六上午班',date='2026-11-21';
 const f=fixture(cls,date,date,{onlyOld:true,query:'?giftedLibrary=grb-chapter-05'});
 await new Promise(setImmediate);assert.equal(f.opened.length,0);
 f.slots.push({dataset:{glClass:cls,glDate:date,glPublishAt:String(Date.parse(date+'T09:00:00+08:00'))},innerHTML:''});
 f.api.refreshPostSlots();assert.equal(f.opened.length,1);assert.equal(f.welcome.hidden,true);
 f.api.refreshPostSlots();assert.equal(f.opened.length,1);
});
