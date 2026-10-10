(function(root) {
    'use strict';
    var cache = {}, pending = {}, errors = {}, owner = '';
    function esc(v) { return String(v || '').replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function resetOwner() {
        var next = gData ? [BEAR_SUBJECT, gData.className, gData.foundUserKey || gData.studentName, (root.ebookAuthSessionInfo || {}).studentKey || ''].join('/') : '';
        if (owner !== next) { owner = next; cache = {}; pending = {}; errors = {}; }
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
            return '<a class="btn-important-tag homework-answer-link" href="' + esc(answer.answerUrl) + '" target="_blank" rel="noopener noreferrer">' + SVG.document + esc(title) + '</a>';
        }).join('') + '<div class="homework-done-hint">請自行對答案，並用紅筆訂正。</div>';
        if (errors[k]) return '<div class="homework-done-hint" role="status">' + esc(errors[k]) + '</div><button type="button" class="homework-answer-retry" data-homework-answer-retry="' + esc(getHomeworkDoneDomKey(post)) + '">重新載入解答</button>';
        if (!pending[k]) Promise.resolve().then(function() { load(post); });
        return '<div class="homework-done-hint" role="status">正在確認完成紀錄並載入解答…</div>';
    }
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
        reset: function() { owner = ''; cache = {}; pending = {}; errors = {}; }
    };
})(window);
