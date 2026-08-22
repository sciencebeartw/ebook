const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert(start >= 0, `missing function ${name}`);
  const braceStart = html.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = braceStart; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

const pendingExam = extractFunction("shouldShowMakeupResultReportExam");
assert(pendingExam.includes("getMakeupColorInfo(exam.cellColor)"), "teacher registration must hide makeup editing");
assert(!pendingExam.includes("getLatestMakeupResultReportInfo"), "an unreviewed report must remain visible in the contact book");

const pendingTasks = fs.readFileSync(path.join(__dirname, "..", "ebook_pending_tasks_app.js"), "utf8");
assert(pendingTasks.includes("hasResultColor(exam, helpers) || resultReport) return;"), "a submitted makeup report must still leave pending tasks immediately");

const examCard = extractFunction("buildDailyPostExamCard");
assert(examCard.includes("logic.showReviewing && !isAdminMode"), "absence editing must be limited to the unreviewed student state");
assert(examCard.includes("getLatestMakeupReportInfo(exam, history)"), "absence editing must require an existing report");
assert(examCard.includes("修改回報"), "absence edit action is missing");

const makeupHtml = extractFunction("buildPendingMakeupResultReportHtml");
assert(makeupHtml.includes("修改錯題數"), "makeup edit action is missing");
assert(makeupHtml.includes("getMakeupResultWrongCount(report.content)"), "makeup editor must prefill the latest wrong count");

const scoreSubmit = extractFunction("submitScoreReport");
assert(scoreSubmit.includes('isUpdate ? "更新" : "送出"'), "absence updates must preserve the original form and use a clear update label");
const makeupSubmit = extractFunction("submitMakeupResultReport");
assert(makeupSubmit.includes('isUpdate ? "更新錯題數" : "送出錯題數"'), "makeup updates must preserve the original wrong-count widget");
assert(makeupSubmit.includes("appendLocalScoreReportFeedback(form, res)"), "makeup updates must recompute local contact-book and pending state immediately");
assert(html.includes(".pending-report-edit-btn[hidden]"), "the compact edit action must disappear while its original form is open");

assert((html.match(/<details class="compact-student-tool/g) || []).length === 3, "the three low-frequency tools must each have one compact disclosure row");
assert(html.includes("作業／筆記上傳區") && html.includes("棒卡申請") && html.includes("我會改進"), "compact tool labels are incomplete");
assert(html.includes(".compact-student-tool-body > .student-upload-box"), "expanded upload must retain the existing full upload component");

const editorFn = extractFunction("showPendingReportEditor");
const editor = { hidden: true };
const input = { focused: false, selected: false, focus() { this.focused = true; }, select() { this.selected = true; } };
const trigger = { hidden: false };
const context = {
  trigger,
  document: {
    getElementById(id) {
      if (id === "editor") return editor;
      if (id === "input") return input;
      return null;
    },
  },
};
vm.runInNewContext(`${editorFn}; showPendingReportEditor("editor", "input", trigger);`, context);
assert(editor.hidden === false && trigger.hidden === true, "opening an edit form must replace the compact edit action");
assert(input.focused && input.selected, "opening an edit form must focus and select the current value");

console.log("ebook pending report edit and compact tools smoke passed");
