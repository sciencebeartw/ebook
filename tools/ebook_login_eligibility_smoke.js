#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing function ${name}`);
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  for (let i = braceStart; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

const context = {};
vm.createContext(context);
vm.runInContext(extractFunction('getStudentLoginFailureMessage'), context);

if (context.getStudentLoginFailureMessage({ message: 'PERMISSION_DENIED: 此班級目前未開放電子聯絡簿' }) !== '此班級目前未開放電子聯絡簿。') {
  throw new Error('blocked classes must show the dedicated eBook availability message');
}
if (context.getStudentLoginFailureMessage({ message: 'network unavailable' }) !== '連線錯誤：network unavailable') {
  throw new Error('unrelated login failures must keep the connection error message');
}

console.log('ebook_login_eligibility_smoke.js passed');
