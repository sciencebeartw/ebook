'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
for(const [file,stop,start] of [
 ['fastwrite_ebook_stickers.js','stopProductionStickerWatch','syncProductionStickerWatch'],
 ['fastwrite_ebook_grades.js','stopProductionGradeWatches','syncProductionVisibleGradeWatches'],
 ['fastwrite_ebook_realtime.js','stopProductionMessageWatches','syncProductionVisibleMessageWatches']
]){
 for(const hidden of [false,true])test(file+' reconnect '+(hidden?'hidden':'visible'),()=>{
  const listeners={},calls=[];
  const window={addEventListener(name,cb){assert.equal(listeners[name],undefined,'one handler per event');listeners[name]=cb;}};
  const context={window,document:{hidden,addEventListener(){}},Set,Map};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  window[stop]=()=>calls.push('clear');window[start]=()=>calls.push('fresh-authorized-watch');
  listeners.online();
  assert.deepEqual(calls,hidden?['clear']:['clear','fresh-authorized-watch']);
  calls.length=0;listeners.online();
  assert.deepEqual(calls,hidden?['clear']:['clear','fresh-authorized-watch'],'repeat online clears stale grants before reopening');
 });
}
