const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');
function extract(name) {
    const start = html.indexOf('        function ' + name + '(');
    assert(start >= 0, name);
    const end = html.indexOf('\n        function ', start + 20);
    return html.slice(start, end);
}
const ctx = vm.createContext({
    window: {}, ClassSessionPlan: { isSelfMarked: () => false },
    isHomePracticeScoreTitle: () => false, isHomeworkColumnTitle: () => false,
    isHomeworkMissingScore: () => false, getMathAdvancedGuidanceStandard: () => null,
    isMathAdvancedGuidanceExam: () => false, isCurrentStudentEnrollmentExemptExam: () => false,
    normalizeEbookFeedbackExamId: v => v || '', isHolidayScoreReportType: () => false,
    isScoreReportTypeForExam: () => true,
});
for (const name of ['getAbsenceScoreReviewStatus', 'getLatestMakeupReportInfo', 'getFeedbackOverrideNum', 'getDisplayLogic']) {
    vm.runInContext(extract(name), ctx);
}
function exam(score) {
    return { score, scoreNum: /^\d+(?:\.\d+)?假?$/.test(String(score)) ? parseFloat(score) : null,
        examId: 'exam-test', exam: '測試小考', date: '2026/10/24小考' };
}
function reports(score = 90) { return [{ type: '請假回報', targetExamId: 'exam-test', content: score + '分' }]; }
test('unreported blank remains 缺考 and student report remains pending until reviewed', () => {
    assert.equal(ctx.getDisplayLogic(exam(''), []).mainScore, '缺考');
    for (const initial of ['', '假']) {
        const result = ctx.getDisplayLogic(exam(initial), reports());
        assert.equal(result.mainScore, 90); assert.equal(result.showReviewing, true);
    }
});
test('reviewed plain score has no absence tag; real absence keeps the tag', () => {
    for (const score of [90, 0, '90', '0', '90假', '0假']) {
        const num = parseFloat(score);
        const result = ctx.getDisplayLogic(exam(score), reports(num));
        assert.equal(result.mainScore, num); assert.equal(result.showReviewing, false);
        assert.equal(result.statusHtml.includes('請假回報'), String(score).endsWith('假'));
        assert.equal(ctx.getAbsenceScoreReviewStatus(score, String(num)), 'filled');
        assert.equal(ctx.getLatestMakeupReportInfo(exam(score), reports(num)).status, 'filled');
        assert.equal(ctx.getLatestMakeupReportInfo(exam(score), reports(num)).scoreValue, String(num) + (String(score).endsWith('假') ? '假' : ''));
    }
});
test('formal teacher correction wins over an older student report', () => {
    for (const score of ['95', '95假']) {
        const result = ctx.getDisplayLogic(exam(score), reports());
        assert.equal(result.mainScore, 95); assert.equal(result.teacherCorrected, true);
        assert.equal(ctx.getAbsenceScoreReviewStatus(score, '90'), 'teacher_corrected');
    }
});

test('science classes use verified status in the contact book and grade cards', () => {
    ctx.window.AssessmentLabels = require('../assessment_labels');
    for (const className of ['115小六資優自然週日下午班','115國一自然超前班']) {
        const view = (title, raw, dueAt) => ctx.getDisplayLogic({...exam(raw), className, exam:title, date:'2026/11/14', dueAt}, []).mainScore;
        assert.equal(view('小考', ''), '未登分');
        assert.equal(view('小考', '假'), '缺考（請假）');
        assert.equal(view('補考', '缺考'), '缺考');
        assert.equal(view('回家練習卷', '未交', Date.now()+60000), '待繳');
        assert.equal(view('假期練習卷', '未交', 1), '缺繳');
        assert.equal(view('假期練習卷', '已繳交', 1), '未登分');
        assert.equal(view('假期練習卷', 0, 1), 0);
        assert.equal(view('回家練習卷', '', 1), '未登分');
    }
});
test('required score reporting checks the exact paper, deadline and review receipt', () => {
    const className = '115國一自然超前班';
    const plan = require('../class_session_plan');
    ctx.ClassSessionPlan = plan;
    ctx.window.AssessmentLabels = require('../assessment_labels');
    const paper = {...exam(''), className, storedClassKey:className, exam:'回家練習卷', assessmentKind:'homework_self_marked',
        sourceAssignmentId:'homework_demo', reportEnabled:true, dueAt:1};
    ctx.gData = {className, feedbackHistory:[]};
    assert.equal(ctx.getDisplayLogic({...paper, dueAt:Date.now()+60000}, []).mainScore, '待回報分數');
    assert.equal(ctx.getDisplayLogic(paper, []).mainScore, '缺繳');
    ctx.isHolidayScoreReportType = () => true;
    ctx.gData.feedbackHistory = [{sourceAssignmentId:'other', targetExamId:paper.examId, reportedScore:8}];
    assert.equal(ctx.getDisplayLogic(paper, []).mainScore, '缺繳');
    ctx.gData.feedbackHistory = [{sourceAssignmentId:paper.sourceAssignmentId, storedClassKey:className, reportedScore:0}];
    const pending = ctx.getDisplayLogic(paper, []);
    assert.equal(pending.mainScore, 0);
    assert.match(pending.statusHtml, /待審核/);
    assert.equal(ctx.getDisplayLogic({...paper,score:85,scoreNum:85}, []).mainScore, 85);
});
