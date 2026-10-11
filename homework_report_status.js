(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.HomeworkReportStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    // 三端共用純判定；來源與學生 scope 由呼叫端沿既有入班／轉班規則建立。
    function values(rows) { return Array.isArray(rows) ? rows : Object.values(rows || {}); }
    function options(post) {
        var value = post && post.displayOptions;
        if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch (_) { return {}; } }
        return value || {};
    }
    function score(value) {
        if (typeof value !== 'number' && typeof value !== 'string' || String(value).trim() === '') return null;
        var n = Number(value);
        return Number.isFinite(n) && n >= 0 && n <= 200 ? n : null;
    }
    function itemId(value) {
        // 固定長度避免超長 post ID 被 skip key 截斷而讓不同卷共用識別。
        var a = 0x811c9dc5, b = 0x9e3779b9;
        for (var i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 0x01000193); b = Math.imul(b ^ value.charCodeAt(i), 0x85ebca6b); }
        return 'homework_score_' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
    }
    function entries(post) {
        var opts = options(post), postId = String(post && (post.id || post.dailyPostId) || '');
        if (!postId || /[.#$\[\]/]/.test(postId) || !Array.isArray(opts.homeworkAnswers)) return [];
        function paper(a) {
            return Array.from(String(post[a.slot] || '').matchAll(/\[回家作業卷[｜|]([^\]\r\n]+)\](https?:\/\/[^\s<>]+)/g))
                .find(function(m) { return m[2] === a.questionUrl; });
        }
        return opts.homeworkAnswers.filter(function(a) {
            return a && a.reportScore === true && a.reportProvisioned === true && /^[a-zA-Z0-9_-]{8,80}$/.test(a.id || '') &&
                ['hw1', 'hw2'].includes(a.slot) && typeof a.questionUrl === 'string' &&
                paper(a);
        }).map(function(a) {
            var assignmentId = 'homework_' + postId + '_' + a.id;
            var match = paper(a);
            return { assignmentId: assignmentId, sourceItemId: itemId(assignmentId), answerId: a.id,
                dailyPostId: postId, title: a.title || match && match[1] || '回家作業卷',
                date: post.date, dueAt: Number((opts.homeworkDue || {}).dueAt || 0) };
        });
    }
    function received(assignment, feedbacks, grades, localReceipt) {
        if (localReceipt && Number(localReceipt.reportedAt) > 0 && score(localReceipt.score) !== null) return true;
        if (values(feedbacks).some(function(f) { return f && f.type === '回家作業回報' &&
            f.assessmentKind === 'homework_self_marked' && f.sourceAssignmentId === assignment.assignmentId && score(f.reportedScore) !== null; })) return true;
        return values(grades).some(function(g) { return g && g.assessmentKind === 'homework_self_marked' &&
            g.sourceAssignmentId === assignment.assignmentId && score(g.score) !== null; });
    }
    function pending(post, state) {
        state = state || {};
        return entries(post).filter(function(a) {
            return !received(a, state.feedbacks, state.grades, (state.receipts || {})[a.assignmentId]);
        }).map(function(a) { return Object.assign({}, a, { dueAt: Number(state.dueAt || a.dueAt || 0) }); });
    }
    function label(overdue) { return overdue ? '作業逾期未回報分數' : '作業待回報分數'; }
    function reminderItems(post, state, identity, now) {
        return pending(post, state).map(function(a) {
            var overdue = a.dueAt > 0 && Number(now == null ? Date.now() : now) >= a.dueAt;
            return Object.assign({}, identity, { type: 'homework_report', reminderType: 'homework_report',
                assessmentKind: 'homework_self_marked', assignmentId: a.assignmentId,
                sourceItemId: a.sourceItemId, sourceDailyPostId: a.dailyPostId, answerId: a.answerId,
                hwName: [a.date, a.title].filter(Boolean).join(' '), reason: label(overdue), overdue: overdue,
                dueAt: a.dueAt, targetDate: a.date, rawDate: a.date, sourceDate: a.date,
                sourceDateResolution: 'exact_daily_post' });
        });
    }
    return { entries: entries, pending: pending, received: received, label: label, reminderItems: reminderItems };
});
