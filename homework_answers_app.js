(function(root) {
    'use strict';
    var cache = {}, pending = {}, errors = {}, drafts = {}, sending = {}, reportErrors = {}, owner = '';
    function esc(v) { return String(v || '').replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function resetOwner() {
        var next = gData ? [BEAR_SUBJECT, gData.className, gData.foundUserKey || gData.studentName, (root.ebookAuthSessionInfo || {}).studentKey || ''].join('/') : '';
        if (owner !== next) { owner = next; cache = {}; pending = {}; errors = {}; drafts = {}; sending = {}; reportErrors = {}; }
    }
    function entries(post) { try { return HomeworkAnswers.normalize(getDailyPostDisplayOptions(post).homeworkAnswers, post, false); } catch (_) { return []; } }
    function key(post) { return getHomeworkDoneDomKey(post) + ':' + HomeworkAnswers.signature(entries(post)); }
    function done(post) { var r = getHomeworkDoneRecordForPost(post, getHomeworkDoneDateKey(post.date)); return !!r && r.status === 'done'; }
    function redraw(post) {
        var host = document.getElementById('homework-answers-' + getHomeworkDoneDomKey(post));
        if (host) host.innerHTML = body(post, done(post));
    }
    function load(post) {
        resetOwner(); var k = key(post), mine = owner;
        if (cache[k] || pending[k] || !done(post) || isAdminMode || isDashboardDraftPreviewMode) return;
        pending[k] = true; delete errors[k];
        var sourceClass = getStudentActionPostSourceClassName(post, gData.className);
        doPostAction('getHomeworkAnswers', {
            sourceClassName: sourceClass,
            sourceClassKey: post.storedClassKey || post.sourceClassKey || safeKey(sourceClass),
            dailyPostId: post.dailyPostId || post.id, sourceItemId: post.id || post.dailyPostId, targetDate: post.date
        }, function(res) {
            resetOwner(); if (mine !== owner) return;
            delete pending[k];
            var expected = entries(post);
            var valid = res && res.success === true && Array.isArray(res.answers) && res.answers.length === expected.length && expected.every(function(a) {
                return res.answers.some(function(r) { return r.id === a.id && r.revision === a.revision && HomeworkAnswers.validUrl(r.answerUrl); });
            });
            if (valid) cache[k] = res.answers;
            else errors[k] = res && res.msg || '解答暫時無法取得，請稍後再試。';
            redraw(post);
        }, function(err) {
            resetOwner(); if (mine !== owner) return;
            delete pending[k]; errors[k] = err && err.message || '連線不穩，請稍後再試。'; redraw(post);
        });
    }
    function body(post, completed) {
        resetOwner(); var list = entries(post), k = key(post);
        if (!list.length || !completed || isAdminMode || isDashboardDraftPreviewMode) return '';
        if (cache[k]) return list.map(function(a) {
            var answer = cache[k].find(function(r) { return r.id === a.id && r.revision === a.revision; });
            var title = getDailyPostExamLinkDisplayName(a.title, '作業解答', (getDailyPostDisplayOptions(post).links || {}).examTitleMode);
            return '<a class="btn-important-tag homework-answer-link" href="' + esc(answer.answerUrl) + '" target="_blank" rel="noopener noreferrer">' + SVG.document + esc(title) + '</a>' + reportForm(post, a, answer);
        }).join('') + '<div class="homework-done-hint">請自行對答案，並用紅筆訂正。</div>';
        if (errors[k]) return '<div class="homework-done-hint" role="status">' + esc(errors[k]) + '</div><button type="button" class="homework-answer-retry" data-homework-answer-retry="' + esc(getHomeworkDoneDomKey(post)) + '">重新載入解答</button>';
        if (!pending[k]) Promise.resolve().then(function() { load(post); });
        return '<div class="homework-done-hint" role="status">正在確認完成紀錄並載入解答…</div>';
    }
    function reportKey(post, a) { return key(post) + ':' + a.id; }
    function reportForm(post, a, answer) {
        if (!a.reportScore) return '';
        var k = reportKey(post, a), inputId = 'homework-score-' + getHomeworkDoneDomKey(post) + '-' + a.id;
        if (answer.report) return '<div class="homework-report-received" role="status">已回報 ' + esc(String(answer.report.score)) + ' ' + esc(a.scoreUnit) + '，由老師審核登記。</div>';
        var status = reportErrors[k] || '';
        return '<form class="homework-report-form" data-homework-report="' + esc(getHomeworkDoneDomKey(post)) + '" data-answer-id="' + esc(a.id) + '">' +
            '<label for="' + esc(inputId) + '">' + (a.scoreUnit === '題' ? '對答案後，回報答對幾大題' : '對答案後，回報分數') + '</label>' +
            '<div class="homework-report-fields"><input id="' + esc(inputId) + '" type="number" inputmode="decimal" min="0" max="' + a.scoreMax + '" step="' + (a.scoreUnit === '題' ? '1' : '0.01') + '" required placeholder="0" value="' + esc(drafts[k] || '') + '"' + (sending[k] ? ' disabled' : '') + '><span>／' + a.scoreMax + ' ' + esc(a.scoreUnit) + '</span><button type="submit"' + (sending[k] ? ' disabled aria-busy="true"' : '') + '>' + (sending[k] ? '回報中…' : '送出回報') + '</button></div>' +
            '<div class="homework-report-status" role="status">' + esc(status || '送出後由老師審核；有需要更正請留言告訴老師。') + '</div></form>';
    }
    function findPost(domKey) { return (gData && gData.dailyPost || []).find(function(p) { return getHomeworkDoneDomKey(p) === domKey; }); }
    document.addEventListener('input', function(event) {
        var form = event.target.closest('[data-homework-report]'); if (!form) return;
        var post = findPost(form.dataset.homeworkReport), a = post && entries(post).find(function(a) { return a.id === form.dataset.answerId; });
        if (a) drafts[reportKey(post, a)] = event.target.value;
    });
    document.addEventListener('submit', function(event) {
        var form = event.target.closest('[data-homework-report]'); if (!form) return;
        event.preventDefault(); resetOwner();
        if (isAdminMode || isDashboardDraftPreviewMode || isStudentPreviewMode) { swalAlert('預覽模式', '預覽不會送出學生分數。', 'info'); return; }
        var post = findPost(form.dataset.homeworkReport), a = post && entries(post).find(function(a) { return a.id === form.dataset.answerId; });
        if (!a || !done(post)) return;
        var k = reportKey(post, a), mine = owner, raw = form.querySelector('input').value.trim(), score = Number(raw);
        if (!raw || !Number.isFinite(score) || score < 0 || score > a.scoreMax || (a.scoreUnit === '題' && !Number.isInteger(score))) { reportErrors[k] = '請填寫 0～' + a.scoreMax + ' ' + a.scoreUnit; redraw(post); return; }
        if (sending[k]) return;
        sending[k] = true; delete reportErrors[k]; redraw(post);
        var sourceClass = getStudentActionPostSourceClassName(post, gData.className);
        function failure(error) { resetOwner(); if (mine !== owner) return; delete sending[k]; reportErrors[k] = error && (error.msg || error.message) || '尚未取得收件確認，請重試；系統不會重複登記。'; redraw(post); }
        doPostAction('reportHomeworkPaper', { sourceClassName: sourceClass, sourceClassKey: post.storedClassKey || post.sourceClassKey || safeKey(sourceClass),
            dailyPostId: post.dailyPostId || post.id, sourceItemId: post.id || post.dailyPostId, targetDate: post.date,
            answerId: a.id, answerRevision: a.revision, score: score }, function(res) {
                resetOwner(); if (mine !== owner) return; delete sending[k];
                if (res && res.success && res.report) {
                    var answer = (cache[key(post)] || []).find(function(r) { return r.id === a.id; });
                    if (answer) answer.report = res.report;
                    delete drafts[k]; redraw(post);
                } else if (res && (res.queued || res.pending || res.syncPending)) {
                    delete cache[key(post)]; load(post); redraw(post);
                    reportErrors[k] = '正在處理回報；可稍後重新開啟確認，再次送出也不會重複收件。';
                } else failure(res);
            }, failure);
    });
    document.addEventListener('click', function(event) {
        var button = event.target.closest('[data-homework-answer-retry]'); if (!button) return;
        var domKey = button.getAttribute('data-homework-answer-retry');
        var post = (gData && gData.dailyPost || []).find(function(p) { return getHomeworkDoneDomKey(p) === domKey; });
        if (post) { delete errors[key(post)]; load(post); redraw(post); }
    });
    root.HomeworkAnswersApp = {
        has: function(post) { return entries(post).length > 0; },
        render: function(post, completed) { return '<div class="homework-answers" id="homework-answers-' + getHomeworkDoneDomKey(post) + '">' + body(post, completed) + '</div>'; },
        completed: redraw,
        reset: function() { owner = ''; cache = {}; pending = {}; errors = {}; drafts = {}; sending = {}; reportErrors = {}; }
    };
})(window);
