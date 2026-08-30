const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = braceStart; index < html.length; index += 1) {
    const ch = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = { BEAR_SUBJECT: '/math' };
vm.createContext(context);
vm.runInContext(extractFunction('getTeacherInfo'), context);

for (const className of ['115資優數學', '115小六資優數學', '115小六資優數學班']) {
  assert.deepEqual(JSON.parse(JSON.stringify(context.getTeacherInfo(className))), { name: '東', fullName: '小東老師' });
}
for (const className of ['115國一數學超前班', '115國二數學超前班', '115數學超前']) {
  assert.deepEqual(JSON.parse(JSON.stringify(context.getTeacherInfo(className))), { name: '翔', fullName: '李翔老師' });
}
assert.deepEqual(JSON.parse(JSON.stringify(context.getTeacherInfo('115國一進度數學'))), { name: '數學', fullName: '數學老師' });
console.log('eBook math teacher mapping smoke passed');
