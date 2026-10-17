'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function extract(name) {
    const start = html.indexOf('function ' + name + '(');
    const end = html.indexOf('\n        function ', start + 1);
    return (html.slice(start - 6, start) === 'async ' ? 'async ' : '') + html.slice(start, end).trim();
}
function harness() {
    const post = { id: 'post_demo', date: '2026/10/10', className: '測試班', hw1: '[回家作業卷｜拋體運動]https://example.test/q.pdf', displayOptions: { homeworkAnswers: [{ id: 'answer_demo', revision: 'revision_1', slot: 'hw1', questionUrl: 'https://example.test/q.pdf', reportScore: true, scoreMax: 100, reportProvisioned: true }] } };
    const host = { innerHTML: '', contains: () => false };
    const elements = { 'homework-answers-post_demo': host, 'homework-done-btn-post_demo': { innerText: '我已完成本次所有作業', disabled: false, classList: { add() {} } }, 'homework-done-hint-post_demo': {} };
    const handlers = {}, calls = [], alerts = [];
    const c = { console, Promise, gData: { className: '測試班', studentName: '測試學生', foundUserKey: 'demo', dailyPost: [post] }, BEAR_SUBJECT: 'science', isAdminMode: false, isDashboardDraftPreviewMode: false, isStudentPreviewMode: false,
        HomeworkAnswers: require('../homework_answers_contract'), HomeworkReportStatus: require('../homework_report_status'), SVG: { document: '' },
        document: { getElementById: id => elements[id], addEventListener: (type, handler) => handlers[type] = handler },
        getDailyPostDisplayOptions: p => p.displayOptions, getHomeworkDoneDomKey: p => p.id, getHomeworkDoneDateKey: d => d,
        getHomeworkDoneRecordForPost: p => (c.gData.homeworkDone || {})[p.date], getStudentActionPostSourceClassName: p => p.className, safeKey: v => v,
        getDailyPostExamLinkDisplayName: v => v, schedulePendingTasksRecompute() {}, confirmStudentPreviewAction: async () => true,
        shouldUseHomeworkDoneFlowForPost: () => true, shouldShowHomeworkDoneButton: () => true, getPostHomeworkText: p => p.hw1,
        swalAlert: (...args) => alerts.push(args), friendlySubmitError: e => e.message,
        doPostAction: (action, data, ok, fail) => calls.push({ action, data, ok, fail }) };
    c.window = c;
    c.google = { script: { run: { withSuccessHandler(ok) { return { withFailureHandler(fail) { return { submitHomeworkDone(data) { calls.push({ action: 'submitHomeworkDone', data, ok, fail }); } }; } }; } } } };
    vm.createContext(c);
    vm.runInContext(fs.readFileSync(path.join(root, 'homework_answers_app.js'), 'utf8'), c);
    vm.runInContext(extract('submitHomeworkDone'), c);
    vm.runInContext(extract('buildHomeworkDoneButton'), c);
    const form = { dataset: { homeworkReport: post.id, answerId: 'answer_demo' }, querySelector: () => ({ value: '75' }) };
    return { c, post, host, elements, calls, alerts, handlers, form,
        input(value) { handlers.input({ target: { closest: () => form, value } }); },
        submit() { handlers.submit({ preventDefault() {}, target: { closest: () => form } }); },
        flush: async () => { await Promise.resolve(); await Promise.resolve(); },
        answers(report) { return { success: true, answers: [{ id: 'answer_demo', revision: 'revision_1', answerUrl: 'https://example.test/a.pdf', ...(report ? { report } : {}) }] }; } };
}
(async () => {
    let h = harness();
    assert.doesNotMatch(h.c.HomeworkAnswersApp.render(h.post, false), /<form/);
    await h.c.submitHomeworkDone(h.post.id);
    assert.equal(h.calls.length, 1);
    assert.match(h.host.innerHTML, /<form/);
    assert.match(h.host.innerHTML, /等待確認中/);
    assert.doesNotMatch(h.host.innerHTML, /<a /);
    assert.equal(h.c.gData.homeworkDone, undefined);
    h.input('75');
    const rendered = h.c.buildHomeworkDoneButton(h.post);
    assert.match(rendered, /正在確認完成/);
    assert.match(rendered, /value="75"/);
    // 即時重繪即使換掉原按鈕，仍只能送出一次。
    h.elements['homework-done-btn-post_demo'] = { disabled: false, innerText: '我已完成', classList: { add() {} } };
    await h.c.submitHomeworkDone(h.post.id);
    h.submit();
    assert.equal(h.calls.length, 1);
    h.calls[0].ok({ success: true }); await h.flush();
    assert.equal(h.calls[1].action, 'getHomeworkAnswers');
    assert.equal(h.elements['homework-done-btn-post_demo'].disabled, true);
    assert.match(h.host.innerHTML, /value="75"/);
    h.submit(); assert.equal(h.calls.length, 2, '未取得解答與回報紀錄不能送分數');
    h.calls[1].fail(new Error('模擬讀取失敗'));
    assert.match(h.host.innerHTML, /重新載入解答/);
    assert.match(h.host.innerHTML, /value="75"/);
    h.handlers.click({ target: { closest: () => ({ getAttribute: () => h.post.id }) } });
    assert.equal(h.calls[2].action, 'getHomeworkAnswers');
    h.calls[2].ok(h.answers());
    assert.match(h.host.innerHTML, /送出回報/);
    assert.doesNotMatch(h.host.innerHTML, /等待確認中/);
    assert.match(h.host.innerHTML, /value="75"/);
    h.submit(); h.submit(); assert.equal(h.calls.length, 4);
    assert.equal(h.calls[3].data.score, 75);
    h.calls[3].ok({ success: true, report: { score: 75, reportedAt: 1 } });
    assert.match(h.host.innerHTML, /已回報 75/);
    assert.equal(h.calls.filter(c => c.action === 'submitHomeworkDone').length, 1);

    for (const fail of [true, false]) {
        h = harness(); await h.c.submitHomeworkDone(h.post.id); h.input('0');
        if (fail) h.calls[0].fail(new Error('連線中斷')); else h.calls[0].ok({ success: false });
        assert.equal(h.c.gData.homeworkDone, undefined);
        assert.equal(h.elements['homework-done-btn-post_demo'].disabled, false);
        assert.match(h.host.innerHTML, /value="0"/);
        await h.c.submitHomeworkDone(h.post.id);
        assert.equal(h.calls.length, 2);
        h.calls[1].ok({ success: true }); await h.flush();
        h.calls[2].ok(h.answers({ score: 0, reportedAt: 1 }));
        assert.match(h.host.innerHTML, /已回報 0/);
        assert.doesNotMatch(h.host.innerHTML, /<form/);
    }
    h = harness(); await h.c.submitHomeworkDone(h.post.id);
    h.c.gData = { ...h.c.gData, foundUserKey: 'other', homeworkDone: {} };
    h.calls[0].ok({ success: true });
    assert.deepEqual(h.c.gData.homeworkDone, {});
    assert.equal(h.calls.length, 1);
    h = harness(); await h.c.submitHomeworkDone(h.post.id);
    h.c.HomeworkAnswersApp.reset(); h.calls[0].ok({ success: true });
    assert.equal(h.c.gData.homeworkDone, undefined);
    h = harness(); h.post.displayOptions.homeworkAnswers[0].reportScore = false;
    await h.c.submitHomeworkDone(h.post.id);
    assert.doesNotMatch(h.host.innerHTML, /<form/);
    h = harness(); h.c.isDashboardDraftPreviewMode = true;
    assert.equal(h.c.HomeworkAnswersApp.render(h.post, true).includes('<form'), false);
    // 後續日期的新作業與既有完成紀錄：報分框不能再等遠端回應才出現。
    for (const date of ['2026/10/17', '2026/10/24', '2027/01/02']) {
        h = harness(); h.post.date = date;
        await h.c.submitHomeworkDone(h.post.id);
        assert.match(h.host.innerHTML, /<form/);
        assert.equal(h.calls[0].data.targetDate, date);
    }
    h = harness(); h.c.gData.homeworkDone = { [h.post.date]: { status: 'done' } };
    let initial = h.c.HomeworkAnswersApp.render(h.post, true);
    assert.match(initial, /<form/); assert.match(initial, /等待確認中/);
    await h.flush(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].action, 'getHomeworkAnswers');
    h.calls[0].ok({ success: true, answers: [{ id: 'answer_demo', revision: 'revision_old', answerUrl: 'https://example.test/a.pdf' }] });
    assert.match(h.host.innerHTML, /重新載入解答/); assert.match(h.host.innerHTML, /等待確認中/);
    assert.doesNotMatch(h.host.innerHTML, /<a /);
    // 兩份作業的分數草稿不可互相覆蓋，等待框逐份保留。
    h = harness();
    h.post.hw2 = '[回家作業卷｜第二份]https://example.test/q2.pdf';
    h.post.displayOptions.homeworkAnswers.push({ ...h.post.displayOptions.homeworkAnswers[0], id: 'answer_second', slot: 'hw2', questionUrl: 'https://example.test/q2.pdf' });
    await h.c.submitHomeworkDone(h.post.id); h.input('75');
    h.form.dataset.answerId = 'answer_second'; h.input('30');
    const multi = h.c.HomeworkAnswersApp.render(h.post, false);
    assert.equal((multi.match(/<form /g) || []).length, 2);
    assert.match(multi, /value="75"/); assert.match(multi, /value="30"/);
    h = harness(); await h.c.submitHomeworkDone(h.post.id); h.calls[0].ok({ success: true }); await h.flush();
    h.c.HomeworkAnswersApp.reset(); h.host.innerHTML = '新登入畫面';
    h.calls[1].ok(h.answers()); assert.equal(h.host.innerHTML, '新登入畫面', '舊讀取不得覆蓋重新登入後的畫面');
    console.log('PASS: immediate form, slow stages, redraw duplicate guard, draft/zero retention, failure/retry, receipt, identity/reset isolation, answer-only, preview, future dates, reopening, revision mismatch and multiple papers');
})().catch(e => { console.error(e); process.exitCode = 1; });
