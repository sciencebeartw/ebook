const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

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

const context = { EbookLifecycleApp: require('../ebook_lifecycle_app.js') };
vm.createContext(context);
[
  'parseEbookComparableDate',
  'getEbookComparableDateKey',
  'listActiveStudentEnrollments',
  'getStudentEnrollmentDateKey',
  'isOnOrAfterStudentEnrollmentDate',
  'isStudentEnrollmentDate',
  'isCurrentStudentEnrollmentDate',
  'filterItemsByStudentEnrollmentDate',
  'isHomePracticeScoreTitle',
  'isHomeworkColumnTitle',
  'isHomeworkMissingScore',
  'isCurrentStudentEnrollmentExemptExam'
].forEach((name) => vm.runInContext(extractFunction(name), context));

const enrollmentIndex = {
  enroll_1: {
    studentName: '陳韋均',
    classKey: '115小六資優自然週六上午班',
    enrollmentDate: '2026-07-04',
    status: 'active',
  },
  deleted: {
    studentName: '陳韋均',
    classKey: '115小六資優自然週六上午班',
    enrollmentDate: '2026-06-01',
    status: 'deleted',
  },
};

if (context.listActiveStudentEnrollments(enrollmentIndex).length !== 1) {
  throw new Error('deleted enrollment records must be ignored');
}

if (context.getStudentEnrollmentDateKey(enrollmentIndex, '115小六資優自然週六上午班') !== 20260704) {
  throw new Error('enrollment date key should come from active current-class enrollment record');
}

if (context.isOnOrAfterStudentEnrollmentDate({ date: '2026/07/03' }, enrollmentIndex, '115小六資優自然週六上午班') !== false) {
  throw new Error('records before enrollment date should be hidden');
}

if (context.isOnOrAfterStudentEnrollmentDate({ date: '2026/07/04' }, enrollmentIndex, '115小六資優自然週六上午班') !== true) {
  throw new Error('records on enrollment date should remain visible');
}

if (context.isStudentEnrollmentDate({ date: '7/4小考' }, enrollmentIndex, '115小六資優自然週六上午班') !== true) {
  throw new Error('the enrollment-day exam must be marked for exemption');
}
if (context.isStudentEnrollmentDate({ date: '7/5小考' }, enrollmentIndex, '115小六資優自然週六上午班') !== false) {
  throw new Error('exemption must apply only on the enrollment date');
}

context.gData = {
  className: '115小六資優自然週六上午班',
  trackedClassKeys: ['115小六資優自然週六上午班'],
  studentEnrollmentIndex: enrollmentIndex,
};
context.getFeedbackOverrideNum = () => null;
vm.runInContext(extractFunction('getDisplayLogic'), context);

const enrollmentQuiz = context.getDisplayLogic({
  date: '7/4小考',
  exam: '生物第1-8章複習考',
  score: '',
  scoreNum: null,
}, []);
if (enrollmentQuiz.mainScore !== '免試' || !enrollmentQuiz.isEnrollmentExempt) {
  throw new Error('the enrollment-day quiz must display 免試');
}

const enrollmentHomeworkMissing = context.getDisplayLogic({
  date: '7/4作業',
  exam: '理化第1章',
  score: '尚未繳交',
  scoreNum: null,
}, []);
if (enrollmentHomeworkMissing.mainScore !== '未繳' || enrollmentHomeworkMissing.isEnrollmentExempt || enrollmentHomeworkMissing.needsReport) {
  throw new Error('missing enrollment-day homework must display 未繳 without exam exemption or score report');
}
if (!['#N/A', '尚未繳交', '未交', '缺繳'].every((score) => context.isHomeworkMissingScore(score))) {
  throw new Error('all supported missing-homework values must normalize to 未繳');
}

const enrollmentHomeworkScore = context.getDisplayLogic({
  date: '7/4作業',
  exam: '理化第1章',
  score: '42',
  scoreNum: 42,
}, []);
if (enrollmentHomeworkScore.mainScore !== 42 || enrollmentHomeworkScore.isEnrollmentExempt) {
  throw new Error('submitted enrollment-day homework must keep its actual score');
}

const enrollmentEntranceAssessment = context.getDisplayLogic({
  date: '7/4鑑定考',
  exam: '入班鑑定考',
  score: '60',
  scoreNum: 60,
}, []);
if (enrollmentEntranceAssessment.mainScore !== 60 || enrollmentEntranceAssessment.isEnrollmentExempt) {
  throw new Error('the entrance assessment must keep its actual score');
}

[
  { date: '7/4複習考', exam: '生物第1-8章複習考' },
  { date: '7/4鑑定考', exam: '自然能力鑑定考' },
  { date: '7/4段考', exam: '第一階段考試' },
].forEach((exam) => {
  const result = context.getDisplayLogic(Object.assign({ score: '88', scoreNum: 88 }, exam), []);
  if (result.mainScore !== '免試' || !result.isEnrollmentExempt) {
    throw new Error(`all enrollment-day exams except the entrance assessment must display 免試: ${exam.date}`);
  }
});

if (context.isCurrentStudentEnrollmentExemptExam({
  date: '7/4作業', exam: '理化第1章', score: '尚未繳交',
})) {
  throw new Error('enrollment-day homework must never be exempt');
}

const laterQuiz = context.getDisplayLogic({
  date: '7/5小考',
  exam: '生物第1-8章複習考',
  score: '',
  scoreNum: null,
}, []);
if (laterQuiz.mainScore !== '缺考' || laterQuiz.isEnrollmentExempt) {
  throw new Error('quiz exemption must not extend beyond the enrollment date');
}

const filtered = context.filterItemsByStudentEnrollmentDate([
  { date: '2026/07/03', title: '入班前' },
  { date: '2026/07/04', title: '入班日' },
  { date: '2026/07/05', title: '入班後' },
], enrollmentIndex, '115小六資優自然週六上午班');

if (filtered.length !== 2 || filtered[0].title !== '入班日' || filtered[1].title !== '入班後') {
  throw new Error('filter should keep only records on or after enrollment date');
}

const timeOnlyItems = context.filterItemsByStudentEnrollmentDate([
  { time: '2026/07/03 18:00:00', title: '公告型資料不依入班日切分' },
], enrollmentIndex, '115小六資優自然週六上午班');

if (timeOnlyItems.length !== 1) {
  throw new Error('time-only items should not be hidden by enrollment date filtering');
}

console.log('ebook student enrollment smoke passed');
