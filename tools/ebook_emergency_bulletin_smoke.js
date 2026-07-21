#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing function ${name}`);
  const braceStart = html.indexOf('{', start + marker.length);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let regexLiteral = false;
  let regexClass = false;
  let previousSignificant = '';

  for (let index = braceStart; index < html.length; index += 1) {
    const char = html[index];
    const next = html[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (regexLiteral) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '[') regexClass = true;
      else if (char === ']') regexClass = false;
      else if (char === '/' && !regexClass) {
        regexLiteral = false;
        previousSignificant = '/';
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && (!previousSignificant || /[=(:,!&|?{\[;]/.test(previousSignificant))) {
      regexLiteral = true;
      regexClass = false;
      escaped = false;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
    if (!/\s/.test(char)) previousSignificant = char;
  }
  throw new Error(`Unterminated function ${name}`);
}

assert.match(html, /知道了，下次仍提醒/, 'the default action must keep future reminders enabled');
assert.match(html, /有效期間內不再顯示/, 'the explicit opt-out action must be visible');
assert.match(html, /本公告有效至/, 'the popup must display its effective-until label');
assert.match(html, /id="emergencyDismissUntilExpiryBtn"[\s\S]*id="emergencyExpiresAt"[\s\S]*<\/button>/,
  'the effective-until label must be rendered inside the compact opt-out button');
assert.match(html, /為避免忘記重要訊息[^<]*下次重新進入聯絡簿時仍會提醒/,
  'the reminder explanation must state why the popup appears again');

const storage = new Map();
const elements = {
  emergencyModal: { style: { display: 'none' } },
  emergencyTitle: { textContent: '' },
  emergencyContent: { innerHTML: '' },
  emergencyExpiresAt: { textContent: '' },
  emergencyDismissUntilExpiryBtn: { disabled: false, title: '' },
};
const context = {
  BEAR_SUBJECT: '/science',
  gData: { className: '115國一自然超前班', studentName: '學生甲' },
  isDashboardDraftPreviewMode: false,
  emergencyShownIdentityForCurrentEntry: '',
  activeEmergencyAnnouncement: null,
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  },
  document: {
    getElementById(id) { return elements[id] || null; },
  },
  parseBtn(value) { return String(value || ''); },
};
vm.createContext(context);
[
  'parseLocalDateTimeValue',
  'isBulletinEffective',
  'buildEmergencyDismissKey',
  'isEmergencyDismissedUntilExpiry',
  'formatEmergencyExpiryText',
  'hideEmergencyModal',
  'checkEmergency',
  'closeEmergencyModal',
  'dismissEmergencyUntilExpiry',
].forEach(name => vm.runInContext(extractFunction(name), context));

const emergency = {
  id: 'bulletin-1',
  time: '2026/07/11 16:14',
  className: '115國一自然超前班',
  type: '緊急',
  title: '下次鑑定考',
  content: '請記得下次上課時間',
  reserveTime: '2026-07-11 13:00',
  expiresAt: '2099-07-18 14:00',
};

context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'an active emergency must open on entry');
assert.equal(elements.emergencyTitle.textContent, '⚠️ 下次鑑定考');
assert.equal(elements.emergencyExpiresAt.textContent, '本公告有效至 2099/07/18 14:00');
assert.equal(elements.emergencyDismissUntilExpiryBtn.disabled, false);

context.closeEmergencyModal();
assert.equal(elements.emergencyModal.style.display, 'none');
assert.equal(storage.size, 0, 'the default close action must not persist a dismissal');

context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'the next entry must remind again after the default action');
context.dismissEmergencyUntilExpiry();
assert.equal(elements.emergencyModal.style.display, 'none');
assert.equal(storage.size, 1, 'the explicit opt-out must persist exactly one scoped dismissal');

const firstStudentKey = context.buildEmergencyDismissKey(emergency);
assert.ok(storage.has(firstStudentKey), 'the persisted dismissal must use the active student scope');
context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'none', 'the same student must stay opted out during the same expiry');

context.gData = { className: '115國一自然超前班', studentName: '學生乙' };
context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'a different student on the same browser must still see the notice');
assert.notEqual(context.buildEmergencyDismissKey(emergency), firstStudentKey, 'dismissal keys must differ by student');
context.closeEmergencyModal();

context.gData = { className: '115國一自然超前班', studentName: '學生甲' };
context.emergencyShownIdentityForCurrentEntry = '';
const extendedEmergency = Object.assign({}, emergency, { expiresAt: '2099-07-19 14:00' });
context.checkEmergency([extendedEmergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'changing the effective-until time must invalidate the old opt-out');
context.closeEmergencyModal();

context.isDashboardDraftPreviewMode = true;
context.emergencyShownIdentityForCurrentEntry = '';
const storageSizeBeforeDraft = storage.size;
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'Dashboard draft preview must always show the emergency popup');
context.dismissEmergencyUntilExpiry();
assert.equal(storage.size, storageSizeBeforeDraft, 'Dashboard draft preview must never persist an opt-out');

console.log('ebook emergency bulletin smoke passed');
