#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extract(start, end) {
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source block: ${start}`);
  return html.slice(startIndex, endIndex);
}

const context = {
  window: {
    BearExamIdentity: {
      normalizeCatalog(value) { return value; },
    },
  },
};
context.normalizeEbookExamLookupText = value => String(value == null ? '' : value).replace(/\s+/g, '');
vm.createContext(context);
vm.runInContext(
  extract('function getVerifiedStoredGradeExamId', 'function collectGradeDateAnchorKeys') +
  extract('function normalizeExamCatalogClassSnapshot', 'async function loadExamIdByClassColKey'),
  context,
);

const currentCatalog = {
  exam_current: {
    examId: 'exam_current',
    colKey: 'col_6',
    date: '2026/8/22小考',
    title: '理化第6章概念一、二',
  },
};
assert.equal(
  context.getVerifiedStoredGradeExamId(
    { date: '2026/8/22小考', examName: '理化第6章概念一、二' },
    'col_6',
    'gifted_class',
    { col_6: 'exam_current' },
    { gifted_class: currentCatalog },
  ),
  'exam_current',
  'matching class, column, date and title must retain the current ExamID',
);

const staleCatalog = {
  exam_old: {
    examId: 'exam_old',
    colKey: 'col_6',
    date: '2026/8/8作業',
    title: '理化第5章',
  },
};
assert.equal(
  context.getVerifiedStoredGradeExamId(
    { date: '2026/8/22小考', examName: '理化第6章概念一、二' },
    'col_6',
    'gifted_class',
    { col_6: 'exam_old' },
    { gifted_class: staleCatalog },
  ),
  '',
  'a grade update arriving before the shifted catalog must fail closed instead of reusing an old ExamID',
);
assert.equal(
  context.getVerifiedStoredGradeExamId(
    { date: '2026/8/22小考', examName: '理化第6章概念一、二' },
    'col_6',
    'gifted_class',
    { col_6: 'missing_exam' },
    { gifted_class: currentCatalog },
  ),
  '',
  'a missing catalog identity must fail closed',
);

const normalized = context.normalizeExamCatalogClassSnapshot({
  success: true,
  entries: currentCatalog,
});
assert.equal(normalized.byColKey.col_6, 'exam_current');
assert.equal(normalized.entries.exam_current.title, '理化第6章概念一、二');

assert.match(
  html,
  /watchRealtimeValue\(BEAR_SUBJECT \+ '\/meta\/examCatalog\/' \+ classKey,[\s\S]*?normalizeExamCatalogClassSnapshot\(snap\.val\(\) \|\| \{\}\)[\s\S]*?rebuildGradesFromScopedSources\(\)/,
  'eBook must keep each tracked class catalog synchronized and rebuild grade/post identities',
);

console.log('ebook exam catalog realtime sync tests passed');
