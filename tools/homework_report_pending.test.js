'use strict';
const assert=require('node:assert/strict'),P=require('../ebook_pending_tasks_app'),R=require('../homework_report_status');
const cls='115國二自然超前班',due=Date.parse('2026-10-17T18:00:00+08:00'),answer={id:'answer_demo_1',slot:'hw1',questionUrl:'https://example.test/q.pdf',reportScore:true,reportProvisioned:true};
const post={id:'post_demo',date:'2026/10/10',className:cls,hw1:'[回家作業卷｜拋體運動]'+answer.questionUrl,displayOptions:{homeworkAnswers:[answer],homeworkDue:{dueAt:due}}};
const assignment=R.entries(post)[0], receipt={type:'回家作業回報',assessmentKind:'homework_self_marked',sourceClassKey:cls,sourceAssignmentId:assignment.assignmentId,reportedScore:0,reviewStatus:'pending'};
function options(overrides={}) {return {...{classKey:cls,className:cls,studentKey:'demo',posts:[post],grades:[],feedbackHistory:[],homeworkDone:{'2026_slash_10_slash_10':{status:'done',dailyPostId:post.id}},
 pendingPolicy:{status:'ready',showPending:true,loginReminder:true,reminderDue:true,loadedAt:due-60000,reminderDueAt:due-21*3600000,reminderDueDateKey:'2026-10-16',reminderLeadMs:21*3600000},
 helpers:{getHomeworkDoneDateKey:d=>d.replaceAll('/','_slash_')}},...overrides};}
let o=options(),r=P.buildPendingTasks(o);assert.equal(r.items.length,1);assert.equal(r.items[0].kind,'homework_paper_report');assert.equal(r.items[0].sourceItemId,assignment.sourceItemId);
assert.equal(P.getReminderDueItems(r).length,0,'before deadline is yellow');assert.equal(P.getEntryReminderItems(r).length,1,'within reminder lead');
o.pendingPolicy.loadedAt=due; r=P.buildPendingTasks(o);assert.equal(P.getReminderDueItems(r).length,1,'at deadline is red');
assert.equal(P.buildPendingTasks(options({feedbackHistory:[receipt]})).items.length,0);
assert.equal(P.buildPendingTasks(options({feedbackHistory:[{...receipt,sourceClassKey:'其他班'}]})).items.length,1);
assert.equal(P.buildPendingTasks(options({homeworkReportReceipts:{[cls]:{[assignment.assignmentId]:{score:0,reportedAt:1}}}})).items.length,0,'success response clears immediately');
assert.equal(P.buildPendingTasks(options({homeworkReportReceipts:{[cls]:{[assignment.assignmentId]:{score:0}}}})).items.length,1,'pending request is not success');
assert.equal(P.buildPendingTasks(options({grades:[{...receipt,score:0}]})).items.length,0);
assert.equal(P.buildPendingTasks(options({homeworkDone:{}})).items[0].kind,'homework_done');
for (const reportScore of [false,undefined]) assert.equal(P.buildPendingTasks(options({posts:[{...post,displayOptions:{homeworkAnswers:[{...answer,reportScore}]}}]})).items.length,0,'answer only unchanged');
const edited={...post,displayOptions:{homeworkAnswers:[{...answer,reportScore:true,reportProvisioned:false}]}};
assert.equal(P.buildPendingTasks(options({posts:[edited]})).items.length,0,'not provisioned must not ask for impossible score');
const normal=P.buildPendingTasks(options()),itemKey=normal.items[0].skipIdentity.itemKey;
assert.equal(P.buildPendingTasks(options({pendingPolicy:{...options().pendingPolicy,skippedItemKeys:{[itemKey]:true}}})).items.length,0);
console.log('student report pending: yellow/red, successful receipt, zero, class isolation, answer-only and skip tests passed');
