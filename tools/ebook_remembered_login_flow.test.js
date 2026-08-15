#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extractBalancedBlock(marker) {
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Missing marker: ${marker}`);
  const braceStart = html.indexOf('{', start + marker.length);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
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
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Unterminated marker: ${marker}`);
}

async function runLoginChoice(rememberDevice) {
  const persistenceCalls = [];
  const loginPayloads = [];
  let successValue = null;
  const context = {
    console,
    firebase: { auth: { Auth: { Persistence: { LOCAL: 'LOCAL', NONE: 'NONE' } } } },
    BEAR_SUBJECT: '/science',
    ebookFunctions: {
      httpsCallable(name) {
        assert.equal(name, 'createEbookStudentSession');
        return async payload => {
          loginPayloads.push(payload);
          return { data: {
            firebaseCustomToken: 'token',
            className: '115測試班',
            studentName: '測試生',
            studentKey: 'student_key',
            rememberDevice,
          } };
        };
      },
    },
    ebookAuth: {
      async setPersistence(value) { persistenceCalls.push(value); },
      async signInWithCustomToken(token) { assert.equal(token, 'token'); },
    },
    executeFirebaseRead: async () => ({ found: true }),
    loadEbookPendingTaskPolicy: async () => ({ status: 'ready' }),
    ebookAuthSessionInfo: null,
    onSuccess(value) { successValue = value; },
    onErr(error) { throw error; },
  };
  vm.createContext(context);
  const studentMethod = extractBalancedBlock('getStudentData: async function');
  vm.runInContext(`var studentApi = { ${studentMethod} };`, context);
  const api = context.studentApi;
  await api.getStudentData('測試生', 'not-stored-secret', rememberDevice);
  assert.equal(loginPayloads.length, 1);
  assert.equal(loginPayloads[0].rememberDevice, rememberDevice);
  assert.equal(Object.hasOwn(loginPayloads[0], 'deviceToken'), false);
  assert.deepEqual(persistenceCalls, [rememberDevice ? 'LOCAL' : 'NONE']);
  assert.equal(successValue.found, true);
}

(async () => {
  await runLoginChoice(true);
  await runLoginChoice(false);
  console.log('ebook remembered-login flow tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
