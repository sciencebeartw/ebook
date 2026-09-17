/* Shared contract. Keep the Dashboard, eBook and GAS copies byte-identical. */
(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ClassSessionPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    var DAY = 86400000, WEEK = 7 * DAY, OFFSET = 8 * 3600000;
    var POLICIES = Object.freeze([
        { id: 'p6_gifted_science_sat_am', subjectKey: 'science', classPattern: /^\d{3,4}小六資優自然週六上午班$/, weekday: 6, startTime: '09:00', endTime: '12:00' },
        { id: 'p6_gifted_science_sun_pm', subjectKey: 'science', classPattern: /^\d{3,4}小六資優自然週日下午班$/, weekday: 0, startTime: '14:00', endTime: '17:00' },
        { id: 'p6_gifted_science_sun_night', subjectKey: 'science', classPattern: /^\d{3,4}小六資優自然週日晚上班$/, weekday: 0, startTime: '18:00', endTime: '21:00' },
        { id: 'g7_advanced_science_sat', subjectKey: 'science', classPattern: /^\d{3,4}國一自然超前班$/, weekday: 6, startTime: '13:00', endTime: '16:00' },
        { id: 'g8_advanced_science_sat', subjectKey: 'science', classPattern: /^\d{3,4}國二自然超前班$/, weekday: 6, startTime: '18:00', endTime: '21:00' },
        { id: 'g7_advanced_math_sat', subjectKey: 'math', classPattern: /^\d{3,4}國一數學超前班$/, weekday: 6, startTime: '18:00', endTime: '21:00' },
        { id: 'g8_advanced_math_sun', subjectKey: 'math', classPattern: /^\d{3,4}國二數學超前班$/, weekday: 0, startTime: '18:00', endTime: '21:00' },
        { id: 'p6_gifted_math_wed', subjectKey: 'math', classPattern: /^\d{3,4}(?:小六)?資優數學(?:班)?$/, weekday: 3, startTime: '18:00', endTime: '21:00' }
    ].map(Object.freeze));
    var HOLIDAY_PRACTICE_POLICY_IDS = Object.freeze([
        'p6_gifted_science_sat_am',
        'p6_gifted_science_sun_pm',
        'p6_gifted_science_sun_night',
        'g7_advanced_science_sat',
        'g8_advanced_science_sat'
    ]);
    function fail(message) { throw new Error(message); }
    function dateKey(value) {
        var s = String(value || '').trim().replace(/\//g, '-');
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) return '';
        var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return '';
        return d.toISOString().slice(0, 10);
    }
    function dayMs(value) { var key = dateKey(value); return key ? Date.parse(key + 'T00:00:00Z') : NaN; }
    function weekday(value) { return new Date(dayMs(value)).getUTCDay(); }
    function addDays(value, days) { var ms = dayMs(value); return Number.isFinite(ms) ? new Date(ms + days * DAY).toISOString().slice(0, 10) : ''; }
    function timeMinutes(value) {
        var m = String(value || '').match(/^(\d{2}):(\d{2})$/);
        return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : NaN;
    }
    function at(value, time) { return dayMs(value) + timeMinutes(time) * 60000 - OFFSET; }
    function taipeiDate(ms) { return new Date(ms + OFFSET).toISOString().slice(0, 10); }
    function policy(subject, className) {
        var matches = POLICIES.filter(function(p) { return p.subjectKey === String(subject || '').replace(/^\/+/, '') && p.classPattern.test(String(className || '').replace(/\s+/g, '')); });
        return matches.length === 1 ? matches[0] : null;
    }
    function holidayPracticePolicy(subject, className) {
        var p = policy(subject, className);
        return p && HOLIDAY_PRACTICE_POLICY_IDS.indexOf(p.id) >= 0 ? p : null;
    }
    function supportsHolidayPractice(subject, className) { return !!holidayPracticePolicy(subject, className); }
    function occurrenceId(p, originalDate) {
        var key = dateKey(originalDate);
        if (!p || !key || weekday(key) !== p.weekday) fail('原訂課次日期與固定班次不符');
        return p.id + '__' + key;
    }
    function normalizeException(p, raw) {
        if (!raw || typeof raw !== 'object') fail('缺少上課安排');
        var originalDate = dateKey(raw.originalDate), id = occurrenceId(p, originalDate);
        if (raw.occurrenceId && raw.occurrenceId !== id || raw.policyId && raw.policyId !== p.id) fail('課次識別不符');
        var status = raw.status;
        if (['scheduled', 'cancelled', 'rescheduled'].indexOf(status) < 0) fail('無效的上課安排');
        var actualDate = status === 'rescheduled' ? dateKey(raw.actualDate) : originalDate;
        var startTime = status === 'rescheduled' ? raw.startTime : p.startTime;
        var endTime = status === 'rescheduled' ? raw.endTime : p.endTime;
        var endDate = status === 'rescheduled' && raw.endDate ? dateKey(raw.endDate) : actualDate;
        var startAt = at(actualDate, startTime), endAt = at(endDate, endTime);
        if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt || endAt - startAt > DAY) fail('實際上下課日期或時間不完整');
        if (Math.abs(dayMs(actualDate) - dayMs(originalDate)) > 8 * WEEK) fail('改期超過八週，請確認課務安排');
        var revision = Number(raw.revision || 0);
        if (!Number.isInteger(revision) || revision < 0) fail('無效的安排版本');
        return { schemaVersion: 1, occurrenceId: id, policyId: p.id, originalDate: originalDate, status: status,
            actualDate: actualDate, startTime: startTime, endDate: endDate, endTime: endTime,
            startAt: startAt, endAt: endAt, revision: revision };
    }
    function resolve(p, originalDate, exceptions) {
        var id = occurrenceId(p, originalDate), ex = (exceptions || {})[id];
        if (ex && ex.pending === true) fail('上課安排同步中');
        return normalizeException(p, ex || { originalDate: originalDate, status: 'scheduled' });
    }
    function nextOriginal(p, originalDate) { occurrenceId(p, originalDate); return addDays(originalDate, 7); }
    function candidates(p, anchor, exceptions, bounds) {
        bounds = bounds || {};
        var start = addDays(anchor, -56), list = [], seen = {};
        start = addDays(start, (p.weekday - weekday(start) + 7) % 7);
        for (var i = 0; i < 61; i++) {
            var date = addDays(start, i * 7);
            if (bounds.activeFrom && date < bounds.activeFrom || bounds.activeUntil && date > bounds.activeUntil) continue;
            var item = resolve(p, date, exceptions);
            seen[item.occurrenceId] = true;
            if (item.status !== 'cancelled') list.push(item);
        }
        Object.keys(exceptions || {}).forEach(function(id) {
            if (seen[id]) return;
            var ex = normalizeException(p, exceptions[id]);
            if (bounds.activeFrom && ex.originalDate < bounds.activeFrom || bounds.activeUntil && ex.originalDate > bounds.activeUntil) return;
            if (ex.status !== 'cancelled') list.push(ex);
        });
        list.sort(function(a, b) { return a.startAt - b.startAt; });
        for (var j = 1; j < list.length; j++) if (list[j].startAt < list[j - 1].endAt) fail('同班課次時間重疊，請先確認安排');
        return list;
    }
    function adjacent(p, source, exceptions, direction, bounds) {
        var current = typeof source === 'string' ? resolve(p, source, exceptions) : source;
        var list = candidates(p, current.originalDate, exceptions, bounds).filter(function(item) {
            return item.occurrenceId !== current.occurrenceId && (direction < 0 ? item.startAt < current.startAt : item.startAt > current.startAt);
        });
        return direction < 0 ? list[list.length - 1] || null : list[0] || null;
    }
    function sourceForPost(p, post, exceptions) {
        var opts = options(post), s = opts.session || {}, date = dateKey(post.date);
        if (s.status === 'cancelled' || s.status === 'supplemental') return null;
        if (s.originalDate) return resolve(p, s.originalDate, exceptions);
        var matches = Object.keys(exceptions || {}).map(function(id) { return resolve(p, exceptions[id].originalDate, exceptions); }).filter(function(e) { return e.status !== 'cancelled' && e.actualDate === date; });
        if (matches.length === 1) return matches[0];
        if (matches.length > 1 || s.status === 'rescheduled' || weekday(date) !== p.weekday) return null;
        return resolve(p, date, exceptions);
    }
    function isActualPost(p, post, plan, now) {
        if (plan && plan.pending) return false;
        var s = options(post).session || {};
        if (['cancelled', 'supplemental'].indexOf(s.status) >= 0) return false;
        if (!p) return dayMs(post.date) - OFFSET <= now;
        // 舊版本調課只記實際日；唯讀棒卡入口可沿用已驗證時間，不猜原訂日期。
        if (s.status === 'rescheduled' && !s.originalDate) {
            var start = at(s.actualDate, s.startTime), end = at(s.actualDate, s.endTime);
            return s.policyId === p.id && s.originalWeekday !== null && s.originalWeekday !== undefined &&
                Number(s.originalWeekday) === p.weekday && s.originalStartTime === p.startTime && s.originalEndTime === p.endTime &&
                dateKey(s.actualDate) === dateKey(post.date) && Number.isFinite(start) && Number.isFinite(end) && end > start && start <= now;
        }
        var source = sourceForPost(p, post, plan && plan.exceptions);
        return !!(source && source.status !== 'cancelled' && source.actualDate === dateKey(post.date) && source.startAt <= now);
    }
    function options(post) {
        var value = post && post.displayOptions;
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { return {}; } }
        return value && typeof value === 'object' ? value : {};
    }
    function due(p, source, exceptions, prior, now, bounds) {
        if (typeof source === 'string') source = resolve(p, source, exceptions);
        // Never move an already overdue assignment as a side effect of a later class edit.
        if (prior && prior.dueAt <= now && prior.dueOccurrenceId) return prior;
        var next = adjacent(p, source, exceptions, 1, bounds);
        if (!next) fail('找不到下一次實際上課，請確認課程結束日期');
        return { sourceOccurrenceId: source.occurrenceId, dueOccurrenceId: next.occurrenceId, dueAt: next.startAt,
            dueDate: next.actualDate, dueTime: next.startTime, scheduleRevision: next.revision, duePolicy: 'next_actual_class_start' };
    }
    function reminderLead(p, schedule) {
        var mins = timeMinutes(schedule.time);
        if (!Number.isInteger(schedule.weekday) || schedule.weekday < 0 || schedule.weekday > 6 || !Number.isFinite(mins)) fail('提醒時間不完整');
        return ((p.weekday * DAY + timeMinutes(p.startTime) * 60000 - (schedule.weekday * DAY + mins * 60000)) % WEEK + WEEK) % WEEK;
    }
    function event(p, originalDate, exceptions, purpose, schedule) {
        var o = resolve(p, originalDate, exceptions), lead = purpose === 'teacher' ? 0 : reminderLead(p, schedule);
        return { occurrenceId: o.occurrenceId, originalDate: o.originalDate, eventId: o.occurrenceId + '__' + purpose,
            status: o.status, revision: o.revision, at: o.startAt - lead,
            originalAt: at(o.originalDate, p.startTime) - lead, occurrence: o };
    }
    function isSelfMarked(exam) { return !!exam && (exam.assessmentKind === 'holiday_self_marked' || !!exam.sourceAssignmentId); }
    function holidayState(assignment, progress, now) {
        if (progress && (progress.reportedAt || progress.status === 'synced' || progress.status === 'received')) return progress.status === 'synced' ? 'reported' : 'syncing';
        if (!assignment || !Number.isFinite(Number(assignment.dueAt))) return 'unconfirmed';
        return now >= assignment.dueAt ? 'missing' : progress && progress.unlockedAt ? 'awaiting_score' : 'pending';
    }
    function publicOptions(value) {
        var o = JSON.parse(JSON.stringify(value || {}));
        // Remove private fields recursively; this helper also protects previews and job results.
        function strip(obj) { Object.keys(obj || {}).forEach(function(k) {
            if (/^(answerUrl|answerURL|answerPdfUrl|private|privateAnswer|answerVersionHistory)$/.test(k)) delete obj[k];
            else if (obj[k] && typeof obj[k] === 'object') strip(obj[k]);
        }); }
        strip(o); return o;
    }
    function validScore(value) {
        if (typeof value === 'string' && !/^\d{1,3}(?:\.\d{1,2})?$/.test(value.trim())) return null;
        if (typeof value !== 'string' && typeof value !== 'number') return null;
        var n = Number(value); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
    }
    return Object.freeze({ schemaVersion: 1, TIMEZONE: 'Asia/Taipei', DAY: DAY, WEEK: WEEK, CLASS_SESSION_POLICIES: POLICIES,
        HOLIDAY_PRACTICE_POLICY_IDS: HOLIDAY_PRACTICE_POLICY_IDS.slice(),
        dateKey: dateKey, dayMs: dayMs, weekday: weekday, addDays: addDays, at: at, taipeiDate: taipeiDate, timeMinutes: timeMinutes,
        policy: policy, holidayPracticePolicy: holidayPracticePolicy, supportsHolidayPractice: supportsHolidayPractice,
        occurrenceId: occurrenceId, normalizeException: normalizeException, resolve: resolve,
        nextOriginal: nextOriginal, candidates: candidates, adjacent: adjacent, sourceForPost: sourceForPost,
        options: options, isActualPost: isActualPost, due: due, reminderLead: reminderLead, event: event, isSelfMarked: isSelfMarked,
        holidayState: holidayState, publicOptions: publicOptions, validScore: validScore });
});
