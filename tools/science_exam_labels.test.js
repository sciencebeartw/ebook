'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ebook = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function extract(source, name) {
  const start = source.indexOf('        function ' + name + '(');
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n        }', start) + 10);
}
const c = { BEAR_SUBJECT: '/science' };
vm.createContext(c);
for (const name of ['prependDailyPostLinkPurpose', 'getDailyPostExamLinkDisplayName']) vm.runInContext(extract(ebook, name), c);
const samples = [
  ['20260919 國二自然超前班 補考 加速度.pdf', '加速度'],
  ['20260919 國二自然超前班 補考 加速度ANS.pdf', '加速度'],
  ['20250302-08 小六資優自然 補考 地科第二章 大氣ANS.doc', '地科第二章 大氣'],
  ['20260621小六資優自然 補考 第七章動物如何獲得養分ANS.pdf', '第七章動物如何獲得養分'],
  ['20260131-0201 補考 理化第13章 電.pdf', '理化第13章 電'],
  ['20260222、28 小六資優自然 小考 地科 第一章.pdf', '地科 第一章'],
  ['20260509-10 小六資優自然 第二章生命的基本單位.pdf', '第二章生命的基本單位'],
  ['小考：20260829 國一自然超前班 光的傳播與特性.pdf', '光的傳播與特性'],
  ['20260815-16 小六資優自然 理化小考 第五章 聲音.pdf', '理化第五章 聲音'],
  ['20260627-28 小六資優自然 在家小考 第八章動物如何運輸物質 （全）ANS.pdf', '第八章動物如何運輸物質 （全）'],
  ['複習考：20260704-05小六資優自然-生物第 1~8 章 複習考.pdf', '生物第 1~8 章'],
  ['202060808 國二自然超前班 小考 高中補充 有機化合物的結構 ANS.pdf', '高中補充 有機化合物的結構'],
  ['20261002-03 國三自然總複習 小考 主題二 物質的世界.pdf', '主題二 物質的世界'],
  ['小考：理化第六章.pdf', '理化第六章'],
  ['補考 理化第13章 電ANS.doc', '理化第13章 電']
];
for (const [file, range] of samples) {
  assert.equal(c.getDailyPostExamLinkDisplayName(file, '小考卷'), '小考卷｜' + range);
  assert.equal(c.getDailyPostExamLinkDisplayName(file, '補考題目'), '補考卷｜' + range);
  assert.equal(c.getDailyPostExamLinkDisplayName(file, '補考答案'), '補考答案｜' + range);
  assert.equal(c.getDailyPostExamLinkDisplayName(file, '小考卷', 'full'), '小考卷｜' + file.replace(/^(?:小考|隨堂考|鑑定考|複習考|補考)[：:]\s*/, ''));
}
const reviewedFiles = require('./fixtures/science_exam_labels_20261003.json');
assert.equal(reviewedFiles.length, 180);
for (const item of reviewedFiles) {
  assert.equal(c.getDailyPostExamLinkDisplayName(item.name, '考卷'), '考卷｜' + item.range, 'reviewed file ' + item.number);
  assert.equal(c.getDailyPostExamLinkDisplayName(item.name, '考卷', 'full'), '考卷｜' + item.name.replace(/^(?:小考|隨堂考|鑑定考|複習考|補考)[：:]\s*/, ''));
}
assert.equal(c.getDailyPostExamLinkDisplayName('TRANS.pdf', '小考卷'), '小考卷｜TRANS');
assert.equal(c.getDailyPostExamLinkDisplayName('圖形解析.pdf', '小考卷'), '小考卷｜圖形解析');
for (const file of ['20260919 未知班級 小考 加速度.pdf', '20260919 國二自然超前班 小考 ANS.pdf', '20260919']) {
  assert.equal(c.getDailyPostExamLinkDisplayName(file, '小考卷'), '小考卷｜' + file);
}
c.BEAR_SUBJECT = '/math';
for (const [file] of samples) assert.equal(c.getDailyPostExamLinkDisplayName(file, '補考題目'), '補考題目｜' + file.replace(/^(?:小考|隨堂考|鑑定考|複習考|補考)[：:]\s*/, ''));
c.BEAR_SUBJECT = '/science';
assert.equal(c.getDailyPostExamLinkDisplayName('&lt;img src=x&gt;.pdf', '小考卷'), '小考卷｜&lt;img src=x&gt;');
assert.equal(
  c.getDailyPostExamLinkDisplayName('20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章', '假期練習卷'),
  '假期練習卷｜理化（上）第1～8章'
);
assert.equal(
  c.getDailyPostExamLinkDisplayName('20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章', '中秋複習卷答案'),
  '中秋複習卷答案｜理化（上）第1～8章'
);
assert.equal(
  c.getDailyPostExamLinkDisplayName('20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章', '假期練習卷', 'full'),
  '假期練習卷｜20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章'
);
const homeworkFile = '20261010 國二自然超前班 回家作業 高中補充 拋體運動.doc';
assert.equal(c.getDailyPostExamLinkDisplayName(homeworkFile, '回家作業卷'), '回家作業卷｜高中補充 拋體運動');
assert.equal(c.getDailyPostExamLinkDisplayName(homeworkFile, '回家作業卷', 'full'), '回家作業卷｜' + homeworkFile);
// Display labels must not replace the Office preview/download filename.
assert(ebook.includes('SVG.document, BEAR_SUBJECT === "/science" ? name : "")'));
const linkContext = { decodeBasicHtmlEntities: String, escapeHtmlAttr: String, isOfficeDocumentLink: name => name.endsWith('.doc'), getOfficePreviewUrl: () => 'https://preview.test', getOfficeDownloadFileName: name => name };
vm.createContext(linkContext); vm.runInContext(extract(ebook, 'renderParsedLink'), linkContext);
const link = linkContext.renderParsedLink('補考卷｜大氣', 'https://files.test/opaque', 'btn-link', '<svg></svg>', samples[2][0]);
assert(link.includes('https://preview.test') && link.includes('data-file-name="' + samples[2][0] + '"') && link.includes('<svg></svg>補考卷｜大氣'));
const homeworkLink = linkContext.renderParsedLink(c.getDailyPostExamLinkDisplayName(homeworkFile, '回家作業卷'), 'https://files.test/opaque', 'btn-important-tag', '<svg></svg>', homeworkFile);
assert(homeworkLink.includes('data-file-name="' + homeworkFile + '"') && homeworkLink.includes('<svg></svg>回家作業卷｜高中補充 拋體運動'));
const Plan = require('../class_session_plan');
assert.equal(Plan.publicOptions({ links: { examTitleMode: 'full' } }).links.examTitleMode, 'full');
for (const name of ['parseDailyPostDisplayOptions', 'getDailyPostDisplayOptions', 'getDailyPostQuizOptions']) vm.runInContext(extract(ebook, name), c);
const oldPost = { quiz: '[在家小考 生物.pdf]https://example.test/q.pdf\n[在家小考 生物ANS.pdf]https://example.test/a.pdf' };
assert.equal(c.getDailyPostQuizOptions(oldPost).slot2Role, 'answer');
assert.equal(oldPost.displayOptions, undefined, 'inference must not mutate old posts');
const teacherPost = { ...oldPost, displayOptions: { quiz: { slot2Role: 'question' } } };
assert.equal(c.getDailyPostQuizOptions(teacherPost).slot2Role, 'question', 'explicit teacher roles win');
assert.equal(c.getDailyPostQuizOptions({ quiz: '[TRANS.pdf]https://example.test/a.pdf' }).slot1Role, undefined);
c.BEAR_SUBJECT = '/math';
assert.equal(c.getDailyPostQuizOptions(oldPost).slot2Role, undefined, 'math roles are unchanged');
console.log('Science exam labels: historical variants, full title, math isolation, Office download passed');
