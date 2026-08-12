const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

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
  'isGiftedScienceClassName',
  'isMathHomeworkDoneClassName',
  'shouldUseHomeworkDoneFlowForClass',
  'parseDailyPostDisplayOptions',
  'getDailyPostDisplayOptions',
  'getDailyPostHomeworkDoneMode',
  'shouldUseHomeworkDoneFlowForPost',
  'getDailyPostHomeworkLinkMode',
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
if (context.getDailyPostHomeworkNoteMode({ displayOptions: { homework: { noteMode: 'hide' } } }) !== 'hide') {
  throw new Error('homework correction note should support an explicit hide mode');
}
const quiz = context.getDailyPostQuizOptions({ displayOptions: { quiz: { slot2Role: 'answer', noteMode: 'provided' } } });
if (quiz.slot2Role !== 'answer' || quiz.noteMode !== 'provided') throw new Error('quiz answer role contract failed');
const mappedQuiz = context.getDailyPostQuizOptions({ displayOptions: { quiz: { slot1Exam: { targetExamId: 'exam_a' }, slot2Exam: { targetExamId: 'exam_b' } } } });
if (mappedQuiz.slot1Exam.targetExamId !== 'exam_a' || mappedQuiz.slot2Exam.targetExamId !== 'exam_b') {
  throw new Error('per-slot quiz ExamID mappings must survive displayOptions parsing');
}

[
  'linkMode === "homework"',
  '本次已附解答，請完成後自行核對並訂正。',
  'buildHomeworkUploadNote(post, item.val)',
  'displayOptions: parseDailyPostDisplayOptions(post.displayOptions)'
].forEach((needle) => {
  if (!html.includes(needle)) throw new Error(`Missing eBook display behavior: ${needle}`);
});

console.log('ebook daily post display options smoke passed');
