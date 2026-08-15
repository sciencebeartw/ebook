#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Lifecycle = require("../ebook_lifecycle_app.js");
const Promotion = require("../ebook_promotion_app.js");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  assert(start >= 0, `missing ${name}`);
  const braceStart = html.indexOf("{", start);
  let depth = 0;
  let quote = "";
  for (let index = braceStart; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = {
  console,
  Date,
  window: { EbookPromotionApp: Promotion, EbookLifecycleApp: Lifecycle },
  EbookLifecycleApp: Lifecycle,
  listActiveIncomingTransfers: () => [],
  isGradeFromPostSource: () => true,
  isDailyPostExamGrade: () => true,
  getDailyPostDisplayOptions: post => post && post.displayOptions || {},
};
vm.createContext(context);
[
  "isValidEbookExamLookupDate",
  "getEbookExamLookupDateParts",
  "getEbookExamLookupDateCandidates",
  "getEbookExamLookupDateKey",
  "ebookExamLookupDatesMatch",
  "ebookExamLookupTextHasDate",
  "parseEbookComparableDate",
  "getEbookComparableDateKey",
  "formatEbookComparableDate",
  "getMakeupResultTargetDate",
  "isExamOnOrBeforePostDate",
  "isExamBeforePostDate",
  "getDailyPostExamMatches",
  "ebookFeedbackMatchesExamDate",
  "getTransferDateKey",
  "getTransferFallbackYear",
  "collectDailyPostExamDateAnchorKeysById",
  "parseMissingHWDateInput",
  "formatMissingHWDate",
  "parseHomeworkDateValue",
  "getHomeworkDateCandidates",
].forEach(name => vm.runInContext(extractFunction(name), context));

assert.strictEqual(context.ebookExamLookupDatesMatch("2026/8/15", "2025/8/15小考"), false);
assert.strictEqual(context.ebookExamLookupDatesMatch("2026/8/15", "8/15小考"), true);
assert.strictEqual(context.getEbookExamLookupDateKey("2026/8/15小考"), "2026/8/15");
assert.strictEqual(context.getEbookExamLookupDateParts("2026/2/30小考"), null);
assert.strictEqual(context.getEbookExamLookupDateParts("2026/2/29小考"), null, "invalid full-year leap dates must not fall back to legacy M/D");
assert.strictEqual(context.getEbookExamLookupDateParts("第1-8章"), null);

const grades = [
  { id: "old", date: "2025/8/15小考" },
  { id: "current", date: "2026/8/15小考" },
  { id: "legacy", date: "8/15小考", dateKey: 20260815 },
];
assert.deepStrictEqual(
  context.getDailyPostExamMatches("2026-08-15", grades, "class-a").map(item => item.id),
  ["current", "legacy"],
  "an exact-year exam must not suppress an independent anchored legacy exam on the same DailyPost"
);
assert.deepStrictEqual(
  context.getDailyPostExamMatches("2026-08-15", [grades[0], grades[2]], "class-a").map(item => item.id),
  ["legacy"],
  "an anchored legacy header remains compatible while a different-year exact header is rejected"
);
assert.deepStrictEqual(context.getDailyPostExamMatches("2026-08-15", [grades[0]], "class-a"), []);
assert.deepStrictEqual(
  context.getDailyPostExamMatches("2026-08-15", [{ id: "ambiguous", date: "8/15小考", dateKey: 0 }], "class-a"),
  [],
  "an unanchored legacy grade date must fail closed"
);
assert.deepStrictEqual(
  context.getDailyPostExamMatches({
    date: "2026-08-15",
    displayOptions: { quiz: { slot1Exam: { targetExamId: "exam-stable" } } },
  }, [{ id: "mapped", date: "8/15小考", dateKey: 0, examId: "exam-stable" }], "class-a").map(item => item.id),
  ["mapped"],
  "an explicit DailyPost ExamID mapping may safely recover an otherwise ambiguous legacy date"
);

const prePublishedPostWithoutExamId = {
  date: "2026-08-15",
  sourceClassKey: "class-a",
  displayOptions: { quiz: { slot1Exam: null, slot2Exam: null } },
};
assert.deepStrictEqual(
  context.getDailyPostExamMatches(prePublishedPostWithoutExamId, [], "class-a"),
  [],
  "a pre-published DailyPost remains valid before score registration creates an ExamID"
);
assert.deepStrictEqual(
  context.getDailyPostExamMatches(prePublishedPostWithoutExamId, [
    { id: "late-current", examId: "exam-late", date: "2026/8/15小考", sourceClassKey: "class-a" },
    { id: "late-old", examId: "exam-old", date: "2025/8/15小考", sourceClassKey: "class-a" },
  ], "class-a").map(item => item.id),
  ["late-current"],
  "eBook must auto-link a same-class same-date exam that appears after the DailyPost was saved, without resaving the post"
);

assert.strictEqual(context.getTransferFallbackYear({}, { chain: [] }), 0, "missing full anchors must never fall back to the browser year");
assert.strictEqual(context.getTransferDateKey("8/15小考", 0, { chain: [] }, [20260801]), 20260815);
assert.strictEqual(context.getTransferDateKey("8/15小考", 0, { chain: [] }, [20250815, 20260815]), 0, "cross-year legacy ambiguity fails closed");
assert.deepStrictEqual(
  Array.from(context.getHomeworkDateCandidates(
    { rawDate: "12/27", title: "作業" },
    { startDate: new Date(2025, 11, 20), endDate: new Date(2026, 0, 10), fallbackYear: 2025 }
  )).map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]),
  [[2025, 12, 27]],
  "legacy homework range filtering uses the selected full-date range as its cross-year anchor"
);
assert.deepStrictEqual(
  Array.from(context.getHomeworkDateCandidates(
    { rawDate: "1/3", title: "作業" },
    { startDate: new Date(2025, 11, 20), endDate: new Date(2026, 0, 10), fallbackYear: 2025 }
  )).map(date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]),
  [[2026, 1, 3]],
  "January legacy homework resolves to the following year inside a selected rollover range"
);
assert.deepStrictEqual(
  Array.from(context.getHomeworkDateCandidates(
    { rawDate: "2026/2/29", title: "作業" },
    { startDate: new Date(2024, 1, 1), endDate: new Date(2024, 2, 1), fallbackYear: 2024 }
  )),
  [],
  "manual homework range filtering must not reinterpret an invalid full-year date as a legacy leap day"
);
assert.strictEqual(context.getHomeworkDateCandidates.toString().includes("new Date().getFullYear"), false, "legacy homework year inference must not use the device wall-clock year");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.collectDailyPostExamDateAnchorKeysById({
    question: {
      date: "2026/08/15",
      displayOptions: { quiz: { slot1Role: "question", slot1Exam: { targetExamId: "exam-stable" } } },
    },
    answer: {
      date: "2026/08/22",
      displayOptions: { quiz: { slot1Role: "answer", slot1Exam: { targetExamId: "exam-stable" } } },
    },
  }))),
  { "exam-stable": [20260815] },
  "only the explicit question-paper DailyPost anchors a partial grade header"
);

assert.strictEqual(context.ebookFeedbackMatchesExamDate({
  targetExamTitle: "8/15 小考",
  targetDate: "2025/08/15",
}, { date: "2026/08/15" }), false, "full targetDate outranks a partial title token");
assert.strictEqual(context.ebookFeedbackMatchesExamDate({
  targetExamTitle: "8/15 小考",
  targetDate: "2026/08/15",
}, { date: "2026/08/15" }), true);
assert.strictEqual(context.ebookFeedbackMatchesExamDate({
  targetExamTitle: "8/15 小考",
  time: "2025/08/20 18:00:00",
}, { date: "2026/08/15" }), false, "legacy title-only feedback uses its persisted timestamp as a year anchor");

const rolloverExam = { date: "12/31小考" };
const januaryPost = { date: "2027/01/07" };
assert.strictEqual(context.isExamBeforePostDate(rolloverExam, januaryPost), true);
assert.strictEqual(context.isExamOnOrBeforePostDate(rolloverExam, januaryPost), true);
assert.strictEqual(context.getMakeupResultTargetDate(rolloverExam, januaryPost), "2026/12/31");

console.log("eBook full-year date contract smoke passed");
