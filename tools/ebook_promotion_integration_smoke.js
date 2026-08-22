#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function between(start, end) {
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return html.slice(startIndex, endIndex);
}

assert.match(
  html,
  /ebook_lifecycle_app\.js[^\n]+<\/script>[\s\S]*ebook_promotion_app\.js\?v=20260812_legacy_transfer_student_key/,
  'promotion helper must load after the lifecycle helper and before the main inline runtime'
);
assert.match(html, /session\.promotionContext \|\| null/, 'promotion context must come from the verified Functions session');
assert.match(
  between('async function renewEbookGodSession', 'function startEbookGodSessionHeartbeat'),
  /previousAllowedClassKeys[\s\S]*ebookGodSessionInfo\.allowedClassKeys === undefined[\s\S]*ebookGodSessionInfo\.allowedClassKeys = previousAllowedClassKeys/,
  'god-session heartbeat renewal must retain the verified former-class authorization scope'
);
assert.doesNotMatch(
  between('function normalizeSessionPromotionContext', 'function getActivePromotionLineageKey'),
  /admin_workspace|class_promotions|db\.ref/,
  'the student app must never read the admin promotion registry directly'
);
assert.match(
  between('async function loadStudentLifecycleIndexes', 'function getStudentEnrollmentDateKey'),
  /buildPriorityLifecycleChain\([\s\S]*transferIndex[\s\S]*promotionContext/,
  'explicit transfer records and verified promotion edges must share one prioritized lifecycle chain'
);
const lifecycleLoadBlock = between('async function loadStudentLifecycleIndexes', 'function getStudentEnrollmentDateKey');
assert.match(
  lifecycleLoadBlock,
  /getVerifiedLifecycleIndexReadScopes\([\s\S]*promotionContext[\s\S]*currentClassKey[\s\S]*studentKey/,
  'transfer index reads must be derived from the exact signed lifecycle destinations'
);
assert.match(
  lifecycleLoadBlock,
  /matchesVerifiedLifecycleTransition\([\s\S]*promotionContext[\s\S]*destinationClassKey[\s\S]*destinationStudentKey/,
  'public index rows must match a signed transition before they can enter the runtime chain'
);
assert.doesNotMatch(
  lifecycleLoadBlock,
  /queue\.push\([\s\S]{0,160}item\.fromClassKey/,
  'a public materialized edge must never expand the RTDB read scope to an unsigned source branch'
);
assert.match(
  between('async function loadStudentLifecycleIndexes', 'function getStudentEnrollmentDateKey'),
  /getTrackedGradeDataClassKeys\(currentClassKey, chainResult\)/,
  'grade reads must follow data storage lineage rather than logical display classes'
);
assert.match(
  between('function buildGradeListFromExams', 'function buildGradeListFromClassExamMap'),
  /sourceClassKey: presentation\.sourceClassKey[\s\S]*storedClassKey: presentation\.storedClassKey/,
  'grade view models must preserve logical source and physical storage class separately'
);
assert.match(
  between('// Fetch Bulletins', '// Fetch Feedbacks'),
  /getFormerBulletinScopes[\s\S]*\.once\('value'\)[\s\S]*currentBulletins[\s\S]*historicalBulletins/,
  'former bulletins must use bounded one-time class reads and remain separate from current bulletins'
);

const bulletinRealtimeBlock = between('// 3. 重要公告監聽', '// 4. 成績資料監聽');
const bulletinListeners = bulletinRealtimeBlock.match(/watchRealtimeValue\(BEAR_SUBJECT \+ '\/bulletins\/'/g) || [];
assert.strictEqual(bulletinListeners.length, 2, 'only current-class and global bulletins may have realtime listeners');
assert.doesNotMatch(bulletinRealtimeBlock, /formerBulletinScopes|historicalBulletins\s*=/, 'former bulletin history must not gain a realtime listener');
assert.match(bulletinRealtimeBlock, /renderBulletins\(gData\.currentBulletins, gData\.historicalBulletins \|\| \[\]\)/);

const renderSource = between('function renderBulletins(list, historicalList)', 'function updateBulletinTabs');
const calls = { tabs: null, sticky: null, emergency: null };
const container = { innerHTML: '' };
const sandbox = {
  isDashboardDraftPreviewMode: false,
  isBulletinEffective: () => true,
  getBulletinDisplayChannels(bulletin) {
    const options = bulletin && bulletin.displayOptions ? bulletin.displayOptions : {};
    return { bulletin: options.bulletin !== false };
  },
  escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  parseBtn(value) { return sandbox.escapeHtml(value || ''); },
  renderParsedLink(label) { return `<a>${label}</a>`; },
  updateBulletinTabs(list) { calls.tabs = list.slice(); },
  renderStickyNotice(list) { calls.sticky = list.slice(); },
  checkEmergency(list) { calls.emergency = list.slice(); },
  document: {
    getElementById(id) { return id === 'tab-content-2' ? container : null; },
    querySelectorAll() { return []; },
  },
  IntersectionObserver: function() { this.observe = function() {}; },
  console,
};
vm.createContext(sandbox);
vm.runInContext(`${renderSource}; this.renderBulletins = renderBulletins;`, sandbox, { filename: 'renderBulletins.js' });

sandbox.renderBulletins([
  { id: 'current', time: '2026/08/11 10:00', type: '一般', title: '目前公告', content: '目前內容' },
  { id: 'marquee-only', time: '2026/08/12 10:00', type: '一般', title: '純跑馬燈', content: '只在頂端顯示', displayOptions: { bulletin: false } },
], [
  {
    id: 'former',
    time: '2026/06/01 10:00',
    type: '緊急',
    title: '舊公告',
    content: '<script>globalThis.pwned=true</script>',
    sourceClassName: '<img src=x onerror=alert(1)>',
    isHistoricalPromotionBulletin: true,
  },
]);

assert.deepStrictEqual(calls.tabs.map(item => item.id), ['current']);
assert.deepStrictEqual(calls.sticky.map(item => item.id), ['marquee-only', 'current']);
assert.deepStrictEqual(calls.emergency.map(item => item.id), ['marquee-only', 'current']);
assert.doesNotMatch(container.innerHTML, /純跑馬燈/, 'marquee-only announcements must not render as bulletin cards');
assert.match(container.innerHTML, /過往班級公告/);
assert.match(container.innerHTML, /過往班級 · &lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(container.innerHTML, /<script>|<img src=x/);
const formerCard = container.innerHTML.slice(container.innerHTML.indexOf('is-promotion-history'));
assert.doesNotMatch(formerCard, /type-emergency/, 'former emergency bulletins must render as quiet history cards');
assert.match(html, /\.bulletin-card\.is-promotion-history \.bulletin-header > div:first-child[\s\S]*min-width:\s*0[\s\S]*overflow-wrap:\s*anywhere/,
  'historical bulletin labels must shrink and wrap instead of causing mobile horizontal overflow');
assert.match(html, /@media \(max-width: 600px\)[\s\S]*\.bulletin-card\.is-promotion-history \.bulletin-header[\s\S]*flex-wrap:\s*wrap/,
  'historical bulletin headers need an explicit narrow-screen wrapping contract');

const forbiddenRootReads = [
  /db\.ref\(`?\$\{BEAR_SUBJECT\}\/bulletins`?\)\.once/,
  /db\.ref\(BEAR_SUBJECT \+ '\/bulletins'\)\.once/,
  /db\.ref\(`?\$\{BEAR_SUBJECT\}\/grades`?\)\.once/,
  /db\.ref\(`?\$\{BEAR_SUBJECT\}\/dailyPosts`?\)\.once/,
];
forbiddenRootReads.forEach(pattern => assert.doesNotMatch(html, pattern, `forbidden unscoped promotion read: ${pattern}`));

console.log('ebook promotion integration smoke passed');
