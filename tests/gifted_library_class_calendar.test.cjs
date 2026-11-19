const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../gifted_library_entry.js'),'utf8');
function fixture(className,date,reviewDate){
 const welcome={hidden:true,replaceChildren(){this.innerHTML='';}};
 const slot=(glClass,glDate)=>({dataset:{glClass,glDate},innerHTML:'',replaceChildren(){this.innerHTML='';}});
 const slots=['2026-11-07','2026-11-14','2026-11-21','2026-11-22','2026-11-28'].map(day=>slot(className,day));
 const transferred=slot('115小六資優自然週日晚上班','2026-11-21');slots.push(transferred);
 const document={getElementById:()=>welcome,querySelectorAll:()=>slots,addEventListener(){},documentElement:{classList:{remove(){}}},body:{style:{removeProperty(){}}}};
 const auth={currentUser:{uid:'demo',getIdToken:async()=>'fixture'}},location=new URL('https://example.invalid/ebook/');
 const policy={classIds:[className],reviews:[],mockOpensAt:'2026-11-21T00:00:00+08:00'};
 const root={GIFTED_LIBRARY_POLICY:policy},calls=[];
 vm.runInNewContext(code,{window:root,document,Date,URL,URLSearchParams,location,performance:{now:()=>0},AbortController,clearTimeout(){},setTimeout(){},fetch:async(url,options)=>{
  calls.push(JSON.parse(options.body).action);
  return {ok:true,json:async()=>({classId:className,serverNow:Date.parse(date+'T08:00:00+08:00'),mockOpensAt:policy.mockOpensAt,earlyAccess:null,reviews:[{chapterId:'grb-chapter-05',date:reviewDate,label:'聲音'}]})};
 }});
 const api=root.GiftedLibraryEbook;api.ready({auth,result:{className,studentName:'一般學生'}});
 return {api,calls,slots,transferred,welcome,visible:()=>slots.filter(s=>s.innerHTML).map(s=>s.dataset.glDate)};
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
