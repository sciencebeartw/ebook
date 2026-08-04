#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  html,
  /EBOOK_BACKGROUND_RTDB_PAUSE_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/,
  'background RTDB pause must use a five-minute grace period'
);
assert.match(
  html,
  /document\.addEventListener\('visibilitychange',\s*syncEbookRealtimeVisibilityState\)/,
  'visibility changes must control the background pause lifecycle'
);
assert.match(
  html,
  /window\.addEventListener\('pagehide',[\s\S]*?pauseEbookRealtimeConnection\('pagehide'\)/,
  'pagehide must pause the RTDB connection immediately'
);
assert.match(
  html,
  /window\.addEventListener\('pageshow',[\s\S]*?syncEbookRealtimeVisibilityState\(\)/,
  'pageshow must restore the realtime lifecycle without a fresh login'
);
assert.match(
  html,
  /function pauseEbookRealtimeConnection[\s\S]*?db\.goOffline\(\)/,
  'background pause must use the existing RTDB connection instead of signing out'
);
assert.match(
  html,
  /function resumeEbookRealtimeConnection[\s\S]*?db\.goOnline\(\)/,
  'foreground resume must reconnect the existing RTDB listeners'
);
assert.match(
  html,
  /function scheduleEbookBackgroundPause[\s\S]*?document\.visibilityState === 'hidden'[\s\S]*?EBOOK_BACKGROUND_RTDB_PAUSE_MS/,
  'the delayed pause must recheck that the page is still hidden'
);

const pauseBlock = html.slice(
  html.indexOf('function pauseEbookRealtimeConnection'),
  html.indexOf('function scheduleEbookBackgroundPause')
);
assert.doesNotMatch(pauseBlock, /signOut|doLogout|gData\s*=\s*null|gPass\s*=\s*["']/,
  'background pause must preserve the signed-in student session');

const lifecycleStart = html.indexOf('var activeRealtimeListeners = [];');
const lifecycleEnd = html.indexOf('function getDashboardDraftPreviewStorageKey', lifecycleStart);
assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart, 'background lifecycle source must be extractable');

const documentListeners = {};
const windowListeners = {};
const timers = new Map();
let nextTimerId = 1;
let offlineCount = 0;
let onlineCount = 0;
let attachedCount = 0;
let detachedCount = 0;
const context = {
  console: { info() {}, warn() {} },
  document: {
    visibilityState: 'visible',
    addEventListener(name, handler) { documentListeners[name] = handler; },
  },
  window: {
    addEventListener(name, handler) { windowListeners[name] = handler; },
  },
  db: {
    goOffline() { offlineCount += 1; },
    goOnline() { onlineCount += 1; },
    ref() {
      return {
        on() { attachedCount += 1; },
        off() { detachedCount += 1; },
      };
    },
  },
  setTimeout(handler, delay) {
    const id = nextTimerId++;
    timers.set(id, { handler, delay });
    return id;
  },
  clearTimeout(id) { timers.delete(id); },
};
vm.createContext(context);
vm.runInContext(html.slice(lifecycleStart, lifecycleEnd), context);

context.watchRealtimeValue('/science/students/class/student/stickers', function() {});
assert.equal(attachedCount, 1, 'the existing listener helper must still attach exactly once');

context.document.visibilityState = 'hidden';
documentListeners.visibilitychange();
assert.equal(offlineCount, 0, 'short background switches must not disconnect immediately');
assert.equal(timers.size, 1, 'hidden pages must schedule one delayed pause');
const firstTimer = Array.from(timers.values())[0];
assert.equal(firstTimer.delay, 5 * 60 * 1000, 'the delayed pause must wait five minutes');

context.document.visibilityState = 'visible';
documentListeners.visibilitychange();
assert.equal(timers.size, 0, 'returning early must cancel the pending pause');
assert.equal(offlineCount, 0, 'returning before the grace period must keep the connection online');

context.document.visibilityState = 'hidden';
documentListeners.visibilitychange();
const delayedPause = Array.from(timers.values())[0];
timers.clear();
delayedPause.handler();
assert.equal(offlineCount, 1, 'remaining hidden for five minutes must pause RTDB');

context.document.visibilityState = 'visible';
documentListeners.visibilitychange();
assert.equal(onlineCount, 1, 'returning to the foreground must resume RTDB');
assert.equal(attachedCount, 1, 'resuming must reuse listeners instead of attaching duplicates');

context.document.visibilityState = 'hidden';
windowListeners.pagehide();
assert.equal(offlineCount, 2, 'pagehide must pause RTDB immediately');
context.document.visibilityState = 'visible';
windowListeners.pageshow();
assert.equal(onlineCount, 2, 'pageshow must resume a page restored from browser cache');

context.clearRealtimeListeners();
assert.equal(detachedCount, 1, 'normal logout or view changes must still detach listeners');
assert.equal(timers.size, 0, 'clearing listeners must also clear background timers');

console.log('ebook background realtime pause smoke passed');
