#!/usr/bin/env node

const assert = require('assert');
const Promotion = require('../ebook_promotion_app.js');

function edge(overrides) {
  const value = Object.assign({
    promotionId: 'p-a-b',
    fromClassKey: 'A',
    fromClassName: 'A 班',
    toClassKey: 'B',
    toClassName: 'B 班',
    effectiveDate: '2026-07-01',
    sourceStudentKey: 'student-a',
    studentKey: 'student-b',
    storageMode: 'same_grid_renamed',
  }, overrides || {});
  const isRenamed = value.storageMode === 'same_grid_renamed';
  value.dataPolicies = value.dataPolicies || {
    grades: {
      beforeDataClassKey: isRenamed ? value.toClassKey : value.fromClassKey,
      beforeDisplayClassKey: value.fromClassKey,
      afterDataClassKey: value.toClassKey,
      afterDisplayClassKey: value.toClassKey,
    },
    dailyPosts: {
      beforeDataClassKey: value.fromClassKey,
      afterDataClassKey: value.toClassKey,
    },
    bulletins: {
      beforeDataClassKey: value.fromClassKey,
      afterDataClassKey: value.toClassKey,
    },
  };
  return value;
}

const rawABC = {
  version: 1,
  currentClassKey: 'C',
  edges: [
    edge(),
    edge({
      promotionId: 'p-b-c',
      fromClassKey: 'B',
      fromClassName: 'B 班',
      toClassKey: 'C',
      toClassName: 'C 班',
      effectiveDate: '2026-07-10',
      sourceStudentKey: 'student-b',
      studentKey: 'student-c',
    }),
  ],
};

const contextABC = Promotion.normalizePromotionContext(rawABC, {
  currentClassKey: 'C',
  currentStudentKey: 'student-c',
  allowedClassKeys: ['A', 'B', 'C'],
});
assert.strictEqual(contextABC.status, 'ready');
assert.deepStrictEqual(contextABC.edges.map(item => item.promotionId), ['p-a-b', 'p-b-c']);
assert.ok(Promotion.getLineageKey(contextABC, 'A'));
assert.strictEqual(Promotion.getLineageKey(contextABC, 'X'), '');

const beforeAll = Promotion.resolvePromotionScopeAtDate(contextABC, '2026-06-30', 'grades');
assert.deepStrictEqual(
  {
    logical: beforeAll.logicalClassKey,
    data: beforeAll.dataClassKey,
    student: beforeAll.dataStudentKey,
  },
  { logical: 'A', data: 'C', student: 'student-c' },
  'two consecutive renamed grids must keep old A grades in the final C storage row'
);

const middle = Promotion.resolvePromotionScopeAtDate(contextABC, '2026-07-05', 'grades');
assert.deepStrictEqual(
  { logical: middle.logicalClassKey, data: middle.dataClassKey, student: middle.dataStudentKey },
  { logical: 'B', data: 'C', student: 'student-c' }
);
const boundary = Promotion.resolvePromotionScopeAtDate(contextABC, '2026-07-10', 'grades');
assert.deepStrictEqual(
  { logical: boundary.logicalClassKey, data: boundary.dataClassKey, student: boundary.dataStudentKey },
  { logical: 'C', data: 'C', student: 'student-c' },
  'effectiveDate itself belongs to the destination class'
);

const oldPost = Promotion.resolvePromotionScopeAtDate(contextABC, '2026-06-30', 'dailyPosts');
assert.deepStrictEqual(
  { logical: oldPost.logicalClassKey, data: oldPost.dataClassKey, student: oldPost.dataStudentKey },
  { logical: 'A', data: 'A', student: 'student-a' },
  'DailyPost must remain in its original class even when grades use a renamed grid'
);
assert.deepStrictEqual(
  Promotion.getFormerBulletinScopes(contextABC).map(item => item.classKey),
  ['B', 'A'],
  'former bulletin scopes are newest first and exclude the current class'
);
assert.deepStrictEqual(
  Promotion.getFormerBulletinScopes(contextABC).map(item => [item.startDate, item.endDate]),
  [['2026-07-01', '2026-07-10'], ['', '2026-07-01']],
  'each former class must be constrained to its exact promotion date window'
);

const currentOnlyEdge = edge({
  dataPolicies: {
    grades: {
      beforeDataClassKey: 'B',
      beforeDisplayClassKey: 'A',
      afterDataClassKey: 'B',
      afterDisplayClassKey: 'B',
    },
    dailyPosts: { beforeDataClassKey: 'A', afterDataClassKey: 'B' },
    bulletins: { beforeDataClassKey: '', afterDataClassKey: 'B', policy: 'current_only' },
  },
});
const currentOnlyContext = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'B',
  edges: [currentOnlyEdge],
}, {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
});
assert.deepStrictEqual(Promotion.getFormerBulletinScopes(currentOnlyContext), []);
assert.strictEqual(
  Promotion.resolvePromotionScopeAtDate(currentOnlyContext, '2026-06-30', 'bulletins').matched,
  false,
  'current_only must never create a former-class bulletin scope'
);

const mixedContext = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'C',
  edges: [
    edge({ storageMode: 'separate_grids' }),
    edge({
      promotionId: 'p-b-c',
      fromClassKey: 'B',
      fromClassName: 'B 班',
      toClassKey: 'C',
      toClassName: 'C 班',
      effectiveDate: '2026-07-10',
      sourceStudentKey: 'student-b',
      studentKey: 'student-c',
      storageMode: 'same_grid_renamed',
    }),
  ],
}, {
  currentClassKey: 'C',
  currentStudentKey: 'student-c',
  allowedClassKeys: { A: true, B: true, C: true },
});
const mixedOld = Promotion.resolvePromotionScopeAtDate(mixedContext, '2026-06-30', 'grades');
assert.deepStrictEqual(
  { logical: mixedOld.logicalClassKey, data: mixedOld.dataClassKey, student: mixedOld.dataStudentKey },
  { logical: 'A', data: 'A', student: 'student-a' },
  'a later B to C rename must not pull separately stored A grades into C'
);

const promotionOnlyChain = Promotion.buildPriorityLifecycleChain({}, contextABC, 'C', {
  currentStudentKey: 'student-c',
});
assert.deepStrictEqual(promotionOnlyChain.chain.map(item => item.recordKind + ':' + item.promotionId), [
  'promotion:p-b-c',
  'promotion:p-a-b',
]);
assert.deepStrictEqual(
  Promotion.getTrackedGradeDataClassKeys('C', promotionOnlyChain),
  ['C'],
  'A and B grade nodes no longer exist after two same-grid renames, so only C may be read'
);

const materializedPromotionChain = Promotion.buildPriorityLifecycleChain({
  materializedAB: Object.assign({}, rawABC.edges[0], {
    id: 'materialized-a-b',
    transitionKind: 'promotion',
    promotionId: 'p-a-b',
    status: 'active',
  }),
  materializedBC: Object.assign({}, rawABC.edges[1], {
    id: 'materialized-b-c',
    transitionKind: 'promotion',
    promotionId: 'p-b-c',
    status: 'active',
  }),
}, contextABC, 'C', { currentStudentKey: 'student-c' });
assert.deepStrictEqual(
  materializedPromotionChain.chain.map(item => [item.recordKind, item.promotionId]),
  [['promotion', 'p-b-c'], ['promotion', 'p-a-b']],
  'materialized promotion index records must not shadow the signed session copy as ordinary transfers'
);

const explicitWins = Promotion.buildPriorityLifecycleChain({
  direct: {
    id: 'direct',
    fromClassKey: 'X',
    toClassKey: 'C',
    effectiveDate: '2026-07-02',
    sourceStudentKey: 'student-x',
    studentKey: 'student-c',
    status: 'active',
  },
}, contextABC, 'C', { currentStudentKey: 'student-c' });
assert.deepStrictEqual(explicitWins.chain.map(item => item.recordKind + ':' + item.fromClassKey), ['transfer:X']);
assert.deepStrictEqual(
  Promotion.getFormerBulletinScopes(contextABC, explicitWins),
  [],
  'an explicit incoming transfer that overrides the promotion must not expose the unused promotion bulletin history'
);

const explicitMiddle = Promotion.buildPriorityLifecycleChain({
  direct: {
    id: 'direct',
    fromClassKey: 'X',
    toClassKey: 'B',
    effectiveDate: '2026-06-20',
    sourceStudentKey: 'student-x',
    studentKey: 'student-b',
    status: 'active',
  },
}, contextABC, 'C', { currentStudentKey: 'student-c' });
assert.deepStrictEqual(explicitMiddle.chain.map(item => item.recordKind + ':' + item.fromClassKey), [
  'promotion:B',
  'transfer:X',
]);

const mixedTransitionContext = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'C',
  edges: [
    edge(),
    {
      transitionKind: 'transfer',
      transitionId: 'transfer-b-c',
      fromClassKey: 'B',
      fromClassName: 'B 班',
      toClassKey: 'C',
      toClassName: 'C 班',
      effectiveDate: '2026-07-10',
      sourceStudentKey: 'student-b',
      studentKey: 'student-c',
    },
  ],
}, {
  currentClassKey: 'C',
  currentStudentKey: 'student-c',
  allowedClassKeys: ['A', 'B', 'C'],
});
assert.ok(Promotion.getLineageKey(mixedTransitionContext, 'A'));
assert.strictEqual(Promotion.getLineageKey(mixedTransitionContext, 'A'), Promotion.getLineageKey(mixedTransitionContext, 'B'));
assert.strictEqual(Promotion.getLineageKey(mixedTransitionContext, 'C'), '', 'an explicit transfer must split promotion course lineages');
const mixedTransitionChain = Promotion.buildPriorityLifecycleChain({}, mixedTransitionContext, 'C', {
  currentStudentKey: 'student-c',
});
assert.deepStrictEqual(mixedTransitionChain.chain.map(item => item.recordKind), ['transfer', 'promotion']);
assert.deepStrictEqual(
  Promotion.getFormerBulletinScopes(mixedTransitionContext, mixedTransitionChain).map(item => [item.classKey, item.startDate, item.endDate]),
  [['A', '', '2026-07-01']],
  'only promotion boundaries create former bulletin sections; explicit transfer boundaries still constrain the lifecycle'
);
assert.strictEqual(Promotion.getCurrentBulletinStartDate(mixedTransitionContext, mixedTransitionChain), '2026-07-10');
assert.strictEqual(
  Promotion.resolvePromotionScopeAtDate(mixedTransitionContext, '2026-07-05', 'grades').reason,
  'promotion-scope-owned-by-explicit-transfer'
);
assert.deepStrictEqual(
  Promotion.getVerifiedLifecycleIndexReadScopes(mixedTransitionContext, 'C', 'student-c'),
  [
    { classKey: 'C', studentKey: 'student-c' },
    { classKey: 'B', studentKey: 'student-b' },
  ],
  'the public transfer index may only be read at exact signed destination identities'
);
assert.strictEqual(Promotion.matchesVerifiedLifecycleTransition(mixedTransitionContext, {
  transitionKind: 'transfer',
  fromClassKey: 'B',
  toClassKey: 'C',
  effectiveDate: '2026/07/10',
  sourceStudentKey: 'student-b',
  studentKey: 'student-c',
}, { destinationClassKey: 'C', destinationStudentKey: 'student-c' }), true);
assert.strictEqual(Promotion.matchesVerifiedLifecycleTransition(mixedTransitionContext, {
  transitionKind: 'promotion',
  promotionId: 'overridden-promotion-x-c',
  fromClassKey: 'X',
  toClassKey: 'C',
  effectiveDate: '2026-07-10',
  sourceStudentKey: 'student-x',
  studentKey: 'student-c',
}, { destinationClassKey: 'C', destinationStudentKey: 'student-c' }), false,
'a materialized promotion branch overridden by the signed explicit transfer must never expand reads');

const absent = Promotion.normalizePromotionContext(null, { currentClassKey: 'C' });
assert.strictEqual(absent.status, 'absent');
assert.deepStrictEqual(absent.classKeys, []);

const julyBoundary = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'B',
  edges: [edge({ effectiveDate: '2026-07-04' })],
}, {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
});
assert.strictEqual(Promotion.resolvePromotionScopeAtDate(julyBoundary, '6/27小考', 'grades').logicalClassKey, 'A');
assert.strictEqual(Promotion.resolvePromotionScopeAtDate(julyBoundary, '7/4鑑定考', 'grades').logicalClassKey, 'B');
assert.strictEqual(Promotion.resolvePromotionScopeAtDate(julyBoundary, '8/1作業', 'grades').logicalClassKey, 'B');

const januaryBoundary = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'B',
  edges: [edge({ effectiveDate: '2027-01-05' })],
}, {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
});
assert.strictEqual(Promotion.resolvePromotionScopeAtDate(januaryBoundary, '12/20小考', 'grades').logicalClassKey, 'A');
assert.strictEqual(Promotion.resolvePromotionScopeAtDate(januaryBoundary, '1/10小考', 'grades').logicalClassKey, 'B');
assert.strictEqual(Promotion.parseDateKeyWithAnchors('2026/08/01小考', [20260704]), 20260801);
assert.strictEqual(
  Promotion.parseDateKeyWithAnchors('7/2小考', [20240101]),
  0,
  'a partial date exactly equidistant across a leap-year boundary must fail closed'
);
const ambiguousPartialBoundary = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'B',
  edges: [edge({ effectiveDate: '2024-01-01' })],
}, {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
});
assert.deepStrictEqual(
  Promotion.resolvePromotionScopeAtDate(ambiguousPartialBoundary, '7/2小考', 'grades'),
  { matched: false, reason: 'promotion-date-invalid' }
);

const contextABA = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'A',
  edges: [
    edge(),
    edge({
      promotionId: 'p-b-a',
      fromClassKey: 'B',
      fromClassName: 'B 班',
      toClassKey: 'A',
      toClassName: 'A 班',
      effectiveDate: '2026-07-10',
      sourceStudentKey: 'student-b',
      studentKey: 'student-a-returned',
      storageMode: 'separate_grids',
    }),
  ],
}, {
  currentClassKey: 'A',
  currentStudentKey: 'student-a-returned',
  allowedClassKeys: ['A', 'B'],
});
assert.strictEqual(Promotion.getCurrentBulletinStartDate(contextABA), '2026-07-10');
assert.deepStrictEqual(
  Promotion.getFormerBulletinScopes(contextABA).map(item => [item.classKey, item.startDate, item.endDate]),
  [['B', '2026-07-01', '2026-07-10'], ['A', '', '2026-07-01']],
  'A to B to A must retain the first A interval as history while the second A interval stays current'
);
assert.deepStrictEqual(
  {
    oldA: Promotion.resolvePromotionScopeAtDate(contextABA, '2026-06-30', 'grades').dataStudentKey,
    middleB: Promotion.resolvePromotionScopeAtDate(contextABA, '2026-07-05', 'grades').dataStudentKey,
    currentA: Promotion.resolvePromotionScopeAtDate(contextABA, '2026-07-10', 'grades').dataStudentKey,
  },
  { oldA: 'student-b', middleB: 'student-b', currentA: 'student-a-returned' }
);

assert.throws(() => Promotion.normalizePromotionContext(Object.assign({}, rawABC, {
  edges: [edge({ effectiveDate: '2026/07/01' })],
  currentClassKey: 'B',
}), {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
}), /invalid-date/, 'slash dates from the session must fail closed');

assert.throws(() => Promotion.normalizePromotionContext(rawABC, {
  currentClassKey: 'C',
  currentStudentKey: 'wrong-student',
  allowedClassKeys: ['A', 'B', 'C'],
}), /current-student-mismatch/);

assert.throws(() => Promotion.normalizePromotionContext(rawABC, {
  currentClassKey: 'C',
  currentStudentKey: 'student-c',
  allowedClassKeys: ['B', 'C'],
}), /class-not-authorized:A/);

assert.throws(() => Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'C',
  edges: [rawABC.edges[1], rawABC.edges[1]],
}, {
  currentClassKey: 'C',
  currentStudentKey: 'student-c',
  allowedClassKeys: ['B', 'C'],
}), /(duplicate-id|date-ambiguity)/);

const xssContext = Promotion.normalizePromotionContext({
  version: 1,
  currentClassKey: 'B',
  edges: [edge({ fromClassName: '<img src=x onerror=alert(1)>' })],
}, {
  currentClassKey: 'B',
  currentStudentKey: 'student-b',
  allowedClassKeys: ['A', 'B'],
});
assert.strictEqual(xssContext.classNameByKey.A, '<img src=x onerror=alert(1)>', 'module returns data only; the renderer must escape it');
assert.strictEqual(typeof Promotion.resolvePromotionScopeAtDate(xssContext, 'invalid', 'grades').matched, 'boolean');

console.log('ebook promotion app tests passed');
