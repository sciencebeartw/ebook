(function(root) {
    'use strict';
    var P = root.ClassSessionPlan, contexts = {}, pending = {}, posts = {}, answers = {}, busy = {};
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function className(post) { return post.storedClassName || post.sourceClassName || post.className || gData.className; }
    function owner() { return gData ? [gData.className, gData.foundUserKey || gData.studentName].join('/') : ''; }
    var currentOwner = '';
    function resetOwner() { if (owner() !== currentOwner) { contexts = {}; pending = {}; posts = {}; answers = {}; currentOwner = owner(); } }
    function api(action, payload) {
        return new Promise(function(resolve, reject) { doPostAction(action, payload, function(result) {
            if (!result || !result.success) reject(new Error(result && result.msg || '送出尚未完成，請稍後重試'));
            else resolve(result);
        }, reject); });
    }
    function context(post) { return contexts[className(post)]; }
    function assignment(post) {
        var a = P.options(post).holidayPractice;
        return a && Object.assign({}, a, (context(post) && context(post).assignments || {})[a.assignmentId] || {});
    }
    function progress(post) {
        var a = assignment(post), p = a && ((context(post) || {}).progress || {})[a.assignmentId] || null;
        var grade = a && (gData.grades || []).find(function(e) { return e.sourceAssignmentId === a.assignmentId && P.validScore(e.score) !== null; });
        return grade ? Object.assign({}, p || {}, { status: 'synced', reportedAt: p && p.reportedAt || 1, score: P.validScore(grade.score) }) : p;
    }
    function safeLink(url, label) {
        try { if (new URL(url).protocol !== 'https:') return ''; } catch (_) { return ''; }
        return '<a class="hw-link-btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    }
    function body(post) {
        var a = assignment(post), c = context(post), p = progress(post), now = Date.now();
        if (!a || a.draft) return '';
        var state = P.holidayState(a, p, now), id = a.assignmentId;
        var label = state === 'reported' ? '已回報 ' + p.score + ' 分' : state === 'syncing' ? '已收到回報，成績更新中' : state === 'missing' ? '缺繳：請回報分數' : state === 'awaiting_score' ? '待回報分數' : '待作答';
        var preview = isAdminMode || isDashboardDraftPreviewMode || isStudentPreviewMode;
        var text = '<div class="section-title">假期練習卷｜' + esc(a.title) + '</div>' +
            '<p>請於下次上課 ' + esc(a.dueDate || P.taipeiDate(a.dueAt)) + ' ' + esc(a.dueTime || '') + ' 前回報分數</p>' +
            safeLink(a.questionUrl, '題目卷 PDF');
        if (preview) return text + '<p>學生完成作答後可開答案並回報分數。預覽不記錄學生進度。</p>';
        if (!c || c.pending) return text + '<p role="status">正在核對上課安排與回報狀態…</p>';
        if (!(c.assignments || {})[id]) return '';
        var buttonLabel = p && p.unlockedAt ? '再次開啟答案卷' : '我已完成，顯示答案卷';
        text += '<div class="homework-done-box"><button type="button" class="homework-done-btn" data-holiday-action="unlock" data-assignment="' + esc(id) + '"' + (busy[id] ? ' disabled' : '') + '>' + buttonLabel + '</button></div>';
        if (answers[id]) text += safeLink(answers[id], '答案卷 PDF');
        if (p && p.unlockedAt && !p.reportedAt) text += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><label>自行對答案後的分數<input type="number" min="0" max="100" step="0.01" inputmode="decimal" class="score-input" id="holiday-score-' + esc(id) + '"></label>' +
            '<button type="button" class="score-btn" data-holiday-action="report" data-assignment="' + esc(id) + '"' + (busy[id] ? ' disabled' : '') + '>回報分數</button></div>';
        return text + '<p role="status"' + (state === 'missing' ? ' style="color:#b91c1c"' : '') + '>' + esc(label) + '</p>';
    }
    function redraw(id) {
        var post = posts[id], target = document.getElementById('holiday-card-' + id);
        if (post && target) target.innerHTML = body(post);
        if (typeof schedulePendingTasksRecompute === 'function') schedulePendingTasksRecompute();
    }
    function load(post, force) {
        if (isAdminMode || isDashboardDraftPreviewMode) return Promise.resolve(null);
        var c = className(post), own = currentOwner;
        if (pending[c]) return pending[c];
        var incoming = P.options(post).holidayPractice, saved = contexts[c] && (contexts[c].assignments || {})[incoming && incoming.assignmentId];
        if (contexts[c] && !force && Date.now() - (contexts[c]._loadedAt || 0) < 60000 && (!incoming || saved && incoming.revision === saved.revision)) return Promise.resolve(contexts[c]);
        pending[c] = api('getHolidayPracticeContext', { sourceClassName: c }).then(function(result) {
            if (own !== currentOwner) return null;
            contexts[c] = Object.assign({}, result, { _loadedAt: Date.now() });
            Object.keys(posts).forEach(function(id) { if (className(posts[id]) === c) redraw(id); });
            return result;
        }).finally(function() { delete pending[c]; });
        return pending[c];
    }
    async function act(id, action) {
        var post = posts[id]; if (!post || busy[id]) return;
        if (isAdminMode || isDashboardDraftPreviewMode || isStudentPreviewMode) return;
        var a = assignment(post), score;
        if (action === 'report') {
            score = P.validScore((document.getElementById('holiday-score-' + id) || {}).value);
            if (score === null) { swalAlert('請確認分數', '請填入 0 到 100 的分數。', 'warning'); return; }
        }
        busy[id] = true; redraw(id);
        try {
            var result = await api(action === 'unlock' ? 'unlockHolidayPractice' : 'reportHolidayPractice', {
                sourceClassName: className(post), sourceClassKey: post.storedClassKey || post.sourceClassKey || safeKey(className(post)),
                sourceStudentKey: post.sourceStudentKey || '', sourceItemId: post.id || post.dailyPostId,
                dailyPostId: post.id || post.dailyPostId, targetDate: post.date, assignmentId: id, revision: a.revision,
                ...(action === 'report' ? { score: score } : {})
            });
            if (!contexts[className(post)]) contexts[className(post)] = { progress: {} };
            if (result.progress) contexts[className(post)].progress[id] = result.progress;
            if (result.answerUrl) answers[id] = result.answerUrl;
            await load(post, true);
            [4000, 12000, 28000].forEach(function(delay) {
                var own = currentOwner;
                setTimeout(function() {
                    if (own === currentOwner && document.getElementById('holiday-card-' + id) && progress(post) && progress(post).status !== 'synced') load(post, true).catch(function() {});
                }, delay);
            });
        } catch (err) {
            await load(post, true).catch(function() {});
            swalAlert('回報狀態', err.message, 'warning');
        } finally { delete busy[id]; redraw(id); }
    }
    document.addEventListener('click', function(event) {
        var target = event.target.closest('[data-holiday-action]');
        if (target) act(target.dataset.assignment, target.dataset.holidayAction);
    });
    root.addEventListener('focus', function() { Object.values(posts).forEach(function(post) { load(post, true).catch(function() {}); }); });
    root.HolidayPracticeApp = {
        render: function(post) {
            resetOwner();
            var a = P.options(post).holidayPractice;
            if (a && !a.assignmentId && isDashboardDraftPreviewMode) { a.assignmentId = 'holiday_preview'; }
            if (!a || a.draft || !/^holiday_[a-zA-Z0-9_-]+$/.test(a.assignmentId || '')) return '';
            posts[a.assignmentId] = post;
            load(post).catch(function(err) {
                var target = document.getElementById('holiday-card-' + a.assignmentId);
                if (target) { var status = document.createElement('p'); status.textContent = '回報狀態暫時無法讀取：' + err.message; target.appendChild(status); }
            });
            return '<div class="homework-done-box" id="holiday-card-' + esc(a.assignmentId) + '" data-holiday-card="1">' + body(post) + '</div>';
        },
        contextMap: function() { return contexts; },
        assignmentForExam: function(exam) { return ((contexts[exam.storedClassName || exam.sourceClassName || gData.className] || {}).assignments || {})[exam.sourceAssignmentId] || exam; },
        progressForExam: function(exam) { return ((contexts[exam.storedClassName || exam.sourceClassName || gData.className] || {}).progress || {})[exam.sourceAssignmentId] || null; }
    };
    root.getHolidayProgressForExam = root.HolidayPracticeApp.progressForExam;
})(window);
