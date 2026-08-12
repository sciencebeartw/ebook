#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

[
  'id="pwaHomeGuideEntry"',
  'class="pwa-home-guide-button"',
  'onclick="openEbookPwaInstallGuide()"',
  'window.openEbookPwaInstallGuide = function()',
  'window.syncEbookPwaHomeGuide = function()',
  'window.ebookPwaGuideHtml = pwaBtn',
  'class="pwa-install-animation"',
  "isMobile && !isStandalone && !isPreview ? 'block' : 'none'"
].forEach(marker => assert.ok(html.includes(marker), `missing PWA home guide marker: ${marker}`));

const start = html.indexOf('window.syncEbookPwaHomeGuide = function()');
const end = html.indexOf('function startDetection()', start);
const syncBlock = html.slice(start, end);
assert.doesNotMatch(syncBlock, /firebase|\.once\(|\.on\(|httpsCallable|google\.script\.run/, 'PWA visibility must remain local-only');
const loginStart = html.indexOf('<div id="login-screen">');
const mainStart = html.indexOf('<div id="main-screen">');
const entryIndex = html.indexOf('id="pwaHomeGuideEntry"');
assert.ok(entryIndex > loginStart && entryIndex < mainStart, 'install guide entry must live on the login screen');
assert.ok(html.indexOf("syncEbookPwaHomeGuide === 'function'") < loginStart, 'app startup must refresh login-page guide visibility');

console.log('ebook_pwa_home_guide_smoke.js OK');
