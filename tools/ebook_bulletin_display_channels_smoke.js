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

const context = { BULLETIN_MARQUEE_COLOR_KEYS: ['blue', 'rose', 'amber', 'emerald', 'violet'] };
vm.createContext(context);
[
  'parseBulletinDisplayOptions',
  'normalizeBulletinMarqueeColor',
  'getBulletinDisplayChannels'
].forEach((name) => vm.runInContext(extractFunction(name), context));

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.getBulletinDisplayChannels({ type: '緊急' }))),
  { bulletin: true, popup: true, marquee: false, marqueeColor: 'blue', isExplicit: false },
  'legacy emergency announcements must remain popup announcements'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.getBulletinDisplayChannels({ type: '跑馬燈' }))),
  { bulletin: true, popup: false, marquee: true, marqueeColor: 'blue', isExplicit: false },
  'legacy marquee announcements must remain marquee announcements'
);

const combined = context.getBulletinDisplayChannels({
  type: '緊急',
  displayOptions: '{"version":1,"bulletin":true,"popup":true,"marquee":true,"marqueeColor":"violet"}'
});
assert.strictEqual(combined.bulletin, true);
assert.strictEqual(combined.popup, true);
assert.strictEqual(combined.marquee, true);
assert.strictEqual(combined.marqueeColor, 'violet');

const marqueeOnly = context.getBulletinDisplayChannels({
  type: '一般',
  displayOptions: '{"version":1,"bulletin":false,"popup":false,"marquee":true,"marqueeColor":"amber"}'
});
assert.strictEqual(marqueeOnly.bulletin, false, 'marquee-only bulletins must stay out of the bulletin list');
assert.strictEqual(marqueeOnly.popup, false);
assert.strictEqual(marqueeOnly.marquee, true);

assert.match(html, /find\(function\(b\) \{ return getBulletinDisplayChannels\(b\)\.marquee; \}\)/,
  'explicit marquee selection must outrank the latest-general fallback');
assert.match(html, /getBulletinDisplayChannels\(b\)\.bulletin && b\.type === '一般'/,
  'the latest-general fallback must not turn a popup-only announcement into a marquee');
assert.match(html, /find\(function\(b\) \{ return getBulletinDisplayChannels\(b\)\.popup; \}\)/,
  'popup rendering must use the independent display channel');
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
assert.match(html, /displayOptions:\s*sanitizeDashboardDraftPreviewText\(bulletin\.displayOptions\)/,
  'Dashboard draft preview must preserve the new display options');

console.log('ebook bulletin display channel smoke passed');
