const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Pending = require('../ebook_pending_tasks_app.js');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const legacyRenderer = fs.readFileSync(path.resolve(__dirname, '..', 'current_render.js'), 'utf8');

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
  BEAR_SUBJECT: '/science',
  escapeHtml: value => String(value),
  escapeHtmlAttr: value => String(value),
  window: { EbookPendingTasks: Pending },
};
vm.createContext(context);
[
  'isGiftedScienceClassName',
  'isMathHomeworkDoneClassName',
  'shouldUseHomeworkDoneFlowForClass',
  'parseDailyPostDisplayOptions',
  'getDailyPostDisplayOptions',
  'parseDailyPostSessionClock',
  'getDailyPostSessionContract',
  'getDailyPostSessionPresentation',
  'buildDailyPostSessionBadge',
  'getDailyPostHomeworkDoneMode',
  'shouldUseHomeworkDoneFlowForPost',
  'getDailyPostHomeworkLinkMode',
  'getDailyPostNoteLinkMode',
  'getDailyPostLinkDisplayName',
  'getDailyPostHomeworkNoteMode',
  'getDailyPostQuizOptions'
].forEach((name) => vm.runInContext(extractFunction(name), context));

const gifted = '115小六資優自然週日晚上班';
const advanced = '115國二自然超前班';
if (context.shouldUseHomeworkDoneFlowForPost({}, gifted)) throw new Error('legacy gifted science post must stay score-based');
if (!context.shouldUseHomeworkDoneFlowForPost({ displayOptions: { homework: { doneMode: 'show' } } }, gifted)) {
  throw new Error('gifted science should allow an explicitly enabled done button');
}
if (context.shouldUseHomeworkDoneFlowForPost({ displayOptions: { homework: { doneMode: 'hide' } } }, advanced)) {
  throw new Error('natural advanced should hide an explicitly disabled done button');
}
if (context.getDailyPostHomeworkLinkMode({ displayOptions: { homework: { hw1LinkMode: 'homework' } } }, 'hw1') !== 'homework') {
  throw new Error('homework resource link mode should be preserved');
}
if (context.getDailyPostHomeworkLinkMode({ displayOptions: { homework: { hw1LinkMode: 'supplement' } } }, 'hw1') !== 'supplement') {
  throw new Error('homework fields should allow the supplemental material link mode');
}
if (context.getDailyPostNoteLinkMode({ displayOptions: { links: { noteLinkMode: 'supplement' } } }) !== 'supplement') {
  throw new Error('supplemental information link mode should be preserved');
}
if (context.getDailyPostNoteLinkMode({ displayOptions: { links: { noteLinkMode: 'unknown' } } }) !== 'auto') {
  throw new Error('unknown supplemental information link modes must fail closed to auto');
}
if (context.getDailyPostLinkDisplayName('透鏡成像作圖', 'supplement') !== '補充教材｜透鏡成像作圖') {
  throw new Error('supplemental buttons must expose their purpose without relying on color alone');
}
if (context.getDailyPostLinkDisplayName('補充教材｜透鏡成像作圖', 'supplement') !== '補充教材｜透鏡成像作圖') {
  throw new Error('supplemental buttons must not duplicate an existing semantic prefix');
}
if (context.getDailyPostHomeworkNoteMode({ displayOptions: { homework: { noteMode: 'hide' } } }) !== 'hide') {
  throw new Error('homework correction note should support an explicit hide mode');
}
const quiz = context.getDailyPostQuizOptions({ displayOptions: { quiz: { slot2Role: 'answer', noteMode: 'provided' } } });
if (quiz.slot2Role !== 'answer' || quiz.noteMode !== 'provided') throw new Error('quiz answer role contract failed');
const mappedQuiz = context.getDailyPostQuizOptions({ displayOptions: { quiz: { slot1Exam: { targetExamId: 'exam_a' }, slot2Exam: { targetExamId: 'exam_b' } } } });
if (mappedQuiz.slot1Exam.targetExamId !== 'exam_a' || mappedQuiz.slot2Exam.targetExamId !== 'exam_b') {
  throw new Error('per-slot quiz ExamID mappings must survive displayOptions parsing');
}
const rescheduled = context.getDailyPostSessionPresentation({
  date: '2026/08/16',
  className: '115小六資優自然週六上午班',
  displayOptions: { session: {
    status: 'rescheduled',
    policyId: 'p6_gifted_science_sat_am',
    originalWeekday: 6,
    originalStartTime: '09:00',
    originalEndTime: '12:00',
    actualDate: '2026-08-16',
    startTime: '9:00',
    endTime: '12:00',
  } },
});
if (!rescheduled || rescheduled.label !== '本次調課｜8/16（日）09:00–12:00') {
  throw new Error('rescheduled DailyPost must expose a validated parent-facing session label');
}
if (!context.buildDailyPostSessionBadge({
  date: '2026/08/16',
  className: '115小六資優自然週六上午班',
  displayOptions: { session: {
    status: 'rescheduled',
    policyId: 'p6_gifted_science_sat_am',
    originalWeekday: 6,
    originalStartTime: '09:00',
    originalEndTime: '12:00',
    actualDate: '2026-08-16',
    startTime: '09:00',
    endTime: '12:00',
  } },
}).includes("post-session-badge")) throw new Error('rescheduled label must render as a DailyPost DOM badge');
if (context.getDailyPostSessionPresentation({
  date: '2026/08/16',
  className: '115小六資優自然週六上午班',
  displayOptions: { session: { status: 'rescheduled', startTime: '12:00', endTime: '09:00' } },
}) !== null) throw new Error('invalid reschedule metadata must fail closed');
if (context.getDailyPostSessionPresentation({
  date: '2026/08/16',
  className: '115小六資優自然週六上午班',
  displayOptions: { session: {
    status: 'rescheduled',
    policyId: 'p6_gifted_science_sun_pm',
    originalWeekday: 6,
    originalStartTime: '09:00',
    originalEndTime: '12:00',
    actualDate: '2026-08-16',
    startTime: '09:00',
    endTime: '12:00',
  } },
}) !== null) throw new Error('a reschedule with the wrong shared policyId must fail closed');
const cancelled = context.getDailyPostSessionPresentation({
  date: '2026/08/16',
  className: '115小六資優自然週六上午班',
  displayOptions: { session: { status: 'cancelled' } },
});
if (!cancelled || cancelled.label !== '本次停課｜8/16（日）') throw new Error('cancelled session label contract failed');

const renderStart = html.indexOf('function renderDailyPosts');
const renderEnd = html.indexOf('function renderGrades', renderStart);
const renderSource = html.slice(renderStart, renderEnd > renderStart ? renderEnd : undefined);
if (renderSource.indexOf('var gradeHtml = examCards.map') === -1 ||
    renderSource.indexOf('var sessionBadge = buildDailyPostSessionBadge(post)') === -1 ||
    renderSource.indexOf('headerTitle + sessionBadge + transferBadge') === -1) {
  throw new Error('session badge must remain a header-only addition independent of grade/paper card rendering');
}

[
  'linkMode === "homework"',
  'linkMode === "supplement"',
  'btn-supplement-tag',
  'linkMode: getDailyPostNoteLinkMode(post)',
  '本次已附解答，請完成後自行核對並訂正。',
  'buildHomeworkUploadNote(post, item.val)',
  'displayOptions: parseDailyPostDisplayOptions(post.displayOptions)',
  'var sessionBadge = buildDailyPostSessionBadge(post)',
  '.post-session-badge'
].forEach((needle) => {
  if (!html.includes(needle)) throw new Error(`Missing eBook display behavior: ${needle}`);
});

[
  'noteLinkMode',
  '"supplement"',
  'btn-supplement-tag',
  '補充教材｜'
].forEach((needle) => {
  if (!legacyRenderer.includes(needle)) throw new Error(`Missing legacy renderer supplemental link behavior: ${needle}`);
});

console.log('ebook daily post display options smoke passed');
