#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Lifecycle = require('../ebook_lifecycle_app.js');

const browserSandbox = { window: {}, console };
browserSandbox.globalThis = browserSandbox.window;
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'ebook_lifecycle_app.js'), 'utf8'),
  browserSandbox,
  { filename: 'ebook_lifecycle_app.js' }
);
assert.strictEqual(typeof browserSandbox.window.EbookLifecycleApp.buildTransferChain, 'function', 'UMD build must attach to window');

const transfersABC = {
  t1: {
    id: 't1',
    fromClassName: 'A 班',
    fromClassKey: 'A',
    toClassName: 'B 班',
    toClassKey: 'B',
    effectiveDate: '2026-07-01',
    status: 'active',
  },
  t2: {
    id: 't2',
    fromClassName: 'B 班',
    fromClassKey: 'B',
    toClassName: 'C 班',
    toClassKey: 'C',
    effectiveDate: '2026-07-10',
    status: 'active',
  },
  deleted: {
    id: 'deleted',
    fromClassKey: 'X',
    toClassKey: 'C',
    effectiveDate: '2026-07-09',
    status: 'deleted',
  },
};

const chainABC = Lifecycle.buildTransferChain(transfersABC, 'C');
assert.deepStrictEqual(chainABC.chain.map(item => item.id), ['t2', 't1']);
assert.deepStrictEqual(Lifecycle.getTrackedClassKeys('C', chainABC), ['C', 'B', 'A']);
assert.strictEqual(chainABC.ambiguities.length, 0);
assert.strictEqual(chainABC.truncated, false);

assert.strictEqual(Lifecycle.resolveClassAtDate('C', chainABC, '2026-06-30').classKey, 'A');
assert.strictEqual(Lifecycle.resolveClassAtDate('C', chainABC, '2026-07-01').classKey, 'B');
assert.strictEqual(Lifecycle.resolveClassAtDate('C', chainABC, '2026-07-09').classKey, 'B');
assert.strictEqual(Lifecycle.resolveClassAtDate('C', chainABC, '2026-07-10').classKey, 'C');
assert.strictEqual(Lifecycle.resolveClassAtDate('C', chainABC, '2026-07-11').classKey, 'C');

const transfersABA = {
  enterB: {
    id: 'enterB',
    fromClassKey: 'A',
    toClassKey: 'B',
    effectiveDate: '2026-07-01',
    status: 'active',
  },
  returnA: {
    id: 'returnA',
    fromClassKey: 'B',
    toClassKey: 'A',
    effectiveDate: '2026-07-10',
    status: 'active',
  },
};

const chainABA = Lifecycle.buildTransferChain(transfersABA, 'A');
assert.deepStrictEqual(chainABA.chain.map(item => item.id), ['returnA', 'enterB']);
assert.deepStrictEqual(Lifecycle.getTrackedClassKeys('A', chainABA), ['A', 'B']);
assert.strictEqual(Lifecycle.resolveClassAtDate('A', chainABA, '2026-06-30').classKey, 'A');
assert.strictEqual(Lifecycle.resolveClassAtDate('A', chainABA, '2026-07-05').classKey, 'B');
assert.strictEqual(Lifecycle.resolveClassAtDate('A', chainABA, '2026-07-10').classKey, 'A');

const ambiguous = Lifecycle.buildTransferChain({
  fromA: { id: 'fromA', fromClassKey: 'A', toClassKey: 'C', effectiveDate: '2026-07-10', createdAt: '2026-07-10T01:00:00Z' },
  fromB: { id: 'fromB', fromClassKey: 'B', toClassKey: 'C', effectiveDate: '2026-07-10', createdAt: '2026-07-10T02:00:00Z' },
}, 'C');
assert.strictEqual(ambiguous.ambiguities.length, 1);
assert.deepStrictEqual(ambiguous.ambiguities[0].fromClassKeys.sort(), ['A', 'B']);

const keyAmbiguous = Lifecycle.buildTransferChain({
  oldKey1: { id: 'oldKey1', studentKey: 'current', sourceStudentKey: 'old-1', fromClassKey: 'A', toClassKey: 'C', effectiveDate: '2026-07-10' },
  oldKey2: { id: 'oldKey2', studentKey: 'current', sourceStudentKey: 'old-2', fromClassKey: 'A', toClassKey: 'C', effectiveDate: '2026-07-10' },
}, 'C');
assert.strictEqual(keyAmbiguous.ambiguities.length, 1, 'same source class with different source student keys must fail closed');
assert.deepStrictEqual(keyAmbiguous.ambiguities[0].sourceStudentKeys.sort(), ['old-1', 'old-2']);

assert.deepStrictEqual(
  Lifecycle.getTrackedClassKeys('C', chainABC, ['114國一自然超前班', '115國二自然超前班', 'C']),
  ['C', 'B', 'A', '114國一自然超前班', '115國二自然超前班']
);

assert.strictEqual(
  Lifecycle.parseDateKey('12/20', { anchorDateKey: Lifecycle.parseDateKey('2027-01-05') }),
  20261220,
  'December before a January transfer must use the prior calendar year'
);
assert.strictEqual(
  Lifecycle.parseDateKey('1/10', { anchorDateKey: Lifecycle.parseDateKey('2026-12-30') }),
  20270110,
  'January after a December anchor must use the next calendar year'
);
assert.strictEqual(
  Lifecycle.parseDateKey('12/20', {
    fallbackYear: 2026,
    preferFallbackYear: true,
    anchorDateKey: Lifecycle.parseDateKey('2028-01-05'),
  }),
  20261220,
  'an explicit feedback timestamp year must outrank a distant transfer anchor'
);
assert.strictEqual(
  Lifecycle.parseDateKey('第1-8章', { fallbackYear: 2026 }),
  null,
  'chapter ranges must never be mistaken for lifecycle dates'
);
assert.strictEqual(
  Lifecycle.parseDateKey('6/20鑑定考', { fallbackYear: 2026 }),
  20260620,
  'exam headers may append text immediately after a partial date'
);
assert.strictEqual(
  Lifecycle.isFeedbackOnPostDate(
    { targetDate: '6/20', time: '2026/06/20 16:18:00' },
    '2026-06-20',
    { chain: [] }
  ),
  true,
  'legacy short feedback dates must match full post dates regardless of padding/separator'
);
assert.strictEqual(
  Lifecycle.isFeedbackOnPostDate(
    { targetDate: '06/20', time: '2026-06-20 16:18:00' },
    '2026/06/20',
    { chain: [] }
  ),
  true,
  'zero-padded feedback dates must match slash-form full post dates'
);
assert.strictEqual(
  Lifecycle.listActiveTransfers(transfersABC.t1).length,
  1,
  'the transfer normalizer also accepts one record'
);

const enrollmentsA = {
  first: { id: 'first', classKey: 'A', enrollmentDate: '2026-06-20', status: 'active' },
  deleted: { id: 'deleted', classKey: 'A', enrollmentDate: '2026-06-01', status: 'deleted' },
};
const enrollmentsB = {
  reenter: { id: 'reenter', classKey: 'B', enrollmentDate: '2026-08-01', status: 'active' },
};
const originLowerBound = Lifecycle.mergeEnrollmentLowerBound([enrollmentsA, {}], {
  classKeys: Lifecycle.getTrackedClassKeys('C', chainABC),
});
assert.strictEqual(originLowerBound.dateKey, 20260620);
assert.strictEqual(Lifecycle.listActiveEnrollments(enrollmentsA.first).length, 1, 'the enrollment normalizer also accepts one record');
assert.strictEqual(Lifecycle.isOnOrAfterEnrollmentLowerBound({ date: '2026-06-19' }, [enrollmentsA], { classKeys: ['A'] }), false);
assert.strictEqual(Lifecycle.isOnOrAfterEnrollmentLowerBound({ date: '2026-06-20' }, [enrollmentsA], { classKeys: ['A'] }), true);

const latestLowerBound = Lifecycle.mergeEnrollmentLowerBound([enrollmentsA, enrollmentsB], {
  classKeys: Lifecycle.getTrackedClassKeys('C', chainABC),
});
assert.strictEqual(latestLowerBound.dateKey, 20260801, 'latest active re-enrollment is the lifecycle lower bound');
assert.strictEqual(
  Lifecycle.mergeEnrollmentLowerBound([
    { id: 'arrayA', classKey: 'A', enrollmentDate: '2026-06-20' },
    { id: 'arrayB', classKey: 'B', enrollmentDate: '2026-08-01' },
  ], { classKeys: ['A', 'B'] }).dateKey,
  20260801,
  'the enrollment merger accepts both arrays of records and arrays of class-scoped index maps'
);

const classNameByKey = { A: 'A 班', B: 'B 班', C: 'C 班' };
const currentStoredBeforeTransfer = Lifecycle.resolveFeedbackScope({
  feedback: { targetDate: '2026-06-25', time: '2026/06/25 18:00:00' },
  storedClassKey: 'C',
  currentClassKey: 'C',
  currentClassName: 'C 班',
  chain: chainABC,
  classNameByKey,
});
assert.deepStrictEqual(
  {
    stored: currentStoredBeforeTransfer.storedClassKey,
    display: currentStoredBeforeTransfer.displayClassKey,
    former: currentStoredBeforeTransfer.isTransferFormerClass,
  },
  { stored: 'C', display: 'A', former: true },
  'feedback stored in the current class before transfer must display on the historical class card'
);

const sourceStoredAfterTransfer = Lifecycle.resolveFeedbackScope({
  feedback: { targetDate: '2026-07-11', time: '2026/07/11 18:00:00' },
  storedClassKey: 'A',
  currentClassKey: 'C',
  currentClassName: 'C 班',
  chain: chainABC,
  classNameByKey,
});
assert.strictEqual(sourceStoredAfterTransfer.storedClassKey, 'A');
assert.strictEqual(sourceStoredAfterTransfer.displayClassKey, 'C');
assert.strictEqual(sourceStoredAfterTransfer.storedClassName, 'A 班');
assert.strictEqual(sourceStoredAfterTransfer.displayClassName, 'C 班');

const middleClassFeedback = Lifecycle.resolveFeedbackScope({
  feedback: { targetDate: '2026-07-05', time: '2026/07/05 18:00:00' },
  storedClassKey: 'C',
  currentClassKey: 'C',
  chain: chainABC,
  classNameByKey,
});
assert.strictEqual(middleClassFeedback.displayClassKey, 'B');

const missingDateFeedback = Lifecycle.resolveFeedbackScope({
  feedback: { content: 'legacy record without date' },
  storedClassKey: 'A',
  currentClassKey: 'C',
  chain: chainABC,
  classNameByKey,
});
assert.strictEqual(missingDateFeedback.displayClassKey, 'A', 'undated feedback must fail safe to its stored class');

const yearBoundaryFeedback = Lifecycle.resolveFeedbackScope({
  feedback: { targetDate: '12/20', time: '2026/12/20 18:00:00' },
  storedClassKey: 'B',
  currentClassKey: 'B',
  transferRecords: {
    january: { id: 'january', fromClassKey: 'A', toClassKey: 'B', effectiveDate: '2027-01-05' },
  },
});
assert.strictEqual(yearBoundaryFeedback.dateKey, 20261220);
assert.strictEqual(yearBoundaryFeedback.displayClassKey, 'A');

const promotedFeedback = Lifecycle.resolveFeedbackScope({
  feedback: { targetDate: '2026-06-20', time: '2026/06/20 18:00:00' },
  storedClassKey: '114國一自然超前班',
  currentClassKey: '115國二自然超前班',
  currentClassName: '115國二自然超前班',
  transferRecords: {},
  isSameCohort: (left, right) => (
    left === '114國一自然超前班' && right === '115國二自然超前班'
  ),
});
assert.strictEqual(promotedFeedback.displayClassKey, '114國一自然超前班');
assert.strictEqual(promotedFeedback.isTransferFormerClass, false, 'promotion aliases remain interactive cohort history');

console.log('ebook lifecycle app tests passed');
