'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCallable,isFeedbackRequest}=require('../feedback_region_transport');
const entries={runEbookStudentAction:'runEbookStudentFeedback',runEbookGodAdminAction:'runEbookGodFeedback',runEbookGasAdminAction:'runEbookAdminFeedback'};
for(const [name,target] of Object.entries(entries))test(name+' sends science/math messages and revisions exactly once to same-database region',async()=>{
 const calls=[],options={timeout:30000};const app={functions:region=>({httpsCallable:(endpoint,opts)=>{assert.equal(opts,options);return async input=>{calls.push({region,endpoint,input});return {data:{success:true}};};}})};const call=createCallable(app,name,options);
 for(const subjectKey of ['science','math'])for(const input of [{action:'fastWriteV1',data:{entityId:'chat_'+'a'.repeat(40),operation:'commit',command:{requestId:'retain-request'}},subjectKey},{action:'feedbackRevisionV2',data:{operation:'edit',version:3,requestId:'retain-edit'},subjectKey}]){await call(input);assert.equal(calls.at(-1).input,input);}
 assert.equal(calls.length,4);assert(calls.every(c=>c.region==='asia-southeast1'&&c.endpoint===target));
 await call({action:'fastWriteV1',data:{entityId:'grade_a',operation:'commit'}});assert.equal(calls.at(-1).region,undefined);assert.equal(calls.at(-1).endpoint,name);
});
test('an uncertain regional result never automatically resends to the old region',async()=>{
 const calls=[];const error=Error('network outcome unknown');const call=createCallable({functions:region=>({httpsCallable:endpoint=>async input=>{calls.push({region,endpoint,input});throw error;}})},'runEbookStudentAction');const input={action:'feedbackRevisionV2',data:{operation:'edit',requestId:'same-request'}};
 await assert.rejects(call(input),e=>e===error);assert.equal(calls.length,1);assert.equal(calls[0].input,input);
});
test('login, reports, grades, stickers and unknown entries retain the original endpoint',async()=>{
 const calls=[];const app={functions:region=>({httpsCallable:endpoint=>async input=>{calls.push({region,endpoint,input});}})};
 const call=createCallable(app,'runEbookGasAdminAction');for(const action of ['approveStickerGas','fastWritePublicationV1','submitFeedback','changePassword'])await call({action});await createCallable(app,'getEbookGodSession')({action:'feedbackRevisionV2'});assert(calls.every(x=>x.region===undefined));assert.equal(isFeedbackRequest(null),false);
});
