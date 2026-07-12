#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = {};
vm.createContext(context);
vm.runInContext(extractFunction(html, "createStableEbookRequestId"), context);

const baseParts = ["/science", "115國二自然超前班", "張櫻芳", "2026/07/04", "補考結果回報", "錯 0 題", "exam_12345678-1234-4abc-8def-1234567890ab", "5", "7/4小考 力與平衡、摩擦力木"];
const first = context.createStableEbookRequestId("makeup_result", baseParts);
const retry = context.createStableEbookRequestId("makeup_result", baseParts.slice());
const changed = context.createStableEbookRequestId("makeup_result", baseParts.map((value, index) => index === 5 ? "錯 1 題" : value));
assert.strictEqual(first, retry, "the same makeup result must reuse one stable request id across retries");
assert.notStrictEqual(first, changed, "a changed wrong-count result must have a distinct request id");
const differentExam = context.createStableEbookRequestId("makeup_result", baseParts.map((value, index) => index === 6 ? "exam_87654321-4321-4abc-8def-ba0987654321" : value));
assert.notStrictEqual(first, differentExam, "different exam IDs must have distinct stable request IDs");
assert(first.length <= 128, "stable request id must fit the GAS metadata limit");

const submit = extractFunction(html, "submitMakeupResultReport");
assert(submit.includes('createStableEbookRequestId("makeup_result"'), "makeup result submissions must use the stable idempotency key");
assert(submit.includes('form.targetExamId || ""'), "stable makeup request IDs must include targetExamId when available");
assert(submit.includes("currentExam.examId || currentExam.targetExamId"), "makeup result submissions must carry the current stable exam ID");
assert(submit.includes("appendLocalScoreReportFeedback(form, res)"), "successful makeup result submission must immediately update local history and hide the form");
assert(html.includes("class='god-direct-score-input'"), "God view direct score field must use its width-safe class");
assert(html.includes("class='admin-btn btn-green god-direct-score-btn'"), "God view direct score button must not inherit full-width admin button sizing");
assert(html.includes("grid-template-columns: minmax(140px, 1fr) auto"), "desktop score controls must reserve readable input width");

const driftContext = {
  gData: {
    grades: [
      { colIndex: 6, date: "7/4小考", exam: "力與平衡、摩擦力木" },
      { colIndex: 7, date: "7/4回家練習卷", exam: "力與平衡、摩擦力" },
    ],
  },
  isExamScoreTitle: () => true,
  ebookFeedbackMatchesExam: (feedback, exam) => feedback.targetDate === "2026/07/04" && feedback.targetExamTitle === `${exam.date} ${exam.exam}`,
};
vm.createContext(driftContext);
vm.runInContext(extractFunction(html, "isUniqueEbookFeedbackExamMatch"), driftContext);
const driftedReport = { targetDate: "2026/07/04", targetExamColIndex: "5", targetExamTitle: "7/4小考 力與平衡、摩擦力木" };
assert.strictEqual(driftContext.isUniqueEbookFeedbackExamMatch(driftedReport, driftContext.gData.grades[0]), true, "a drifted column may repair to one exact date-title match");
driftContext.gData.grades.push({ colIndex: 8, date: "7/4小考", exam: "力與平衡、摩擦力木" });
assert.strictEqual(driftContext.isUniqueEbookFeedbackExamMatch(driftedReport, driftContext.gData.grades[0]), false, "duplicate exact headers must fail closed instead of hiding the wrong report");
const reportLookup = extractFunction(html, "getLatestMakeupResultReportInfo");
assert(reportLookup.includes("sameStableExamId"), "makeup result history must prefer stable exam ID matching");
assert(reportLookup.includes("examId && feedbackExamId && !sameStableExamId"), "different stable exam IDs must fail closed");
assert(reportLookup.includes("!sameStoredCol && !isUniqueEbookFeedbackExamMatch(fb, exam)"), "makeup result history must repair a stale column only through a unique exact match");

const stableIdContext = {
  normalizeEbookFeedbackExamId: value => /^exam_/.test(value || "") ? value : "",
  isMakeupResultReportType: type => type === "補考結果回報",
  isUniqueEbookFeedbackExamMatch: () => false,
  normalizeEbookExamLookupText: value => String(value || "").trim(),
  ebookFeedbackMatchesExam: () => false,
  ebookFeedbackMatchesExamDate: () => false,
  getMakeupResultReportDisplayText: value => value,
  isMakeupResultWrongCountContent: () => true,
};
vm.createContext(stableIdContext);
vm.runInContext(reportLookup, stableIdContext);
const stableExam = { colIndex: 12, examId: baseParts[6], date: "6/21小考", exam: "生物第8章前半" };
const shiftedStableFeedback = [{
  type: "補考結果回報",
  targetExamId: baseParts[6],
  targetExamColIndex: "11",
  targetExamTitle: "已位移的舊標題",
  content: "錯 4 題",
}];
assert(stableIdContext.getLatestMakeupResultReportInfo(stableExam, shiftedStableFeedback), "matching exam IDs must survive column and title drift");
assert.strictEqual(stableIdContext.getLatestMakeupResultReportInfo(stableExam, [{ ...shiftedStableFeedback[0], targetExamId: "exam_87654321-4321-4abc-8def-ba0987654321" }]), null, "different exam IDs must never hide the form");

console.log("ebook makeup result idempotency/UI smoke passed");
