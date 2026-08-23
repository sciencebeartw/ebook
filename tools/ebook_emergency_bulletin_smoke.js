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
assert.match(html, /看過了，本裝置不再提醒/, 'normal popups must offer a device-only dismissal action');
assert.match(html, /id="popupDismissButton"[\s\S]{0,160}hidden/, 'the dismissal action must be hidden by default for urgent legacy behavior');
assert.match(html, /本公告有效至/, 'the popup must display its effective-until label');
assert.match(html, /class="emergency-expiry-notice"[\s\S]*id="emergencyExpiresAt"[\s\S]*<\/div>/,
  'the effective-until label must remain in a compact non-interactive notice');
assert.match(html, /\.emergency-expiry-notice\[hidden\]\s*\{\s*display:\s*none;/,
  'hidden popup metadata containers must not leave empty pills behind');
assert.doesNotMatch(html, /彈窗提醒規則|此為重要通知，每次登入都會顯示|已到可略過時間/,
  'popup recurrence rules are admin behavior and must not be shown to families');

const storage = new Map();
let pendingReminderAttempts = 0;
const elements = {
  emergencyModal: { style: { display: 'none' }, dataset: {} },
  emergencyTitle: { textContent: '' },
  emergencyContent: { innerHTML: '' },
  emergencyExpiryNotice: { hidden: false },
  emergencyExpiresAt: { textContent: '' },
  popupCloseButton: { textContent: '' },
  popupDismissButton: { hidden: true },
};
const context = {
  BULLETIN_MARQUEE_COLOR_KEYS: ['blue', 'rose', 'amber', 'emerald', 'violet'],
  BULLETIN_POPUP_TONE_KEYS: ['info', 'notice', 'urgent'],
  BEAR_SUBJECT: '/science',
  gData: { className: '115國一自然超前班', studentName: '學生甲' },
  isDashboardDraftPreviewMode: false,
  pendingEntryNoticeReady: false,
  activeEmergencyAnnouncement: null,
  popupAnnouncementQueue: [],
  popupShownIdentitiesForCurrentEntry: {},
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
  'parseBulletinDisplayOptions',
  'normalizeBulletinMarqueeColor',
  'normalizeBulletinPopupTone',
  'getBulletinDisplayChannels',
  'buildEmergencyIdentity',
  'buildPopupDismissKey',
  'isPopupDismissibleNow',
  'isPopupDismissedOnThisDevice',
  'formatPopupDatetimeText',
  'formatEmergencyExpiryText',
  'resetPopupQueueForEntry',
  'hideEmergencyModal',
  'showNextPopupAnnouncement',
  'checkEmergency',
  'closeEmergencyModal',
  'dismissActivePopupAnnouncement',
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
assert.equal(elements.emergencyModal.dataset.popupTone, 'urgent');
assert.equal(elements.popupCloseButton.textContent, '知道了，關閉公告');
assert.equal(elements.popupDismissButton.hidden, true, 'urgent popup must never offer a persistent dismissal');
assert.equal(elements.emergencyExpiresAt.textContent, '本公告有效至 2099/07/18 14:00');

context.pendingEntryNoticeReady = true;
context.closeEmergencyModal();
assert.equal(elements.emergencyModal.style.display, 'none');
assert.equal(pendingReminderAttempts, 1, 'pending reminder may continue only after the emergency closes');
assert.equal(storage.size, 0, 'the default close action must not persist a dismissal');

context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'none', 'the same live app entry must not immediately reopen the popup');

context.resetPopupQueueForEntry();
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'the next entry must always remind again');
context.closeEmergencyModal();

const firstStudentKey = context.buildEmergencyIdentity(emergency);
storage.set(firstStudentKey, JSON.stringify({ dismissed: true, expiresAt: emergency.expiresAt }));
context.resetPopupQueueForEntry();
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'legacy dismissal records must no longer suppress the popup');
context.closeEmergencyModal();

context.gData = { className: '115國一自然超前班', studentName: '學生乙' };
context.resetPopupQueueForEntry();
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'a different student on the same browser must still see the notice');
assert.notEqual(context.buildEmergencyIdentity(emergency), firstStudentKey, 'entry identities must differ by student');
context.closeEmergencyModal();

context.gData = { className: '115國一自然超前班', studentName: '學生甲' };
context.resetPopupQueueForEntry();
const extendedEmergency = Object.assign({}, emergency, { expiresAt: '2099-07-19 14:00' });
context.checkEmergency([extendedEmergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'an updated announcement must still display');
context.closeEmergencyModal();

context.isDashboardDraftPreviewMode = true;
context.resetPopupQueueForEntry();
context.checkEmergency([emergency]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'Dashboard draft preview must always show the emergency popup');
context.closeEmergencyModal();
assert.equal(storage.size, 1, 'viewing or closing the popup must never add dismissal storage');

context.isDashboardDraftPreviewMode = false;
context.gData = { className: '115國一自然超前班', studentName: '學生甲' };
const ordinary = {
  id: 'bulletin-normal-1',
  time: '2026/08/23 09:00',
  className: '115國一自然超前班',
  type: '一般',
  title: '下課接送提醒',
  content: '建議下課後 10 到 15 分鐘再來接。',
  expiresAt: '2099-08-31 23:59',
  displayOptions: { version: 2, bulletin: true, popup: true, popupTone: 'notice', marquee: true, marqueeColor: 'amber' },
};

context.resetPopupQueueForEntry();
context.checkEmergency([ordinary]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'an undismissed normal popup must open on entry');
assert.equal(elements.emergencyTitle.textContent, '🔔 下課接送提醒');
assert.equal(elements.emergencyModal.dataset.popupTone, 'notice');
assert.equal(elements.popupCloseButton.textContent, '這次先關閉');
assert.equal(elements.popupDismissButton.hidden, false, 'normal popup must offer the device-only dismissal');

const forcedRoutine = Object.assign({}, ordinary, {
  id: 'bulletin-normal-required',
  time: '2026/08/23 09:30',
  displayOptions: { version: 4, bulletin: true, popup: true, popupTone: 'notice', popupDismissMode: 'required-until', popupDismissibleAfter: '2099-08-30 12:00', marquee: false, marqueeColor: 'amber' },
});
context.resetPopupQueueForEntry();
context.checkEmergency([forcedRoutine]);
assert.equal(elements.popupDismissButton.hidden, true, 'a routine popup must not be dismissible before its configured cutoff');
assert.equal(elements.popupCloseButton.textContent, '知道了，關閉公告', 'a mandatory routine popup must use the same concise close label as an urgent popup');
assert.equal(elements.emergencyExpiresAt.textContent, '本公告有效至 2099/08/31 23:59，於 2099/08/30 12:00 後可略過',
  'visible popup metadata must combine the announcement lifetime and the dismissal cutoff');
context.dismissActivePopupAnnouncement();
assert.equal(storage.has(context.buildPopupDismissKey(forcedRoutine)), false, 'calling dismiss early must never persist a dismissal');
context.resetPopupQueueForEntry();
context.checkEmergency([forcedRoutine]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'the mandatory routine popup must return on the next entry');
context.closeEmergencyModal();

const elapsedRoutine = Object.assign({}, forcedRoutine, {
  id: 'bulletin-normal-elapsed',
  displayOptions: Object.assign({}, forcedRoutine.displayOptions, { popupDismissibleAfter: '2000-01-01 00:00' }),
});
context.resetPopupQueueForEntry();
context.checkEmergency([elapsedRoutine]);
assert.equal(elements.popupDismissButton.hidden, false, 'the device-only dismissal must appear after the configured cutoff');
context.closeEmergencyModal();

const beforeNormalCloseStorageSize = storage.size;
context.closeEmergencyModal();
assert.equal(storage.size, beforeNormalCloseStorageSize, 'closing only this entry must not persist a dismissal');
context.resetPopupQueueForEntry();
context.checkEmergency([ordinary]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'normal popup must return on the next entry unless explicitly dismissed');

context.dismissActivePopupAnnouncement();
assert.equal(storage.get(context.buildPopupDismissKey(ordinary)), 'dismissed', 'normal dismissal must be scoped to this announcement and browser');
context.resetPopupQueueForEntry();
context.checkEmergency([ordinary]);
assert.equal(elements.emergencyModal.style.display, 'none', 'dismissed normal popup must stay hidden on this browser');

context.gData = { className: '115國一自然超前班', studentName: '學生乙' };
context.resetPopupQueueForEntry();
context.checkEmergency([ordinary]);
assert.equal(elements.emergencyModal.style.display, 'flex', 'a different student on the same browser must still see the normal popup');
context.closeEmergencyModal();

const permanent = Object.assign({}, ordinary, {
  id: 'bulletin-normal-2',
  time: '2026/08/23 10:00',
  title: '永久班規提醒',
  expiresAt: '',
  displayOptions: { version: 3, bulletin: true, popup: true, popupTone: 'info', showDate: true, showPopupExpiry: false, marquee: false, marqueeColor: 'blue' },
});
context.gData = { className: '115國一自然超前班', studentName: '學生丙' };
context.resetPopupQueueForEntry();
context.checkEmergency([ordinary, permanent]);
assert.equal(elements.emergencyTitle.textContent, 'ℹ️ 永久班規提醒', 'the newest routine popup must appear first');
assert.equal(elements.popupCloseButton.textContent, '這次先關閉，查看下一則', 'the first popup must explain that another notice follows');
assert.equal(elements.emergencyExpiryNotice.hidden, true, 'showPopupExpiry=false must hide the complete popup expiry block independently of the card date');
assert.equal(elements.emergencyExpiresAt.textContent, '', 'hidden popup expiry metadata must not remain in the accessibility tree');
context.closeEmergencyModal();
assert.equal(elements.emergencyTitle.textContent, '🔔 下課接送提醒', 'closing the first popup must advance to the next active popup');
assert.equal(elements.emergencyModal.style.display, 'flex', 'the popup queue must stay open for the next active notice');
assert.equal(elements.emergencyExpiryNotice.hidden, false, 'a later popup may restore the complete expiry block');
context.closeEmergencyModal();
assert.equal(elements.emergencyModal.style.display, 'none', 'the modal closes only after the popup queue is exhausted');
assert.equal(context.formatEmergencyExpiryText({ expiresAt: '' }), '本公告永久有效', 'an empty expiry must have an explicit permanent meaning');
assert.equal(context.formatEmergencyExpiryText({
  expiresAt: '',
  type: '一般',
  displayOptions: { version: 4, popup: true, popupTone: 'notice', popupDismissMode: 'required-until', popupDismissibleAfter: '2026-08-30 12:00' },
}), '本公告永久有效，於 2026/08/30 12:00 後可略過',
  'a permanent routine announcement must tell families when its reminder can be skipped');
assert.equal(context.formatEmergencyExpiryText(Object.assign({}, emergency, {
  displayOptions: { version: 4, popup: true, popupTone: 'urgent', popupDismissMode: 'required-until', popupDismissibleAfter: '2099-07-17 14:00' },
})), '本公告有效至 2099/07/18 14:00',
  'urgent announcements must show only their effective lifetime');

context.resetPopupQueueForEntry();
context.checkEmergency([
  Object.assign({}, forcedRoutine, { id: 'mandatory-older', time: '2099/08/23 09:00' }),
  Object.assign({}, emergency, { id: 'urgent-newer', time: '2099/08/23 10:00' }),
]);
assert.equal(elements.popupCloseButton.textContent, '知道了，顯示下一則',
  'a non-dismissible popup with another queued announcement must use the concise next label');
context.closeEmergencyModal();
assert.equal(elements.popupCloseButton.textContent, '知道了，關閉公告',
  'the final non-dismissible popup must return to the concise close label');
context.closeEmergencyModal();

console.log('ebook emergency bulletin smoke passed');
