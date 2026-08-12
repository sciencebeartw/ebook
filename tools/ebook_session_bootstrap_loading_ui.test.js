const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /id="full-loader" class="loader-overlay"[\s\S]*?class="loader-panel"/);
assert.match(html, /id="ebookSessionLoaderLabel">安全連線</);
assert.match(html, /id="ebookSessionLoaderTitle">正在開啟聯絡簿</);
assert.match(html, /id="ebookSessionLoaderText">資料載入中\.\.\.</);
assert.match(html, /\.loader-overlay\.ebook-session-bootstrap\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?min-height:\s*100dvh;[\s\S]*?z-index:\s*2147483000;[\s\S]*?background:\s*linear-gradient/);
assert.match(html, /\.loader-overlay\.ebook-session-bootstrap \.loader-panel\s*\{[\s\S]*?width:\s*min\(520px,\s*100%\);[\s\S]*?border-radius:\s*28px/);
assert.match(html, /font-size:\s*clamp\(26px,\s*5vw,\s*34px\)/);
assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)/);

assert.match(html, /function showEbookSessionBootstrapLoader\(viewLabel\)[\s\S]*?textContent = '正在載入聯絡簿資料，請稍候…'[\s\S]*?classList\.add\('ebook-session-bootstrap'\)[\s\S]*?style\.display = 'flex'/);
assert.match(html, /function resetEbookSessionBootstrapLoader\(\)[\s\S]*?classList\.remove\('ebook-session-bootstrap'\)/);
assert.match(html, /async function enterEbookGodSession\(sessionId\)\s*\{\s*showEbookSessionBootstrapLoader\(''\)/);
assert.match(html, /isStudentPreviewMode\s*=\s*!![\s\S]*?showEbookSessionBootstrapLoader\(isStudentPreviewMode \? '學生視角' : '上帝視角'\)/);
assert.match(html, /function enterStudentView\(result, pass\)\s*\{\s*resetEbookSessionBootstrapLoader\(\);\s*document\.getElementById\('full-loader'\)\.style\.display = 'none'/);

const showLoaderSource = html.slice(
    html.indexOf('function showEbookSessionBootstrapLoader'),
    html.indexOf('function resetEbookSessionBootstrapLoader')
);
assert.doesNotMatch(showLoaderSource, /firebase|\.once\(|\.on\(|httpsCallable|fetch\(/,
    'loading presentation must not add Firebase reads, listeners, callables, or network requests');

console.log('ebook_session_bootstrap_loading_ui tests passed');
