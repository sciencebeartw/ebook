const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = require(path.join(__dirname, '..', 'gifted_homework_full_scores.js'));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.equal(Object.keys(app.scores).length, 32, 'the public catalog must contain all 32 gifted-science chapters');
assert.equal(app.getFullScore('理化第3章'), 39, 'physics chapter 3 must use the formal Form score ceiling');
assert.equal(app.getFullScore(' 114理化作業第三章 '), null, 'year-prefixed sheet names must not accidentally match parent grade labels');
assert.equal(app.getFullScore('生物作業第十六章'), 45, 'Chinese chapter numbers must normalize');
assert.equal(app.getFullScore('地科第3章'), 39, 'earth science chapter 3 must match the 39 scored textbook questions');
assert.equal(app.getFullScore('理化第14章'), null, 'unknown chapters must fail closed');

assert.match(html, /gifted_homework_full_scores\.js\?v=20260720_geo3_question_count_v2/,
  'eBook must load the public full-score catalog');
assert.match(html, /function getGiftedScienceHomeworkFullScore\(grade\)/,
  'eBook must gate full-score lookup by subject, class and homework type');
assert.match(html, /Number\(scoreMatch\[1\]\) > fullScore/,
  'a score above the catalog ceiling must fail closed');
assert.match(html, /getGradeScoreUnitText\(exam, exam\.unit \|\| "分"\)/,
  'contact-book main score must display the formal denominator');
assert.match(html, /getGradeScoreUnitText\(o, o\.unit \|\| "題"\)/,
  'contact-book related homework score must display the formal denominator');
assert.match(html, /getGradeScoreUnitText\(item, item\.unit\)/,
  'recent-grade cards must display the formal denominator');

console.log('ebook gifted homework full-score smoke passed');
