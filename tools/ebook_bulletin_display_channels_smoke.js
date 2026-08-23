const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing function ${name}`);
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < html.length; i += 1) {
    if (html[i] === '{') depth += 1;
    if (html[i] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

const context = {
  BULLETIN_MARQUEE_COLOR_KEYS: ['blue', 'rose', 'amber', 'emerald', 'violet'],
  BULLETIN_POPUP_TONE_KEYS: ['info', 'notice', 'urgent'],
  isBulletinInsidePromotionWindow() { return true; },
  isBulletinEffective() { return true; },
};
vm.createContext(context);
[
  'parseBulletinDisplayOptions',
  'normalizeBulletinMarqueeColor',
  'normalizeBulletinPopupTone',
  'getBulletinDisplayChannels',
  'buildEbookBulletinList',
].forEach((name) => vm.runInContext(extractFunction(name), context));

const studentSessionBulletins = context.buildEbookBulletinList({
  row_1: {
    id: 'bulletin-a',
    title: '接送時間',
    displayOptions: '{"version":2,"popup":true,"popupTone":"notice","marquee":true,"marqueeColor":"amber"}',
  },
}, { classKey: '115-class', className: '115小六資優自然週六上午班' });
assert.equal(studentSessionBulletins.length, 1);
assert.equal(studentSessionBulletins[0].displayOptions.includes('"marqueeColor":"amber"'), true,
  'student, teacher and god-session data normalization must preserve display options');

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.getBulletinDisplayChannels({ type: '緊急' }))),
  { bulletin: true, popup: true, popupTone: 'urgent', showDate: true, showPopupExpiry: true, popupDismissMode: 'dismissible', popupDismissibleAfter: '', marquee: false, marqueeColor: 'blue', isExplicit: false },
  'legacy emergency announcements must remain popup announcements'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.getBulletinDisplayChannels({ type: '跑馬燈' }))),
  { bulletin: true, popup: false, popupTone: 'info', showDate: true, showPopupExpiry: true, popupDismissMode: 'dismissible', popupDismissibleAfter: '', marquee: true, marqueeColor: 'blue', isExplicit: false },
  'legacy marquee announcements must remain marquee announcements'
);

const combined = context.getBulletinDisplayChannels({
  type: '緊急',
  displayOptions: '{"version":1,"bulletin":true,"popup":true,"marquee":true,"marqueeColor":"violet"}'
});
assert.strictEqual(combined.bulletin, true);
assert.strictEqual(combined.popup, true);
assert.strictEqual(combined.popupTone, 'urgent', 'v1 popup must keep the old red behavior');
assert.strictEqual(combined.marquee, true);
assert.strictEqual(combined.marqueeColor, 'violet');

const marqueeOnly = context.getBulletinDisplayChannels({
  type: '一般',
  displayOptions: '{"version":1,"bulletin":false,"popup":false,"marquee":true,"marqueeColor":"amber"}'
});
assert.strictEqual(marqueeOnly.bulletin, false, 'marquee-only bulletins must stay out of the bulletin list');
assert.strictEqual(marqueeOnly.popup, false);
assert.strictEqual(marqueeOnly.marquee, true);

const normalPopup = context.getBulletinDisplayChannels({
  type: '一般',
  displayOptions: '{"version":2,"bulletin":true,"popup":true,"popupTone":"notice","showDate":false,"marquee":false,"marqueeColor":"blue"}'
});
assert.strictEqual(normalPopup.popupTone, 'notice', 'v2 normal popup tone must survive parsing');
assert.strictEqual(normalPopup.showDate, false, 'v2 announcement date visibility must survive parsing');
assert.strictEqual(normalPopup.showPopupExpiry, true, 'older display options must keep popup expiry text visible');
assert.strictEqual(normalPopup.popupDismissMode, 'dismissible', 'older routine popups must remain immediately dismissible');
const forcedRoutinePopup = context.getBulletinDisplayChannels({
  type: '一般',
  displayOptions: '{"version":4,"popup":true,"popupTone":"notice","showDate":true,"showPopupExpiry":false,"popupDismissMode":"required-until","popupDismissibleAfter":"2026-08-30 12:00"}'
});
assert.strictEqual(forcedRoutinePopup.showDate, true, 'card date must remain independent from popup metadata');
assert.strictEqual(forcedRoutinePopup.showPopupExpiry, false, 'popup expiry visibility must remain independent from card date');
assert.strictEqual(forcedRoutinePopup.popupDismissMode, 'required-until');
assert.strictEqual(forcedRoutinePopup.popupDismissibleAfter, '2026-08-30 12:00');
assert.match(html, /bulletinDisplay\.showDate[\s\S]{0,180}bulletin-date/,
  'bulletin cards must render the date only when enabled');

assert.match(html, /find\(function\(b\) \{ return getBulletinDisplayChannels\(b\)\.marquee; \}\)/,
  'explicit marquee selection must outrank the latest-general fallback');
assert.match(html, /getBulletinDisplayChannels\(b\)\.bulletin && b\.type === '一般'/,
  'the latest-general fallback must not turn a popup-only announcement into a marquee');
assert.match(html, /getBulletinDisplayChannels\(b\)\.popup && !isPopupDismissedOnThisDevice\(b\)/,
  'popup rendering must use the independent display channel');
assert.match(html, /aUrgent !== bUrgent[\s\S]{0,120}bUrgent - aUrgent/,
  'red popups must be queued before dismissible normal popups');
assert.match(html, /popupAnnouncementQueue\.push\(candidate\)/,
  'all active popup announcements must be queued instead of dropping older ones');
assert.match(html, /activeList\.filter\(function\(b\) \{[\s\S]{0,120}getBulletinDisplayChannels\(b\)\.bulletin/,
  'the bulletin area must exclude marquee-only announcements');
assert.match(html, /stickyChannels\.bulletin \? ' onclick="switchTab\(2\)"' : ''/,
  'a marquee-only banner must not navigate to an empty bulletin area');
['rose', 'amber', 'emerald', 'violet'].forEach((color) => {
  assert.match(html, new RegExp(`\\.sticky-notice-banner\\.marquee-color-${color}`), `missing ${color} marquee palette`);
});
assert.match(html, /sticky_v2_/, 'edited color or content versions must be able to reappear after an older banner was dismissed');
assert.match(html, /!stickyChannels\.isExplicit[\s\S]*legacyStickyId/,
  'legacy dismissed announcements must not unexpectedly reappear after deployment');
assert.match(html, /displayOptions:\s*bulletin\.displayOptions && typeof bulletin\.displayOptions === 'object'/,
  'Dashboard draft preview must preserve the new display options');
assert.match(html, /expiresAt: b\.expiresAt \|\| "",\s*displayOptions: b\.displayOptions \|\| null/,
  'student and god-session bulletin reads must preserve persisted display options');
assert.match(html, /if \(expiryNotice\) expiryNotice\.hidden = !showPopupExpiry/,
  'popup expiry visibility must hide the complete metadata block with its independent option');
assert.match(html, /function isPopupDismissibleNow\(/,
  'student, teacher and god-session popup rendering must share the mandatory-until rule');

console.log('ebook bulletin display channel smoke passed');
