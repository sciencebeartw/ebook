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

const context = { BEAR_SUBJECT: '/science' };
vm.createContext(context);
[
  'getHomeworkDoneCourseAliasKey',
  'getHomeworkDoneRelatedClassKeyCandidates',
  'getHomeworkDoneRelatedClassKeys',
  'mergeHomeworkClassNode',
  'mergeHomeworkDoneForStudent',
  'mergeFeedbackForStudent',
  'mergeFeedbackClassNode',
  'buildFeedbackHistoryList'
].forEach((name) => vm.runInContext(extractFunction(name), context));

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\nexpected ${e}\nactual   ${a}`);
}

if (context.getHomeworkDoneCourseAliasKey('115國二自然超前班') !== 'science:natural-advanced:113') {
  throw new Error('promoted grade 8 class should use cohort 113');
}
if (context.getHomeworkDoneCourseAliasKey('115國一自然超前班') === context.getHomeworkDoneCourseAliasKey('115國二自然超前班')) {
  throw new Error('new grade 7 class must not merge with promoted grade 8 class');
}
if (context.getHomeworkDoneCourseAliasKey('116國三自然超前班') !== '') {
  throw new Error('natural advanced is a two-year class; grade 9 must not be aliased');
}

assertDeepEqual(
  context.getHomeworkDoneRelatedClassKeyCandidates('115國二自然超前班'),
  ['114國一自然超前班', '115國二自然超前班'],
  'promoted grade 8 class should read only old grade 7 plus current grade 8 nodes'
);

assertDeepEqual(
  context.getHomeworkDoneRelatedClassKeyCandidates('115國一自然超前班'),
  ['115國一自然超前班', '116國二自然超前班'],
  'new grade 7 class should not read the promoted grade 8 cohort'
);

const dailyPosts = {
  '114國一自然超前班': { row5: { date: '2026/06/20', title: '國一自然超前' } },
  '115國一自然超前班': { wrongPost: { date: '2026/07/04', title: '另一屆國一自然超前' } },
  '115國二自然超前班': { row5: { date: '2026/07/04', title: '國二自然超前' } }
};

assertDeepEqual(
  context.mergeHomeworkClassNode(dailyPosts, '115國二自然超前班'),
  {
    row5: { className: '114國一自然超前班', date: '2026/06/20', title: '國一自然超前' },
    '115國二自然超前班__row5': { className: '115國二自然超前班', date: '2026/07/04', title: '國二自然超前' }
  },
  'eBook should merge old grade 7 and new grade 8 posts without row-key collisions'
);

const homeworkDoneRoot = {
  '114國一自然超前班': { '陳金希': { '2026_06_20': { status: 'done' } } },
  '115國一自然超前班': { '陳金希': { '2026_07_04': { status: 'done', wrongCohort: true } } },
  '115國二自然超前班': { '陳金希': { '2026_07_04': { status: 'done' } } }
};

assertDeepEqual(
  context.mergeHomeworkDoneForStudent(homeworkDoneRoot, '115國二自然超前班', '陳金希'),
  {
    '2026_06_20': { status: 'done' },
    '2026_07_04': { status: 'done' }
  },
  'eBook should merge homeworkDone for the promoted cohort only'
);

const feedbackRoot = {
  '114國一自然超前班': { '陳金希': { oldFb: { time: '2026/06/20 20:00', targetDate: '2026/06/20', type: '缺考回報', content: '90' } } },
  '115國二自然超前班': { '陳金希': { newFb: { time: '2026/07/04 20:00', targetDate: '2026/07/04', type: '學生留言', content: 'done' } } }
};

const feedbacks = context.buildFeedbackHistoryList(context.mergeFeedbackForStudent(feedbackRoot, '115國二自然超前班', '陳金希'));
if (feedbacks.length !== 2 || feedbacks[0].fbKey !== 'oldFb' || feedbacks[1].fbKey !== 'newFb') {
  throw new Error('eBook should merge and sort feedback history for the promoted cohort');
}

assertDeepEqual(
  context.mergeFeedbackClassNode(feedbackRoot, '115國二自然超前班'),
  {
    '陳金希': {
      oldFb: { time: '2026/06/20 20:00', targetDate: '2026/06/20', type: '缺考回報', content: '90' },
      newFb: { time: '2026/07/04 20:00', targetDate: '2026/07/04', type: '學生留言', content: 'done' }
    }
  },
  'eBook admin feedback query should merge same cohort class nodes only'
);

[
  '`${BEAR_SUBJECT}/dailyPosts${hasHomeworkCohortAlias ?',
  '`${BEAR_SUBJECT}/homeworkDone${hasHomeworkCohortAlias ?',
  '`${BEAR_SUBJECT}/feedbacks`).once',
  "BEAR_SUBJECT + '/feedbacks' + (hasHomeworkCohortAlias ? ''"
].forEach((pattern) => {
  if (html.includes(pattern)) {
    throw new Error(`promotion alias must not read whole Firebase nodes: ${pattern}`);
  }
});

console.log('ebook homework class alias smoke passed');
