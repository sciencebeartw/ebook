'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../../gifted/grade-refresh');
function fixture(options={}){
 const timers=new Map(),states=[];let key=0,visible=true,online=true,calls=0;
 const poll=create({read:async()=>{calls++;return calls===1?'pending':'completed';},render:v=>{states.push(v);return v==='pending';},
  isVisible:()=>visible,isOnline:()=>online,setTimer:(fn,ms)=>{const id=++key;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),...options});
 return {poll,timers,states,get calls(){return calls;},setVisible:v=>visible=v,setOnline:v=>online=v,
  async tick(){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();await new Promise(setImmediate);}};
}
test('pending automatically becomes completed with no click, then stops',async()=>{const f=fixture();await f.poll.refresh();assert.equal(f.calls,1);assert.equal(f.timers.size,1);await f.tick();assert.deepEqual(f.states,['pending','completed']);assert.equal(f.timers.size,0);});
test('background/offline pauses and returns without duplicate in-flight reads',async()=>{let release;const f=fixture({read:()=>new Promise(r=>release=r)});const a=f.poll.refresh(),b=f.poll.refresh({manual:true});assert.equal(a,b);await Promise.resolve();f.setVisible(false);release('pending');await a;assert.equal(f.timers.size,0);f.setVisible(true);f.setOnline(false);await f.poll.resume();assert.equal(f.poll.reads,1);f.setOnline(true);const c=f.poll.resume();await Promise.resolve();release('completed');await c;assert.deepEqual(f.states,['pending','completed']);});
test('network failure retries without changing accepted submission and caps automatic reads',async()=>{const events=[];const f=fixture({read:async()=>{throw Error('offline');},onError:()=>{events.push('accepted');return true;},onWaiting:v=>events.push(v),maxReads:3});await f.poll.refresh();await f.tick();await f.tick();assert.equal(f.poll.reads,3);assert.equal(f.timers.size,0);assert.deepEqual(events,['accepted','accepted','accepted','delayed']);await f.poll.resume();assert.equal(f.poll.reads,3);await f.poll.refresh({manual:true});assert.equal(f.poll.reads,1);});
test('closed page ignores late private results and creates no new timer',async()=>{let release;const f=fixture({read:()=>new Promise(r=>release=r)});const p=f.poll.refresh();await Promise.resolve();f.poll.dispose();release('pending');await p;assert.deepEqual(f.states,[]);assert.equal(f.timers.size,0);});
test('unsubmitted or teacher-action status does not poll',async()=>{for(const status of ['draft','waiting_column','waiting_grading','waiting_answers','blocked']){const f=fixture({read:async()=>status});await f.poll.refresh();assert.equal(f.timers.size,0);}});
