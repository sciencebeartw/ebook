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

assert.match(html, /知道了，關閉公告/, 'the popup must provide one clear close action');
assert.doesNotMatch(html, /不再顯示/, 'students must not be offered a persistent opt-out');
assert.doesNotMatch(html, /dismissEmergencyUntilExpiry/, 'the persistent opt-out handler must be removed');
assert.match(html, /本公告有效至/, 'the popup must display its effective-until label');
assert.match(html, /class="emergency-expiry-notice"[\s\S]*id="emergencyExpiresAt"[\s\S]*<\/div>/,
  'the effective-until label must remain in a compact non-interactive notice');

const storage = new Map();
let pendingReminderAttempts = 0;
const elements = {
  emergencyModal: { style: { display: 'none' } },
  emergencyTitle: { textContent: '' },
  emergencyContent: { innerHTML: '' },
  emergencyExpiresAt: { textContent: '' },
};
const context = {
  BEAR_SUBJECT: '/science',
  gData: { className: '115國一自然超前班', studentName: '學生甲' },
  isDashboardDraftPreviewMode: false,
  emergencyShownIdentityForCurrentEntry: '',
  activeEmergencyAnnouncement: null,
  maybeShowPendingEntryReminder() { pendingReminderAttempts += 1; },
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
  'buildEmergencyIdentity',
  'formatEmergencyExpiryText',
  'hideEmergencyModal',
  'checkEmergency',
  'closeEmergencyModal',
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

context.closeEmergencyModal();
assert.equal(elements.emergencyModal.style.display, 'none');
assert.equal(pendingReminderAttempts, 1, 'pending reminder may continue only after the emergency closes');
assert.equal(storage.size, 0, 'the default close action must not persist a dismissal');

context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'none', 'the same live app entry must not immediately reopen the popup');

context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'the next entry must always remind again');
context.closeEmergencyModal();

const firstStudentKey = context.buildEmergencyIdentity(emergency);
storage.set(firstStudentKey, JSON.stringify({ dismissed: true, expiresAt: emergency.expiresAt }));
context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'legacy dismissal records must no longer suppress the popup');
context.closeEmergencyModal();

context.gData = { className: '115國一自然超前班', studentName: '學生乙' };
context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'a different student on the same browser must still see the notice');
assert.notEqual(context.buildEmergencyIdentity(emergency), firstStudentKey, 'entry identities must differ by student');
context.closeEmergencyModal();

context.gData = { className: '115國一自然超前班', studentName: '學生甲' };
context.emergencyShownIdentityForCurrentEntry = '';
const extendedEmergency = Object.assign({}, emergency, { expiresAt: '2099-07-19 14:00' });
context.checkEmergency([extendedEmergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'an updated announcement must still display');
context.closeEmergencyModal();

context.isDashboardDraftPreviewMode = true;
context.emergencyShownIdentityForCurrentEntry = '';
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'Dashboard draft preview must always show the emergency popup');
context.closeEmergencyModal();
assert.equal(storage.size, 1, 'viewing or closing the popup must never add dismissal storage');

console.log('ebook emergency bulletin smoke passed');
