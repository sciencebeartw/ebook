/* 同步供 Dashboard / eBook 使用；章名來源：115 資優自然正式章節目錄。 */
(function (root) {
    'use strict';
    const chapters = Object.freeze({
        生物: ['生物圈及科學方法', '生命的基本單位', '生物體的組成', '養分與能量', '植物如何獲得養分', '植物的運輸原理', '動物如何獲得養分', '動物如何運輸物質', '神經系統', '內分泌系統', '生殖與無性生殖', '有性生殖', '遺傳', '演化', '生物的分類', '生態與環境'],
        理化: ['物質的基本結構', '基本測量', '水與密度', '溶液與溶解度', '聲音', '光', '溫度與熱', '酸與鹼', '空氣的組成', '有機化合物', '常見的力', '簡單機械', '電與磁'],
        地科: ['我們所在的地球', '大氣與天氣', '地表的變化']
    });
    function chapterNumber(value) {
        if (/^\d+$/.test(value)) return Number(value);
        const units = '零一二三四五六七八九';
        if (value === '十') return 10;
        if (/^十[一二三四五六七八九]$/.test(value)) return 10 + units.indexOf(value[1]);
        return value.length === 1 ? units.indexOf(value) : 0;
    }
    function describe(value, className) {
        const raw = String(value || '').trim();
        // 舊假期卷常以「日期 班名 回家複習卷 章節.pdf」作為欄名。
        // 僅在移除已知前綴後能辨識章節時採用，其他自訂文字不裁切。
        const scope = raw.replace(/^\d{8}(?:[-～~、]\d{2,8})*\s+/, '')
            .replace(/^(?:115(?:學年度)?\s*)?小六資優自然(?:週[六日](?:上午|下午|晚上)班)?\s+/, '')
            .replace(/^(?:回家|假期|中秋|連假)(?:作業|練習|複習)*(?:考卷|卷)?[\s｜|：:]+/, '')
            .replace(/\.(?:pdf|docx?)$/i, '').trim();
        const match = scope.match(/^((?:(生物|理化|地科)(?:[（(][上下][）)])?)?第([0-9一二三四五六七八九十、,\-–—～~至]+)章)(.*)$/);
        if (!match) {
            const parts = raw.split(/[｜|]/).map(x => x.trim()).filter(Boolean);
            return { heading: parts[0] || '', detail: parts.slice(1).join('｜'), full: raw };
        }
        const heading = match[1];
        let detail = match[4].replace(/^[\s｜|：:]+/, '').trim();
        // 跨章只顯示章節範圍，不逐章列出內容；保留複習考用途。
        if (/[、,\-–—～~至]/.test(match[3])) {
            const compact = heading + (/複習考/.test(detail) ? '複習考' : '');
            const note = /（自行對答案）/.test(detail) ? '（自行對答案）' : '';
            return { heading: compact, detail: note, full: compact + note };
        }
        const catalog = /^115小六資優自然/.test(String(className || '')) ? chapters[match[2]] : null;
        const chapter = catalog && catalog[chapterNumber(match[3]) - 1];
        // 只補有目錄依據、且尚未填章名的簡稱。自訂內容不覆寫。
        if (chapter && (!detail || /^(?:概念[一二三四五六七八九十\d、及與到至\-～]+|前半(?:範圍)?|後半(?:範圍)?|全章?|剩餘(?:作業|範圍)?|複習考)?(?:（自行對答案）)?$/.test(detail))) {
            detail = chapter + (detail ? '｜' + detail : '');
        }
        return { heading, detail, full: heading + (detail ? ' ' + detail : '') };
    }
    function fullTitle(value, className) { return describe(value, className).full; }
    // 新上傳的簡章名可補內容；日期、班名及未知檔名不猜測，原樣保留。
    function paperTitle(value, className) {
        const raw = String(value || '').trim();
        return /^115小六資優自然/.test(String(className || '')) ? fullTitle(raw, className) : raw;
    }
    function dateParts(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/(?:(\d{4})[\/-])?(\d{1,2})[\/-](\d{1,2})/);
        if (!match) return { date: raw, shortDate: raw, type: '' };
        return {
            date: (match[1] ? match[1] + '/' : '') + Number(match[2]) + '/' + Number(match[3]),
            shortDate: Number(match[2]) + '/' + Number(match[3]),
            type: (raw.slice(0, match.index) + raw.slice(match.index + match[0].length)).replace(/^[\s｜|]+|[\s｜|]+$/g, '')
        };
    }
    const api = Object.freeze({ describe, fullTitle, paperTitle, dateParts });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.AssessmentLabels = api;
})(typeof window !== 'undefined' ? window : globalThis);
