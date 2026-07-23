const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing function ${name}`);
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

const context = {
  BEAR_SUBJECT: '/math',
  gData: { className: '115數學超前' },
  window: {},
  SVG: { alert: '<alert>', thumbsUp: '<up>', smile: '<smile>', meh: '<meh>', frown: '<frown>' },
  isHomeworkColumnTitle: () => false,
  isHomeworkMissingScore: () => false,
  isCurrentStudentEnrollmentExemptExam: () => false,
  getFeedbackOverrideNum: () => null,
  getGiftedScienceHomeworkFullScore: () => null,
};
vm.createContext(context);
[
  'isMathAdvancedGuidanceExam',
  'getMathAdvancedGuidanceStandard',
  'getGradeScoreUnitText',
  'getDisplayLogic',
].forEach((name) => vm.runInContext(extractFunction(name), context));

const assessment = {
  className: '115數學超前',
  date: '7/23',
  exam: 'B1-Ch1鑑定考',
  note: '滿分110分，輔導標準75分',
  score: '74',
  scoreNum: 74,
  makeupThreshold: 0,
  myBucket: 2,
};

assert.equal(context.isMathAdvancedGuidanceExam(assessment), true,
  'math-advanced assessments must use the guidance display');
assert.equal(context.isMathAdvancedGuidanceExam({ ...assessment, className: '115資優數學' }), false,
  'gifted math must keep the existing makeup behavior');
assert.equal(context.isMathAdvancedGuidanceExam({ ...assessment, date: '7/25小考', exam: 'B1-Ch2' }), true,
  'quizzes in math-advanced classes must use the same guidance behavior');
assert.equal(context.isMathAdvancedGuidanceExam({ ...assessment, exam: 'B1-Ch1複習考' }), false,
  'unrequested exam types in math-advanced classes must keep the existing makeup behavior');

const standard = context.getMathAdvancedGuidanceStandard(assessment);
assert.deepEqual({ ...standard }, { fullScore: 110, guidanceThreshold: 75 },
  'full score and guidance threshold must be parsed by their labels');
assert.deepEqual({ ...context.getMathAdvancedGuidanceStandard({
  ...assessment,
  note: '滿分：120 分 / 輔導標準：80 分',
}) }, { fullScore: 120, guidanceThreshold: 80 },
  'full-width colons and spaces must be supported');
assert.deepEqual({ ...context.getMathAdvancedGuidanceStandard({
  ...assessment,
  date: '7/25小考',
  exam: 'B1-Ch2',
  note: '未滿75分',
}) }, { fullScore: null, guidanceThreshold: 75 },
  'legacy numeric quiz notes must be interpreted as guidance thresholds');
assert.equal(context.getGradeScoreUnitText(assessment, '分'), '／110 分',
  'the score must show the assessment denominator');

const below = context.getDisplayLogic(assessment, []);
assert.match(below.statusHtml, /未達標需輔導/,
  'a score below the guidance threshold must show the guidance warning');
assert.doesNotMatch(below.statusHtml, /未達標需補考/,
  'math-advanced assessments must not show a makeup warning');

const passing = context.getDisplayLogic({ ...assessment, score: '75', scoreNum: 75 }, []);
assert.equal(passing.statusHtml, '', 'a score at the guidance threshold must not show a warning');
const above = context.getDisplayLogic({ ...assessment, score: '81', scoreNum: 81 }, []);
assert.equal(above.statusHtml, '', 'a score above the guidance threshold must not show a warning');

[
  ['#00ff00', '輔導結果：觀念理解良好'],
  ['#ffff00', '輔導結果：觀念大致理解'],
  ['#ff9900', '輔導結果：觀念不太理解'],
  ['#ff0000', '輔導結果：觀念必須加強'],
].forEach(([cellColor, expected]) => {
  const colored = context.getDisplayLogic({ ...assessment, cellColor }, []);
  assert.match(colored.statusHtml, new RegExp(expected), `${cellColor} must show its guidance result`);
  assert.doesNotMatch(colored.statusHtml, /未達標需輔導|補考結果/,
    `${cellColor} guidance results must replace pending and makeup labels`);
});
const incompleteNote = context.getDisplayLogic({
  ...assessment,
  note: '滿分110分',
  guidanceThreshold: 0,
  makeupThreshold: 110,
}, []);
assert.doesNotMatch(incompleteNote.statusHtml, /補考/,
  'math-advanced assessments must never fall back to the generic makeup warning');

const regularMath = context.getDisplayLogic({
  ...assessment,
  className: '115資優數學',
  exam: '小考',
  note: '75',
  score: '74',
  scoreNum: 74,
  makeupThreshold: 75,
}, []);
assert.match(regularMath.statusHtml, /未達標需補考/,
  'other math classes and exam types must keep the existing makeup warning');
const regularMathColored = context.getDisplayLogic({
  ...assessment,
  className: '115資優數學',
  exam: '小考',
  cellColor: '#00ff00',
}, []);
assert.match(regularMathColored.statusHtml, /補考結果：觀念理解良好/,
  'other math classes must keep the existing four-color makeup labels');
assert.doesNotMatch(regularMathColored.statusHtml, /輔導結果/,
  'guidance color labels must not leak into other math classes');

assert.match(html, /!isMathAdvancedGuidance && eData\.note/,
  'the generic makeup parser must not treat full score as a makeup threshold');
assert.match(html, /輔導標準：" \+ escapeHtml\(mathGuidanceStandard\.guidanceThreshold\) \+ "分/,
  'the daily-post card must render the guidance standard label');
assert.match(html, /var oldStandardHtml = isMathAdvancedGuidance/,
  'the recent-grade card must render the same guidance standard label');
assert.match(html, /if \(isMathAdvancedGuidanceExam\(\{ className: cls/,
  'math-advanced assessments and quizzes must be excluded from the makeup result list');

console.log('ebook math-advanced guidance smoke passed');
