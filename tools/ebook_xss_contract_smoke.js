#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const MARKER = 'ebookXssMarker';
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function extractFunction(name) {
  const marker = `function ${name}`;
  let start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing function ${name}`);
  if (html.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
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

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function inspectRenderedHtml(rendered, label) {
  const tags = String(rendered || '').match(/<[^>]*>/g) || [];
  tags.forEach(tag => {
    check(!/^<\s*(?:img|script|iframe|object|embed)\b/i.test(tag), `${label} emitted an attacker-controlled executable tag: ${tag}`);
    const eventPattern = /\b(on[a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let eventMatch;
    while ((eventMatch = eventPattern.exec(tag)) !== null) {
      const eventName = eventMatch[1].toLowerCase();
      const handler = decodeHtmlEntities(eventMatch[2] || eventMatch[3] || eventMatch[4] || '');
      if (eventName !== 'onclick') {
        failures.push(`${label} emitted unexpected ${eventName}: ${handler}`);
        continue;
      }
      check(!handler.includes(MARKER), `${label} leaked attacker data into inline onclick JavaScript: ${handler}`);
    }
  });
}

const maliciousReason = `<img src=x onerror=globalThis.${MARKER}=1>`;
const maliciousStatus = `待審核</div><script>globalThis.${MARKER}=2</script>`;
const maliciousName = `陳同學');globalThis.${MARKER}=3;//`;
const maliciousClass = `A班');globalThis.${MARKER}=4;//`;
const maliciousKey = `fb');globalThis.${MARKER}=5;//`;
const maliciousTime = `2026/07/11 16:18');globalThis.${MARKER}=6;//`;
check(!html.includes("statusDiv.innerHTML = SVG.hourglass + ' 正在上傳：' + file.name"), 'local upload filenames must not be concatenated into innerHTML');
check(html.includes("document.createTextNode(' 正在上傳：' + file.name + '...')"), 'local upload filenames must be rendered through a text node');
check(
  html.includes('withBr = withBr.replace(/\\[quote(?::([^\\]]+))?\\](.*?)\\[\\/quote\\]/gi') &&
    html.includes('type = type || "留言";'),
  'daily feedback rendering must safely recognize both typed and untyped legacy quote blocks'
);
const stickerFeedback = {
  fbKey: maliciousKey,
  type: '棒卡申請',
  content: JSON.stringify({ reason: maliciousReason, count: 5, status: maliciousStatus }),
  time: maliciousTime,
};
const handlerFeedback = {
  fbKey: maliciousKey,
  type: '棒卡申請',
  content: JSON.stringify({ reason: '待審核測試', count: 5, status: '待審核' }),
  time: maliciousTime,
};

// Student/god sidebar sticker renderer: text must be escaped and handler arguments must be registry IDs, not data strings.
const sidebarSandbox = {
  SVG: { penalty: '−', star: '★' },
  getStickerReviewStatusKind() { return 'pending'; },
  formatStickerCountText(value) { return `${Number(value) || 0}棒`; },
  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  window: {},
};
vm.createContext(sidebarSandbox);
vm.runInContext(extractFunction('renderSidebarStickers'), sidebarSandbox);
let sidebarHtml = '';
try {
  sidebarHtml = sidebarSandbox.renderSidebarStickers([stickerFeedback, handlerFeedback], maliciousName, maliciousClass);
} catch (error) {
  failures.push(`renderSidebarStickers threw on malicious fixture: ${error.message}`);
}
inspectRenderedHtml(sidebarHtml, 'renderSidebarStickers');
check(sidebarHtml.includes('&lt;img'), 'renderSidebarStickers must visibly escape malicious sticker reason');

// Full sticker review list uses a different renderer; execute it against scoped fake Firebase data.
const elements = {
  stickerClassSelect: { value: 'A班' },
  stickerStudentSelect: { value: maliciousName },
  stickerStatusFilter: { value: 'all' },
  stickerReviewList: { innerHTML: '' },
  btnApproveAllStickers: { style: {} },
};
const reviewSandbox = {
  BEAR_SUBJECT: '/science',
  SVG: { penalty: '−', star: '★' },
  safeKey(value) { return String(value || ''); },
  getHomeworkDoneCourseAliasKey() { return ''; },
  getHomeworkDoneRelatedClassKeys() { return ['A班']; },
  getStickerReviewStatusKind() { return 'pending'; },
  formatStickerCountText(value) { return `${Number(value) || 0}棒`; },
  escapeHtml: sidebarSandbox.escapeHtml,
  alert() {},
  window: {},
  document: {
    getElementById(id) { return elements[id] || null; },
  },
  db: {
    ref() {
      return {
        async once() {
          return { val: () => ({ studentA: { name: maliciousName } }) };
        },
      };
    },
  },
  async loadClassNodeMapByKeys() {
    return {
      'A班': {
        studentA: {
          maliciousText: stickerFeedback,
          [maliciousKey]: handlerFeedback,
        },
      },
    };
  },
};
vm.createContext(reviewSandbox);
vm.runInContext(extractFunction('loadStickerReviews'), reviewSandbox);
try {
  Promise.resolve(reviewSandbox.loadStickerReviews()).catch(error => {
    failures.push(`loadStickerReviews rejected malicious fixture: ${error.message}`);
  });
} catch (error) {
  failures.push(`loadStickerReviews threw on malicious fixture: ${error.message}`);
}

// Global feedback/bulletin rich text renderer must preserve text while refusing markup and attribute injection.
const richTextSandbox = {
  SVG: { upload: '↑', clip: '📎' },
  window: { open() {} },
  URL: { createObjectURL() {}, revokeObjectURL() {} },
  document: {},
  fetch() {},
  encodeURIComponent,
  decodeURIComponent,
  renderEbookRichTextFormat(value) { return String(value || ''); },
};
vm.createContext(richTextSandbox);
[
  'decodeBasicHtmlEntities',
  'escapeHtmlAttr',
  'getDriveDownloadUrlForViewer',
  'isOfficeDocumentLink',
  'getOfficePreviewUrl',
  'getOfficeDownloadFileName',
  'renderParsedLink',
  'renderEbookPlainSegment',
  'parseEbookEscapedTextLinks',
  'compactParsedButtonBreaks',
  'parseBtn',
].forEach(name => {
  try {
    vm.runInContext(extractFunction(name), richTextSandbox);
  } catch (error) {
    throw new Error(`could not load rich-text helper ${name}: ${error.message}`);
  }
});
const richTextFixture = `${maliciousReason}\n[安全連結]https://example.com/x" onmouseover="globalThis.${MARKER}=7`;
const richTextHtml = richTextSandbox.parseBtn(richTextFixture);
inspectRenderedHtml(richTextHtml, 'parseBtn');
check(richTextHtml.includes('&lt;img'), 'parseBtn must render malicious HTML as escaped text');

// Sticky bulletin ID is persisted and embedded in an onclick; it must be normalized before insertion.
const stickyContainer = { innerHTML: '' };
const stickySandbox = {
  SVG: { bulb: '💡' },
  BULLETIN_MARQUEE_COLOR_KEYS: ['blue', 'rose', 'amber', 'emerald', 'violet'],
  BULLETIN_POPUP_TONE_KEYS: ['info', 'notice', 'urgent'],
  isDashboardDraftPreviewMode: false,
  document: {
    getElementById(id) { return id === 'sticky-notice-container' ? stickyContainer : null; },
  },
  localStorage: { getItem() { return null; } },
  setTimeout() {},
  renderEbookRichTextFormat(value) { return value; },
  escapeHtml: sidebarSandbox.escapeHtml,
  makeDomSafeId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_'); },
};
vm.createContext(stickySandbox);
[
  'parseBulletinDisplayOptions',
  'normalizeBulletinMarqueeColor',
  'normalizeBulletinPopupTone',
  'getBulletinDisplayChannels',
  'renderStickyNotice',
].forEach(name => vm.runInContext(extractFunction(name), stickySandbox));
try {
  stickySandbox.renderStickyNotice([{
    id: `notice');globalThis.${MARKER}=8;//`,
    time: '2026/07/11 18:00',
    type: '一般',
    title: '安全公告',
    content: '內容',
  }]);
} catch (error) {
  failures.push(`renderStickyNotice threw on malicious fixture: ${error.message}`);
}
inspectRenderedHtml(stickyContainer.innerHTML, 'renderStickyNotice');

// Wait for the async full-review renderer, then inspect all accumulated HTML.
setImmediate(() => {
  inspectRenderedHtml(elements.stickerReviewList.innerHTML, 'loadStickerReviews');
  check(elements.stickerReviewList.innerHTML.includes('&lt;img'), 'loadStickerReviews must visibly escape malicious sticker reason');

  if (failures.length) {
    console.error(`eBook XSS contract failed (${failures.length}):`);
    failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('✓ eBook feedback/sticker XSS fixtures passed');
});
