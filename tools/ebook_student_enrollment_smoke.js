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

const context = {};
vm.createContext(context);
[
  'parseEbookComparableDate',
  'getEbookComparableDateKey',
  'listActiveStudentEnrollments',
  'getStudentEnrollmentDateKey',
  'isOnOrAfterStudentEnrollmentDate',
  'filterItemsByStudentEnrollmentDate'
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
