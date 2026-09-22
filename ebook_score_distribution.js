/* 圖表專用衍生資料；不回寫正式成績或 Firebase 統計。 */
(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.EbookScoreDistribution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    function forDisplay(grade) {
        grade = grade || {};
        var result = {
            dist: grade.dist || [0, 0, 0, 0, 0],
            labels: grade.labels || ['0~20', '20~40', '40~60', '60~80', '80~100'],
            myBucket: grade.myBucket,
            normalized: false
        };
        // 只處理已確認全部同分且 >=100 的零寬度範圍；不從平均或標籤猜成績。
        var min = grade.distMin, max = grade.distMax;
        if (typeof min !== 'number' || typeof max !== 'number' ||
            !Number.isFinite(min) || !Number.isFinite(max) || min !== max || max < 100) return result;
        if (!Array.isArray(result.dist) || result.dist.length !== 5 ||
            !result.dist.every(function(n) { return Number.isInteger(n) && n >= 0; })) return result;
        var total = result.dist.reduce(function(sum, n) { return sum + n; }, 0);
        if (!total || (grade.total !== undefined && grade.total !== total)) return result;

        result.dist = [0, 0, 0, 0, total];
        result.labels = [];
        // 中間界線沿用整數顯示，末端保留實際最高分（包含小數）。
        for (var i = 0; i < 5; i++) {
            result.labels.push(Math.round(max * i / 5) + ' ~ ' + (i === 4 ? max : Math.round(max * (i + 1) / 5)));
        }
        var scoreMatch = String(grade.score == null ? '' : grade.score).match(/^(\d+(?:\.\d+)?)(?:假)?$/);
        result.myBucket = !grade.isMissing && scoreMatch && Number(scoreMatch[1]) === max ? 4 : -1;
        result.normalized = true;
        return result;
    }

    return { forDisplay: forDisplay };
});
