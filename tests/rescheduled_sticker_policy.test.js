'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const P = require('../class_session_plan');
const cls = '115小六資優自然週六上午班', p = P.policy('science', cls);
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('    function normalizeEbookPendingPolicyPayload(');
const end = html.indexOf('    async function loadEbookPendingTaskPolicy(', start);
const ctx = {window: {EbookPendingTasks: require('../ebook_pending_tasks_app')}};
vm.createContext(ctx); vm.runInContext(html.slice(start, end), ctx);
const moved = P.normalizeException(p, {originalDate: '2026-10-10', status: 'rescheduled', actualDate: '2026-10-11', startTime: '09:00', endTime: '12:00', revision: 2});
function normalize(plan) {
  return ctx.normalizeEbookPendingPolicyPayload({success: true, status: 'ready', items: [], loadedAt: P.at('2026-10-11', '14:00'), sessionPlansByClass: {[cls]: plan}, homeworkDueByClass: {[cls]: {post1: {dueAt: P.at('2026-10-17', '09:00')}}}, reminderLeadMs: 3600000});
}
function latest(posts, policy, now) {
  return posts.filter(post => P.isActualPost(p, post, policy.sessionPlansByClass[cls], now))[0]?.date;
}
const post = {date: '2026/10/11', displayOptions: {session: moved}};
test('student payload retains trusted scoped plan and enables the actual moved lesson', () => {
  const plan = {revision: 2, exceptions: {[moved.occurrenceId]: moved}, pending: false}, policy = normalize(plan);
  assert.equal(policy.sessionPlansByClass[cls], plan);
  assert.equal(policy.homeworkDueByClass[cls].post1.dueAt, P.at('2026-10-17', '09:00'));
  assert.equal(policy.reminderLeadMs, 3600000);
  assert.equal(latest([post, {date: '2026/10/10'}, {date: '2026/10/03'}], policy, P.at('2026-10-11', '14:00')), '2026/10/11');
});
test('a moved lesson stays closed before its actual start and never opens on the old day', () => {
  const policy = normalize({exceptions: {[moved.occurrenceId]: moved}});
  assert.equal(latest([post, {date: '2026/10/10'}, {date: '2026/10/03'}], policy, P.at('2026-10-11', '08:59')), '2026/10/03');
  assert.equal(latest([post, {date: '2026/10/03'}], policy, P.at('2026-10-11', '09:00')), '2026/10/11');
});
test('pending, cancelled and supplemental lessons stay closed', () => {
  assert.equal(latest([post], normalize({pending: true, exceptions: {[moved.occurrenceId]: moved}}), P.at('2026-10-11', '14:00')), undefined);
  const cancelled = P.normalizeException(p, {originalDate: '2026-10-10', status: 'cancelled'});
  assert.equal(latest([post], normalize({exceptions: {[cancelled.occurrenceId]: cancelled}}), P.at('2026-10-11', '14:00')), undefined);
  assert.equal(latest([{...post, displayOptions: {session: {...moved, status: 'supplemental'}}}], normalize({exceptions: {[moved.occurrenceId]: moved}}), P.at('2026-10-11', '14:00')), undefined);
});
test('an unavailable policy does not retain untrusted class plans', () => {
  const policy = ctx.normalizeEbookPendingPolicyPayload({success: false, status: 'ready', items: [], sessionPlansByClass: {[cls]: {}}});
  assert.equal(policy.status, 'unavailable'); assert.equal(policy.sessionPlansByClass, undefined);
});
