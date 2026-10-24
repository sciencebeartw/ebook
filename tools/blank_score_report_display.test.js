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
