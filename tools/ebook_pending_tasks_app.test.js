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

const CURRENT_CLASS = '115小六資優自然週六上午班';
const STUDENT_KEY = '王小明';
const READY_POLICY = { status: 'ready', items: [] };

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
  { taskId: 'old', date: '2026-08-09' },
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
  ['old', 'same-day-partial'],
  'only tasks on or before the latest server reminder slot date may turn red'
);
assert.strictEqual(Pending.isReminderDueState(validReminderResult), true);
assert.strictEqual(Pending.isReminderDueState(Object.assign({}, validReminderResult, { items: [] })), false, 'completion must immediately clear reminder state');
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
assert.strictEqual(Pending.monthDayKey('第1-8章'), '', 'chapter ranges are not dates');

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

const giftedGrades = ['', '#N/A', '0', 0].map((score, index) => ({
  date: `8/${index + 1} 作業`,
  exam: `資優作業 ${index + 1}`,
  score,
  scoreNum: score === 0 ? 0 : null,
  colIndex: index + 10,
  storedClassKey: CURRENT_CLASS,
}));
giftedGrades.push({ date: '8/5 作業', exam: '已完成', score: '28', scoreNum: 28, colIndex: 15, storedClassKey: CURRENT_CLASS });
const giftedResult = Pending.buildPendingTasks(baseOptions({ grades: giftedGrades }));
assert.strictEqual(giftedResult.items.length, 4, 'gifted blank/#N/A/string zero/numeric zero are all pending');
assert.ok(giftedResult.items.every(item => item.kind === 'homework_score'));

const sourceClassFlowResult = Pending.buildPendingTasks(baseOptions({
  className: '115國二自然超前班',
  grades: [{
    date: '8/9 作業',
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
    { date: '8/9 小考', exam: '一般鑑定考', score: '', scoreNum: null, colIndex: 20, examId: 'exam_regular' },
    { date: '8/9 作業', exam: '第一堂作業', score: '#N/A', scoreNum: null, colIndex: 21, examId: 'exam_homework' },
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
assert.strictEqual(absenceResult.items[0].displayTarget.examId, 'exam_absence');
assert.strictEqual(absenceResult.items[0].writeTarget.storedExamId, 'stored_absence');

const absencePaper = {
  id: 'absence_paper_exact',
  date: '2026-08-08',
  makeup: '[補考卷]https://example.com/absence-exact.pdf',
  displayOptions: { makeup: { targetExamId: 'stored_absence' } },
};
const mappedAbsenceResult = Pending.buildPendingTasks(baseOptions({ posts: [absencePaper], grades: [absenceExam] }));
assert.strictEqual(mappedAbsenceResult.items[0].paperTarget.dailyPostId, absencePaper.id, 'absence task exposes an explicitly mapped makeup paper');
assert.strictEqual(mappedAbsenceResult.items[0].paperTarget.url, 'https://example.com/absence-exact.pdf');

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
const latestPost = { id: 'latest_post', date: '2026-08-09', sourceClassKey: CURRENT_CLASS };
const oldUnmappedPaper = { id: 'old_guess_only', date: '2026-08-08', makeup: '[補考卷]https://example.com/guess.pdf' };
const lowResult = Pending.buildPendingTasks(baseOptions({ posts: [latestPost, oldUnmappedPaper], grades: [lowExam] }));
assert.strictEqual(lowResult.items.length, 1);
assert.strictEqual(lowResult.items[0].kind, 'makeup_result');
assert.strictEqual(lowResult.items[0].reportTarget.dailyPostId, latestPost.id);
assert.strictEqual(lowResult.items[0].paperTarget, null, 'legacy paper text/date must never be guessed as a mapping');

const mappedPaper = {
  id: 'mapped_paper',
  date: '2026-08-08',
  makeup: '[補考卷]https://example.com/exact.pdf',
  displayOptions: { makeup: { targetExamId: 'display_exam_low' } },
};
const mappedResult = Pending.buildPendingTasks(baseOptions({ posts: [latestPost, mappedPaper], grades: [lowExam] }));
assert.strictEqual(mappedResult.items[0].paperTarget.dailyPostId, mappedPaper.id);
assert.strictEqual(mappedResult.items[0].paperTarget.url, 'https://example.com/exact.pdf');

const wrongLegacyMapping = Pending.buildPendingTasks(baseOptions({
  posts: [latestPost, Object.assign({}, mappedPaper, {
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

const preview = Pending.normalizePreviewTasks([{
  taskId: 'preview.one',
  kind: 'makeup_result',
  neutralLabel: '補考結果待回報',
  title: '8/2 小考',
  displayTarget: { tab: 'grades', examId: 'exam_1', url: 'javascript:alert(1)' },
  reportTarget: { tab: 'contact', dailyPostId: 'post_1', focus: 'makeup-result' },
}]);
assert.strictEqual(preview[0].taskId, 'preview-one');
assert.strictEqual(preview[0].displayTarget.url, '', 'preview targets only retain http(s) URLs');
assert.strictEqual(preview[0].reportTarget.dailyPostId, 'post_1');

console.log('ebook pending tasks app tests passed');
