(function(root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.BearGiftedHomeworkFullScores = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    // 來源：sciencebear-admin 正式 Google Form quiz metadata（2026-07-18 暖機完成）。
    // 此清單只有章名與滿分，不含 Form 網址、正解、學生資料或作答紀錄。
    var FULL_SCORES = Object.freeze({
        "生物第1章": 46,
        "生物第2章": 29,
        "生物第3章": 20,
        "生物第4章": 30,
        "生物第5章": 32,
        "生物第6章": 39,
        "生物第7章": 32,
        "生物第8章": 35,
        "生物第9章": 35,
        "生物第10章": 31,
        "生物第11章": 24,
        "生物第12章": 29,
        "生物第13章": 43,
        "生物第14章": 42,
        "生物第15章": 73,
        "生物第16章": 45,
        "理化第1章": 29,
        "理化第2章": 24,
        "理化第3章": 39,
        "理化第4章": 37,
        "理化第5章": 41,
        "理化第6章": 54,
        "理化第7章": 46,
        "理化第8章": 16,
        "理化第9章": 32,
        "理化第10章": 33,
        "理化第11章": 59,
        "理化第12章": 39,
        "理化第13章": 44,
        "地科第1章": 37,
        "地科第2章": 46,
        "地科第3章": 40
    });

    var CHAPTER_NUMBERS = Object.freeze({
        "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
        "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
        "十三": 13, "十四": 14, "十五": 15, "十六": 16
    });

    function normalizeRangeLabel(value) {
        var text = String(value || "").replace(/\s+/g, "").replace(/作業/g, "");
        var match = text.match(/^(生物|理化|地科)第?([0-9]+|十六|十五|十四|十三|十二|十一|十|九|八|七|六|五|四|三|二|一)章$/);
        if (!match) return "";
        var chapter = /^\d+$/.test(match[2]) ? Number(match[2]) : CHAPTER_NUMBERS[match[2]];
        return chapter ? match[1] + "第" + chapter + "章" : "";
    }

    function getFullScore(rangeLabel) {
        var normalized = normalizeRangeLabel(rangeLabel);
        var fullScore = Number(FULL_SCORES[normalized]);
        return Number.isFinite(fullScore) && fullScore > 0 ? fullScore : null;
    }

    return Object.freeze({
        version: "20260718-form-quiz-metadata-v1",
        scores: FULL_SCORES,
        normalizeRangeLabel: normalizeRangeLabel,
        getFullScore: getFullScore
    });
});
