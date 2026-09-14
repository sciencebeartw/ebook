const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  const brace = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (!depth) return html.slice(start, i + 1);
  }
  throw new Error(`Unterminated ${name}`);
}
const c = {
  ClassSessionPlan: require("../class_session_plan"),
  FEEDBACK_TYPE_LABELS: { makeup: '缺考回報', legacyMakeup: '補考回報' },
  getMathAdvancedGuidanceStandard: () => null,
  isMathAdvancedGuidanceExam: () => false,
  isCurrentStudentEnrollmentExemptExam: () => false,
  normalizeEbookFeedbackExamId: value => String(value || ''),
  SVG: { edit: '', thumbsUp: '', smile: '', frown: '', meh: '', alert: '' },
  escapeHtmlAttr: String, escapeInlineJs: String,
  buildPostMakeupExtra: (post, extra) => (post.makeup || '') + (extra || '')
};
vm.createContext(c);
['isHomePracticeScoreTitle', 'isHomeworkColumnTitle', 'isHomeworkMissingScore', 'getDisplayLogic',
 'getDailyPostExamLabel', 'getDailyPostExamTimePrefix', 'buildAbsenceScoreReportFormHtml',
 'splitPostMultiLinkValue', 'buildPostMakeupFields', 'getFeedbackOverrideNum',
 'getLatestMakeupReportInfo', 'isMakeupScoreReportType', 'getAbsenceScoreReviewStatus'].forEach(name => vm.runInContext(extract(name), c));
vm.runInContext(extract('buildPostQuizFields'), c);
for (const quiz of ['', '  \n ', null, undefined]) {
  assert.equal(c.buildPostQuizFields({ quiz }).length, 0, 'no quiz attachment must omit the paper header and answer note');
}

const practice = { exam: '回家練習卷：理化第1-8章', examId: 'exam_practice', score: '假', scoreNum: null };
for (const score of ['假', '', '未繳', '#N/A']) {
  const logic = c.getDisplayLogic({ ...practice, score }, []);
  assert.equal(logic.mainScore, '缺繳', `home practice ${score} must show missing homework`);
  assert.equal(logic.needsReport, true, 'home practice must retain score reporting');
}
assert.equal(c.getDisplayLogic({ ...practice, exam: '小考：理化第9章' }, []).mainScore, '缺考');
assert.equal(c.getDisplayLogic({ exam: '理化作業第9章', score: '#N/A', scoreNum: null }, []).mainScore, '未繳');
for (const score of [0, 85]) {
  assert.strictEqual(c.getDisplayLogic({ ...practice, score: String(score), scoreNum: score }, []).mainScore, score);
}
const reports = [{ type: '缺考回報', targetExamId: 'exam_practice', content: '86' }];
const reviewed = c.getDisplayLogic(practice, reports);
assert.equal(reviewed.mainScore, 86);
assert.equal(reviewed.showReviewing, true);
assert(c.getDisplayLogic({ ...practice, score: '90假', scoreNum: 90 }, reports).teacherCorrected);
for (const score of ['未繳', '#N/A']) assert(c.getDisplayLogic({ ...practice, score }, reports).showReviewing);
assert.equal(c.getDisplayLogic(practice, [{ ...reports[0], targetExamId: 'different_exam' }]).mainScore, '缺繳');
const form = c.buildAbsenceScoreReportFormHtml({ date: '2026/09/19' }, practice, '2026-09-19', 'score-in', true, '', false);
assert(form.includes('缺繳分數') && !form.includes('缺考'), 'practice form must use missing-homework wording');
const examForm = c.buildAbsenceScoreReportFormHtml({ date: '2026/09/19' }, { exam: '小考' }, 'date', 'input', true, '', false);
assert(examForm.includes('缺考分數'), 'classroom exam report wording must remain');

for (const makeup of ['', '  \n ']) {
  assert.equal(c.buildPostMakeupFields({ makeup }, '').length, 0, 'no paper or pending result must omit the block');
  const fields = c.buildPostMakeupFields({ makeup }, '<form>上次未達標補考結果回報</form>');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].label, '補考結果回報');
  assert(!fields[0].labelNote, 'no missing-paper download hint');
  assert(fields[0].extra.includes('<form>'), 'pending reporting must stay accessible without an attachment');
}
for (const extra of ['', '<form>結果回報</form>']) {
  const fields = c.buildPostMakeupFields({ makeup: '[補考卷]https://example.test/paper.pdf\n[答案]https://example.test/answer.pdf' }, extra);
  assert.equal(fields[0].label, '今日補考考卷');
  assert(fields[0].extra.includes('paper.pdf') && fields[0].extra.includes('answer.pdf'));
  if (extra) assert(fields[0].extra.includes(extra));
}
console.log('home practice score states and makeup fields passed');
