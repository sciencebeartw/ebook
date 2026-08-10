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
assert.match(html, /queue = \[\{ classKey: currentClassKey, studentKey: studentKey \}\]/, "lifecycle traversal must carry the current student key");
assert.match(html, /item\.sourceStudentKey \|\| destinationStudentKey/, "each historical hop must carry its source student key");
assert.match(html, /loadStudentEnrollmentIndexForStudent\(entry\.classKey, entry\.studentKey\)/, "enrollment reads must use each class-scoped student key");
assert.match(html, /adminModeDirectMessageContext\[directContextKey\][\s\S]*storedStudentKey:\s*post\.sourceStudentKey/, "old-post direct message context must retain the exact source student key");
assert.match(html, /sendEbookGodDirectMessage[\s\S]*storedStudentKey:\s*context\.storedStudentKey/, "old-post direct message must send the exact source student key back to the callable");
assert.match(html, /sciencebear\.dashboard\.ebookFeedbackJobs\.v1/, "god-mode feedback jobs must be handed back to the Dashboard work center");
assert.match(html, /rememberAdminFeedbackJobForDashboard\(result\)/, "god-mode reply and direct message must remember their durable background job");
assert.match(html, /已排入後端佇列，可安全離開/, "god-mode feedback UI must say queued instead of claiming delivery completed");
assert.match(html, /sourceStudentKey:\s*\(post && post\.sourceStudentKey\)/, "historical homework completion must send the exact source student key");

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
  "getStudentKeysForClass",
  "getHomeworkDoneCourseAliasKey",
  "getHomeworkDoneRelatedClassKeyCandidates",
  "mergeHomeworkDoneForStudentByKeys",
  "listActiveIncomingTransfers",
  "getTransferBySourceClassKey",
  "getTransferDateKey",
  "getTransferFallbackYear",
  "getTransferClassNameForKey",
  "shouldIncludeTransferGrade",
  "getTransferGradePresentation",
  "shouldIncludeTransferPost",
  "resolveTransferStudentAtDate",
  "mergeDailyPostClassNodeByKeys",
  "mergeStudentChildNodeByKeys",
  "mergeGradeExamNodeMap",
  "buildFeedbackHistoryList",
].forEach(name => vm.runInContext(extractFunction(name), context));

const transfers = {
  enterB: { id: "enterB", studentKey: "student", fromClassKey: "A", fromClassName: "A 班", toClassKey: "B", toClassName: "B 班", effectiveDate: "2026-07-01", status: "active" },
  returnA: { id: "returnA", studentKey: "student", fromClassKey: "B", fromClassName: "B 班", toClassKey: "A", toClassName: "A 班", effectiveDate: "2026-07-10", status: "active" },
};

const keyChangingChain = EbookLifecycleApp.buildTransferChain({
  bToC: { id: "bToC", studentKey: "key3", sourceStudentKey: "key2", fromClassKey: "B", toClassKey: "C", effectiveDate: "2026-07-10", status: "active" },
  aToB: { id: "aToB", studentKey: "key2", sourceStudentKey: "key1", fromClassKey: "A", toClassKey: "B", effectiveDate: "2026-07-01", status: "active" },
}, "C");
assert.deepStrictEqual(
  keyChangingChain.chain.map(item => [item.studentKey, item.sourceStudentKey]),
  [["key3", "key2"], ["key2", "key1"]],
  "normalized transfer chain must preserve key changes across two hops"
);
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

const sameCohortTransferChain = EbookLifecycleApp.buildTransferChain({
  moved: {
    id: "moved",
    studentKey: "new-key",
    sourceStudentKey: "old-key",
    fromClassKey: "114國一自然超前班",
    fromClassName: "114國一自然超前班",
    toClassKey: "115國二自然超前班",
    toClassName: "115國二自然超前班",
    effectiveDate: "2026-07-10",
    status: "active",
  },
}, "115國二自然超前班");
const sameCohortTransferPosts = context.mergeDailyPostClassNodeByKeys({
  "114國一自然超前班": {
    oldPost: { date: "2026-07-01", title: "old class" },
  },
}, ["114國一自然超前班"], "115國二自然超前班", {}, "115國二自然超前班", sameCohortTransferChain, "new-key");
assert.strictEqual(sameCohortTransferPosts.oldPost.isTransferFormerClass, true, "an explicit transfer must remain read-only even when both classes share a promotion alias");
assert.strictEqual(sameCohortTransferPosts.oldPost.sourceStudentKey, "old-key");

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
assert.strictEqual(history[0].storedStudentKey, "student");

const keyChangingFeedback = context.mergeStudentChildNodeByKeys(
  {
    A: { key1: { oldA: { time: "2026/06/20 18:00:00", targetDate: "2026/06/20", type: "學生留言", content: "A" } } },
    B: { key2: { middleB: { time: "2026/07/05 18:00:00", targetDate: "2026/07/05", type: "學生留言", content: "B" } } },
    C: { key3: { currentC: { time: "2026/07/12 18:00:00", targetDate: "2026/07/12", type: "學生留言", content: "C" } } },
  },
  ["A", "B", "C"],
  "key3",
  {},
  "C 班",
  "C",
  keyChangingChain,
  { A: "A 班", B: "B 班", C: "C 班" },
  { A: ["key1"], B: ["key2"], C: ["key3"] }
);
assert.deepStrictEqual(
  Object.keys(keyChangingFeedback).sort(),
  ["currentC", "middleB", "oldA"],
  "feedback merge must read every class with its historical student key"
);
const keyChangingHomeworkDone = context.mergeHomeworkDoneForStudentByKeys(
  {
    A: { key1: { "2026-06-20": { status: "done" } } },
    B: { key2: { "2026-07-05": { status: "done" } } },
    C: { key3: { "2026-07-12": { status: "done" } } },
  },
  ["A", "B", "C"],
  "key3",
  { A: ["key1"], B: ["key2"], C: ["key3"] }
);
assert.deepStrictEqual(
  Object.keys(keyChangingHomeworkDone).sort(),
  ["2026-06-20", "2026-07-05", "2026-07-12"],
  "homeworkDone merge must keep completion records stored under historical keys"
);
const keyChangingGrades = context.mergeGradeExamNodeMap(
  {
    A: { key1: { col_5: { score: "80" } } },
    B: { key2: { col_6: { score: "85" } } },
    C: { key3: { col_7: { score: "90" } } },
  },
  ["A", "B", "C"],
  "key3",
  { A: ["key1"], B: ["key2"], C: ["key3"] }
);
assert.strictEqual(keyChangingGrades.A.col_5.score, "80");
assert.strictEqual(keyChangingGrades.B.col_6.score, "85");
assert.strictEqual(keyChangingGrades.C.col_7.score, "90");
assert.strictEqual(keyChangingGrades.A.col_5.sourceStudentKey, "key1");

console.log("ebook lifecycle integration smoke passed");
