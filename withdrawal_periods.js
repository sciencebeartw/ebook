// A return date is the first active day, in Asia/Taipei.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.WithdrawalPeriods = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    function taipeiDay(ms) {
        return new Date(Number(ms) + 8 * 3600000).toISOString().slice(0, 10);
    }
    function day(value) {
        var text = String(value || '').trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
        var ms = Date.parse(text + 'T00:00:00Z');
        return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text ? text : '';
    }
    function blocked(record, date) {
        var key = day(date);
        return !!key && Object.values(record && record.periods || {}).some(function (p) {
            return p.start <= key && (!p.end || key < p.end);
        });
    }
    function isQuiz(rawDate, title) {
        var dateLabel = String(rawDate || '').replace(/\s/g, '');
        var name = String(title || '').replace(/\s/g, '');
        if (/入班鑑定/.test(dateLabel + name) || /作業|回家練習卷/.test(dateLabel)) return false;
        return /小考/.test(dateLabel) || (!/作業|回家練習卷/.test(name) && /小考/.test(name));
    }
    function returnedOn(record, date) {
        var key = day(date);
        if (!key || blocked(record, key)) return false;
        return Object.values(record && record.periods || {}).some(function (p) {
            return p && day(p.end) === key && day(p.start) && p.start < key;
        });
    }
    // Merged lifecycle records are replaced on refresh. Index them once per scan.
    var indexes = new WeakMap();
    function matchingRecord(records, cls, student, date, test) {
        if (!records || typeof records !== 'object' || !cls) return false;
        var index = indexes.get(records);
        if (!index) {
            index = new Map();
            Object.values(records).forEach(function (r) {
                if (!r || r.kind !== 'withdrawal') return;
                if (!index.has(r.classKey)) index.set(r.classKey, []);
                index.get(r.classKey).push(r);
            });
            indexes.set(records, index);
        }
        return (index.get(cls) || []).some(function (r) { return (!student || r.studentKey === student) && test(r, date); });
    }
    function fromRecords(records, cls, student, date) {
        return matchingRecord(records, cls, student, date, blocked);
    }
    function returnedOnFromRecords(records, cls, student, date) {
        return !!student && matchingRecord(records, cls, student, date, returnedOn);
    }
    function revise(record, previousStart, start, end, now) {
        if (!day(start) || (end && (!day(end) || end <= start))) throw Error('復班日必須晚於退班日，請確認日期。');
        var periods = Object.assign({}, record && record.periods);
        if (previousStart && !periods[previousStart]) throw Error('這筆紀錄已變更，請重新載入。');
        if (previousStart) delete periods[previousStart];
        if (periods[start]) throw Error('此退班日已有紀錄。');
        periods[start] = end ? { start: start, end: end } : { start: start };
        var ordered = Object.values(periods).sort(function (a, b) { return a.start.localeCompare(b.start); });
        var today = taipeiDay(now);
        ordered.forEach(function (p, i) {
            if (i && (!ordered[i-1].end || ordered[i-1].end > p.start)) throw Error('退班期間重疊，請先確認上一筆復班日。');
        });
        if (ordered.filter(function (p) { return !p.end || p.end > today; }).length > 1) {
            throw Error('已有進行中或預定的退班，請在該次復班後再登記下一次。');
        }
        var last = ordered[ordered.length - 1];
        return { periods: periods, revision: (record && record.revision || 0) + 1,
            blockedFrom: Date.parse(last.start + 'T00:00:00+08:00'),
            blockedUntil: last.end ? Date.parse(last.end + 'T00:00:00+08:00') : 0 };
    }
    function validScope(s) {
        function validKey(k) { return typeof k === 'string' && k.length > 0 && k.length <= 180 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(k); }
        return !!s && ['science','math'].includes(s.subject) && validKey(s.classKey) && validKey(s.studentKey)
            && validKey(s.sourceClassKey) && validKey(s.sourceStudentKey) && !!day(s.date);
    }
    return { day: day, taipeiDay: taipeiDay, blocked: blocked, fromRecords: fromRecords, isQuiz: isQuiz, returnedOn: returnedOn, returnedOnFromRecords: returnedOnFromRecords, revise: revise, validScope: validScope };
});
