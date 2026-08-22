const assert = require('assert');
const threads = require('../ebook_feedback_threads_app.js');

function feedback(overrides) {
  return Object.assign({
    time: '2026/08/22 18:00:00',
    targetDate: '2026/08/22',
    type: '學生留言',
    content: '學生留言',
    sourceClassKey: '115小六資優自然週六上午班',
    storedStudentKey: 'student_a',
  }, overrides || {});
}

const explicit = threads.buildFeedbackThreads([
  feedback({ fbKey: 'student-root', content: '老師您好，我的成績要改成 86。' }),
  feedback({
    fbKey: 'teacher-reply',
    time: '2026/08/22 18:05:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    source: 'ebook_god_teacher',
    replyToFeedbackKey: 'student-root',
    content: '[quote:學生留言]老師您好，我的成績要改成 86。[/quote]\n已協助確認。',
  }),
  feedback({
    fbKey: 'student-followup',
    time: '2026/08/22 18:06:00',
    replyToFeedbackKey: 'teacher-reply',
    content: '謝謝老師！',
  }),
  feedback({ fbKey: 'student-root-2', time: '2026/08/22 18:07:00', content: '另一個問題' }),
]);

assert.strictEqual(explicit.threads.length, 2, 'two independent roots must stay as two threads');
assert.deepStrictEqual(
  explicit.threads[0].messages.map(item => item.key),
  ['student-root', 'teacher-reply', 'student-followup'],
  'explicit parent chains must flatten into one chronological thread'
);
assert.strictEqual(explicit.threads[0].messages[1].displayContent, '已協助確認。', 'valid explicit children should hide the legacy leading quote visually');
assert.strictEqual(explicit.threads[0].messages[1].item.content.includes('[quote:'), true, 'thread rendering must not mutate persisted content');
assert.strictEqual(threads.getLatestKeyedMessage(explicit.threads[0]).key, 'student-followup');
assert.strictEqual(threads.getLatestReplyableKeyedMessage(explicit.threads[0]).key, 'student-followup');
assert.strictEqual(threads.getLatestStudentMessage(explicit.threads[0]).key, 'student-followup');

const quoteOnlyChild = threads.buildFeedbackThreads([
  feedback({ fbKey: 'quote-only-root', content: '引用後沒有其他文字' }),
  feedback({
    fbKey: 'quote-only-child',
    time: '2026/08/22 18:01:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    replyToFeedbackKey: 'quote-only-root',
    content: '[quote:學生留言]引用後沒有其他文字[/quote]',
  }),
]);
assert.strictEqual(quoteOnlyChild.threads[0].replies[0].displayContent, '', 'a valid explicit child must always hide its leading quote');

const forwardListedParent = threads.buildFeedbackThreads([
  feedback({ fbKey: 'child-listed-first', replyToFeedbackKey: 'parent-listed-later', time: '2026/08/22 18:00:00', content: '同秒回覆' }),
  feedback({ fbKey: 'parent-listed-later', time: '2026/08/22 18:00:00', content: '同秒原留言' }),
]);
assert.strictEqual(forwardListedParent.threads.length, 1, 'an exact explicit parent must not depend on object enumeration order');
assert.deepStrictEqual(forwardListedParent.threads[0].messages.map(item => item.key), ['parent-listed-later', 'child-listed-first']);
assert.strictEqual(
  threads.getLatestKeyedMessage(forwardListedParent.threads[0]).key,
  'child-listed-first',
  'same-second ordering must keep the explicit child as the latest reply target'
);

const untrustedLegacyTeacherTarget = threads.buildFeedbackThreads([
  feedback({ fbKey: 'safe-student-target', content: '學生原留言' }),
  feedback({
    fbKey: 'legacy-visual-teacher',
    time: '2026/08/22 18:01:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    source: 'legacy_unknown',
    replyToFeedbackKey: 'safe-student-target',
    content: '這筆舊老師資料缺少可信來源。',
  }),
]);
assert.strictEqual(threads.isTeacherFeedback(untrustedLegacyTeacherTarget.threads[0].replies[0].item), true, 'legacy teacher rows should still render as teacher messages');
assert.strictEqual(threads.isReplyableFeedback(untrustedLegacyTeacherTarget.threads[0].replies[0].item), false, 'an untrusted legacy teacher row must not be offered as a backend reply parent');
assert.strictEqual(
  threads.getLatestReplyableKeyedMessage(untrustedLegacyTeacherTarget.threads[0]).key,
  'safe-student-target',
  'student composer should fall back to the latest backend-eligible message in the thread'
);

const trustedTeacherTarget = explicit.threads[0].messages[1];
assert.strictEqual(threads.isReplyableFeedback(trustedTeacherTarget.item), true, 'new trusted teacher replies should remain valid student reply targets');

const duplicateKeyAcrossScopes = threads.buildFeedbackThreads([
  feedback({ fbKey: 'shared-key', sourceClassKey: 'class-a', content: 'A 班原留言' }),
  feedback({ fbKey: 'shared-key', sourceClassKey: 'class-b', time: '2026/08/22 18:01:00', content: 'B 班同 key 留言' }),
  feedback({ fbKey: 'scoped-child', sourceClassKey: 'class-a', time: '2026/08/22 18:02:00', replyToFeedbackKey: 'shared-key', content: '只應回覆 A 班' }),
]);
assert.strictEqual(duplicateKeyAcrossScopes.threads.length, 2, 'duplicate keys in other class scopes must not make an exact scoped parent ambiguous');
assert.deepStrictEqual(duplicateKeyAcrossScopes.threads[0].messages.map(item => item.key), ['shared-key', 'scoped-child']);
assert.deepStrictEqual(duplicateKeyAcrossScopes.threads[1].messages.map(item => item.key), ['shared-key']);

const equivalentDateFormats = threads.buildFeedbackThreads([
  feedback({ fbKey: 'date-format-parent', targetDate: '2026/8/2', content: '未補零日期' }),
  feedback({
    fbKey: 'date-format-child',
    targetDate: '2026-08-02',
    time: '2026/08/02 18:01:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    source: 'dashboard_admin',
    replyToFeedbackKey: 'date-format-parent',
    content: '同一天的回覆',
  }),
]);
assert.strictEqual(equivalentDateFormats.threads.length, 1, 'equivalent padded and non-padded dates must share one thread');
assert.strictEqual(threads.canonicalDateKey('2026/8/2'), '2026/08/02');
assert.strictEqual(threads.canonicalDateKey('2026/08-02'), '', 'mixed date separators must fail closed');
assert.strictEqual(threads.canonicalDateKey('2026/02/30'), '', 'invalid calendar dates must fail closed');

const invalidDateScope = threads.buildFeedbackThreads([
  feedback({ fbKey: 'invalid-date-parent', targetDate: '2026/02/30', content: 'invalid parent' }),
  feedback({ fbKey: 'invalid-date-child', targetDate: '2026/02/30', replyToFeedbackKey: 'invalid-date-parent', content: 'invalid child' }),
]);
assert.strictEqual(invalidDateScope.threads.length, 2, 'invalid dates must never authorize an automatic parent link');

const teacherRoot = threads.buildFeedbackThreads([
  feedback({ fbKey: 'teacher-direct', type: '阿喵老師留言', actorRole: 'teacher', content: '請補上訂正照片。' }),
  feedback({ fbKey: 'student-photo', time: '2026/08/22 18:01:00', replyToFeedbackKey: 'teacher-direct', content: '📎 訂正.jpg\n[附件]https://example.com/corrected.jpg' }),
]);
assert.strictEqual(teacherRoot.threads.length, 1, 'a student reply to a teacher direct message must remain in that thread');
assert.strictEqual(threads.getLatestStudentMessage(teacherRoot.threads[0]).key, 'student-photo');

const legacySource = '這是一段超過五十個字的舊學生留言，用來確認歷史老師引用只有在唯一匹配時才會自動整理到同一個留言串中。';
const legacyQuote = legacySource.replace(/\s+/g, ' ').slice(0, 50) + '...';
const legacy = threads.buildFeedbackThreads([
  feedback({ fbKey: 'legacy-root', content: legacySource }),
  feedback({
    fbKey: 'legacy-teacher',
    time: '2026/08/22 18:02:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    content: `[quote:學生留言]${legacyQuote}[/quote]\n舊資料也能整理。`,
  }),
]);
assert.strictEqual(legacy.threads.length, 1, 'one unique legacy quote match should join its original thread');
assert.strictEqual(legacy.threads[0].messages[1].relation, 'legacy_quote');
assert.strictEqual(legacy.threads[0].messages[1].displayContent, '舊資料也能整理。');

const untypedLegacy = threads.buildFeedbackThreads([
  feedback({ fbKey: 'untyped-root', content: '沒有引用類型的舊留言' }),
  feedback({
    fbKey: 'untyped-teacher',
    time: '2026/08/22 18:03:00',
    type: '歷史回覆',
    source: 'spreadsheet_sidebar',
    content: '[quote]沒有引用類型的舊留言[/quote]\n仍應唯一對齊。',
  }),
]);
assert.strictEqual(untypedLegacy.threads.length, 1, 'legacy [quote] without a type should remain compatible');
assert.strictEqual(untypedLegacy.threads[0].messages[1].displayContent, '仍應唯一對齊。');

['dashboard_direct', 'dashboard_admin', 'ebook_god_teacher', 'spreadsheet_sidebar'].forEach(source => {
  assert.strictEqual(
    threads.isTeacherFeedback(feedback({ type: '歷史留言', actorRole: '', source })),
    true,
    `${source} must preserve teacher identity when legacy actorRole is missing`
  );
});

const ambiguousLegacy = threads.buildFeedbackThreads([
  feedback({ fbKey: 'same-1', content: '完全相同的留言' }),
  feedback({ fbKey: 'same-2', time: '2026/08/22 18:01:00', content: '完全相同的留言' }),
  feedback({
    fbKey: 'ambiguous-reply',
    time: '2026/08/22 18:02:00',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    content: '[quote:學生留言]完全相同的留言[/quote]\n不能猜。',
  }),
]);
assert.strictEqual(ambiguousLegacy.threads.length, 3, 'ambiguous legacy quotes must fail closed as independent roots');
assert.strictEqual(ambiguousLegacy.threads[2].root.displayContent.includes('[quote:'), true, 'an ungrouped legacy quote must remain visible for context');

const orphan = threads.buildFeedbackThreads([
  feedback({
    fbKey: 'orphan',
    type: '阿喵老師回覆',
    actorRole: 'teacher',
    replyToFeedbackKey: 'missing-parent',
    content: '[quote:學生留言]找不到的留言[/quote]\n保留引用。',
  }),
]);
assert.strictEqual(orphan.threads.length, 1);
assert.strictEqual(orphan.threads[0].root.relation, 'orphan');
assert.strictEqual(orphan.threads[0].root.displayContent.includes('[quote:'), true, 'orphan replies must preserve their original quote');

const selfAndForwardCycle = threads.buildFeedbackThreads([
  feedback({ fbKey: 'cycle-a', replyToFeedbackKey: 'cycle-b', content: 'A' }),
  feedback({ fbKey: 'cycle-b', replyToFeedbackKey: 'cycle-a', time: '2026/08/22 18:01:00', content: 'B' }),
  feedback({ fbKey: 'self', replyToFeedbackKey: 'self', time: '2026/08/22 18:02:00', content: 'self' }),
]);
assert.strictEqual(selfAndForwardCycle.threads.length, 3, 'forward, cyclic, and self parents must all fail closed');

const tooDeep = [];
for (let i = 0; i < 6; i++) {
  tooDeep.push(feedback({
    fbKey: `depth-${i}`,
    replyToFeedbackKey: i ? `depth-${i - 1}` : '',
    time: `2026/08/22 18:0${i}:00`,
    content: `message ${i}`,
  }));
}
const depthResult = threads.buildFeedbackThreads(tooDeep, { maxDepth: 3 });
assert(depthResult.threads.length > 1, 'over-deep chains must split instead of being followed without a bound');

const operational = threads.buildFeedbackThreads([
  feedback({ fbKey: 'normal', content: '一般留言' }),
  feedback({ fbKey: 'sticker', type: '棒卡申請', content: '{"reason":"小考高分","count":5,"status":"待審核"}' }),
  feedback({ fbKey: 'makeup', type: '補考結果回報', content: '錯 2 題' }),
]);
assert.strictEqual(operational.threads.length, 1);
assert.strictEqual(operational.operational.length, 2, 'operational cards must not be folded into social reply threads');
assert.deepStrictEqual(operational.blocks.map(block => block.kind), ['thread', 'operational', 'operational']);

console.log('✓ eBook feedback thread helper tests passed');
