#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const EbookLifecycleApp = require("../ebook_lifecycle_app.js");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `missing ${name}`);
  const brace = html.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === "{") depth++;
    if (html[i] === "}") depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = vm.createContext({
  BEAR_SUBJECT: "/science",
  EbookLifecycleApp,
  Date,
  Object,
  isRecordFromPostSource: (gradeClassKey, postClassKey) => gradeClassKey === postClassKey,
  isDailyPostExamGrade: () => true,
});
[
  "normalizeEbookExamLookupText",
  "isValidEbookExamLookupDate",
  "getEbookExamLookupDateParts",
  "getHomeworkDoneCourseAliasKey",
  "listActiveIncomingTransfers",
  "getTransferDateKey",
  "getTransferFallbackYear",
  "getTransferGradeCatalogKind",
  "getTransferGradeDateDistanceDays",
  "isTransferGradeCompatibleAssessmentKinds",
  "resolveTransferGradeDisplayIdentity",
  "isGradeFromPostSource",
  "getDailyPostExamMatches",
].forEach(name => vm.runInContext(extractFunction(name), context));

const saturday = "115小六資優自然週六上午班";
const sunday = "115小六資優自然週日晚上班";
const caiTransfer = {
  cai: {
    id: "cai",
    fromClassKey: saturday,
    fromClassName: saturday,
    toClassKey: sunday,
    toClassName: sunday,
    effectiveDate: "2026-07-26",
    status: "active",
  },
};
const caiChain = EbookLifecycleApp.buildTransferChain(caiTransfer, sunday);
const caiCatalogs = {
  [saturday]: {
    satQuiz: { examId: "satQuiz", colKey: "col_20", date: "7/18小考", title: "理化第2章" },
    satHomework: { examId: "satHomework", colKey: "col_19", date: "7/18作業", title: "理化第3章" },
    satSameDay: { examId: "satSameDay", colKey: "col_18", date: "7/12小考", title: "理化第1章" },
    satReview: { examId: "satReview", colKey: "col_10", date: "7/4複習考", title: "生物第1-8章複習考" },
  },
  [sunday]: {
    sunQuiz: { examId: "sunQuiz", colKey: "col_20", date: "7/19小考", title: "理化第2章" },
    sunHomework: { examId: "sunHomework", colKey: "col_19", date: "7/19作業", title: "理化第3章" },
    sunSameDay: { examId: "sunSameDay", colKey: "col_18", date: "7/12小考", title: "理化第1章" },
    sunReview: { examId: "sunReview", colKey: "col_10", date: "7/5小考", title: "生物第1-8章複習考" },
  },
};

function resolveCai(grade, colKey) {
  return context.resolveTransferGradeDisplayIdentity({
    grade,
    storedClassKey: sunday,
    currentClassKey: sunday,
    presentation: { sourceClassKey: saturday, isTransferFormerClass: true },
    colKey,
    examIdByColKey: {
      col_20: "sunQuiz",
      col_19: "sunHomework",
      col_18: "sunSameDay",
      col_10: "sunReview",
    },
    examCatalogEntriesByClassKey: caiCatalogs,
    transferIndex: caiTransfer,
    transferChain: caiChain,
  });
}

const caiQuiz = resolveCai({ date: "7/19小考", examName: "理化第2章" }, "col_20");
assert.strictEqual(caiQuiz.date, "7/18小考", "蔡昱萱的轉班前小考必須顯示週六原班日期");
assert.strictEqual(caiQuiz.examId, "satQuiz", "顯示身分必須切到原班 examID");
assert.strictEqual(caiQuiz.storedDate, "7/19小考", "仍須保留新班橫列的實際儲存日期");
assert.strictEqual(caiQuiz.storedExamId, "sunQuiz", "仍須保留實際儲存 examID 供老師端寫回");
assert.strictEqual(caiQuiz.mapped, true);
const linkedSaturdayPostGrades = context.getDailyPostExamMatches(
  { date: "2026/07/18" },
  [Object.assign({ sourceClassKey: saturday, dateKey: 20260718 }, caiQuiz)],
  saturday
);
assert.strictEqual(linkedSaturdayPostGrades.length, 1, "映射後的成績必須重新掛回 7/18 原班聯絡簿");

const caiHomework = resolveCai({ date: "7/19作業", examName: "理化第3章" }, "col_19");
assert.strictEqual(caiHomework.date, "7/18作業", "同範圍作業也必須顯示原班日期");

const caiSameDay = resolveCai({ date: "7/12小考", examName: "理化第1章" }, "col_18");
assert.strictEqual(caiSameDay.date, "7/12小考", "兩班同日考試仍維持相同日期");
assert.strictEqual(caiSameDay.examId, "satSameDay");

const caiReview = resolveCai({ date: "7/5小考", examName: "生物第1-8章複習考" }, "col_10");
assert.strictEqual(caiReview.date, "7/4複習考", "同一份複習考即使新舊班考試類型標籤不同，也要在唯一且相差一天時對回原班日期");
assert.strictEqual(caiReview.examId, "satReview");

const ambiguousCatalogs = JSON.parse(JSON.stringify(caiCatalogs));
ambiguousCatalogs[saturday].satQuizDuplicate = {
  examId: "satQuizDuplicate",
  colKey: "col_21",
  date: "7/17小考",
  title: "理化第2章",
};
const ambiguous = context.resolveTransferGradeDisplayIdentity({
  grade: { date: "7/19小考", examName: "理化第2章" },
  storedClassKey: sunday,
  currentClassKey: sunday,
  presentation: { sourceClassKey: saturday, isTransferFormerClass: true },
  colKey: "col_20",
  examIdByColKey: { col_20: "sunQuiz" },
  examCatalogEntriesByClassKey: ambiguousCatalogs,
  transferIndex: caiTransfer,
  transferChain: caiChain,
});
assert.strictEqual(ambiguous.mapped, false, "原班有多個候選時必須停止，不得猜日期");
assert.strictEqual(ambiguous.date, "7/19小考");

const tooFarCatalogs = JSON.parse(JSON.stringify(caiCatalogs));
tooFarCatalogs[saturday].satReview.date = "6/20複習考";
const tooFar = context.resolveTransferGradeDisplayIdentity({
  grade: { date: "7/5小考", examName: "生物第1-8章複習考" },
  storedClassKey: sunday,
  currentClassKey: sunday,
  presentation: { sourceClassKey: saturday, isTransferFormerClass: true },
  colKey: "col_10",
  examIdByColKey: { col_10: "sunReview" },
  examCatalogEntriesByClassKey: tooFarCatalogs,
  transferIndex: caiTransfer,
  transferChain: caiChain,
});
assert.strictEqual(tooFar.mapped, false, "跨類型考試日期相差超過兩天時不得猜測對應");

const homeworkKindMismatchCatalogs = JSON.parse(JSON.stringify(caiCatalogs));
homeworkKindMismatchCatalogs[saturday].satHomework.title = "生物第1-8章複習考";
homeworkKindMismatchCatalogs[saturday].satHomework.date = "7/4作業";
const homeworkKindMismatch = context.resolveTransferGradeDisplayIdentity({
  grade: { date: "7/5小考", examName: "生物第1-8章複習考" },
  storedClassKey: sunday,
  currentClassKey: sunday,
  presentation: { sourceClassKey: saturday, isTransferFormerClass: true },
  colKey: "col_10",
  examIdByColKey: { col_10: "sunReview" },
  examCatalogEntriesByClassKey: homeworkKindMismatchCatalogs,
  transferIndex: caiTransfer,
  transferChain: caiChain,
});
assert.strictEqual(homeworkKindMismatch.date, "7/4複習考", "同標題作業不得取代唯一的非作業複習考候選");

const hongTransfer = {
  hong: {
    id: "hong",
    fromClassKey: sunday,
    fromClassName: sunday,
    toClassKey: saturday,
    toClassName: saturday,
    effectiveDate: "2026-07-25",
    status: "active",
  },
};
const hong = context.resolveTransferGradeDisplayIdentity({
  grade: { date: "7/18小考", examName: "理化第2章" },
  storedClassKey: saturday,
  currentClassKey: saturday,
  presentation: { sourceClassKey: sunday, isTransferFormerClass: true },
  colKey: "col_20",
  examIdByColKey: { col_20: "satQuiz" },
  examCatalogEntriesByClassKey: caiCatalogs,
  transferIndex: hongTransfer,
  transferChain: EbookLifecycleApp.buildTransferChain(hongTransfer, saturday),
});
assert.strictEqual(hong.date, "7/19小考", "洪晨皓的轉班前成績必須顯示週日原班日期");
assert.strictEqual(hong.examId, "sunQuiz");

const currentClassGrade = context.resolveTransferGradeDisplayIdentity({
  grade: { date: "7/26小考", examName: "理化第4章" },
  storedClassKey: sunday,
  currentClassKey: sunday,
  presentation: { sourceClassKey: sunday, isTransferFormerClass: false },
  colKey: "col_22",
  examIdByColKey: { col_22: "currentQuiz" },
  examCatalogEntriesByClassKey: caiCatalogs,
  transferIndex: caiTransfer,
  transferChain: caiChain,
});
assert.strictEqual(currentClassGrade.mapped, false, "轉班後目前班級成績不得改日期");
assert.strictEqual(currentClassGrade.date, "7/26小考");

assert.match(html, /date:\s*displayIdentity\.date \|\| eData\.date/);
assert.match(html, /storedDate:\s*displayIdentity\.storedDate \|\| eData\.date/);
assert.match(html, /targetExamId:\s*item\.storedExamId \|\| item\.examId/);
assert.match(html, /targetExamId:\s*exam\.storedExamId \|\| exam\.examId/);

console.log("ebook transfer grade display date tests passed");
