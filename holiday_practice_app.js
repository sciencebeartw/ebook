(function(root) {
    'use strict';
    var P = root.ClassSessionPlan, contexts = {}, pending = {}, posts = {}, answers = {}, busy = {}, scoreDrafts = {}, optimisticUntil = {};
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function className(post) { return post.storedClassName || post.sourceClassName || post.className || gData.className; }
    function owner() { return gData ? [gData.className, gData.foundUserKey || gData.studentName].join('/') : ''; }
    var currentOwner = '';
    function resetOwner() { if (owner() !== currentOwner) { contexts = {}; pending = {}; posts = {}; answers = {}; scoreDrafts = {}; optimisticUntil = {}; currentOwner = owner(); } }
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
    function safeLink(url, label, colorClass) {
        try { if (new URL(url).protocol !== 'https:') return ''; } catch (_) { return ''; }
        return '<a class="btn-link' + colorClass + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    }
    function linkPurpose(post, answer) {
        var custom = String((P.options(post).links || {}).holidayLabel || '').trim().replace(/[｜|：:]+$/, '').trim().slice(0, 24);
        return (custom || '假期練習卷') + (answer ? '答案' : '');
    }
    function body(post) {
        var a = assignment(post), c = context(post), p = progress(post), now = Date.now();
        if (!a || a.draft) return '';
        var state = P.holidayState(a, p, now), id = a.assignmentId;
        var label = state === 'reported' ? '已登記 ' + p.score + ' 分' : state === 'awaiting_review' ? '已回報分數，等待老師登記' : state === 'missing' ? '缺繳：請回報分數' : state === 'awaiting_score' ? '答案已開啟，請自行對答案後回報分數。' : '';
        var preview = isAdminMode || isDashboardDraftPreviewMode;
        var color = (P.options(post).links || {}).holidayColor;
        var colorClass = ' post-button-' + (['blue', 'purple', 'slate', 'orange', 'gray'].indexOf(color) > -1 ? color : 'orange');
        var text = safeLink(a.questionUrl, SVG.document + esc(linkPurpose(post, false)) + '｜' + esc(a.title), colorClass) +
            '<div class="holiday-deadline-box"><div class="holiday-deadline-hint">請於下次上課 ' + esc(a.dueDate || P.taipeiDate(a.dueAt)) + ' ' + esc(a.dueTime || '') + ' 前回報分數</div></div>';
        if (preview) return text + '<div class="holiday-unlock-actions"><button type="button" class="homework-done-btn holiday-unlock-btn holiday-preview-btn' + colorClass + '" disabled aria-disabled="true">我已完成，顯示答案</button></div>' +
            '<div class="holiday-unlock-hint">這是預覽；學生實際登入後按上方按鈕，才會開啟答案並可回報分數。預覽不記錄學生進度。</div>';
        if (!c || c.pending) return text + '<div class="holiday-unlock-hint" role="status">正在核對上課安排與回報狀態…</div>';
        if (!(c.assignments || {})[id]) return '';
        if (!(p && p.unlockedAt)) {
            var buttonLabel = busy[id] ? '正在開啟答案…' : '我已完成，顯示答案';
            text += '<div class="holiday-unlock-actions"><button type="button" class="homework-done-btn holiday-unlock-btn' + colorClass + '" data-holiday-action="unlock" data-assignment="' + esc(id) + '"' + (busy[id] ? ' disabled aria-busy="true"' : '') + '>' + buttonLabel + '</button></div>' +
                '<div class="holiday-unlock-hint">' + (busy[id] ? '正在安全核對答案，完成後會立即顯示。' : '完成作答後按一下，答案會立即開啟。') + '</div>';
        } else if (answers[id]) {
            text += safeLink(answers[id], SVG.document + esc(linkPurpose(post, true)) + '｜' + esc(a.title), colorClass);
        } else {
            text += '<div class="holiday-unlock-actions"><button type="button" class="btn-link holiday-answer-btn' + colorClass + '" data-holiday-action="answer" data-assignment="' + esc(id) + '"' + (busy[id] ? ' disabled aria-busy="true"' : '') + '>' + SVG.document + (busy[id] ? '正在取得答案…' : esc(linkPurpose(post, true)) + '｜' + esc(a.title)) + '</button></div>';
        }
        if (p && p.unlockedAt && !p.reportedAt) text += '<div class="holiday-score-report"><label class="holiday-score-label">自行對答案後的分數<input type="number" min="0" max="' + (P.SCORE_MAX || 200) + '" step="0.01" inputmode="decimal" class="score-input" id="holiday-score-' + esc(id) + '" value="' + esc(scoreDrafts[id] || '') + '"></label>' +
            '<button type="button" class="score-btn" data-holiday-action="report" data-assignment="' + esc(id) + '"' + (busy[id] ? ' disabled' : '') + '>回報分數</button></div>';
        return text + (label ? '<div class="holiday-progress-hint' + (state === 'missing' ? ' is-missing' : '') + '" role="status">' + esc(label) + '</div>' : '');
    }
    function redraw(id) {
        var post = posts[id], target = document.getElementById('holiday-card-' + id);
        if (post && target) {
            var focused = document.activeElement && document.activeElement.id === 'holiday-score-' + id;
            target.innerHTML = body(post);
            var input = document.getElementById('holiday-score-' + id);
            if (focused && input) input.focus({ preventScroll: true });
        }
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
            var previousProgress = contexts[c] && contexts[c].progress || {};
            result.progress = Object.assign({}, result.progress || {});
            Object.keys(previousProgress).forEach(function(id) {
                if (!optimisticUntil[id]) return;
                if (optimisticUntil[id] <= Date.now()) { delete optimisticUntil[id]; return; }
                var local = previousProgress[id], remote = result.progress[id];
                var remoteIsCurrent = remote && Number(remote.reportedAt || remote.unlockedAt || 0) >= Number(local.reportedAt || local.unlockedAt || 0);
                if (remoteIsCurrent) delete optimisticUntil[id];
                else result.progress[id] = local;
            });
            contexts[c] = Object.assign({}, result, { _loadedAt: Date.now() });
            Object.keys(posts).forEach(function(id) { if (className(posts[id]) === c) redraw(id); });
            return result;
        }).finally(function() { delete pending[c]; });
        return pending[c];
    }
    function actionPayload(post, assignment, id) {
        return {
            sourceClassName: className(post), sourceClassKey: post.storedClassKey || post.sourceClassKey || safeKey(className(post)),
            sourceStudentKey: post.sourceStudentKey || '', sourceItemId: post.id || post.dailyPostId,
            dailyPostId: post.id || post.dailyPostId, targetDate: post.date, assignmentId: id, revision: assignment.revision
        };
    }
    async function act(id, action) {
        var post = posts[id]; if (!post || busy[id]) return;
        if (isAdminMode || isDashboardDraftPreviewMode) return;
        var a = assignment(post), score;
        if (action === 'report') {
            score = P.validScore((document.getElementById('holiday-score-' + id) || {}).value);
            if (score === null) { swalAlert('請確認分數', '請填入 0 到 ' + (P.SCORE_MAX || 200) + ' 的分數。', 'warning'); return; }
        }
        if (isStudentPreviewMode && !(await confirmStudentPreviewAction(action === 'report' ? '回報假期卷分數' : '開啟假期卷答案'))) return;
        busy[id] = true; redraw(id);
        try {
            var payload = actionPayload(post, a, id);
            if (action === 'report') payload.score = score;
            var result = await api(action === 'report' ? 'reportHolidayPractice' : 'unlockHolidayPractice', payload);
            if (!contexts[className(post)]) contexts[className(post)] = { progress: {} };
            if (!contexts[className(post)].progress) contexts[className(post)].progress = {};
            if (result.progress) {
                contexts[className(post)].progress[id] = result.progress;
                optimisticUntil[id] = Date.now() + 30000;
            }
            if (result.progress && result.progress.reportedAt) delete scoreDrafts[id];
            if (result.answerUrl) answers[id] = result.answerUrl;
            // 先使用伺服器剛回傳的單筆結果重畫；背景讀回不應讓家長卡在舊按鈕。
            redraw(id);
            if (action === 'report' && typeof refreshHolidayGradeDisplays === 'function') refreshHolidayGradeDisplays();
            load(post, true).catch(function() {});
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
    document.addEventListener('input', function(event) {
        var input = event.target, prefix = 'holiday-score-';
        if (input && input.id && input.id.indexOf(prefix) === 0) scoreDrafts[input.id.slice(prefix.length)] = input.value;
    });
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
            return '<div id="holiday-card-' + esc(a.assignmentId) + '" data-holiday-card="1">' + body(post) + '</div>';
        },
        contextMap: function() { return contexts; },
        assignmentForExam: function(exam) { return ((contexts[exam.originClassName || exam.storedClassName || exam.sourceClassName || gData.className] || {}).assignments || {})[exam.sourceAssignmentId] || exam; },
        progressForExam: function(exam) { return ((contexts[exam.originClassName || exam.storedClassName || exam.sourceClassName || gData.className] || {}).progress || {})[exam.sourceAssignmentId] || null; }
    };
    root.getHolidayProgressForExam = root.HolidayPracticeApp.progressForExam;
})(window);
