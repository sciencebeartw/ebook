#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("index.html", "utf8");

function extractFunction(name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("missing " + name);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated " + name);
}

const context = vm.createContext({
  Number,
  String,
  EBOOK_SCORE_MAX: 200,
  window: { adminModeScoreEditContext: {} },
  escapeAdminHtml: value => String(value)
});
for (const name of ["getGodEditableScoreInfo", "getGodScoreHumanLabel", "buildGodScoreEditBox"]) {
  vm.runInContext(extractFunction(name), context);
}

let info = context.getGodEditableScoreInfo("92假");
assert.deepStrictEqual(JSON.parse(JSON.stringify(info)), {
  storedScore: "92假",
  numericScore: "92",
  hasAbsenceMarker: true
});
assert.strictEqual(context.getGodScoreHumanLabel("92假"), "92（請假回報）");
assert.strictEqual(context.getGodEditableScoreInfo("105假").numericScore, "105");
assert.strictEqual(context.getGodEditableScoreInfo("201假"), null);

context.window.adminModeScoreEditContext.absent = {
  currentScore: "92假",
  canEditAbsenceMarker: true
};
let html = context.buildGodScoreEditBox("absent");
assert.match(html, /type='number'/);
assert.match(html, /max='200'/);
assert.match(html, /value='92'/);
assert.doesNotMatch(html, /value='92假'/);
assert.match(html, /保留「請假回報」註記/);
assert.match(html, /checked/);
assert.match(html, /目前 92（請假回報）/);

context.window.adminModeScoreEditContext.regular = {
  currentScore: "85",
  canEditAbsenceMarker: false
};
html = context.buildGodScoreEditBox("regular");
assert.match(html, /value='85'/);
assert.doesNotMatch(html, /god-score-edit-absence-/);

const displayLogic = extractFunction("getDisplayLogic");
assert.match(displayLogic, /data-absence-score-tag='1'/);
assert.match(displayLogic, /請假回報/);
assert.match(displayLogic, /result\.mainScore = sheetNum/);

const writeCorrection = extractFunction("writeGodScoreCorrection");
assert.match(writeCorrection, /absenceInput\.checked/);
assert.match(writeCorrection, /nextScore = nextNumericScore \+ \(keepAbsenceMarker \? '假' : ''\)/);
assert.match(writeCorrection, /scoreNode\.textContent = nextNumericScore/);
assert.doesNotMatch(writeCorrection, /scoreNode\.textContent = nextScore/);
assert.match(writeCorrection, /closest\('\.god-score-edit-box'\)/);
assert.match(writeCorrection, /系統正在背景補上雲端顯示，可繼續處理其他學生/);

console.log("eBook score correction UI smoke passed");
