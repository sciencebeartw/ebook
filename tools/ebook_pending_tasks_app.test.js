#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Pending = require('../ebook_pending_tasks_app.js');
const DashboardSkips = require('../../dashboard/homework_reminder_skip_app.js');

const browserSandbox = { window: {}, console };
browserSandbox.globalThis = browserSandbox.window;
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'ebook_pending_tasks_app.js'), 'utf8'),
  browserSandbox,
  { filename: 'ebook_pending_tasks_app.js' }
);
assert.strictEqual(
  typeof browserSandbox.window.EbookPendingTasks.buildPendingTasks,
  'function',
  'UMD build must attach to window'
);
assert.strictEqual(
  Pending.formatPendingTaskTitle('**國中Book 1：**\n主題三 第95、97-98頁 / {blue:國中Book1填格格}[20260801課本填格格.pdf]https://firebasestorage.googleapis.com/v0/b/example.pdf?token=secret'),
  '國中Book 1： 主題三 第95、97-98頁 / 國中Book1填格格 20260801課本填格格.pdf',
  'pending cards keep readable labels while hiding formatting tokens and raw Storage URLs'
);
assert.strictEqual(
  Pending.formatPendingTaskTitle('[下載講義](https://example.com/very-long.pdf) {red:{u:記得完成}}'),
  '下載講義 記得完成',
  'markdown links and nested DailyPost styling are rendered as plain readable text'
);

const CURRENT_CLASS = '115小六資優自然週六上午班';
const STUDENT_KEY = '王小明';
const READY_POLICY = { status: 'ready', items: [] };

function rescheduledSession(className, actualDate, startTime, endTime, overrides = {}) {
  const contract = Pending.resolveClassSessionContract(className);
  assert.ok(contract, `missing fixture contract for ${className}`);
  return Object.assign({
    status: 'rescheduled',
    policyId: contract.id,
    originalWeekday: contract.weekday,
    originalStartTime: String(contract.startHour).padStart(2, '0') + ':' + String(contract.startMinute).padStart(2, '0'),
    originalEndTime: String(contract.endHour).padStart(2, '0') + ':' + String(contract.endMinute).padStart(2, '0'),
    actualDate,
    startTime,
    endTime,
  }, overrides);
}

function baseOptions(overrides = {}) {
  return Object.assign({
    classKey: CURRENT_CLASS,
    className: CURRENT_CLASS,
    studentKey: STUDENT_KEY,
    posts: [],
    grades: [],
    feedbackHistory: [],
    homeworkDone: {},
    pendingPolicy: READY_POLICY,
    now: new Date('2026-08-10T12:00:00+08:00'),
    helpers: {
      isHomeworkColumnTitle: title => title.includes('作業'),
      isEnrollmentExemptExam: () => false,
      shouldUseHomeworkDoneFlowForClass: () => false,
      shouldUseHomeworkDoneFlowForPost: () => false,
      getHomeworkDoneDateKey: date => String(date).replace(/-/g, '/'),
      getPostHomeworkText: post => [post.hw1, post.hw2].filter(Boolean).join(' / '),
      getLatestScoreReportInfo: () => null,
      getLatestResultReportInfo: () => null,
      isMathGuidanceExam: () => false,
      getMakeupColorInfo: color => color === '#00ff00' ? { key: 'green' } : null,
      getDisplayOptions: post => post.displayOptions || {},
      isExamBeforePostDate: (exam, post) => {
        const examDay = Number(String(exam.date).match(/\/(\d{1,2})/)[1]);
        const postDay = Number(String(post.date).match(/-(\d{2})$/)[1]);
        return examDay < postDay;
      },
      isSameSource: (left, right) => left === right,
    },
  }, overrides);
}

assert.deepStrictEqual(
  Pending.buildPendingTasks(baseOptions({ pendingPolicy: null })),
  {
    status: 'unavailable',
    items: [],
    policy: {
      status: 'unavailable',
      skippedItemKeys: {},
      skippedClassItemKeys: {},
      version: 1,
      showPending: false,
      loginReminder: false,
      reminderDue: false,
      reminderDueAt: '',
      reminderDueDateKey: '',
    },
  },
  'missing policy must fail closed instead of showing a false zero'
);

assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [] }).showPending, false);
assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [] }).loginReminder, false);
assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [], showPending: true, loginReminder: true }).showPending, true);
assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [], showPending: true, loginReminder: true }).loginReminder, true);
assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [], showPending: false }).showPending, false);
assert.strictEqual(Pending.normalizePendingPolicy({ status: 'ready', items: [], loginReminder: false }).loginReminder, false);

const VALID_REMINDER_POLICY = {
  status: 'ready',
  items: [],
  showPending: true,
  loginReminder: true,
  loadedAt: 1786284000000,
  reminderDue: true,
  reminderDueAt: 1786280400000,
  reminderDueDateKey: '2026-08-09',
};
assert.strictEqual(Pending.normalizePendingPolicy(VALID_REMINDER_POLICY).reminderDue, true, 'only a valid trusted server policy may enable reminder styling');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { reminderDue: 'true' })).reminderDue, false, 'string reminderDue must fail closed');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { loginReminder: false })).reminderDue, false, 'disabled login reminder must also keep the pending UI neutral');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { loadedAt: undefined })).reminderDue, false, 'missing server loadedAt must not fall back to device time');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { reminderDueAt: '1786280400000' })).reminderDue, false, 'non-numeric reminderDueAt must fail closed');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { reminderDueAt: 1786284000001 })).reminderDue, false, 'future reminderDueAt beyond loadedAt must fail closed');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { reminderDueDateKey: '2099-01-01' })).reminderDue, false, 'due date key must match the Asia/Taipei date derived from reminderDueAt');
assert.strictEqual(Pending.normalizePendingPolicy(Object.assign({}, VALID_REMINDER_POLICY, { reminderDueDateKey: '' })).reminderDue, false, 'production policy missing its due date key must fail closed');
assert.strictEqual(Pending.normalizeReminderDueDateKey('20260809', 0), '2026-08-09');

const reminderItems = [
  { taskId: 'old', date: '2026-08-08' },
  { taskId: 'same-day-partial', date: '8/9 小考' },
  { taskId: 'new-after-slot', date: '2026-08-10' },
];
const validReminderResult = {
  status: 'ready',
  items: reminderItems,
  policy: Pending.normalizePendingPolicy(VALID_REMINDER_POLICY),
};
assert.deepStrictEqual(
  Pending.getReminderDueItems(validReminderResult).map(item => item.taskId),
  ['old'],
  'only tasks strictly before the latest server reminder slot date may turn red'
);
assert.strictEqual(Pending.isReminderDueState(validReminderResult), true);
assert.strictEqual(Pending.isReminderDueState(Object.assign({}, validReminderResult, { items: [] })), false, 'completion must immediately clear reminder state');

function weeklyReminderPolicy(slotDateKey, loadedAt) {
  const reminderDueAt = Date.parse(slotDateKey + 'T15:00:00+08:00');
  return Pending.normalizePendingPolicy({
    status: 'ready',
    items: [],
    showPending: true,
    loginReminder: true,
    loadedAt,
    reminderDue: true,
    reminderDueAt,
    reminderDueDateKey: slotDateKey,
  });
}

const weeklyDerivedKinds = ['homework_done', 'homework_score', 'absence', 'makeup', 'makeup_result'];
function derivedTasksForPost(postDate, labelDate) {
  return weeklyDerivedKinds.map(kind => ({
    taskId: postDate + '-' + kind,
    kind,
    // Deliberately differs from the DailyPost date so this fixture proves
    // the reminder cycle follows the source post, not a legacy exam label.
    date: labelDate,
    reminderSourceDate: postDate,
    displayTarget: { postDate },
  }));
}

const aug8DerivedTasks = derivedTasksForPost('2026-08-08', '2026-08-01');
const aug8SlotAt = Date.parse('2026-08-08T15:00:00+08:00');
const aug15SlotAt = Date.parse('2026-08-15T15:00:00+08:00');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: aug8DerivedTasks,
    policy: weeklyReminderPolicy('2026-08-08', aug8SlotAt + 1),
  }),
  [],
  'all tasks introduced by the 8/8 DailyPost must stay neutral at the same-day 8/8 slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: aug8DerivedTasks,
    policy: weeklyReminderPolicy('2026-08-08', aug15SlotAt - 1),
  }),
  [],
  'all 8/8 DailyPost tasks must remain neutral immediately before the next weekly slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: aug8DerivedTasks,
    policy: weeklyReminderPolicy('2026-08-15', aug15SlotAt + 1),
  }).map(item => item.taskId),
  aug8DerivedTasks.map(item => item.taskId),
  '8/8 homework, exam, absence, makeup, and result tasks may turn red only after the 8/15 slot'
);
const aug15ReachedPolicy = weeklyReminderPolicy('2026-08-15', aug15SlotAt + 1);
const mixedOldAndCurrentResult = {
  status: 'ready',
  items: [
    { taskId: 'old-aug8', date: '2026-08-08', reminderSourceDate: '2026-08-08', displayTarget: { postDate: '2026-08-08' } },
    { taskId: 'current-aug15', date: '2026-08-15', reminderSourceDate: '2026-08-15', displayTarget: { postDate: '2026-08-15' } },
  ],
  policy: aug15ReachedPolicy,
};
assert.deepStrictEqual(
  Pending.getReminderDueItems(mixedOldAndCurrentResult).map(item => item.taskId),
  ['old-aug8'],
  'mixed old and current work must mark only the older reminder cycle as due'
);
assert.strictEqual(Pending.isReminderDueState(mixedOldAndCurrentResult), true, 'one old item keeps the overall pending state red');
const currentOnlyResult = {
  status: 'ready',
  items: [mixedOldAndCurrentResult.items[1]],
  policy: aug15ReachedPolicy,
};
assert.deepStrictEqual(Pending.getReminderDueItems(currentOnlyResult), [], 'same-day current work remains visible but is not due');
assert.strictEqual(Pending.isReminderDueState(currentOnlyResult), false, 'removing the final old item returns the overall state to amber');
assert.strictEqual(
  Pending.isReminderDueState({ status: 'ready', items: [], policy: aug15ReachedPolicy }),
  false,
  'completing every item leaves no reminder-due state'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: derivedTasksForPost('2026-08-08', '2026-08-01')
      .concat(derivedTasksForPost('2026-08-15', '2026-08-01'))
      .concat(derivedTasksForPost('2026-08-22', '2026-08-01')),
    policy: weeklyReminderPolicy('2026-08-22', Date.parse('2026-08-22T15:00:01+08:00')),
  }).map(item => item.taskId),
  derivedTasksForPost('2026-08-08', '2026-08-01')
    .concat(derivedTasksForPost('2026-08-15', '2026-08-01'))
    .map(item => item.taskId),
  'later weekly slots must include every prior DailyPost kind while keeping same-day work neutral'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: [{
      taskId: 'malformed-source-post',
      kind: 'makeup_result',
      date: '2026-08-01',
      reminderSourceDate: 'not-a-date',
      displayTarget: { postDate: 'not-a-date' },
    }],
    policy: weeklyReminderPolicy('2026-08-15', aug15SlotAt + 1),
  }),
  [],
  'a malformed explicit reminder source must fail closed instead of falling back to navigation metadata'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: [{
      taskId: 'stable-source-ignores-navigation-targets',
      kind: 'makeup_result',
      date: '2026-08-01',
      reminderSourceDate: '2026-08-08',
      displayTarget: { postDate: '2026-08-01' },
      paperTarget: { postDate: 'not-a-date' },
      reportTarget: { postDate: '2026-08-22' },
    }],
    policy: weeklyReminderPolicy('2026-08-15', aug15SlotAt + 1),
  }).map(item => item.taskId),
  ['stable-source-ignores-navigation-targets'],
  'an explicit stable source must not be replaced by malformed or later navigation targets'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: [{
      taskId: 'legacy-report-target-must-not-delay',
      kind: 'makeup_result',
      date: '2026-08-01',
      displayTarget: { postDate: '2026-08-01' },
      reportTarget: { postDate: '2027-08-08' },
    }],
    policy: weeklyReminderPolicy('2026-08-08', Date.parse('2026-08-08T15:00:01+08:00')),
  }).map(item => item.taskId),
  ['legacy-report-target-must-not-delay'],
  'legacy classification uses display/item fallback and must never consult a moving report target'
);
const rolloverTask = {
  taskId: 'adjacent-year-rollover',
  kind: 'makeup_result',
  date: '12/26 小考',
  reminderSourceDate: '2027-01-02',
  displayTarget: { postDate: '2026-12-26' },
  paperTarget: { postDate: '2027-01-02' },
  reportTarget: { postDate: '2027-01-02' },
};
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: [rolloverTask],
    policy: weeklyReminderPolicy('2027-01-02', Date.parse('2027-01-02T15:00:01+08:00')),
  }),
  [],
  'a valid adjacent-year target timeline remains neutral on its latest actionable post day'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: [rolloverTask],
    policy: weeklyReminderPolicy('2027-01-09', Date.parse('2027-01-09T15:00:01+08:00')),
  }).map(item => item.taskId),
  ['adjacent-year-rollover'],
  'a valid adjacent-year target timeline becomes due at the first later weekly slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: reminderItems,
    policy: Object.assign({}, validReminderResult.policy, { reminderDue: false }),
  }),
  [],
  'pre-due pending items remain visible but neutral'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: reminderItems,
    policy: Object.assign({}, validReminderResult.policy, { reminderDueDateKey: '', reminderDueAt: 0 }),
  }),
  [],
  'production policy without a trusted due date must fail closed'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: reminderItems,
    policy: {
      status: 'ready',
      loginReminder: true,
      reminderDue: true,
      reminderDueAt: VALID_REMINDER_POLICY.reminderDueAt,
      reminderDueDateKey: '2099-01-01',
    },
  }),
  [],
  'the item classifier must independently reject a mismatched dueAt/dateKey pair'
);
assert.strictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: reminderItems,
    policy: { status: 'ready', loginReminder: true, reminderDue: true, previewReminderDueAll: true },
  }).length,
  reminderItems.length,
  'an explicit local draft fixture may preview the due state without a date'
);
assert.strictEqual(Pending.getReminderDueItems.toString().includes('Date.now'), false, 'due classification must not use the device clock');

assert.strictEqual(Pending.monthDayKey('2026-08-09'), '8/9');
assert.strictEqual(Pending.monthDayKey('8/9 小考'), '8/9');
assert.strictEqual(Pending.monthDayKey('2026/2/29 小考'), '', 'an invalid full-year token must not fall back to a legacy leap-day identity');
assert.strictEqual(Pending.dateIdentityParts('2026/2/29 小考'), null, 'invalid full dates fail closed before any M/D matching');
assert.strictEqual(Pending.monthDayKey('第1-8章'), '', 'chapter ranges are not dates');
assert.deepStrictEqual(
  Pending.selectYearAwareDateMatches(
    [{ id: 'old', date: '2025/8/9' }, { id: 'current', date: '2026/8/9' }, { id: 'legacy', date: '8/9' }],
    '2026/8/9',
    item => item.date
  ).map(item => item.id),
  ['current'],
  'a complete date selects only its exact year before considering legacy fallback'
);

const dashboardIdentity = DashboardSkips.buildIdentity({
  type: 'homework_report',
  classKey: CURRENT_CLASS,
  studentKey: STUDENT_KEY,
  sourceClassKey: '114小六資優自然週六上午班',
  sourceItemId: '2026-08-09',
});
const ebookIdentity = Pending.buildSkipIdentity({
  itemType: 'homework_report',
  classKey: CURRENT_CLASS,
  studentKey: STUDENT_KEY,
  sourceClassKey: '114小六資優自然週六上午班',
  sourceItemId: '2026-08-09',
});
assert.strictEqual(ebookIdentity.itemKey, dashboardIdentity.itemKey, 'legacy date skip hash must match Dashboard exactly');
assert.strictEqual(ebookIdentity.lookupKey, dashboardIdentity.lookupKey, 'legacy date skip lookup path must match Dashboard exactly');

const transferPost = {
  id: 'daily_post_old_class_exact_id',
  dailyPostId: 'rtdb_row_key_old_class_exact',
  date: '2026-08-09',
  hw1: '完成講義第 3 頁',
  storedClassKey: '114小六資優自然週六上午班',
  storedClassName: '114小六資優自然週六上午班',
  sourceClassKey: '114小六資優自然週六上午班',
  isTransferFormerClass: true,
};
const doneFlowResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(doneFlowResult.items.length, 1);
assert.strictEqual(doneFlowResult.items[0].kind, 'homework_done');
assert.strictEqual(doneFlowResult.items[0].sourceItemId, transferPost.id, 'new identity uses the exact post id');
assert.strictEqual(doneFlowResult.items[0].legacySkipIdentities[0].itemKey, dashboardIdentity.itemKey, 'legacy date skip remains honored');
assert.strictEqual(doneFlowResult.items[0].displayTarget.dailyPostId, transferPost.dailyPostId, 'navigation must retain the exact RTDB row key');
assert.strictEqual(doneFlowResult.items[0].writeTarget.dailyPostId, transferPost.dailyPostId, 'write must retain the exact RTDB row key');
assert.strictEqual(doneFlowResult.items[0].writeTarget.sourceItemId, transferPost.id, 'write also retains the embedded source item id for audit compatibility');
assert.strictEqual(doneFlowResult.items[0].writeTarget.storedClassKey, transferPost.storedClassKey, 'transfer write must retain stored class');

const keyChangingTransferPost = Object.assign({}, transferPost, { sourceStudentKey: 'old-key' });
const keyChangingTransferDone = Pending.buildPendingTasks(baseOptions({
  posts: [keyChangingTransferPost],
  studentKeysByClassKey: {
    [CURRENT_CLASS]: [STUDENT_KEY],
    [transferPost.storedClassKey]: ['old-key'],
  },
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: {
      'old-key': { '2026/08/09': { status: 'done' } },
    },
    [CURRENT_CLASS]: { [STUDENT_KEY]: {} },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(keyChangingTransferDone.items.length, 0, 'historical-key completion must remove the exact transfer task');
const keyChangingTransferPending = Pending.buildPendingTasks(baseOptions({
  posts: [keyChangingTransferPost],
  studentKeysByClassKey: {
    [CURRENT_CLASS]: [STUDENT_KEY],
    [transferPost.storedClassKey]: ['old-key'],
  },
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: { 'old-key': {} },
    [CURRENT_CLASS]: { [STUDENT_KEY]: {} },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(keyChangingTransferPending.items.length, 1);
assert.strictEqual(keyChangingTransferPending.items[0].writeTarget.sourceStudentKey, 'old-key', 'pending write target must preserve the historical student key');

const doneResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  homeworkDone: { '2026/08/09': { status: 'done' } },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(doneResult.items.length, 0, 'done-flow completion must remove the task');

const singleClassWrongMetadataResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  homeworkDone: {
    '2026/08/09': {
      status: 'done',
      sourceClassKey: transferPost.sourceClassKey,
      sourceItemId: 'different-post-id',
      dailyPostId: 'different-row-key',
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  singleClassWrongMetadataResult.items.map(item => item.sourceItemId),
  [transferPost.id],
  'single-class flat done data with mismatched exact post metadata must fail closed'
);
const conflictingRowMetadataResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  homeworkDone: {
    '2026/08/09': {
      status: 'done',
      sourceClassKey: transferPost.sourceClassKey,
      sourceItemId: transferPost.id,
      sourceDailyPostId: 'different-row-key',
      dailyPostId: transferPost.id,
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  conflictingRowMetadataResult.items.map(item => item.sourceItemId),
  [transferPost.id],
  'a matching embedded ID must not hide a conflicting RTDB row-key marker'
);
const exactGasMetadataResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  homeworkDone: {
    '2026/08/09': {
      status: 'done',
      sourceClassKey: transferPost.sourceClassKey,
      sourceItemId: transferPost.id,
      sourceDailyPostId: transferPost.dailyPostId,
      dailyPostId: transferPost.id,
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(exactGasMetadataResult.items.length, 0, 'GAS embedded-ID plus RTDB-row-key metadata must complete the exact post');
const exactOptimisticMetadataResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  homeworkDone: {
    '2026/08/09': {
      status: 'done',
      sourceClassKey: transferPost.sourceClassKey,
      sourceItemId: transferPost.id,
      sourceDailyPostId: transferPost.dailyPostId,
      dailyPostId: transferPost.dailyPostId,
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(exactOptimisticMetadataResult.items.length, 0, 'optimistic embedded-ID plus RTDB-row-key metadata must complete the exact post');

const sameClassSecondPost = Object.assign({}, transferPost, {
  id: 'daily_post_same_class_second',
  dailyPostId: 'rtdb_row_key_same_class_second',
  hw1: '完成講義第 4 頁',
});
const sameClassAmbiguousDoneResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost, sameClassSecondPost],
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: {
      [STUDENT_KEY]: { '2026/08/09': { status: 'done' } },
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  sameClassAmbiguousDoneResult.items.map(item => item.sourceItemId),
  [transferPost.id, sameClassSecondPost.id],
  'an unscoped same-class same-date completion must fail closed for both posts'
);
const sameClassOnlyMetadataResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost, sameClassSecondPost],
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: {
      [STUDENT_KEY]: {
        '2026/08/09': { status: 'done', sourceClassKey: transferPost.sourceClassKey },
      },
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  sameClassOnlyMetadataResult.items.map(item => item.sourceItemId),
  [transferPost.id, sameClassSecondPost.id],
  'class-only metadata cannot disambiguate two same-class same-date posts'
);
const sameClassTextMatchedDoneResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost, sameClassSecondPost],
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: {
      [STUDENT_KEY]: {
        '2026/08/09': { status: 'done', homeworkText: transferPost.hw1 },
      },
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  sameClassTextMatchedDoneResult.items.map(item => item.sourceItemId),
  [sameClassSecondPost.id],
  'legacy homeworkText may complete only the exact same-class same-date post'
);
const sameClassFlatAmbiguousDoneResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost, sameClassSecondPost],
  homeworkDone: { '2026/08/09': { status: 'done' } },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  sameClassFlatAmbiguousDoneResult.items.map(item => item.sourceItemId),
  [transferPost.id, sameClassSecondPost.id],
  'the flat compatibility path must also fail closed for same-class same-date ambiguity'
);

const sameDateCurrentPost = Object.assign({}, transferPost, {
  id: 'daily_post_current_same_date',
  dailyPostId: 'rtdb_row_key_current_same_date',
  storedClassKey: CURRENT_CLASS,
  storedClassName: CURRENT_CLASS,
  sourceClassKey: CURRENT_CLASS,
  isTransferFormerClass: false,
});
const scopedSameDateResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost, sameDateCurrentPost],
  // This flat value simulates the lossy merged view and must not mark both posts done.
  homeworkDone: { '2026/08/09': { status: 'done' } },
  cohortHomeworkDoneRoot: {
    [transferPost.storedClassKey]: {
      [STUDENT_KEY]: { '2026/08/09': { status: 'done' } },
    },
    [CURRENT_CLASS]: {
      [STUDENT_KEY]: {},
    },
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  scopedSameDateResult.items.map(item => item.sourceItemId),
  [sameDateCurrentPost.id],
  'same-date former/current homework must resolve done state by exact source class instead of the lossy flat map'
);

const PROMOTED_OLD_CLASS = '114國一自然超前班';
const PROMOTED_CURRENT_CLASS = '115國二自然超前班';
const promotedOldPost = Object.assign({}, transferPost, {
  id: 'natural_advanced_old_post',
  dailyPostId: 'natural_advanced_old_row',
  storedClassKey: PROMOTED_OLD_CLASS,
  storedClassName: PROMOTED_OLD_CLASS,
  sourceClassKey: PROMOTED_OLD_CLASS,
  isTransferFormerClass: false,
});
const promotedHelpers = Object.assign({}, baseOptions().helpers, {
  shouldUseHomeworkDoneFlowForClass: () => true,
  shouldUseHomeworkDoneFlowForPost: () => true,
  isSameSource: (left, right) => [left, right].every(value => [PROMOTED_OLD_CLASS, PROMOTED_CURRENT_CLASS].includes(value)),
});
const promotedLegacyDoneResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  posts: [promotedOldPost],
  cohortHomeworkDoneRoot: {
    [PROMOTED_OLD_CLASS]: { [STUDENT_KEY]: {} },
    [PROMOTED_CURRENT_CLASS]: {
      [STUDENT_KEY]: { '2026/08/09': { status: 'done' } },
    },
  },
  helpers: promotedHelpers,
}));
assert.strictEqual(
  promotedLegacyDoneResult.items.length,
  0,
  'a promoted natural-advanced legacy completion may fall back to the current class when no same-date current post exists'
);

const promotedCurrentSameDatePost = Object.assign({}, promotedOldPost, {
  id: 'natural_advanced_current_post',
  dailyPostId: 'natural_advanced_current_row',
  hw1: '目前班不同作業',
  storedClassKey: PROMOTED_CURRENT_CLASS,
  storedClassName: PROMOTED_CURRENT_CLASS,
  sourceClassKey: PROMOTED_CURRENT_CLASS,
});
const promotedConflictResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  posts: [promotedOldPost, promotedCurrentSameDatePost],
  cohortHomeworkDoneRoot: {
    [PROMOTED_OLD_CLASS]: { [STUDENT_KEY]: {} },
    [PROMOTED_CURRENT_CLASS]: {
      [STUDENT_KEY]: { '2026/08/09': { status: 'done', homeworkText: '目前班不同作業' } },
    },
  },
  helpers: promotedHelpers,
}));
assert.deepStrictEqual(
  promotedConflictResult.items.map(item => item.sourceItemId),
  [promotedOldPost.id],
  'a same-date current-class post keeps an unscoped legacy completion from leaking into the promoted old post'
);

const promotedLegacyOldTextResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  posts: [promotedOldPost, promotedCurrentSameDatePost],
  cohortHomeworkDoneRoot: {
    [PROMOTED_OLD_CLASS]: { [STUDENT_KEY]: {} },
    [PROMOTED_CURRENT_CLASS]: {
      [STUDENT_KEY]: { '2026/08/09': { status: 'done', homeworkText: '完成講義第 3 頁' } },
    },
  },
  helpers: promotedHelpers,
}));
assert.deepStrictEqual(
  promotedLegacyOldTextResult.items.map(item => item.sourceItemId),
  [promotedCurrentSameDatePost.id],
  'authoritative legacy text stored under the current class must complete only the matching old alias post'
);

const promotedExactMetadataResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  posts: [promotedOldPost, promotedCurrentSameDatePost],
  cohortHomeworkDoneRoot: {
    [PROMOTED_OLD_CLASS]: { [STUDENT_KEY]: {} },
    [PROMOTED_CURRENT_CLASS]: {
      [STUDENT_KEY]: {
        '2026/08/09': {
          status: 'done',
          sourceClassKey: PROMOTED_OLD_CLASS,
          sourceItemId: promotedOldPost.id,
          homeworkText: '完成講義第 3 頁',
        },
      },
    },
  },
  helpers: promotedHelpers,
}));
assert.deepStrictEqual(
  promotedExactMetadataResult.items.map(item => item.sourceItemId),
  [promotedCurrentSameDatePost.id],
  'exact old-post metadata must complete only the promoted old post and keep same-date current homework pending'
);

const duplicateGradeResult = Pending.buildPendingTasks(baseOptions({
  posts: [Object.assign({}, transferPost, { isTransferFormerClass: false })],
  grades: [{
    date: '8/9 作業',
    exam: '講義第 3 頁',
    score: '#N/A',
    colIndex: 18,
    storedClassKey: transferPost.storedClassKey,
  }],
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(duplicateGradeResult.items.length, 1, 'same source/date grade must not duplicate a done-flow post');
assert.strictEqual(duplicateGradeResult.items[0].kind, 'homework_done');

const crossYearDoneFlowResult = Pending.buildPendingTasks(baseOptions({
  posts: [{
    id: 'post_2026_same_month_day',
    dailyPostId: 'row_2026_same_month_day',
    date: '2026-08-09',
    hw1: '2026 按鈕作業',
    storedClassKey: CURRENT_CLASS,
    storedClassName: CURRENT_CLASS,
    sourceClassKey: CURRENT_CLASS,
  }],
  grades: [{
    date: '2025/8/9 作業',
    exam: '2025 成績欄作業',
    score: '#N/A',
    colIndex: 18,
    storedClassKey: CURRENT_CLASS,
    storedClassName: CURRENT_CLASS,
  }],
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => false,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.deepStrictEqual(
  crossYearDoneFlowResult.items.map(item => item.kind).sort(),
  ['homework_done', 'homework_score'],
  'a 2026 done-flow post must not hide a 2025 same-month/day score homework'
);

const giftedGrades = ['', '#N/A', '0', 0].map((score, index) => ({
  date: '2026/8/8 作業',
  exam: `資優作業 ${index + 1}`,
  score,
  scoreNum: score === 0 ? 0 : null,
  colIndex: index + 10,
  storedClassKey: CURRENT_CLASS,
}));
giftedGrades.push({ date: '2026/8/8 作業', exam: '已完成', score: '28', scoreNum: 28, colIndex: 15, storedClassKey: CURRENT_CLASS });
const giftedResult = Pending.buildPendingTasks(baseOptions({ grades: giftedGrades }));
assert.strictEqual(giftedResult.items.length, 4, 'gifted blank/#N/A/string zero/numeric zero are all pending');
assert.ok(giftedResult.items.every(item => item.kind === 'homework_score'));

const stableHomeworkGrade = {
  date: '2026/8/8 作業',
  exam: '穩定作業身分',
  score: '#N/A',
  colIndex: 77,
  examId: 'display_homework_stable',
  storedExamId: 'stored_homework_stable',
  storedClassKey: CURRENT_CLASS,
};
const stableHomeworkResult = Pending.buildPendingTasks(baseOptions({ grades: [stableHomeworkGrade] }));
assert.strictEqual(stableHomeworkResult.items[0].sourceItemId, stableHomeworkGrade.storedExamId, 'grade homework uses stable ExamID before mutable col_N');
assert.ok(stableHomeworkResult.items[0].legacySkipIdentities.some(identity => identity.sourceItemId === 'col_77'), 'col_N remains a legacy skip identity');
const legacyHomeworkSkip = stableHomeworkResult.items[0].legacySkipIdentities.find(identity => identity.sourceItemId === 'col_77');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  grades: [stableHomeworkGrade],
  pendingPolicy: { status: 'ready', skippedItemKeys: [legacyHomeworkSkip.itemKey] },
})).items.length, 0, 'an existing col_N exclusion continues to suppress the ExamID-based task');

const timedGradeHomework = Object.assign({}, stableHomeworkGrade, {
  date: '2026/8/15 作業',
  colIndex: 80,
  examId: 'timed_grade_homework',
  storedExamId: 'timed_grade_homework',
});
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T11:59:59+08:00'),
  grades: [timedGradeHomework],
})).items.length, 0, 'GoogleSheet grade homework stays hidden during its class session');
const timedGradeHomeworkAfterClass = Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T12:00:00+08:00'),
  grades: [timedGradeHomework],
}));
assert.strictEqual(timedGradeHomeworkAfterClass.items.length, 0, 'a same-day GoogleSheet grade stays hidden until its public DailyPost exists, even at class end');

function getGradeHomeworkEligibility(now, sessionPosts, exam = timedGradeHomework) {
  const options = baseOptions({
    now: new Date(now),
    posts: [],
    sessionPosts,
    grades: [exam],
  });
  return Pending.resolveGradeHomeworkTaskEligibility(
    options,
    Pending.normalizePendingPolicy(options.pendingPolicy),
    exam,
    {
      classKey: CURRENT_CLASS,
      className: CURRENT_CLASS,
      studentKey: STUDENT_KEY,
      helpers: options.helpers,
    },
    options.helpers
  );
}

const futureExactGradePost = {
  id: 'future_exact_grade_post',
  date: '2026-08-15',
  reserveTime: '2026-08-15 13:00:00',
  sourceClassKey: CURRENT_CLASS,
};
const futureGradeEligibility = getGradeHomeworkEligibility(
  '2026-08-15T12:00:00+08:00',
  [futureExactGradePost]
);
assert.strictEqual(futureGradeEligibility.allowed, false);
assert.strictEqual(futureGradeEligibility.reason, 'source_daily_post_not_published', 'grade homework cannot appear before its exact DailyPost reserveTime even after class end');
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', []).reason,
  'source_daily_post_not_published',
  'the public student snapshot cannot use a same-day no-post source-record fallback'
);
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-14T16:00:00Z', []).reason,
  'source_daily_post_not_published',
  'same-day no-post protection derives today from trusted Asia/Taipei time rather than the device timezone'
);
const historicalNoPostHomework = Object.assign({}, timedGradeHomework, {
  date: '2026/8/8 作業',
  examId: 'historical_no_post_homework',
  storedExamId: 'historical_no_post_homework',
});
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', [], historicalNoPostHomework).allowed,
  true,
  'a prior-date grade-only row retains the bounded historical source-record fallback'
);
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T12:00:00+08:00'),
  posts: [],
  sessionPosts: [futureExactGradePost],
  grades: [timedGradeHomework],
})).items.length, 0, 'the raw future session post blocks the production pending-task build');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T13:00:00+08:00'),
  posts: [futureExactGradePost],
  sessionPosts: [futureExactGradePost],
  grades: [timedGradeHomework],
})).items.length, 1, 'grade homework appears once both publication and session-end gates have passed');

const malformedExactGradePost = Object.assign({}, futureExactGradePost, {
  id: 'malformed_exact_grade_post',
  reserveTime: '2026-08-15 下午 1:00',
});
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T14:00:00+08:00', [malformedExactGradePost]).reason,
  'invalid_daily_post_reserve_time',
  'a malformed matching DailyPost reserveTime fails closed'
);
[
  '2026-08-15',
  '2026-08-15T10:30:00+0800',
].forEach(reserveTime => {
  assert.strictEqual(
    getGradeHomeworkEligibility('2026-08-15T14:00:00+08:00', [Object.assign({}, futureExactGradePost, { reserveTime })]).reason,
    'invalid_daily_post_reserve_time',
    `${reserveTime} is not part of the shared strict reserveTime contract`
  );
});
[
  '2026-08-15T10:30:00+08:00',
  '2026-08-15T02:30:00Z',
  Date.parse('2026-08-15T10:30:00+08:00'),
  new Date('2026-08-15T10:30:00+08:00'),
].forEach(reserveTime => {
  assert.strictEqual(
    getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', [Object.assign({}, futureExactGradePost, { reserveTime })]).allowed,
    true,
    `${reserveTime} remains a valid explicitly-zoned publication instant`
  );
});

const effectiveExactGradePost = Object.assign({}, futureExactGradePost, {
  id: 'effective_exact_grade_post',
  reserveTime: '2026-08-15 10:30:00',
});
const effectiveLegacyGradePost = {
  id: 'effective_legacy_grade_post',
  date: '8/15',
  reserveTime: '2026-08-15 10:30:00',
  sourceClassKey: CURRENT_CLASS,
};
const futureLegacyGradePost = Object.assign({}, effectiveLegacyGradePost, {
  id: 'future_legacy_grade_post',
  reserveTime: '2026-08-15 13:00:00',
});
[
  [futureExactGradePost, effectiveLegacyGradePost],
  [effectiveLegacyGradePost, futureExactGradePost],
].forEach(sessionPosts => {
  const eligibility = getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', sessionPosts);
  assert.strictEqual(eligibility.allowed, false);
  assert.strictEqual(eligibility.reason, 'source_daily_post_not_published', 'an effective legacy M/D row cannot bypass the future exact-year post regardless of array order');
});
[
  [effectiveExactGradePost, futureLegacyGradePost],
  [futureLegacyGradePost, effectiveExactGradePost],
].forEach(sessionPosts => {
  assert.strictEqual(
    getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', sessionPosts).allowed,
    true,
    'the effective exact-year post remains authoritative over a future legacy row regardless of array order'
  );
});

const futureRescheduledGradePost = Object.assign({}, futureExactGradePost, {
  id: 'future_rescheduled_grade_post',
  displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-15', '14:00', '17:00') },
});
const futureCompanionSession = getGradeHomeworkEligibility(
  '2026-08-15T12:00:00+08:00',
  [effectiveExactGradePost, futureRescheduledGradePost]
);
assert.strictEqual(futureCompanionSession.allowed, false);
assert.strictEqual(futureCompanionSession.reason, 'homework_session_not_ended', 'future companion metadata still defines the formal date-level rescheduled session');
assert.strictEqual(futureCompanionSession.eligibleAt, Date.parse('2026-08-15T17:00:00+08:00'));
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T17:00:00+08:00', [effectiveExactGradePost, futureRescheduledGradePost]).allowed,
  true,
  'the future companion override unlocks only after both its reserveTime and rescheduled endTime'
);

const effectiveRescheduledGradePost = Object.assign({}, effectiveExactGradePost, {
  id: 'effective_rescheduled_grade_post',
  displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-15', '14:00', '17:00') },
});
const conflictingFutureGradePost = Object.assign({}, futureRescheduledGradePost, {
  id: 'conflicting_future_grade_post',
  displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-15', '14:00', '18:00') },
});
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', [effectiveRescheduledGradePost, conflictingFutureGradePost]).reason,
  'ambiguous_class_session_override',
  'a conflicting future companion override cannot be ignored just because another same-date post is published'
);
const unknownFutureGradePost = Object.assign({}, futureExactGradePost, {
  id: 'unknown_future_grade_post',
  displayOptions: { session: { status: 'moved' } },
});
assert.strictEqual(
  getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', [effectiveExactGradePost, unknownFutureGradePost]).reason,
  'invalid_class_session_override',
  'unknown future companion metadata keeps the entire date-level session fail closed'
);
[
  [effectiveExactGradePost, futureExactGradePost],
  [futureExactGradePost, effectiveExactGradePost],
].forEach(sessionPosts => {
  assert.strictEqual(
    getGradeHomeworkEligibility('2026-08-15T12:00:00+08:00', sessionPosts).allowed,
    true,
    'one effective exact same-date post is sufficient for the publication gate regardless of array order'
  );
});
[
  [effectiveExactGradePost, malformedExactGradePost],
  [malformedExactGradePost, effectiveExactGradePost],
].forEach(sessionPosts => {
  assert.strictEqual(
    getGradeHomeworkEligibility('2026-08-15T14:00:00+08:00', sessionPosts).reason,
    'invalid_daily_post_reserve_time',
    'any malformed exact same-date publication record keeps the grade task fail closed regardless of array order'
  );
});

const crossYearLegacyHomeworkOrder = Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-01-03T12:00:00+08:00'),
  posts: [
    { id: 'legacy_dec_post', date: '2025-12-27', sourceClassKey: CURRENT_CLASS },
    { id: 'legacy_jan_post', date: '2026-01-03', sourceClassKey: CURRENT_CLASS },
  ],
  grades: [
    { date: '12/27 作業', exam: '跨年前作業', score: '#N/A', colIndex: 90, storedClassKey: CURRENT_CLASS },
    { date: '1/3 作業', exam: '跨年後作業', score: '#N/A', colIndex: 91, storedClassKey: CURRENT_CLASS },
  ],
}));
assert.deepStrictEqual(
  crossYearLegacyHomeworkOrder.items.map(item => item.title),
  ['1/3 作業 跨年後作業', '12/27 作業 跨年前作業'],
  'legacy M/D tasks sort by their exact DailyPost anchors instead of the browser year'
);

const duringClassButtonPost = {
  id: 'during_class_button_post',
  date: '2026-08-15',
  reserveTime: '2026-08-15 10:30:00',
  sourceClassKey: CURRENT_CLASS,
  storedClassKey: CURRENT_CLASS,
  hw1: '按我已完成',
};
const duringClassButtonResult = Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T10:31:00+08:00'),
  posts: [duringClassButtonPost],
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(duringClassButtonResult.items.length, 1, 'button homework appears immediately after its DailyPost reserveTime');
assert.strictEqual(duringClassButtonResult.items[0].kind, 'homework_done');
assert.deepStrictEqual(Pending.getReminderDueItems(duringClassButtonResult), [], 'newly published button homework remains neutral during class');

const rescheduledSundayHomework = Object.assign({}, timedGradeHomework, {
  date: '2026/8/16 作業',
  colIndex: 81,
  examId: 'rescheduled_sunday_homework',
  storedExamId: 'rescheduled_sunday_homework',
});
const rescheduledSundayPost = {
  id: 'rescheduled_sunday_post',
  date: '2026-08-16',
  sourceClassKey: CURRENT_CLASS,
  displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-16', '14:00', '17:00') },
};
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-16T16:59:59+08:00'),
  posts: [rescheduledSundayPost],
  grades: [rescheduledSundayHomework],
})).items.length, 0, 'a Saturday class moved to Sunday stays hidden during the override session');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-16T17:00:00+08:00'),
  posts: [rescheduledSundayPost],
  grades: [rescheduledSundayHomework],
})).items.length, 1, 'a complete one-off reschedule unlocks grade homework at override endTime');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-16T21:00:00+08:00'),
  posts: [Object.assign({}, rescheduledSundayPost, {
    displayOptions: { session: { status: 'cancelled', startTime: '14:00', endTime: '17:00' } },
  })],
  grades: [rescheduledSundayHomework],
})).items.length, 0, 'a cancelled one-off session never creates grade homework pending');
const sundayClass = '115小六資優自然週日下午班';
const mondayHomework = Object.assign({}, timedGradeHomework, {
  date: '2026/8/17 作業',
  examId: 'sunday_class_monday_homework',
  storedExamId: 'sunday_class_monday_homework',
  storedClassKey: sundayClass,
  storedClassName: sundayClass,
});
const mondayRescheduledPost = {
  id: 'sunday_class_monday_post',
  date: '2026-08-17',
  sourceClassKey: sundayClass,
  className: sundayClass,
  displayOptions: { session: rescheduledSession(sundayClass, '2026-08-17', '14:00', '17:00') },
};
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  classKey: sundayClass,
  className: sundayClass,
  now: new Date('2026-08-17T17:00:00+08:00'),
  posts: [mondayRescheduledPost],
  grades: [mondayHomework],
})).items.length, 1, 'a complete Sunday-class override may safely move the session to Monday');
[null, false, ''].forEach(invalidWeekday => {
  assert.strictEqual(Pending.buildPendingTasks(baseOptions({
    classKey: sundayClass,
    className: sundayClass,
    now: new Date('2026-08-17T17:00:00+08:00'),
    posts: [Object.assign({}, mondayRescheduledPost, {
      displayOptions: { session: rescheduledSession(sundayClass, '2026-08-17', '14:00', '17:00', { originalWeekday: invalidWeekday }) },
    })],
    grades: [mondayHomework],
  })).items.length, 0, 'an invalid Sunday originalWeekday cannot coerce into a complete override');
});
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T13:00:00+08:00'),
  grades: [Object.assign({}, timedGradeHomework, { date: '8/15 作業' })],
})).items.length, 0, 'a partial homework date without a full DailyPost anchor fails closed');

const sourceClassFlowResult = Pending.buildPendingTasks(baseOptions({
  className: '115國二自然超前班',
  grades: [{
    date: '2026/8/8 作業',
    exam: '資優班作業',
    score: '#N/A',
    colIndex: 17,
    storedClassName: '115小六資優自然週六上午班',
    storedClassKey: '115小六資優自然週六上午班',
  }],
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: className => className.includes('自然超前'),
  }),
}));
assert.strictEqual(sourceClassFlowResult.items.length, 1, 'grade flow must follow the exam source class, not the current transferred class');
assert.strictEqual(sourceClassFlowResult.items[0].kind, 'homework_score');

const formerGradeReadOnlyResult = Pending.buildPendingTasks(baseOptions({
  grades: [{
    date: '8/1 小考',
    exam: '轉班前小考',
    score: '假',
    scoreNum: null,
    colIndex: 19,
    examId: 'former_exam',
    storedClassKey: '原班',
    isTransferFormerClass: true,
  }],
}));
assert.strictEqual(formerGradeReadOnlyResult.items.length, 0, 'former-class grades remain read-only and must not create an impossible action');

const unflaggedFormerGradeResult = Pending.buildPendingTasks(baseOptions({
  grades: [{
    date: '8/1 小考',
    exam: '未標旗標的轉班前小考',
    score: '假',
    scoreNum: null,
    colIndex: 20,
    examId: 'former_exam_without_flag',
    sourceClassKey: '114原班',
    sourceClassName: '114原班',
    storedClassKey: CURRENT_CLASS,
  }],
}));
assert.strictEqual(unflaggedFormerGradeResult.items.length, 0, 'semantic source class must keep former exams read-only even when the legacy flag is absent');

const nameOnlyFormerGradeResult = Pending.buildPendingTasks(baseOptions({
  grades: [{
    date: '8/1 小考',
    exam: '只保留來源班名的轉班前小考',
    score: '假',
    scoreNum: null,
    colIndex: 20,
    examId: 'former_exam_name_only',
    sourceClassName: '114原班',
    storedClassKey: CURRENT_CLASS,
  }],
}));
assert.strictEqual(nameOnlyFormerGradeResult.items.length, 0, 'a former sourceClassName must not become writable merely because storage moved to the current class');

const advancedCurrentClass = '115國二自然超前班';
const advancedAliasClass = '114國一自然超前班';
const aliasGradeResult = Pending.buildPendingTasks(baseOptions({
  classKey: advancedCurrentClass,
  className: advancedCurrentClass,
  grades: [{
    date: '8/1 小考',
    exam: '同梯自然超前小考',
    score: '假',
    scoreNum: null,
    colIndex: 21,
    examId: 'advanced_alias_exam',
    sourceClassKey: advancedAliasClass,
    sourceClassName: advancedAliasClass,
    storedClassKey: advancedCurrentClass,
  }],
  helpers: Object.assign({}, baseOptions().helpers, {
    isExamSourceClassWritable: (_exam, sourceClassKey) => sourceClassKey === advancedAliasClass,
  }),
}));
assert.strictEqual(aliasGradeResult.items.length, 1, 'same-cohort natural-advanced alias remains writable');
assert.strictEqual(aliasGradeResult.items[0].writeTarget.storedClassKey, advancedCurrentClass, 'alias feedback writes to the exact stored class');

const enrollmentDayResult = Pending.buildPendingTasks(baseOptions({
  grades: [
    { date: '2026/8/8 小考', exam: '一般鑑定考', score: '', scoreNum: null, colIndex: 20, examId: 'exam_regular' },
    { date: '2026/8/8 作業', exam: '第一堂作業', score: '#N/A', scoreNum: null, colIndex: 21, examId: 'exam_homework' },
  ],
  helpers: Object.assign({}, baseOptions().helpers, {
    isEnrollmentExemptExam: exam => exam.exam === '一般鑑定考',
  }),
}));
assert.deepStrictEqual(
  enrollmentDayResult.items.map(item => item.kind),
  ['homework_score'],
  'enrollment-day regular exams are exempt while same-day homework remains pending'
);

const absenceExam = {
  date: '8/2 小考',
  exam: '生物第 1 章',
  score: '假',
  scoreNum: null,
  colIndex: 30,
  examId: 'exam_absence',
  storedExamId: 'stored_absence',
  storedClassKey: CURRENT_CLASS,
};
const absenceResult = Pending.buildPendingTasks(baseOptions({ grades: [absenceExam] }));
assert.strictEqual(absenceResult.items.length, 1, 'pure absence must not be coerced to score zero');
assert.strictEqual(absenceResult.items[0].kind, 'absence');
assert.strictEqual(absenceResult.items[0].neutralLabel, '請假考試待補');
assert.strictEqual(absenceResult.items[0].displayTarget, null, 'absence report navigation without an exact DailyPost ExamID mapping must fail closed');
assert.strictEqual(absenceResult.items[0].writeTarget.storedExamId, 'stored_absence');
assert.ok(absenceResult.items[0].legacySkipIdentities.some(identity => identity.sourceItemId === 'col_30'), 'ExamID absence keeps its legacy col_N skip identity');

const secondSameDayAbsenceExam = Object.assign({}, absenceExam, {
  date: '8/2 隨堂',
  exam: '生物第 2 章',
  colIndex: 31,
  examId: 'exam_absence_second',
  storedExamId: 'stored_absence_second',
});
const twoSameDayAbsences = Pending.buildPendingTasks(baseOptions({
  grades: [absenceExam, secondSameDayAbsenceExam],
}));
assert.strictEqual(twoSameDayAbsences.items.length, 2, 'two same-day absences with distinct ExamIDs must produce two pending cards');
assert.strictEqual(new Set(twoSameDayAbsences.items.map(item => item.taskId)).size, 2, 'same-day absence task identity must remain ExamID-scoped');

const twoMappedExamPaperPost = {
  id: 'two_mapped_exam_papers',
  date: '2026-08-02',
  sourceClassKey: CURRENT_CLASS,
  quiz: '[隨堂考卷]https://example.com/classroom.pdf\n[小考卷]https://example.com/quiz.pdf',
  displayOptions: {
    quiz: {
      slot1Role: 'question',
      slot1Exam: { targetExamId: secondSameDayAbsenceExam.examId, sourceClassKey: CURRENT_CLASS },
      slot2Role: 'question',
      slot2Exam: { targetExamId: absenceExam.examId, sourceClassKey: CURRENT_CLASS },
    },
  },
  examData: {
    main: absenceExam,
    exams: [
      { main: secondSameDayAbsenceExam, others: [] },
      { main: absenceExam, others: [] },
    ],
  },
};
const twoMappedExamAbsences = Pending.buildPendingTasks(baseOptions({
  posts: [twoMappedExamPaperPost],
  grades: [absenceExam, secondSameDayAbsenceExam],
}));
assert.strictEqual(twoMappedExamAbsences.items.length, 2, 'two exact per-paper ExamID mappings keep both absence tasks');
const twoMappedExamTargets = Object.fromEntries(twoMappedExamAbsences.items.map(item => [item.sourceItemId, item.paperTarget]));
assert.strictEqual(twoMappedExamTargets[absenceExam.storedExamId].dailyPostId, twoMappedExamPaperPost.id, 'small quiz absence keeps its exact mapped paper target');
assert.strictEqual(twoMappedExamTargets[absenceExam.storedExamId].examId, absenceExam.examId, 'small quiz paper target retains its own ExamID');
assert.strictEqual(twoMappedExamTargets[secondSameDayAbsenceExam.storedExamId].dailyPostId, twoMappedExamPaperPost.id, 'classroom exam absence keeps its exact mapped paper target');
assert.strictEqual(twoMappedExamTargets[secondSameDayAbsenceExam.storedExamId].examId, secondSameDayAbsenceExam.examId, 'classroom paper target retains its own ExamID');

const absencePaper = {
  id: 'absence_paper_exact',
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
  makeup: '[補考卷]https://example.com/absence-exact.pdf',
  displayOptions: { makeup: { targetExamId: 'stored_absence', sourceClassKey: CURRENT_CLASS } },
};
const mappedAbsenceResult = Pending.buildPendingTasks(baseOptions({ posts: [absencePaper], grades: [absenceExam] }));
assert.strictEqual(mappedAbsenceResult.items[0].paperTarget, null, 'absence navigation must not reuse the mapped makeup paper as the original exam paper');
assert.strictEqual(mappedAbsenceResult.items[0].reminderSourceDate, '2026-08-08', 'mapped absence uses the exact paper date as its stable reminder source');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: mappedAbsenceResult.items,
    policy: weeklyReminderPolicy('2026-08-08', Date.parse('2026-08-08T15:00:01+08:00')),
  }),
  [],
  'a real absence task with an exact 8/8 makeup paper remains neutral at the 8/8 slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: mappedAbsenceResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['absence'],
  'the real absence task becomes due at the first later 8/15 weekly slot'
);
const absenceOriginalExamPost = {
  id: 'absence_original_exam_post',
  date: '2026-08-02',
  sourceClassKey: CURRENT_CLASS,
  quiz: '[小考卷]https://example.com/absence-original.pdf',
  examData: { main: absenceExam, exams: [{ main: absenceExam, others: [] }] },
};
const mappedAbsenceWithOriginalExam = Pending.buildPendingTasks(baseOptions({
  posts: [absencePaper, absenceOriginalExamPost],
  grades: [absenceExam],
}));
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].paperTarget.dailyPostId, absenceOriginalExamPost.id, 'absence secondary action points to the exact original exam DailyPost');
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].displayTarget.dailyPostId, absenceOriginalExamPost.id, 'absence primary action points to the same exact ExamID-mapped DailyPost report box');
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].displayTarget.examId, absenceExam.examId);
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].paperTarget.section, 'exam-paper');
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].paperTarget.examId, absenceExam.examId);
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].paperTarget.storedExamId, absenceExam.storedExamId);
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].paperTarget.url, 'https://example.com/absence-original.pdf');
assert.strictEqual(mappedAbsenceWithOriginalExam.items[0].reminderSourceDate, absencePaper.date, 'absence navigation target must not change the mapped reminder source date');

const correctedHeaderExactExamPost = Object.assign({}, absenceOriginalExamPost, {
  id: 'absence_original_after_header_date_correction',
  date: '2026-08-03',
});
const correctedHeaderExactExamResult = Pending.buildPendingTasks(baseOptions({
  posts: [correctedHeaderExactExamPost],
  grades: [absenceExam],
}));
assert.strictEqual(correctedHeaderExactExamResult.items[0].displayTarget.dailyPostId, correctedHeaderExactExamPost.id, 'stable ExamID remains authoritative after a header date correction');
assert.strictEqual(correctedHeaderExactExamResult.items[0].paperTarget.dailyPostId, correctedHeaderExactExamPost.id, 'paper navigation also survives a corrected header date');

const ambiguousOriginalExamResult = Pending.buildPendingTasks(baseOptions({
  posts: [
    absenceOriginalExamPost,
    Object.assign({}, absenceOriginalExamPost, { id: 'absence_original_exam_duplicate' }),
  ],
  grades: [absenceExam],
}));
assert.strictEqual(ambiguousOriginalExamResult.items[0].paperTarget, null, 'two matching original exam paper posts must fail closed');
assert.strictEqual(ambiguousOriginalExamResult.items[0].displayTarget, null, 'two matching report DailyPosts must also fail closed');

const unverifiedOriginalExamResult = Pending.buildPendingTasks(baseOptions({
  posts: [Object.assign({}, absenceOriginalExamPost, { examData: { main: null, exams: [] } })],
  grades: [absenceExam],
}));
assert.strictEqual(unverifiedOriginalExamResult.items[0].paperTarget, null, 'an original quiz block without an exact ExamID mapping must fail closed');

const duplicateDateOnlyHomework = Pending.buildPendingTasks(baseOptions({
  posts: [
    { id: 'date_only_a', date: '2026-08-08', sourceClassKey: CURRENT_CLASS },
    { id: 'date_only_b', date: '2026-08-08', sourceClassKey: CURRENT_CLASS },
  ],
  grades: [{
    date: '2026/8/8 作業', exam: '日期相同但無 ExamID', score: '#N/A', colIndex: 78, storedClassKey: CURRENT_CLASS,
  }],
}));
assert.strictEqual(duplicateDateOnlyHomework.items[0].displayTarget.tab, 'grades', 'duplicate date-only DailyPosts must fail closed instead of picking array item zero');

const answerOnlyOriginalExamResult = Pending.buildPendingTasks(baseOptions({
  posts: [Object.assign({}, absenceOriginalExamPost, {
    quiz: '[小考解答]https://example.com/absence-answer.pdf',
    displayOptions: { quiz: { slot1Role: 'answer' } },
  })],
  grades: [absenceExam],
}));
assert.strictEqual(answerOnlyOriginalExamResult.items[0].displayTarget.dailyPostId, absenceOriginalExamPost.id, 'answer-only post still keeps the exact score-report target');
assert.strictEqual(answerOnlyOriginalExamResult.items[0].paperTarget, null, 'an answer-only quiz slot must not expose a misleading original-paper action');

const questionAndAnswerOriginalExamResult = Pending.buildPendingTasks(baseOptions({
  posts: [Object.assign({}, absenceOriginalExamPost, {
    quiz: '[小考卷]https://example.com/absence-question.pdf\n[小考解答]https://example.com/absence-answer.pdf',
    displayOptions: { quiz: { slot1Role: 'question', slot2Role: 'answer' } },
  })],
  grades: [absenceExam],
}));
assert.strictEqual(questionAndAnswerOriginalExamResult.items[0].paperTarget.dailyPostId, absenceOriginalExamPost.id, 'an explicit question slot keeps exact original-paper navigation');

const guidanceAbsenceExam = Object.assign({}, absenceExam, {
  exam: '數學超前輔導題',
  examId: 'exam_guidance_absence',
  storedExamId: 'stored_guidance_absence',
});
const guidanceAbsencePost = {
  id: 'guidance_absence_post',
  date: '2026-08-02',
  sourceClassKey: CURRENT_CLASS,
  examData: { main: guidanceAbsenceExam, exams: [{ main: guidanceAbsenceExam, others: [] }] },
};
const guidanceAbsenceResult = Pending.buildPendingTasks(baseOptions({
  posts: [guidanceAbsencePost],
  grades: [guidanceAbsenceExam],
  helpers: Object.assign({}, baseOptions().helpers, { isMathGuidanceExam: () => true }),
}));
assert.strictEqual(guidanceAbsenceResult.items[0].kind, 'guidance_absence');
assert.strictEqual(guidanceAbsenceResult.items[0].displayTarget.dailyPostId, guidanceAbsencePost.id, 'guidance absence keeps its exact score-report navigation');
assert.strictEqual(guidanceAbsenceResult.items[0].paperTarget, null, 'guidance absence does not expose an unrelated exam-paper secondary action');

const mappedAbsenceWithLaterPosts = Pending.buildPendingTasks(baseOptions({
  posts: [
    { id: 'absence_latest_host_aug22', date: '2026-08-22', sourceClassKey: CURRENT_CLASS },
    { id: 'absence_later_host_aug15', date: '2026-08-15', sourceClassKey: CURRENT_CLASS },
    absenceOriginalExamPost,
    absencePaper,
  ],
  grades: [absenceExam],
}));
assert.strictEqual(mappedAbsenceWithLaterPosts.items[0].reminderSourceDate, '2026-08-08', 'later posts do not move a mapped absence source beyond its exact paper');
assert.strictEqual(mappedAbsenceWithLaterPosts.items[0].paperTarget.dailyPostId, absenceOriginalExamPost.id, 'later report hosts do not move the original exam-paper navigation target');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: mappedAbsenceWithLaterPosts.items,
    policy: weeklyReminderPolicy('2026-08-22', Date.parse('2026-08-22T15:00:01+08:00')),
  }).map(item => item.kind),
  ['absence'],
  'mapped absence remains due when later DailyPosts are published'
);

const legacyAbsencePaperResult = Pending.buildPendingTasks(baseOptions({
  posts: [Object.assign({}, absencePaper, { displayOptions: { makeup: { examId: 'stored_absence' } } })],
  grades: [absenceExam],
}));
assert.strictEqual(legacyAbsencePaperResult.items[0].paperTarget, null, 'absence task must not guess a legacy makeup-paper mapping');

const reportedAbsenceResult = Pending.buildPendingTasks(baseOptions({
  grades: [absenceExam],
  helpers: Object.assign({}, baseOptions().helpers, {
    getLatestScoreReportInfo: () => ({ reportedScoreNum: 80 }),
  }),
}));
assert.strictEqual(reportedAbsenceResult.items.length, 0, 'student score report completes the absence task');

const lowExam = {
  date: '8/2 小考',
  exam: '理化第 1 章',
  score: '60',
  scoreNum: 60,
  makeupThreshold: 85,
  colIndex: 31,
  examId: 'display_exam_low',
  storedExamId: 'stored_exam_low',
  storedClassKey: CURRENT_CLASS,
};
const lowExamPost = { id: 'low_exam_post', date: '2026-08-02', sourceClassKey: CURRENT_CLASS };
const latestPost = { id: 'latest_post', date: '2026-08-09', sourceClassKey: CURRENT_CLASS };
const oldUnmappedPaper = { id: 'old_guess_only', date: '2026-08-08', sourceClassKey: CURRENT_CLASS, makeup: '[補考卷]https://example.com/guess.pdf' };
const lowResult = Pending.buildPendingTasks(baseOptions({ posts: [lowExamPost, latestPost, oldUnmappedPaper], grades: [lowExam] }));
assert.strictEqual(lowResult.items.length, 1);
assert.strictEqual(lowResult.items[0].kind, 'makeup_result');
assert.strictEqual(lowResult.items[0].reportTarget.dailyPostId, latestPost.id);
assert.strictEqual(lowResult.items[0].paperTarget.dailyPostId, oldUnmappedPaper.id, 'gifted-science makeup paper auto-links to the prior formal post when exactly one eligible exam exists');
assert.strictEqual(lowResult.items[0].paperTarget.examId, lowExam.examId);
assert.ok(lowResult.items[0].legacySkipIdentities.some(identity => identity.sourceItemId === 'col_31'), 'ExamID threshold makeup keeps its legacy col_N skip identity');

[
  '115小六資優自然週六上午班',
  '115小六資優自然週日下午班',
  '115小六資優自然週日晚上班',
].forEach(className => {
  const classExam = Object.assign({}, lowExam, { sourceClassKey: className, storedClassKey: className });
  const classExamPost = Object.assign({}, lowExamPost, { sourceClassKey: className });
  const classMakeupPost = Object.assign({}, oldUnmappedPaper, { sourceClassKey: className });
  assert.strictEqual(
    Pending.resolveGiftedScienceMakeupExamForPost([classExamPost, classMakeupPost], [classExam], classMakeupPost, baseOptions().helpers),
    classExam,
    `${className} must support the same unique prior-exam fallback`,
  );
});

const secondLowExam = Object.assign({}, lowExam, {
  examId: 'display_exam_low_2',
  storedExamId: 'stored_exam_low_2',
  colIndex: 32,
  exam: '理化第 2 章',
});
const ambiguousGiftedResult = Pending.buildPendingTasks(baseOptions({
  posts: [lowExamPost, latestPost, oldUnmappedPaper],
  grades: [lowExam, secondLowExam],
}));
assert.strictEqual(ambiguousGiftedResult.items[0].paperTarget, null, 'two eligible exams on the prior formal post must fail closed');

const unrelatedClassExam = Object.assign({}, lowExam, {
  sourceClassKey: '115國二自然超前班',
  storedClassKey: '115國二自然超前班',
});
const unrelatedClassPaper = Object.assign({}, oldUnmappedPaper, {
  sourceClassKey: '115國二自然超前班',
});
assert.strictEqual(Pending.resolveGiftedScienceMakeupExamForPost(
  [Object.assign({}, lowExamPost, { sourceClassKey: '115國二自然超前班' }), unrelatedClassPaper],
  [unrelatedClassExam],
  unrelatedClassPaper,
  baseOptions().helpers,
), null, 'the auto-link exception must stay limited to the three gifted-science classes');

const mappedPaper = {
  id: 'mapped_paper',
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
  makeup: '[補考卷]https://example.com/exact.pdf',
  displayOptions: { makeup: { targetExamId: 'display_exam_low', sourceClassKey: CURRENT_CLASS } },
};
const mappedResult = Pending.buildPendingTasks(baseOptions({ posts: [lowExamPost, latestPost, mappedPaper], grades: [lowExam] }));
assert.strictEqual(mappedResult.items[0].paperTarget.dailyPostId, mappedPaper.id);
assert.strictEqual(mappedResult.items[0].paperTarget.url, 'https://example.com/exact.pdf');
assert.strictEqual(mappedResult.items[0].paperTarget.examId, lowExam.examId, 'mapped makeup-paper navigation retains the exact display ExamID');
assert.strictEqual(mappedResult.items[0].paperTarget.storedExamId, lowExam.storedExamId, 'mapped makeup-paper navigation retains the exact stored ExamID');

const thresholdTimingExam = {
  date: '2026/08/08 小考',
  exam: '理化第 3、4 章',
  score: '65',
  scoreNum: 65,
  makeupThreshold: 85,
  colIndex: 79,
  examId: 'threshold_timing_exam',
  storedExamId: 'threshold_timing_exam',
  storedClassKey: CURRENT_CLASS,
};
const thresholdExamPost = { id: 'threshold_exam_post', date: '2026-08-08', sourceClassKey: CURRENT_CLASS };
const thresholdNextPost = { id: 'threshold_next_post', date: '2026-08-15', sourceClassKey: CURRENT_CLASS };
function buildThresholdTiming(now, nextPost = thresholdNextPost, extra = {}) {
  return Pending.buildPendingTasks(baseOptions(Object.assign({
    now: new Date(now),
    posts: nextPost ? [thresholdExamPost, nextPost] : [thresholdExamPost],
    grades: [thresholdTimingExam],
  }, extra)));
}
function getThresholdEligibility(now, posts, exam = thresholdTimingExam) {
  const options = baseOptions({ now: new Date(now), posts, grades: [exam] });
  return Pending.resolveThresholdTaskEligibility(
    options,
    Pending.normalizePendingPolicy(options.pendingPolicy),
    exam,
    {
      classKey: CURRENT_CLASS,
      className: CURRENT_CLASS,
      studentKey: STUDENT_KEY,
      helpers: options.helpers,
    },
    options.helpers
  );
}
assert.strictEqual(buildThresholdTiming('2026-08-14T23:59:59+08:00').items.length, 0, 'a future next-class post must not create a threshold task early');
assert.strictEqual(buildThresholdTiming('2026-08-15T11:59:59+08:00').items.length, 0, 'a prepublished next DailyPost stays hidden before class ends');
assert.strictEqual(buildThresholdTiming('2026-08-15T11:59:59+08:00', Object.assign({}, thresholdNextPost, {
  reserveTime: '2026-08-15 10:30:00',
})).items.length, 0, 'a DailyPost already released during class still does not expose threshold makeup before session end');
assert.strictEqual(buildThresholdTiming('2026-08-15T12:30:00+08:00', Object.assign({}, thresholdNextPost, {
  reserveTime: '2026-08-15 13:00:00',
})).items.length, 0, 'a next-session post whose Taipei reserve time is still in the future is not effective');
const laterAlreadyEffectivePost = {
  id: 'later_already_effective_post',
  date: '2026-08-22',
  reserveTime: '2026-08-15 10:00:00',
  sourceClassKey: CURRENT_CLASS,
};
const earlierFutureMustWin = getThresholdEligibility(
  '2026-08-15T12:30:00+08:00',
  [
    thresholdExamPost,
    Object.assign({}, thresholdNextPost, { reserveTime: '2026-08-15 13:00:00' }),
    laterAlreadyEffectivePost,
  ]
);
assert.strictEqual(earlierFutureMustWin.allowed, false);
assert.strictEqual(earlierFutureMustWin.reason, 'missing_next_effective_post');
assert.strictEqual(earlierFutureMustWin.nextPostDate, '2026-08-15', 'an earlier trusted session waiting for reserveTime cannot be bypassed by a later already-effective post');
const invalidReserveEligibility = getThresholdEligibility(
  '2026-08-15T12:30:00+08:00',
  [thresholdExamPost, Object.assign({}, thresholdNextPost, { reserveTime: '2026-08-15 下午 10:30' })]
);
assert.strictEqual(invalidReserveEligibility.allowed, false);
assert.strictEqual(invalidReserveEligibility.reason, 'invalid_daily_post_reserve_time', 'an unparseable reserveTime must fail closed instead of being treated as already published');
const earlierMalformedMustBlock = getThresholdEligibility(
  '2026-08-15T12:30:00+08:00',
  [
    thresholdExamPost,
    Object.assign({}, thresholdNextPost, { reserveTime: 'not-a-reserve-time' }),
    laterAlreadyEffectivePost,
  ]
);
assert.strictEqual(earlierMalformedMustBlock.allowed, false);
assert.strictEqual(earlierMalformedMustBlock.reason, 'invalid_daily_post_reserve_time');
assert.strictEqual(earlierMalformedMustBlock.nextPostDate, '2026-08-15', 'a malformed earlier session record cannot be bypassed by a later effective post');
const thresholdAfterClass = buildThresholdTiming('2026-08-15T12:00:00+08:00');
assert.strictEqual(thresholdAfterClass.items.length, 1, 'threshold task appears when the next same-class session has ended');
assert.strictEqual(thresholdAfterClass.items[0].reminderSourceDate, '2026-08-15');
assert.strictEqual(thresholdAfterClass.items[0].thresholdEligibleAt, Date.parse('2026-08-15T12:00:00+08:00'));
assert.strictEqual(thresholdAfterClass.items[0].thresholdSessionKey, 'p6_gifted_science_sat_am', 'task records the canonical shared policyId');

const sameExamIdSameDatePosts = [1, 2].map(index => ({
  id: `threshold_exam_duplicate_${index}`,
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
  examData: {
    main: {
      examId: thresholdTimingExam.examId,
      storedExamId: thresholdTimingExam.storedExamId,
    },
  },
}));
const legacyThresholdExam = Object.assign({}, thresholdTimingExam, { date: '8/8 小考' });
const sameExamIdSameDateResult = Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T12:00:00+08:00'),
  posts: sameExamIdSameDatePosts.concat(thresholdNextPost),
  grades: [legacyThresholdExam],
}));
assert.strictEqual(sameExamIdSameDateResult.items.length, 1, 'same ExamID in multiple posts on one exact date still anchors a legacy M/D exam');
const sameExamIdDifferentYearsResult = Pending.buildPendingTasks(baseOptions({
  now: new Date('2026-08-15T12:00:00+08:00'),
  posts: sameExamIdSameDatePosts.slice(0, 1).map(post => Object.assign({}, post, { date: '2025-08-08' }))
    .concat(sameExamIdSameDatePosts.slice(1), thresholdNextPost),
  grades: [legacyThresholdExam],
}));
assert.strictEqual(sameExamIdDifferentYearsResult.items.length, 0, 'same ExamID mapped to different full dates remains cross-year ambiguous');

assert.strictEqual(buildThresholdTiming('2026-08-22T12:00:00+08:00', null).items.length, 0, 'missing next DailyPost fails closed even long after the exam');
const loneOffDayPost = {
  id: 'wrong_weekday_next_post', date: '2026-08-16', sourceClassKey: CURRENT_CLASS,
};
assert.strictEqual(buildThresholdTiming('2026-08-16T21:00:00+08:00', loneOffDayPost).items.length, 0, 'a same-class post outside the contracted weekday is not the next class session');
assert.strictEqual(
  getThresholdEligibility('2026-08-16T21:00:00+08:00', [thresholdExamPost, loneOffDayPost]).reason,
  'class_session_date_mismatch',
  'a lone legacy off-day post fails closed with the session mismatch reason'
);
const laterRegularPost = { id: 'later_regular_post', date: '2026-08-22', sourceClassKey: CURRENT_CLASS };
const legacyExtraThenRegular = getThresholdEligibility(
  '2026-08-22T12:00:00+08:00',
  [thresholdExamPost, loneOffDayPost, laterRegularPost]
);
assert.strictEqual(legacyExtraThenRegular.allowed, true, 'a legacy unmarked off-day supplement may be skipped only when a later regular session is verifiable');
assert.strictEqual(legacyExtraThenRegular.nextPost.date, '2026-08-22');
const malformedLegacyExtraThenRegular = getThresholdEligibility(
  '2026-08-22T12:00:00+08:00',
  [thresholdExamPost, Object.assign({}, loneOffDayPost, { reserveTime: 'legacy malformed reserve' }), laterRegularPost]
);
assert.strictEqual(malformedLegacyExtraThenRegular.allowed, true, 'a malformed reserve on a legacy off-weekday supplement is ignored only after a later ready session is verified');
assert.strictEqual(malformedLegacyExtraThenRegular.nextPost.date, '2026-08-22');
const explicitSupplementalThenRegular = getThresholdEligibility(
  '2026-08-22T12:00:00+08:00',
  [thresholdExamPost, Object.assign({}, loneOffDayPost, {
    displayOptions: { session: { status: 'supplemental' } },
  }), laterRegularPost]
);
assert.strictEqual(explicitSupplementalThenRegular.allowed, true, 'an explicit supplemental DailyPost never replaces the next class session');
assert.strictEqual(
  getThresholdEligibility('2026-08-22T12:00:00+08:00', [thresholdExamPost, Object.assign({}, loneOffDayPost, {
    reserveTime: 'not-a-reserve-time',
    displayOptions: { session: { status: 'supplemental' } },
  }), laterRegularPost]).allowed,
  true,
  'an explicit supplemental row is ignored even when its irrelevant reserveTime is malformed'
);
assert.strictEqual(
  getThresholdEligibility('2026-08-16T21:00:00+08:00', [thresholdExamPost, Object.assign({}, loneOffDayPost, {
    displayOptions: { session: { status: 'supplemental' } },
  })]).reason,
  'missing_next_effective_post',
  'an explicit supplemental DailyPost is ignored even when it is the only later post'
);
assert.strictEqual(
  getThresholdEligibility('2026-08-16T21:00:00+08:00', [thresholdExamPost, Object.assign({}, loneOffDayPost, {
    reserveTime: 'not-a-reserve-time',
    displayOptions: { session: { status: 'cancelled' } },
  })]).reason,
  'missing_next_effective_post',
  'an explicit cancelled row is ignored before reserveTime validation'
);
const thresholdRescheduledNextPost = {
  id: 'threshold_rescheduled_next_post',
  date: '2026-08-16',
  sourceClassKey: CURRENT_CLASS,
  displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-16', '14:00', '17:00') },
};
assert.strictEqual(buildThresholdTiming('2026-08-16T16:59:59+08:00', thresholdRescheduledNextPost).items.length, 0, 'rescheduled next class remains hidden during the override session');
assert.strictEqual(buildThresholdTiming('2026-08-16T17:00:00+08:00', thresholdRescheduledNextPost).items.length, 1, 'rescheduled next class unlocks threshold makeup at override endTime');
const conflictingReschedule = getThresholdEligibility(
  '2026-08-16T18:00:00+08:00',
  [
    thresholdExamPost,
    thresholdRescheduledNextPost,
    Object.assign({}, thresholdRescheduledNextPost, {
      id: 'threshold_rescheduled_conflict',
      displayOptions: { session: rescheduledSession(CURRENT_CLASS, '2026-08-16', '14:00', '18:00') },
    }),
  ]
);
assert.strictEqual(conflictingReschedule.allowed, false);
assert.strictEqual(conflictingReschedule.reason, 'ambiguous_class_session_override', 'conflicting same-day formal reschedules fail closed');
const invalidRescheduleBeforeRegular = getThresholdEligibility(
  '2026-08-22T12:00:00+08:00',
  [thresholdExamPost, Object.assign({}, thresholdRescheduledNextPost, {
    displayOptions: { session: { status: 'rescheduled', actualDate: '2026-08-16', startTime: '14:00', endTime: '17:00' } },
  }), laterRegularPost]
);
assert.strictEqual(invalidRescheduleBeforeRegular.allowed, false);
assert.strictEqual(invalidRescheduleBeforeRegular.reason, 'invalid_class_session_override', 'an incomplete reschedule cannot be skipped as a legacy supplement');
const unknownSessionStatus = getThresholdEligibility(
  '2026-08-15T12:00:00+08:00',
  [thresholdExamPost, Object.assign({}, thresholdNextPost, {
    displayOptions: { session: { status: 'moved' } },
  })]
);
assert.strictEqual(unknownSessionStatus.allowed, false);
assert.strictEqual(unknownSessionStatus.reason, 'invalid_class_session_override', 'an unknown session status cannot silently fall back to the fixed schedule');
assert.strictEqual(buildThresholdTiming('2026-08-16T21:00:00+08:00', Object.assign({}, thresholdRescheduledNextPost, {
  displayOptions: { session: { status: 'cancelled', startTime: '14:00', endTime: '17:00' } },
})).items.length, 0, 'cancelled DailyPost session is ignored by threshold timing');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: null,
  pendingPolicy: { status: 'ready', items: [], loadedAt: Date.parse('2026-08-15T12:00:00+08:00') },
  posts: [thresholdExamPost, thresholdNextPost],
  grades: [thresholdTimingExam],
})).items.length, 1, 'production may use trusted server policy loadedAt instead of device time');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  now: null,
  posts: [thresholdExamPost, thresholdNextPost],
  grades: [thresholdTimingExam],
})).items.length, 0, 'missing explicit test time and missing server loadedAt fail closed');
assert.strictEqual(Pending.buildPendingTasks(baseOptions({
  classKey: '未知班',
  className: '未知班',
  now: new Date('2026-08-15T12:00:00+08:00'),
  posts: [{ id: 'unknown_next', date: '2026-08-15', sourceClassKey: '未知班' }],
  grades: [Object.assign({}, thresholdTimingExam, { storedClassKey: '未知班', sourceClassKey: '未知班' })],
})).items.length, 0, 'a class without an explicit session contract fails closed');

[
  ['115小六資優自然週六上午班', 'p6_gifted_science_sat_am', 6, 9, 12],
  ['115小六資優自然週日下午班', 'p6_gifted_science_sun_pm', 0, 14, 17],
  ['115小六資優自然週日晚上班', 'p6_gifted_science_sun_night', 0, 18, 21],
  ['115國一自然超前班', 'g7_advanced_science_sat', 6, 13, 16],
  ['115國二自然超前班', 'g8_advanced_science_sat', 6, 18, 21],
  ['115國一數學超前班', 'g7_advanced_math_sat', 6, 18, 21],
  ['115國二數學超前班', 'g8_advanced_math_sun', 0, 18, 21],
  ['115小六資優數學班', 'p6_gifted_math_wed', 3, 18, 21],
  ['115資優數學', 'p6_gifted_math_wed', 3, 18, 21],
  ['116資優數學', 'p6_gifted_math_wed', 3, 18, 21],
].forEach(([className, policyId, weekday, startHour, endHour]) => {
  const contract = Pending.resolveClassSessionContract(className);
  assert.ok(contract, `${className} has an explicit class-session contract`);
  assert.strictEqual(contract.id, policyId);
  assert.strictEqual(contract.weekday, weekday);
  assert.strictEqual(contract.startHour, startHour);
  assert.strictEqual(contract.endHour, endHour);
});
assert.strictEqual(Pending.resolveClassSessionContract('115國一資優數學班'), null, 'non-grade-six gifted math classes must not inherit the Wednesday contract');
assert.strictEqual(Pending.resolveClassSessionContract('115-小六資優自然週六上午班'), null, 'malformed punctuation must not be normalized into a valid class policy');

const reminderSourceExam = {
  date: '8/1 小考',
  exam: '化學第 1 章',
  score: '60',
  scoreNum: 60,
  makeupThreshold: 85,
  colIndex: 32,
  examId: 'display_exam_reminder_source',
  storedExamId: 'stored_exam_reminder_source',
  storedClassKey: CURRENT_CLASS,
};
const reminderSourceExamPost = {
  id: 'reminder_source_exam_post',
  date: '2026-08-01',
  sourceClassKey: CURRENT_CLASS,
};
const reminderNextSessionPost = {
  id: 'reminder_next_session_post',
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
};
const builtMakeupTaskResult = Pending.buildPendingTasks(baseOptions({
  posts: [reminderSourceExamPost, reminderNextSessionPost],
  grades: [reminderSourceExam],
}));
assert.strictEqual(builtMakeupTaskResult.items.length, 1, 'real builder fixture must create one pending threshold task after the next class');
assert.strictEqual(builtMakeupTaskResult.items[0].kind, 'makeup_result');
assert.strictEqual(builtMakeupTaskResult.items[0].date, '8/1 小考', 'task label date remains the original exam date');
assert.strictEqual(builtMakeupTaskResult.items[0].reminderSourceDate, '2026-08-08');
assert.strictEqual(builtMakeupTaskResult.items[0].displayTarget.postDate, '2026-08-01');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtMakeupTaskResult.items,
    policy: weeklyReminderPolicy('2026-08-08', Date.parse('2026-08-08T15:00:01+08:00')),
  }),
  [],
  'a real makeup task remains neutral on the next-class DailyPost date'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtMakeupTaskResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'a real 8/1 makeup task becomes due at the first weekly slot after it became actionable on 8/8'
);

const reminderSourceMakeupPost = {
  id: 'reminder_source_makeup_post',
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
  makeup: '[補考卷]https://example.com/reminder-source.pdf',
  displayOptions: { makeup: { targetExamId: 'stored_exam_reminder_source', sourceClassKey: CURRENT_CLASS } },
};
const reminderReportHostAug15 = {
  id: 'reminder_report_host_aug15',
  date: '2026-08-15',
  sourceClassKey: CURRENT_CLASS,
};
const reminderReportHostAug22 = {
  id: 'reminder_report_host_aug22',
  date: '2026-08-22',
  sourceClassKey: CURRENT_CLASS,
};
const wrongSourceMappedPaper = {
  id: 'wrong_source_mapped_paper',
  date: '2026-08-03',
  sourceClassKey: '另一班',
  makeup: '[補考卷]https://example.com/wrong-source.pdf',
  displayOptions: { makeup: { targetExamId: 'stored_exam_reminder_source', sourceClassKey: '另一班' } },
};
const builtMakeupResultTaskResult = Pending.buildPendingTasks(baseOptions({
  posts: [wrongSourceMappedPaper, reminderSourceExamPost, reminderSourceMakeupPost, reminderReportHostAug15, reminderReportHostAug22],
  grades: [reminderSourceExam],
}));
assert.strictEqual(builtMakeupResultTaskResult.items.length, 1, 'real builder fixture must create one pending makeup-result task');
assert.strictEqual(builtMakeupResultTaskResult.items[0].kind, 'makeup_result');
assert.strictEqual(builtMakeupResultTaskResult.items[0].date, '8/1 小考', 'makeup-result label keeps the original 8/1 exam date');
assert.strictEqual(builtMakeupResultTaskResult.items[0].displayTarget.postDate, '2026-08-01');
assert.strictEqual(builtMakeupResultTaskResult.items[0].paperTarget.dailyPostId, reminderSourceMakeupPost.id, 'exact ExamID links the 8/8 makeup paper');
assert.strictEqual(builtMakeupResultTaskResult.items[0].paperTarget.postDate, '2026-08-08', 'the exact makeup paper carries its own 8/8 DailyPost date');
assert.strictEqual(builtMakeupResultTaskResult.items[0].paperTarget.examId, reminderSourceExam.examId);
assert.strictEqual(builtMakeupResultTaskResult.items[0].paperTarget.storedExamId, reminderSourceExam.storedExamId);
assert.strictEqual(builtMakeupResultTaskResult.items[0].reminderSourceDate, '2026-08-08', 'the exact paper fixes the reminder source at 8/8');
assert.strictEqual(builtMakeupResultTaskResult.items[0].reportTarget.postDate, '2026-08-22', 'navigation may keep moving to the latest DailyPost');
assert.strictEqual(builtMakeupResultTaskResult.items[0].reportTarget.dailyPostId, reminderReportHostAug22.id);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtMakeupResultTaskResult.items,
    policy: weeklyReminderPolicy('2026-08-08', Date.parse('2026-08-08T15:00:01+08:00')),
  }),
  [],
  'a real 8/1 exam with an exact 8/8 makeup paper remains neutral at the 8/8 slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtMakeupResultTaskResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'the real 8/8 actionable makeup-result task is already due at the 8/15 slot despite later navigation hosts'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtMakeupResultTaskResult.items,
    policy: weeklyReminderPolicy('2026-08-22', Date.parse('2026-08-22T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'the moving 8/22 report host must not reset an already-due 8/8 reminder source'
);

const firstActionableUnmappedPost = {
  id: 'first_actionable_unmapped_aug8',
  date: '2026-08-08',
  sourceClassKey: CURRENT_CLASS,
};
const wrongSourceEarlyHost = { id: 'wrong_source_early_host', date: '2026-08-03', sourceClassKey: '另一班' };
const wrongSourceLatestHost = { id: 'wrong_source_latest_host', date: '2026-08-29', sourceClassKey: '另一班' };
const unmappedStableSourceResult = Pending.buildPendingTasks(baseOptions({
  posts: [wrongSourceLatestHost, reminderReportHostAug22, reminderReportHostAug15, firstActionableUnmappedPost, wrongSourceEarlyHost, reminderSourceExamPost],
  grades: [reminderSourceExam],
}));
assert.strictEqual(unmappedStableSourceResult.items[0].kind, 'makeup_result');
assert.strictEqual(unmappedStableSourceResult.items[0].paperTarget, null);
assert.strictEqual(unmappedStableSourceResult.items[0].reminderSourceDate, '2026-08-08', 'without an exact paper, the earliest safe post after the exam fixes the reminder source');
assert.strictEqual(unmappedStableSourceResult.items[0].reportTarget.postDate, '2026-08-22', 'unmapped navigation still uses the latest report host');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: unmappedStableSourceResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'an unmapped first-actionable 8/8 source must be due at 8/15, not postponed by the latest host'
);

const missingMappingSourcePost = Object.assign({}, reminderSourceMakeupPost, {
  id: 'missing_mapping_source_post',
  displayOptions: { makeup: { targetExamId: 'stored_exam_reminder_source' } },
});
const missingMappingSourceResult = Pending.buildPendingTasks(baseOptions({
  posts: [reminderSourceExamPost, missingMappingSourcePost, reminderReportHostAug22],
  grades: [reminderSourceExam],
}));
assert.strictEqual(missingMappingSourceResult.items[0].paperTarget, null);
assert.strictEqual(missingMappingSourceResult.items[0].reminderSourceDateInvalid, false, 'invalid paper metadata does not poison independently verified session timing');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: missingMappingSourceResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'missing paper source metadata keeps navigation closed while date-level reminder timing stays valid'
);

const duplicateMappedPaper = Object.assign({}, reminderSourceMakeupPost, {
  id: 'duplicate_mapped_paper',
  date: '2026-08-09',
});
const duplicateMappingResult = Pending.buildPendingTasks(baseOptions({
  posts: [reminderSourceExamPost, reminderSourceMakeupPost, duplicateMappedPaper, reminderReportHostAug22],
  grades: [reminderSourceExam],
}));
assert.strictEqual(duplicateMappingResult.items[0].paperTarget, null);
assert.strictEqual(duplicateMappingResult.items[0].reminderSourceDateInvalid, false, 'duplicate exact paper mappings keep navigation closed without invalidating session timing');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: duplicateMappingResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'duplicate exact paper mappings must not suppress a separately verified date-level reminder'
);

const sameDayMappedPaper = Object.assign({}, reminderSourceMakeupPost, {
  id: 'same_day_mapped_paper',
  date: '2026-08-01',
});
const sameDayMappingResult = Pending.buildPendingTasks(baseOptions({
  posts: [reminderSourceExamPost, sameDayMappedPaper, reminderNextSessionPost, reminderReportHostAug22],
  grades: [reminderSourceExam],
}));
assert.strictEqual(sameDayMappingResult.items[0].paperTarget, null, 'a mapped paper on the exam date is not a valid navigation target');
assert.strictEqual(sameDayMappingResult.items[0].reminderSourceDateInvalid, false, 'invalid paper timing remains separate from next-session eligibility');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: sameDayMappingResult.items,
    policy: weeklyReminderPolicy('2026-08-15', Date.parse('2026-08-15T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'a same-day invalid paper stays closed while the verified 8/8 session controls reminder age'
);

const ambiguousFirstHostResult = Pending.buildPendingTasks(baseOptions({
  posts: [
    reminderSourceExamPost,
    firstActionableUnmappedPost,
    Object.assign({}, firstActionableUnmappedPost, { id: 'second_unmapped_aug8' }),
    reminderReportHostAug22,
  ],
  grades: [reminderSourceExam],
}));
assert.strictEqual(ambiguousFirstHostResult.items.length, 1, 'multiple DailyPosts on the same next class date still permit date-level session eligibility');
assert.strictEqual(ambiguousFirstHostResult.items[0].reminderSourceDate, '2026-08-08');
assert.strictEqual(ambiguousFirstHostResult.items[0].sourceDailyPostId, '', 'date-level eligibility must not guess one same-day DailyPost identity');
assert.strictEqual(ambiguousFirstHostResult.items[0].reminderSourceDateInvalid, false, 'same-day multiplicity is not a reminder-date ambiguity');
const sameSessionOnlyMultiplicity = Pending.buildPendingTasks(baseOptions({
  posts: [
    reminderSourceExamPost,
    firstActionableUnmappedPost,
    Object.assign({}, firstActionableUnmappedPost, { id: 'same_session_only_second_post' }),
  ],
  grades: [reminderSourceExam],
}));
assert.strictEqual(sameSessionOnlyMultiplicity.items.length, 1);
assert.strictEqual(sameSessionOnlyMultiplicity.items[0].kind, 'makeup', 'same-session multiplicity must not invent one report-host DailyPost');
assert.strictEqual(sameSessionOnlyMultiplicity.items[0].reportTarget, null);
assert.strictEqual(sameSessionOnlyMultiplicity.items[0].sourceDailyPostId, '');

const rolloverExam = Object.assign({}, reminderSourceExam, {
  date: '12/26 小考',
  exam: '跨年補考',
  colIndex: 33,
  examId: 'display_exam_rollover',
  storedExamId: 'stored_exam_rollover',
});
const rolloverExamPost = { id: 'rollover_exam_post', date: '2026-12-26', sourceClassKey: CURRENT_CLASS };
const rolloverPaperPost = {
  id: 'rollover_paper_post',
  date: '2027-01-02',
  sourceClassKey: CURRENT_CLASS,
  makeup: '[補考卷]https://example.com/rollover.pdf',
  displayOptions: { makeup: { targetExamId: 'stored_exam_rollover', sourceClassKey: CURRENT_CLASS } },
};
const rolloverLatestHost = { id: 'rollover_latest_host', date: '2027-01-09', sourceClassKey: CURRENT_CLASS };
const builtRolloverResult = Pending.buildPendingTasks(baseOptions({
  posts: [rolloverExamPost, rolloverPaperPost, rolloverLatestHost],
  grades: [rolloverExam],
  now: new Date('2027-01-03T12:00:00+08:00'),
}));
assert.strictEqual(builtRolloverResult.items[0].kind, 'makeup_result');
assert.strictEqual(builtRolloverResult.items[0].reminderSourceDate, '2027-01-02', 'real builder resolves a 12/26 exam to its adjacent-year 1/2 paper');
assert.strictEqual(builtRolloverResult.items[0].reportTarget.postDate, '2027-01-09');
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtRolloverResult.items,
    policy: weeklyReminderPolicy('2027-01-02', Date.parse('2027-01-02T15:00:01+08:00')),
  }),
  [],
  'real adjacent-year builder output remains neutral on its 1/2 source slot'
);
assert.deepStrictEqual(
  Pending.getReminderDueItems({
    status: 'ready',
    items: builtRolloverResult.items,
    policy: weeklyReminderPolicy('2027-01-09', Date.parse('2027-01-09T15:00:01+08:00')),
  }).map(item => item.kind),
  ['makeup_result'],
  'real adjacent-year builder output becomes due at the first later 1/9 slot'
);

const wrongLegacyMapping = Pending.buildPendingTasks(baseOptions({
  posts: [lowExamPost, latestPost, Object.assign({}, mappedPaper, {
    displayOptions: { makeup: { examId: 'display_exam_low' } },
  })],
  grades: [lowExam],
}));
assert.strictEqual(wrongLegacyMapping.items[0].paperTarget, null, 'non-contract legacy examId must not opt into paper mapping');

const completedLowResult = Pending.buildPendingTasks(baseOptions({
  posts: [latestPost],
  grades: [Object.assign({}, lowExam, { cellColor: '#00ff00' })],
}));
assert.strictEqual(completedLowResult.items.length, 0, 'registered makeup color completes the task');

const skipPolicyResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  pendingPolicy: {
    status: 'ready',
    items: [{
      classKey: CURRENT_CLASS,
      itemKey: doneFlowResult.items[0].taskId,
      itemType: 'homework_report',
      sourceClassKey: transferPost.storedClassKey,
      sourceItemId: '2026/08/09',
    }],
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(skipPolicyResult.items.length, 0, 'class-scoped Dashboard skip policy removes the matching task');

const legacySkipPolicyResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  pendingPolicy: { status: 'ready', skippedItemKeys: [dashboardIdentity.itemKey] },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(legacySkipPolicyResult.items.length, 0, 'existing Dashboard date-based skips remain compatible');

const otherClassSkipResult = Pending.buildPendingTasks(baseOptions({
  posts: [transferPost],
  pendingPolicy: {
    status: 'ready',
    items: [{ classKey: '另一班', itemKey: doneFlowResult.items[0].taskId }],
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    shouldUseHomeworkDoneFlowForClass: () => true,
    shouldUseHomeworkDoneFlowForPost: () => true,
  }),
}));
assert.strictEqual(otherClassSkipResult.items.length, 1, 'a skip from another current class must not leak across classes');

const promotedOldAbsence = {
  date: '2/7隨堂考',
  exam: '化學反應式',
  score: '假',
  scoreNum: null,
  colIndex: 30,
  examId: 'exam_promoted_old_absence',
  storedExamId: 'exam_promoted_old_absence',
  sourceClassKey: PROMOTED_OLD_CLASS,
  sourceClassName: PROMOTED_OLD_CLASS,
  storedClassKey: PROMOTED_CURRENT_CLASS,
  storedClassName: PROMOTED_CURRENT_CLASS,
};
const promotedStorageSkipIdentity = Pending.buildSkipIdentity({
  classKey: PROMOTED_CURRENT_CLASS,
  studentKey: STUDENT_KEY,
  itemType: 'makeup',
  sourceClassKey: PROMOTED_CURRENT_CLASS,
  sourceItemId: promotedOldAbsence.examId,
});
const promotedOldAbsenceResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  grades: [promotedOldAbsence],
  pendingPolicy: {
    status: 'ready',
    items: [{ classKey: PROMOTED_CURRENT_CLASS, itemKey: promotedStorageSkipIdentity.itemKey }],
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    isExamSourceClassWritable: () => true,
    getLegacyPendingSkipSourceClassKeys: sourceClassKey =>
      sourceClassKey === PROMOTED_OLD_CLASS ? [PROMOTED_CURRENT_CLASS] : [],
  }),
}));
assert.strictEqual(
  promotedOldAbsenceResult.items.length,
  0,
  'a signed same-grid promotion must honor a pre-registry skip stored with the current storage class identity'
);
const unverifiedCrossClassSkipResult = Pending.buildPendingTasks(baseOptions({
  classKey: PROMOTED_CURRENT_CLASS,
  className: PROMOTED_CURRENT_CLASS,
  grades: [promotedOldAbsence],
  pendingPolicy: {
    status: 'ready',
    items: [{ classKey: PROMOTED_CURRENT_CLASS, itemKey: promotedStorageSkipIdentity.itemKey }],
  },
  helpers: Object.assign({}, baseOptions().helpers, {
    isExamSourceClassWritable: () => true,
  }),
}));
assert.strictEqual(
  unverifiedCrossClassSkipResult.items.length,
  1,
  'without a signed promotion lineage, a current-class skip must not suppress another logical source class'
);

const preview = Pending.normalizePreviewTasks([{
  taskId: 'preview.one',
  kind: 'makeup_result',
  neutralLabel: '補考結果待回報',
  title: '8/2 小考',
  reminderSourceDate: '2026-08-08',
  displayTarget: { tab: 'grades', examId: 'exam_1', url: 'javascript:alert(1)' },
  reportTarget: { tab: 'contact', dailyPostId: 'post_1', focus: 'makeup-result' },
  paperTarget: { tab: 'contact', dailyPostId: 'paper_1', sourceClassKey: CURRENT_CLASS, examId: 'exam_1', section: 'makeup-paper' },
}]);
assert.strictEqual(preview[0].taskId, 'preview-one');
assert.strictEqual(preview[0].reminderSourceDate, '2026-08-08', 'preview preserves the stable reminder source date');
assert.strictEqual(preview[0].displayTarget.url, '', 'preview targets only retain http(s) URLs');
assert.strictEqual(preview[0].reportTarget.dailyPostId, 'post_1');
assert.strictEqual(preview[0].paperTarget.dailyPostId, 'paper_1', 'preview retains the exact paper navigation target');
assert.strictEqual(preview[0].paperTarget.examId, 'exam_1');

console.log('ebook pending tasks app tests passed');
