(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.HomeworkAnswers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    function url(value) { return typeof value === 'string' && /^https:\/\/[^\s<>"']+$/i.test(value) && value.length <= 4000; }
    function papers(post) {
        var result = [];
        ['hw1', 'hw2'].forEach(function(slot) {
            var pattern = /\[回家作業卷｜([^\]\r\n]+)\](https?:\/\/[^\s<]+)/g, match;
            while ((match = pattern.exec(String(post && post[slot] || '')))) {
                if (!result.some(function(p) { return p.slot === slot && p.questionUrl === match[2]; })) {
                    result.push({ slot: slot, title: match[1], questionUrl: match[2] });
                }
            }
        });
        return result;
    }
    function normalize(entries, post, privateRequired) {
        if (entries === undefined || entries === null) return [];
        if (!Array.isArray(entries) || entries.length > 12) throw new Error('一篇最多附 12 份作業解答');
        var candidates = papers(post), used = {};
        return entries.map(function(a) {
            if (!a || !/^[a-zA-Z0-9_-]{8,80}$/.test(a.id || '') || !/^[a-zA-Z0-9_-]{8,80}$/.test(a.revision || '')) throw new Error('作業解答識別碼不完整');
            var p = candidates.find(function(paper) { return paper.slot === a.slot && paper.questionUrl === a.questionUrl; });
            if (!p || used[a.id] || used[a.slot + ':' + a.questionUrl]) throw new Error('解答對應的作業卷已變更，請重新加入解答');
            if (privateRequired && (!url(a.answerUrl) || a.answerUrl === a.questionUrl)) throw new Error('請附上有效的 HTTPS 解答網址，不能與題目相同');
            used[a.id] = used[a.slot + ':' + a.questionUrl] = true;
            var out = { id: a.id, revision: a.revision, slot: a.slot, title: p.title.slice(0, 300), questionUrl: p.questionUrl };
            out.reportScore = a.reportScore === true;
            out.scoreMax = a.scoreMax === undefined ? 100 : Number(a.scoreMax);
            out.scoreUnit = a.scoreUnit === '題' ? '題' : '分';
            if (!Number.isInteger(out.scoreMax) || out.scoreMax < 1 || out.scoreMax > 200) throw new Error('滿分須為 1～200 的整數');
            if (a.reportProvisioned === true) out.reportProvisioned = true;
            if (privateRequired) out.answerUrl = a.answerUrl;
            return out;
        });
    }
    function signature(entries) {
        return JSON.stringify((entries || []).map(function(a) { return [a.id, a.revision, a.slot, a.questionUrl, a.reportScore === true, a.scoreMax || 100, a.scoreUnit || '分']; }).sort(function(a, b) { return a[0].localeCompare(b[0]); }));
    }
    return { papers: papers, normalize: normalize, signature: signature, validUrl: url };
});
