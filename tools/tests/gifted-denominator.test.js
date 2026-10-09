const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const get=html.slice(html.indexOf('        function getGiftedScienceHomeworkFullScore('),html.indexOf('        function getGradeScoreUnitText('));
function value(grade){const c={BEAR_SUBJECT:'/science',window:{BearGiftedHomeworkFullScores:require('../../gifted_homework_full_scores')},gData:{className:'115小六資優自然週六上午班'},isGiftedScienceClassName:s=>s.includes('小六資優自然'),isHomeworkColumnTitle:s=>s.includes('作業')};vm.createContext(c);vm.runInContext(get,c);return c.getGiftedScienceHomeworkFullScore(grade);}
test('native 19-question scope uses trusted metadata, including zero score; legacy whole chapter remains 59',()=>{
 const g={date:'2026/10/11作業',exam:'理化第11章 常見的力｜概念一、二',score:'15',homeworkMaxScore:19};
 assert.equal(value(g),19);assert.equal(value({...g,score:'0'}),19);assert.equal(value({...g,score:'20'}),null);
 assert.equal(value({...g,homeworkMaxScore:'19'}),null);assert.equal(value({...g,homeworkMaxScore:0}),null);
 assert.equal(value({date:'2026/10/11作業',exam:'理化第11章',score:'15'}),59);
 assert.equal(value({...g,date:'2026/10/11小考'}),null);assert.equal(value({...g,className:'115國二自然超前班'}),null);
 assert.match(html,/homeworkMaxScore: eData\.homeworkMaxScore/);
});
