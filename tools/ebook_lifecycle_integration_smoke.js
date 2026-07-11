#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const EbookLifecycleApp = require("../ebook_lifecycle_app.js");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
assert.match(html, /baseTrackedClassKeys\.forEach[\s\S]*getHomeworkDoneRelatedClassKeyCandidates\(baseClassKey\)/, "every transfer source must expand its verified promotion aliases");
assert.match(html, /sessionAllowedClassKeys\[candidateClassKey\] === true/, "promotion aliases must remain constrained to server-authorized class keys");
assert.match(html, /sourceClassName: resolveStudentActionSourceClassName\(realDate\)/, "student actions must target the physical post class");
assert.match(html, /post\.storedClassName \|\| post\.sourceClassName/, "student action source must prefer physical post storage over presentation class");
assert.match(html, /作業完成回報讀取失敗，為避免把已完成誤顯示為未完成/, "homeworkDone read failures must fail closed");

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
  EbookLifecycleApp,
  BEAR_SUBJECT: "/science",
  Date,
  Object,
});
[
  "uniqueClassKeys",
  "getHomeworkDoneCourseAliasKey",
  "getHomeworkDoneRelatedClassKeyCandidates",
  "listActiveIncomingTransfers",
  "getTransferBySourceClassKey",
  "getTransferDateKey",
  "getTransferFallbackYear",
  "getTransferClassNameForKey",
  "shouldIncludeTransferGrade",
  "getTransferGradePresentation",
  "shouldIncludeTransferPost",
  "mergeDailyPostClassNodeByKeys",
  "mergeStudentChildNodeByKeys",
  "buildFeedbackHistoryList",
].forEach(name => vm.runInContext(extractFunction(name), context));

const transfers = {
  enterB: { id: "enterB", studentKey: "student", fromClassKey: "A", fromClassName: "A 班", toClassKey: "B", toClassName: "B 班", effectiveDate: "2026-07-01", status: "active" },
  returnA: { id: "returnA", studentKey: "student", fromClassKey: "B", fromClassName: "B 班", toClassKey: "A", toClassName: "A 班", effectiveDate: "2026-07-10", status: "active" },
};
const chain = EbookLifecycleApp.buildTransferChain(transfers, "A");
assert.strictEqual(
  context.getTransferClassNameForKey("114國一自然超前班", "115國二自然超前班", {}, "115國二自然超前班"),
  "114國一自然超前班",
  "a promotion alias grade must retain its physical storage class name"
);

const posts = context.mergeDailyPostClassNodeByKeys({
  A: {
    originalA: { date: "2026-06-20", title: "A first period" },
    wrongA: { date: "2026-07-05", title: "must not use A while in B" },
    returnedA: { date: "2026-07-11", title: "A second period" },
  },
  B: {
    middleB: { date: "2026-07-05", title: "B period" },
  },
}, ["A", "B"], "A", transfers, "A 班", chain);

assert.ok(posts.originalA, "A->B->A must keep the first A period");
assert.ok(posts.returnedA, "A->B->A must keep the returned A period");
assert.ok(posts.middleB, "A->B->A must keep the middle B period");
assert.ok(!posts.wrongA, "a class post outside that class interval must be excluded");
assert.strictEqual(posts.originalA.sourceClassKey, "A");
assert.strictEqual(posts.originalA.storedClassName, "A");
assert.strictEqual(posts.middleB.sourceClassKey, "B");

const before = context.getTransferGradePresentation("A", "A", { date: "2026-06-20" }, transfers, "A 班", "A 班", chain);
const middle = context.getTransferGradePresentation("A", "A", { date: "2026-07-05" }, transfers, "A 班", "A 班", chain);
assert.strictEqual(before.sourceClassKey, "A", "pre-first-transfer grade must present as A");
assert.strictEqual(middle.sourceClassKey, "B", "current-row copied grade must present by lifecycle date");
assert.strictEqual(middle.storedClassKey, "A", "presentation must not overwrite the actual grade storage class");

const feedbackRoot = {
  A: {
    student: {
      feedback1: { time: "2026/07/05 18:00:00", targetDate: "2026/07/05", type: "學生留言", content: "我有留言" },
    },
  },
};
const mergedFeedback = context.mergeStudentChildNodeByKeys(
  feedbackRoot,
  ["A", "B"],
  "student",
  transfers,
  "A 班",
  "A",
  chain,
  { A: "A 班", B: "B 班" }
);
assert.strictEqual(mergedFeedback.feedback1.storedClassKey, "A");
assert.strictEqual(mergedFeedback.feedback1.sourceClassKey, "B", "feedback must display on the class card active on its date");
const history = context.buildFeedbackHistoryList(mergedFeedback);
assert.strictEqual(history[0].storedClassName, "A 班");
assert.strictEqual(history[0].sourceClassName, "B 班");

console.log("ebook lifecycle integration smoke passed");
