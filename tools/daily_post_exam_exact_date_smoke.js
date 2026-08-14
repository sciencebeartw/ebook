#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `missing ${name}`);
  const brace = html.indexOf("{", start);
  let depth = 0;
  let quote = "";
  for (let i = brace; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = {
  isGradeFromPostSource: (grade, sourceClassKey) => !sourceClassKey || grade.sourceClassKey === sourceClassKey,
  isDailyPostExamGrade: grade => /小考|複習考/.test(`${grade.date || ""}${grade.exam || ""}`),
};
vm.createContext(context);
["isValidEbookExamLookupDate", "getEbookExamLookupDateParts", "getDailyPostExamMatches"].forEach(name => {
  vm.runInContext(extractFunction(name), context);
});

const grades = [
  { date: "5/3小考", exam: "生物第一章", score: "98", sourceClassKey: "class-a" },
  { date: "4/26作業", exam: "生物第一章", score: "44", sourceClassKey: "class-a" },
  { date: "7/5複習考", exam: "生物第1-8章複習考", score: "92", sourceClassKey: "class-a" },
];
const july12Post = {
  date: "2026/07/12",
  sourceClassKey: "class-a",
  progress: "理化第二章-科學的根本",
  quiz: "小考 理化第一章 物質的基本結構",
};
assert.deepStrictEqual(Array.from(context.getDailyPostExamMatches(july12Post, grades, "class-a")), [], "a newly published post must not borrow an older same-chapter exam");

const withTodayExam = grades.concat([{ date: "7/12小考", dateKey: 20260712, exam: "理化第一章", score: "95", sourceClassKey: "class-a" }]);
const matched = Array.from(context.getDailyPostExamMatches(july12Post, withTodayExam, "class-a"));
assert.strictEqual(matched.length, 1);
assert.strictEqual(matched[0].score, "95");
assert.deepStrictEqual(Array.from(context.getDailyPostExamMatches(july12Post, withTodayExam, "class-b")), [], "a post must not borrow another class source");

assert.ok(!html.includes("chapterMatches"), "chapter-only daily-post fallback must stay removed");
console.log("daily post exam exact-date smoke passed");
