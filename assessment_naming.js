/* Dashboard / eBook 共用：可編輯預填及呈現名稱，不作成績識別。 */
(function(root) {
    'use strict';
    function clean(value) { return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\[/g, '［').replace(/\]/g, '］').trim().slice(0, 300); }
    function esc(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function validDate(y, m, d) {
        const n = new Date(Date.UTC(+y, +m - 1, +d));
        return n.getUTCFullYear() === +y && n.getUTCMonth() === +m - 1 && n.getUTCDate() === +d ? [y, String(m).padStart(2,'0'), String(d).padStart(2,'0')].join('-') : '';
    }
    function parse(filename, context) {
        const c = context || {}, raw = clean(filename), notes = [];
        let scope = raw.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g)$/i, ''), date = c.date || '', type = c.type || '一般';
        const dateMatch = scope.match(/^(20\d{2})[-_/年]?(\d{2})[-_/月]?(\d{2})(?:日)?/);
        if (dateMatch) {
            const rest = scope.slice(dateMatch[0].length);
            if (/^\s*[-～~、]\s*\d/.test(rest)) notes.push('檔名包含多個日期，請確認日期。');
            else { const parsed = validDate(dateMatch[1], dateMatch[2], dateMatch[3]); if (parsed) { date = parsed; scope = rest; } else notes.push('檔名日期無效，請確認日期。'); }
        }
        scope = scope.replace(/^[\s_｜|：:-]+/, '')
            .replace(/^(?:\d{2,3}(?:學年度)?\s*)?(?:小六資優自然|國[一二三]自然(?:超前|總複習|生物|理化))(?:班|週[六日](?:上午|下午|晚上)班)?[\s_｜|：:-]*/, '');
        const kind = scope.match(/^(小考(?:卷)?|隨堂考(?:卷)?|鑑定考(?:卷)?|複習考(?:卷)?|補考(?:卷)?|輔導(?:卷)?|回家作業卷?|回家練習卷?|(?:假期|中秋|連假)(?:作業|練習|複習)?卷?)[\s_｜|：:-]*/);
        if (kind) { type = /^(假期|中秋|連假)/.test(kind[1]) ? '假期題目' : /回家/.test(kind[1]) ? (kind[1].includes('練習') ? '回家練習卷' : '回家作業卷') : kind[1].replace(/卷$/, ''); scope = scope.slice(kind[0].length); }
        const englishAnswer = /(^|[^a-z])ANS$/i, chineseAnswer = /(?:\s|_)*(?:答案(?:卷)?|解答(?:卷)?)$/;
        const answer = englishAnswer.test(scope) || chineseAnswer.test(scope);
        scope = scope.replace(englishAnswer, '$1').replace(chineseAnswer, '').replace(/[\s_]+$/, '');
        if (answer && type === '假期題目') type = '假期答案';
        if (!kind && !/^((生物|理化|地科).*第.+章|第.+章)/.test(scope)) notes.push('請確認卷別與範圍；無法完整辨識的文字已保留。');
        if (root.AssessmentLabels && /^115小六資優自然/.test(c.className || '')) scope = root.AssessmentLabels.fullTitle(scope, c.className);
        return { original: raw, date, type, scope: clean(scope), answer, notes };
    }
    function purpose(type, answer) {
        if (type === '假期題目' || type === '假期答案') return '假期練習卷' + (type === '假期答案' ? '答案' : '');
        if (type === '一般') return '';
        if (type === '補充') return '補充教材';
        return /卷$/.test(type) ? type + (answer ? '答案' : '') : type + (answer ? '解答' : '卷');
    }
    function label(data) { return [purpose(data.type, data.answer), clean(data.scope)].filter(Boolean).join('｜'); }
    function color(type) { return /假期/.test(type) ? 'orange' : /回家/.test(type) ? 'purple' : type === '補充' ? 'slate' : type === '一般' ? 'gray' : 'blue'; }
    function labelHtml(value) { return clean(value).split('｜').map((part,i) => '<span class="assessment-name-part">' + (i ? '｜' : '') + esc(part) + '</span>').join(''); }
    function find(options, source, href, role) {
        const rows = options && options.links && options.links.labels;
        if (!Array.isArray(rows)) return null;
        return rows.find(r => r && (role ? r.role === role : !r.role && r.source === source && r.href === href)) || null;
    }
    function fit(value) { const text = clean(value); return Array.from(text).length > 46 ? Array.from(text).slice(0,44).join('') + '…' : text; }
    function reportTitle(value, className) {
        const full = root.AssessmentLabels ? root.AssessmentLabels.fullTitle(value, className) : clean(value);
        if (Array.from(full).length <= 46) return full;
        const qualifier = full.match(/(?:概念[一二三四五六七八九十\d、]+|前半|後半|全章|自行對答案)/g) || [];
        const tail = Array.from(new Set(qualifier)).join('・');
        const short = Array.from(full).slice(0, tail ? 34 : 44).join('').replace(/[、，；：｜\s]+$/, '');
        return short + '…' + (tail && !short.includes(tail) ? '（' + tail + '）' : '');
    }
    const api = { clean, esc, parse, purpose, label, color, labelHtml, find, reportTitle, fit };
    root.AssessmentNaming = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
